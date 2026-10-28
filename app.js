/* Jungle Jam Player
 * Reads the shared "Jungle Jam and Friends" folder from Google Drive and plays it.
 * No build step, no server: works on GitHub Pages as plain files.
 */
(() => {
  "use strict";

  const CFG = window.JJ_CONFIG || {};
  const API = "https://www.googleapis.com/drive/v3/files";
  const FOLDER = "application/vnd.google-apps.folder";
  const LIST_TTL = 1000 * 60 * 60 * 24 * 7; // folder listings are cached for a week

  const $ = (id) => document.getElementById(id);
  const view = $("view");
  const audio = $("audio");
  const video = $("video");

  // ───────────────────────── storage (never throws) ─────────────────────────
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem("jj:" + key); return v == null ? fallback : JSON.parse(v); }
      catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem("jj:" + key, JSON.stringify(value)); } catch { /* full or blocked */ }
    },
    clearLists() {
      try {
        Object.keys(localStorage).filter((k) => k.startsWith("jj:list:")).forEach((k) => localStorage.removeItem(k));
      } catch { /* ignore */ }
    },
  };

  // ───────────────────────── names & sorting ─────────────────────────
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
  const byName = (a, b) => collator.compare(a.name, b.name);

  // "Y01c_A Little Night Monkey, part 1.flac" -> "A Little Night Monkey, part 1"
  // "3_A Little Night Monkey, part 1.mp3"     -> "A Little Night Monkey, part 1"
  function cleanName(name) {
    return name
      .replace(/\.[a-z0-9]{2,5}$/i, "")
      .replace(/^Y\d+[a-z]?[_\s-]+/i, "")
      .replace(/^\d+[_.\s-]+/, "")
      .replace(/_/g, " ")
      .trim();
  }
  const isPromo = (f) => /promo/i.test(f.name);
  const isMedia = (f) => /^(audio|video)\//.test(f.mimeType || "");
  const isVideo = (f) => /^video\//.test(f.mimeType || "");
  // Safari can't play FLAC reliably; only use it if nothing else exists.
  const isLossless = (f) => /flac|wav|aiff/i.test(f.mimeType || "") || /\.(flac|wav|aiff?)$/i.test(f.name);

  // ───────────────────────── Google Drive ─────────────────────────
  const mediaUrl = (id) => `${API}/${encodeURIComponent(id)}?alt=media&key=${encodeURIComponent(CFG.apiKey)}`;

  async function listFolder(id, { fresh = false } = {}) {
    const cacheKey = "list:" + id;
    const cached = store.get(cacheKey);
    if (!fresh && cached && Date.now() - cached.t < LIST_TTL) return cached.files;

    const files = [];
    let pageToken = "";
    do {
      const params = new URLSearchParams({
        q: `'${id}' in parents and trashed = false`,
        fields: "nextPageToken, files(id, name, mimeType, size)",
        pageSize: "1000",
        key: CFG.apiKey,
      });
      if (pageToken) params.set("pageToken", pageToken);
      const res = await fetch(`${API}?${params}`);
      if (!res.ok) {
        let detail = "";
        try { detail = (await res.json()).error.message; } catch { /* ignore */ }
        const err = new Error(detail || `Google Drive said ${res.status}`);
        err.status = res.status;
        throw err;
      }
      const data = await res.json();
      files.push(...(data.files || []));
      pageToken = data.nextPageToken || "";
    } while (pageToken);

    files.sort(byName);
    store.set(cacheKey, { t: Date.now(), files });
    return files;
  }

  // Shelf (e.g. "Jungle Jam Radio Episodes"): sub-folders are episodes,
  // loose audio/video files become one-part episodes of their own.
  async function loadShelf(shelfId) {
    const children = await listFolder(shelfId);
    const items = [];
    for (const c of children) {
      if (c.mimeType === FOLDER) items.push({ id: c.id, name: c.name, kind: "folder" });
      else if (isMedia(c)) items.push({ id: c.id, name: cleanName(c.name), kind: "file", file: c });
    }
    // Hide FLAC/WAV duplicates when the same title exists in a lighter format.
    const seen = new Set(items.filter((i) => i.kind === "file" && !isLossless(i.file)).map((i) => i.name.toLowerCase()));
    return items.filter((i) => !(i.kind === "file" && isLossless(i.file) && seen.has(i.name.toLowerCase()))).sort(byName);
  }

  // Episode folder: prefer an "MP3" sub-folder, then "M4A", then whatever is loose in the folder.
  async function loadTracks(item) {
    if (item.kind === "file") return [item.file];
    const children = await listFolder(item.id);
    const sub = (re) => children.find((c) => c.mimeType === FOLDER && re.test(c.name));
    let pool = children.filter(isMedia);
    for (const re of [/^mp3$/i, /^m4a$/i, /^(aac|audio|video|mp4)$/i]) {
      const folder = sub(re);
      if (folder) {
        const files = (await listFolder(folder.id)).filter(isMedia);
        if (files.length) { pool = files; break; }
      }
    }
    // Fall back to any other sub-folder with media in it.
    if (!pool.length) {
      for (const f of children.filter((c) => c.mimeType === FOLDER)) {
        const files = (await listFolder(f.id)).filter(isMedia);
        if (files.length) { pool = files; break; }
      }
    }
    const playable = pool.filter((f) => !isLossless(f));
    return (playable.length ? playable : pool).sort(byName);
  }

  // ───────────────────────── progress ─────────────────────────
  const progress = store.get("progress", {}); // fileId -> { t, d }
  const episodes = store.get("episodes", {}); // episodeId -> { name, shelf, track, at }
  const favorites = new Set(store.get("favorites", []));
  const saveProgress = () => store.set("progress", progress);

  function fileDone(id) { const p = progress[id]; return p && p.d && p.t / p.d > 0.92; }
  function fileStarted(id) { const p = progress[id]; return p && p.t > 10 && !fileDone(id); }

  // ───────────────────────── player state ─────────────────────────
  const state = {
    queue: [],       // tracks of the current episode
    index: -1,
    episode: null,   // { id, name, shelf, kind }
    sleep: null,     // { mode: "time", until } | { mode: "episode" }
  };
  let el = audio;    // active media element
  let saveTick = 0;

  function currentTrack() { return state.queue[state.index]; }

  async function playEpisode(item, shelfId, startIndex) {
    $("player").hidden = false;
    setNow(item.name, "Loading…");
    let tracks;
    try { tracks = await loadTracks(item); }
    catch (e) { return showError(e); }
    if (!tracks.length) return toast("No playable files in this folder.");

    let i = startIndex;
    if (i == null) {
      const saved = episodes[item.id];
      if (saved && saved.track && tracks.some((t) => t.id === saved.track) && !fileDone(saved.track)) {
        i = tracks.findIndex((t) => t.id === saved.track);
      } else {
        i = tracks.findIndex((t) => !(CFG.skipPromos && isPromo(t)));
        if (i < 0) i = 0;
      }
    }
    state.queue = tracks;
    state.episode = { id: item.id, name: item.name, shelf: shelfId, kind: item.kind };
    playIndex(i);
    render();
  }

  function playIndex(i) {
    const track = state.queue[i];
    if (!track) return;
    state.index = i;

    const next = isVideo(track) ? video : audio;
    if (el !== next) { el.pause(); el.removeAttribute("src"); el.load(); }
    el = next;
    $("stage").hidden = el !== video;

    el.src = mediaUrl(track.id);
    const p = progress[track.id];
    const resumeAt = p && p.t > 10 && (!p.d || p.t < p.d - 15) ? p.t : 0;
    const onMeta = () => { if (resumeAt) el.currentTime = resumeAt; el.removeEventListener("loadedmetadata", onMeta); };
    el.addEventListener("loadedmetadata", onMeta);
    el.play().catch(() => { /* iOS may need a tap; play button handles it */ });

    episodes[state.episode.id] = {
      name: state.episode.name, shelf: state.episode.shelf, kind: state.episode.kind,
      track: track.id, at: Date.now(),
    };
    store.set("episodes", episodes);

    setNow(state.episode.name, partLabel());
    updateMediaSession();
  }

  function partLabel() {
    const t = currentTrack();
    if (!t) return "";
    const parts = state.queue.length;
    const name = cleanName(t.name);
    return parts > 1 ? `${name} · ${state.index + 1} of ${parts}` : name;
  }

  function nextTrack() {
    if (state.index < state.queue.length - 1) playIndex(state.index + 1);
    else {
      // episode finished
      el.pause();
      if (state.sleep && state.sleep.mode === "episode") setSleep("off");
      updatePlayButton();
    }
  }

  function setNow(title, sub) { $("nowTitle").textContent = title; $("nowSub").textContent = sub || ""; }

  // ───────────────────────── media events ─────────────────────────
  for (const m of [audio, video]) {
    m.addEventListener("play", () => { if (m === el) updatePlayButton(); });
    m.addEventListener("pause", () => { if (m === el) { updatePlayButton(); savePosition(); } });
    m.addEventListener("ended", () => {
      if (m !== el) return;
      const t = currentTrack();
      if (t) { progress[t.id] = { t: m.duration || 0, d: m.duration || 0 }; saveProgress(); }
      nextTrack();
      render(true);
    });
    m.addEventListener("timeupdate", () => {
      if (m !== el) return;
      if (m.duration) $("seek").value = Math.round((m.currentTime / m.duration) * 1000);
      if (++saveTick % 20 === 0) savePosition();
      checkSleep();
    });
    m.addEventListener("error", () => {
      if (m !== el || !m.getAttribute("src")) return;
      toast("Couldn't play this file. Check that the Drive folder is shared “Anyone with the link”.");
      updatePlayButton();
    });
  }

  function savePosition() {
    const t = currentTrack();
    if (!t || !el.duration) return;
    progress[t.id] = { t: Math.floor(el.currentTime), d: Math.floor(el.duration) };
    saveProgress();
  }

  function updatePlayButton() {
    const playing = !el.paused && !el.ended;
    $("playPause").classList.toggle("playing", playing);
    $("playPause").setAttribute("aria-label", playing ? "Pause" : "Play");
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = playing ? "playing" : "paused";
  }

  function updateMediaSession() {
    if (!("mediaSession" in navigator)) return;
    const icon = new URL("icons/icon-512.png", location.href).href;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: state.episode.name,
      artist: partLabel(),
      album: CFG.title || "Jungle Jam & Friends",
      artwork: [{ src: icon, sizes: "512x512", type: "image/png" }],
    });
    const ms = navigator.mediaSession;
    const safe = (action, fn) => { try { ms.setActionHandler(action, fn); } catch { /* unsupported */ } };
    safe("play", () => el.play());
    safe("pause", () => el.pause());
    safe("seekbackward", () => { el.currentTime = Math.max(0, el.currentTime - 15); });
    safe("seekforward", () => { el.currentTime = Math.min(el.duration || 0, el.currentTime + 30); });
    safe("previoustrack", () => { if (state.index > 0) playIndex(state.index - 1); });
    safe("nexttrack", () => nextTrack());
  }

  // ───────────────────────── sleep timer ─────────────────────────
  function setSleep(value) {
    if (value === "off" || !value) state.sleep = null;
    else if (value === "episode") state.sleep = { mode: "episode" };
    else state.sleep = { mode: "time", until: Date.now() + Number(value) * 60000 };
    el.volume = 1;
    renderSleep();
  }
  function renderSleep() {
    const label = $("sleepLabel");
    const btn = $("sleep");
    btn.classList.toggle("on", !!state.sleep);
    if (!state.sleep) label.textContent = "";
    else if (state.sleep.mode === "episode") label.textContent = "end";
    else label.textContent = Math.max(1, Math.ceil((state.sleep.until - Date.now()) / 60000)) + "m";
  }
  function checkSleep() {
    if (!state.sleep || state.sleep.mode !== "time") return;
    const left = state.sleep.until - Date.now();
    if (left <= 0) { el.pause(); setSleep("off"); return; }
    if (left < 10000) el.volume = Math.max(0.05, left / 10000); // gentle fade
    renderSleep();
  }

  // ───────────────────────── controls ─────────────────────────
  $("playPause").addEventListener("click", () => {
    if (!currentTrack()) return;
    if (el.paused) el.play().catch((e) => toast("Tap play again — " + e.message));
    else el.pause();
  });
  $("back15").addEventListener("click", () => { el.currentTime = Math.max(0, el.currentTime - 15); });
  $("next").addEventListener("click", () => nextTrack());
  $("seek").addEventListener("input", (e) => {
    if (el.duration) el.currentTime = (e.target.value / 1000) * el.duration;
  });
  $("now").addEventListener("click", () => {
    if (state.episode) go(`#/e/${state.episode.shelf}/${state.episode.id}`);
  });
  $("sleep").addEventListener("click", () => $("sleepDialog").showModal());
  $("sleepDialog").addEventListener("close", () => {
    const v = $("sleepDialog").returnValue;
    if (v) setSleep(v);
  });
  $("back").addEventListener("click", () => history.length > 1 ? history.back() : go("#/"));
  $("refresh").addEventListener("click", () => {
    store.clearLists();
    shelfCache.clear();
    render();
    toast("Episode list refreshed");
  });

  // ───────────────────────── views ─────────────────────────
  const shelfCache = new Map();
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const go = (hash) => { if (location.hash !== hash) location.hash = hash; else render(); };

  // A friendly color for each title, from a small jungle palette.
  const PALETTE = ["#f5c542", "#ff8a5c", "#7bd389", "#5cc8ff", "#c79bff", "#ff6f91", "#ffd166", "#4fd1c5"];
  function hue(name) {
    let h = 0;
    for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return PALETTE[h % PALETTE.length];
  }
  function initials(name) {
    const words = name.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter((w) => w && !/^(the|a|an|and|of|part|\d+)$/i.test(w));
    return (words[0] || name)[0].toUpperCase() + ((words[1] || "")[0] || "").toUpperCase();
  }

  function episodeState(id) {
    const e = episodes[id];
    if (!e) return "";
    if (e.track && fileStarted(e.track)) return "started";
    return "played";
  }

  async function renderHome() {
    setHeader(CFG.title || "Jungle Jam & Friends", false);
    view.innerHTML = `<div class="loading">Loading shelves…</div>`;
    const folders = (await listFolder(CFG.rootFolderId)).filter((f) => f.mimeType === FOLDER);

    const recent = Object.entries(episodes)
      .sort((a, b) => b[1].at - a[1].at)
      .slice(0, 6);

    const favs = [];
    for (const [id, e] of Object.entries(episodes)) if (favorites.has(id)) favs.push([id, e]);

    let html = "";
    if (recent.length) {
      html += `<section><h2 class="shelf-title">Keep listening</h2><div class="rail">`;
      html += recent.map(([id, e]) => railCard(id, e)).join("");
      html += `</div></section>`;
    }
    if (favs.length) {
      html += `<section><h2 class="shelf-title">★ Favorites</h2><div class="rail">`;
      html += favs.map(([id, e]) => railCard(id, e)).join("");
      html += `</div></section>`;
    }
    html += `<section><h2 class="shelf-title">Shelves</h2><div class="shelves">`;
    html += folders.map((f) => `
      <a class="shelf" href="#/s/${f.id}" style="--c:${hue(f.name)}">
        <span class="shelf-art">${JJArt.art(f.name, { shelf: true })}</span>
        <span class="shelf-name">${esc(f.name)}</span>
        <svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>
      </a>`).join("");
    html += `</div></section>`;
    view.innerHTML = html;
  }

  function railCard(id, e) {
    const s = episodeState(id);
    return `
      <a class="rail-card" href="#/e/${e.shelf}/${id}" style="--c:${hue(e.name)}">
        <span class="art">${JJArt.art(e.name)}</span>
        <span class="rail-name">${esc(e.name)}</span>
        ${s === "started" ? `<span class="badge">Resume</span>` : ""}
      </a>`;
  }

  async function getShelf(shelfId) {
    if (!shelfCache.has(shelfId)) shelfCache.set(shelfId, await loadShelf(shelfId));
    return shelfCache.get(shelfId);
  }

  async function shelfName(shelfId) {
    const root = await listFolder(CFG.rootFolderId);
    const f = root.find((x) => x.id === shelfId);
    return f ? f.name : "Episodes";
  }

  let searchTerm = "";
  async function renderShelf(shelfId) {
    setHeader(await shelfName(shelfId), true);
    view.innerHTML = `<div class="loading">Loading episodes…</div>`;
    const items = await getShelf(shelfId);
    view.innerHTML = `
      <div class="search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>
        <input id="q" type="search" placeholder="Find an episode" value="${esc(searchTerm)}" autocomplete="off">
      </div>
      <div id="grid"></div>
      <p class="count" id="count"></p>`;

    // Group by season when this shelf's folders match the episode list (the radio shelf does).
    const tagged = items.map((i) => {
      const info = findInfo(i.name);
      const nums = info.map((e) => e.n).filter((n) => n > 0);
      const n = nums.length ? Math.min(...nums) : (info.length ? 1000 : null); // specials sort after
      return { item: i, n, season: n == null ? null : seasonOf(n) };
    });
    const bySeason = tagged.filter((t) => t.n != null).length >= items.length / 2;
    tagged.sort((a, b) => bySeason
      ? ((a.n ?? 9999) - (b.n ?? 9999)) || byName(a.item, b.item)
      : byName(a.item, b.item));

    const draw = () => {
      const q = searchTerm.trim().toLowerCase();
      const shown = tagged.filter((t) => !q || t.item.name.toLowerCase().includes(q));
      let html = "";
      if (!shown.length) html = `<p class="empty">No episodes match “${esc(searchTerm)}”.</p>`;
      else if (!bySeason) html = `<div class="grid">${shown.map((t) => episodeCard(t.item, shelfId)).join("")}</div>`;
      else {
        const groups = new Map();
        for (const t of shown) {
          const key = t.season || "More";
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(t);
        }
        for (const [key, list] of groups) {
          html += `<section class="season">
            <h2 class="season-title">${esc(typeof key === "number" ? `Season ${key}` : key)}
              <span>${list.length} ${list.length === 1 ? "folder" : "folders"}</span></h2>
            <div class="grid">${list.map((t) => episodeCard(t.item, shelfId)).join("")}</div>
          </section>`;
        }
      }
      $("grid").innerHTML = html;
      $("count").textContent = `${shown.length} of ${items.length}`;
    };
    $("q").addEventListener("input", (e) => { searchTerm = e.target.value; draw(); });
    draw();
  }

  function episodeCard(item, shelfId) {
    const s = episodeState(item.id);
    const isNow = state.episode && state.episode.id === item.id;
    return `
      <div class="card ${isNow ? "now-playing" : ""}" style="--c:${hue(item.name)}">
        <div class="art-wrap">
          <a href="#/e/${shelfId}/${item.id}" tabindex="-1" aria-hidden="true">
            <span class="art">${JJArt.art(item.name)}</span>
          </a>
          ${s === "started" ? `<span class="badge">Resume</span>` : s === "played" ? `<span class="badge quiet">Played</span>` : ""}
          ${favorites.has(item.id) ? `<span class="star" aria-label="Favorite">★</span>` : ""}
          <button class="card-play" data-play="${item.id}" aria-label="Play ${esc(item.name)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
          </button>
        </div>
        <a class="card-name" href="#/e/${shelfId}/${item.id}">${esc(item.name)}</a>
      </div>`;
  }

  async function renderEpisode(shelfId, episodeId) {
    const items = await getShelf(shelfId);
    const item = items.find((i) => i.id === episodeId) ||
      (episodes[episodeId] && { id: episodeId, name: episodes[episodeId].name, kind: episodes[episodeId].kind || "folder" });
    if (!item) { go(`#/s/${shelfId}`); return; }
    setHeader(await shelfName(shelfId), true);
    view.innerHTML = `<div class="loading">Loading…</div>`;
    const tracks = await loadTracks(item);
    const isNow = state.episode && state.episode.id === item.id;
    const fav = favorites.has(item.id);
    const resumable = episodes[item.id] && fileStarted(episodes[item.id].track);

    view.innerHTML = `
      <div class="hero" style="--c:${hue(item.name)}">
        <span class="hero-art">${JJArt.art(item.name)}</span>
        <h2>${esc(item.name)}</h2>
        <div class="hero-actions">
          <button class="big-play" id="epPlay">${isNow && !el.paused ? "Playing" : resumable ? "Resume" : "Play"}</button>
          <button class="fav ${fav ? "on" : ""}" id="epFav" aria-pressed="${fav}">${fav ? "★ Favorite" : "☆ Favorite"}</button>
        </div>
      </div>
      ${previewHtml(item.name)}
      <ol class="tracks">
        ${tracks.map((t, i) => {
          const p = progress[t.id];
          const pct = p && p.d ? Math.min(100, Math.round((p.t / p.d) * 100)) : 0;
          const current = isNow && state.index === i;
          return `
          <li>
            <button class="track ${current ? "current" : ""} ${isPromo(t) ? "promo" : ""}" data-track="${i}">
              <span class="track-num">${current ? "♪" : i + 1}</span>
              <span class="track-name">${esc(cleanName(t.name))}${isVideo(t) ? ` <em>video</em>` : ""}</span>
              ${fileDone(t.id) ? `<span class="tick" aria-label="Played">✓</span>` : ""}
              ${pct && !fileDone(t.id) ? `<span class="bar"><i style="width:${pct}%"></i></span>` : ""}
            </button>
          </li>`;
        }).join("")}
      </ol>`;

    $("epPlay").addEventListener("click", () => {
      if (isNow) { if (el.paused) el.play(); return; }
      playEpisode(item, shelfId);
    });
    $("epFav").addEventListener("click", () => {
      if (favorites.has(item.id)) favorites.delete(item.id); else favorites.add(item.id);
      if (!episodes[item.id]) episodes[item.id] = { name: item.name, shelf: shelfId, kind: item.kind, at: 0 };
      store.set("episodes", episodes);
      store.set("favorites", [...favorites]);
      renderEpisode(shelfId, episodeId);
    });
    view.querySelectorAll("[data-track]").forEach((b) => b.addEventListener("click", () => {
      const i = Number(b.dataset.track);
      if (isNow) playIndex(i); else playEpisode(item, shelfId, i);
      setTimeout(render, 50);
    }));
  }

  // Play buttons on shelf cards
  view.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-play]");
    if (!btn) return;
    e.preventDefault();
    const shelfId = route().shelf;
    const item = (await getShelf(shelfId)).find((i) => i.id === btn.dataset.play);
    if (item) { await playEpisode(item, shelfId); }
  });

  function setHeader(title, showBack) {
    $("title").textContent = title;
    $("back").hidden = !showBack;
    document.title = title === CFG.title ? title : `${title} · Jungle Jam`;
  }

  function route() {
    const parts = location.hash.replace(/^#\/?/, "").split("/");
    if (parts[0] === "s" && parts[1]) return { name: "shelf", shelf: parts[1] };
    if (parts[0] === "e" && parts[1] && parts[2]) return { name: "episode", shelf: parts[1], episode: parts[2] };
    return { name: "home" };
  }

  let renderSeq = 0;
  async function render(quiet) {
    if (!CFG.apiKey || /PASTE/.test(CFG.apiKey)) return renderSetup();
    const seq = ++renderSeq;
    const r = route();
    const scroll = quiet ? window.scrollY : 0;
    try {
      if (r.name === "shelf") await renderShelf(r.shelf);
      else if (r.name === "episode") await renderEpisode(r.shelf, r.episode);
      else await renderHome();
      if (seq === renderSeq) window.scrollTo(0, scroll);
    } catch (e) {
      if (seq === renderSeq) showError(e);
    }
  }

  function renderSetup() {
    setHeader(CFG.title || "Jungle Jam & Friends", false);
    view.innerHTML = `
      <div class="notice">
        <h2>Almost ready</h2>
        <p>Add your Google API key to <code>config.js</code>, then reload. The README walks through it in about five minutes.</p>
      </div>`;
  }

  function showError(e) {
    const status = e && e.status;
    let help = "Check your internet connection and try again.";
    if (status === 403 || status === 400) help = "The API key was refused. Make sure the Google Drive API is enabled for it and that it allows this website's address.";
    if (status === 404) help = "Google Drive couldn't find the folder. Make sure “Jungle Jam and Friends” is shared as “Anyone with the link can view”.";
    view.innerHTML = `
      <div class="notice">
        <h2>Couldn't load episodes</h2>
        <p>${esc(help)}</p>
        <p class="small">${esc(e && e.message || "")}</p>
        <button class="big-play" onclick="location.reload()">Try again</button>
      </div>`;
  }

  let toastTimer;
  function toast(msg) {
    let t = document.querySelector(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.append(t); }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 3500);
  }

  window.addEventListener("hashchange", () => { searchTerm = route().name === "shelf" ? searchTerm : ""; render(); });
  window.addEventListener("pagehide", savePosition);
  document.addEventListener("visibilitychange", () => { if (document.hidden) savePosition(); });

  // Exposed for tests only.
  // ───────────────────────── episode previews ─────────────────────────
  const squash = (s) => String(s).toLowerCase().replace(/\bpart\s*\d+\b|,\s*\d+$/g, "").replace(/[^a-z0-9]/g, "");
  const INFO = (window.JJ_INFO || []).map((e) => ({ ...e, keys: [e.t, ...(e.aka || [])].map(squash) }));

  // Seasons as numbered in the published episode list; 1000 = specials not in that list.
  function seasonOf(n) {
    if (n >= 1000) return "Specials";
    return n <= 22 ? 1 : n <= 45 ? 2 : n <= 55 ? 3 : 4;
  }

  // A folder like "A River Runs Over It & Koalas In The Mist" holds two episodes.
  function findInfo(folderName) {
    return folderName.split(/\s+&\s+/).map((part) => {
      const seg = squash(part);
      if (seg.length < 4) return null;
      return INFO.find((e) => e.keys.some((k) => k === seg || (seg.length >= 10 && (k.startsWith(seg) || seg.startsWith(k)))));
    }).filter(Boolean);
  }

  function previewHtml(folderName) {
    const found = findInfo(folderName);
    if (!found.length) return "";
    return `<div class="previews">${found.map((e) => `
      <article class="preview">
        ${found.length > 1 ? `<h3>${esc(e.t)}</h3>` : ""}
        <p class="tease">${esc(e.tease)}</p>
        <dl>
          ${e.who ? `<div><dt>Starring</dt><dd>${esc(e.who)}</dd></div>` : ""}
          ${e.lesson ? `<div><dt>Lesson</dt><dd>${esc(e.lesson)}</dd></div>` : ""}
          ${e.verse ? `<div><dt>Verse</dt><dd>${esc(e.verse)}</dd></div>` : ""}
        </dl>
      </article>`).join("")}</div>`;
  }

  window.__jj = { cleanName, isPromo, isLossless, byName, findInfo };

  render();
})();
