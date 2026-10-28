/* Original jungle illustrations for the player (all drawn here, no outside art).
 * art(name, opts) returns an inline SVG picked deterministically from the title,
 * so each episode always gets the same picture and color.
 */
(() => {
  "use strict";

  const PALETTE = [
    { bg: "#f5c542", ink: "#2f5a2a", hi: "#fff2b8" }, // banana
    { bg: "#ff8a5c", ink: "#5a2a14", hi: "#ffd2bd" }, // papaya
    { bg: "#7bd389", ink: "#1d4a2a", hi: "#d6f5da" }, // lime leaf
    { bg: "#5cc8ff", ink: "#12405a", hi: "#cfeeff" }, // lagoon
    { bg: "#c79bff", ink: "#3d2366", hi: "#ecdcff" }, // orchid
    { bg: "#ff6f91", ink: "#5c1a2c", hi: "#ffd0dc" }, // hibiscus
    { bg: "#4fd1c5", ink: "#0f4440", hi: "#c9f4ef" }, // jade
    { bg: "#ffb347", ink: "#5a3410", hi: "#ffe3bd" }, // mango
  ];

  // Each motif draws in a 100×100 box using I (ink) and H (highlight).
  const MOTIFS = {
    palm: (I, H) => `
      <circle cx="72" cy="28" r="14" fill="${H}"/>
      <path d="M48 92 C50 74 52 58 50 40" stroke="${I}" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="M50 40 C38 30 24 30 14 38 C26 34 38 36 50 40Z M50 40 C62 28 78 28 88 36 C76 33 62 35 50 40Z
               M50 40 C44 26 34 18 22 18 C34 24 42 30 50 40Z M50 40 C58 24 68 18 80 18 C68 24 58 30 50 40Z
               M50 40 C50 26 52 16 58 10 C56 22 54 30 50 40Z" fill="${I}"/>
      <circle cx="47" cy="43" r="4" fill="${I}"/><circle cx="54" cy="44" r="4" fill="${I}"/>
      <path d="M8 96 Q50 78 92 96Z" fill="${I}" opacity=".35"/>`,
    banana: (I, H) => {
      const one = (r) => `<g transform="rotate(${r} 70 26)">
        <path d="M70 26 C74 48 64 72 38 82 C30 85 22 84 18 80 C40 76 58 58 62 30Z" fill="${H}" stroke="${I}" stroke-width="3.5" stroke-linejoin="round"/>
        <path d="M18 80 L13 80" stroke="${I}" stroke-width="4" stroke-linecap="round"/></g>`;
      return `<g transform="translate(12 8) scale(.88)">${one(18)}${one(0)}${one(-20)}
        <path d="M66 28 L76 12" stroke="${I}" stroke-width="7" stroke-linecap="round"/></g>`;
    },
    monstera: (I, H) => `
      <path d="M50 92 L50 60" stroke="${I}" stroke-width="5" stroke-linecap="round"/>
      <path d="M50 62 C20 62 10 40 18 24 C26 10 44 8 50 16 C56 8 74 10 82 24 C90 40 80 62 50 62Z" fill="${I}"/>
      <path d="M50 18 L50 58 M50 30 L28 22 M50 38 L22 36 M50 46 L26 52 M50 30 L72 22 M50 38 L78 36 M50 46 L74 52"
            stroke="${H}" stroke-width="3.5" stroke-linecap="round"/>
      <ellipse cx="36" cy="30" rx="4" ry="2.5" fill="${H}"/><ellipse cx="64" cy="44" rx="4" ry="2.5" fill="${H}"/>`,
    sunrise: (I, H) => `
      <circle cx="50" cy="60" r="22" fill="${H}"/>
      <g stroke="${H}" stroke-width="4" stroke-linecap="round">
        <path d="M50 22 L50 30 M24 34 L30 40 M76 34 L70 40 M14 58 L22 58 M86 58 L78 58"/>
      </g>
      <path d="M0 70 Q25 54 50 70 T100 70 L100 100 L0 100Z" fill="${I}"/>
      <path d="M0 84 Q30 72 60 84 T100 82 L100 100 L0 100Z" fill="${I}" opacity=".6"/>`,
    moon: (I, H) => `
      <path d="M62 18 A30 30 0 1 0 82 66 A24 24 0 1 1 62 18Z" fill="${H}"/>
      <g fill="${H}">
        <path d="M24 22 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2Z"/>
        <path d="M30 56 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5Z"/>
        <circle cx="84" cy="22" r="2.5"/><circle cx="16" cy="44" r="2"/>
      </g>
      <path d="M0 92 C14 78 26 82 34 92 C42 80 56 80 64 92 C74 82 88 80 100 90 L100 100 L0 100Z" fill="${I}"/>`,
    paws: (I) => {
      const paw = (x, y, r) => `
        <g transform="translate(${x} ${y}) rotate(${r})">
          <ellipse cx="0" cy="6" rx="9" ry="8" fill="${I}"/>
          <circle cx="-9" cy="-6" r="3.6" fill="${I}"/><circle cx="-3" cy="-10" r="3.6" fill="${I}"/>
          <circle cx="4" cy="-10" r="3.6" fill="${I}"/><circle cx="10" cy="-5" r="3.6" fill="${I}"/>
        </g>`;
      return paw(28, 78, -20) + paw(52, 56, 10) + paw(34, 32, -15) + paw(66, 18, 15);
    },
    river: (I, H) => `
      <path d="M0 30 Q50 6 100 30 L100 100 L0 100Z" fill="${I}" opacity=".35"/>
      <g fill="none" stroke="${H}" stroke-width="5" stroke-linecap="round">
        <path d="M10 48 Q22 40 34 48 T58 48 T82 48 T106 48"/>
        <path d="M-6 64 Q6 56 18 64 T42 64 T66 64 T90 64"/>
        <path d="M10 80 Q22 72 34 80 T58 80 T82 80 T106 80"/>
      </g>
      <path d="M70 24 C74 14 84 14 86 22 C80 20 76 22 70 24Z" fill="${I}"/>`,
    hibiscus: (I, H) => `
      <g fill="${H}" stroke="${I}" stroke-width="3">
        ${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="50" cy="28" rx="15" ry="20" transform="rotate(${a} 50 52)"/>`).join("")}
      </g>
      <circle cx="50" cy="52" r="8" fill="${I}"/>
      <path d="M50 52 L66 34" stroke="${I}" stroke-width="3" stroke-linecap="round"/>
      <g fill="${I}"><circle cx="66" cy="34" r="3"/><circle cx="70" cy="38" r="2.4"/><circle cx="62" cy="30" r="2.4"/></g>`,
    coconut: (I, H) => `
      <path d="M8 96 Q50 70 92 96Z" fill="${I}" opacity=".4"/>
      <circle cx="38" cy="62" r="20" fill="${I}"/>
      <circle cx="64" cy="70" r="16" fill="${I}"/>
      <g fill="${H}"><circle cx="32" cy="56" r="3"/><circle cx="42" cy="56" r="3"/><circle cx="37" cy="64" r="3"/></g>
      <path d="M50 36 C42 22 30 18 18 22 C30 24 40 28 50 36Z M50 36 C58 20 72 16 84 22 C72 24 60 28 50 36Z" fill="${I}"/>`,
    bird: (I, H) => `
      <path d="M14 70 L86 70" stroke="${I}" stroke-width="5" stroke-linecap="round"/>
      <ellipse cx="46" cy="50" rx="18" ry="20" fill="${I}"/>
      <circle cx="54" cy="36" r="13" fill="${I}"/>
      <path d="M64 32 C80 30 90 36 92 42 C82 42 72 42 64 40Z" fill="${H}" stroke="${I}" stroke-width="2.5"/>
      <circle cx="56" cy="33" r="4" fill="${H}"/><circle cx="57" cy="33" r="1.8" fill="${I}"/>
      <path d="M44 46 C40 56 42 64 48 68 C38 66 32 58 34 48Z" fill="${H}" opacity=".5"/>
      <path d="M42 68 L38 84 M50 68 L50 84" stroke="${I}" stroke-width="3" stroke-linecap="round"/>`,
  };

  // Pictures for the shelves themselves.
  const SHELF_MOTIFS = {
    radio: (I, H) => `
      <rect x="16" y="34" width="68" height="50" rx="10" fill="${I}"/>
      <path d="M30 34 L66 14" stroke="${I}" stroke-width="4" stroke-linecap="round"/>
      <circle cx="66" cy="14" r="4" fill="${I}"/>
      <circle cx="38" cy="59" r="14" fill="${H}"/><circle cx="38" cy="59" r="6" fill="${I}"/>
      <rect x="58" y="46" width="18" height="6" rx="3" fill="${H}"/>
      <rect x="58" y="58" width="18" height="6" rx="3" fill="${H}" opacity=".7"/>
      <rect x="58" y="70" width="18" height="6" rx="3" fill="${H}" opacity=".45"/>`,
    songs: (I, H) => `
      <path d="M36 74 L36 26 L76 18 L76 66" stroke="${I}" stroke-width="6" fill="none" stroke-linejoin="round"/>
      <path d="M36 34 L76 26" stroke="${I}" stroke-width="10"/>
      <ellipse cx="28" cy="76" rx="11" ry="8" fill="${I}" transform="rotate(-18 28 76)"/>
      <ellipse cx="68" cy="68" rx="11" ry="8" fill="${I}" transform="rotate(-18 68 68)"/>
      <circle cx="18" cy="24" r="3" fill="${H}"/><circle cx="86" cy="84" r="3" fill="${H}"/>`,
    video: (I, H) => `
      <rect x="12" y="26" width="76" height="54" rx="10" fill="${I}"/>
      <rect x="20" y="33" width="60" height="40" rx="5" fill="${H}"/>
      <path d="M44 42 L60 53 L44 64Z" fill="${I}"/>
      <path d="M40 26 L30 12 M60 26 L70 12" stroke="${I}" stroke-width="4" stroke-linecap="round"/>
      <path d="M34 80 L30 90 M66 80 L70 90" stroke="${I}" stroke-width="5" stroke-linecap="round"/>`,
  };

  function hash(str, seed) {
    let h = seed >>> 0;
    for (const ch of str) h = (Math.imul(h ^ ch.charCodeAt(0), 2654435761) >>> 0);
    return h;
  }

  // Bedtime-ish titles get the moon, songs get the bird, etc. Everything else is random-but-stable.
  function pickMotif(name) {
    const n = name.toLowerCase();
    if (/\b(night|bedtime|sleep|moon|star|christmas|wise men)\b/.test(n)) return "moon";
    if (/\b(river|island|water|ark|fall)\b/.test(n)) return "river";
    if (/\b(sing|songs?|sound|blues)\b/.test(n)) return "bird";
    if (/\b(footprints?|bears?|hound|dogs?|cat|cat's|horses|koalas|hog|skunk|elephant's|rabbits|cheetah)\b/.test(n)) return "paws";
    if (/\b(coconut|picnic|cakes|candyland|pears)\b/.test(n)) return "coconut";
    const keys = ["palm", "banana", "monstera", "sunrise", "hibiscus", "palm", "banana", "monstera", "bird"];
    return keys[hash(name, 7) % keys.length];
  }

  function colors(name) { return PALETTE[hash(name, 3) % PALETTE.length]; }

  function shelfMotif(name) {
    const n = name.toLowerCase();
    if (/video/.test(n)) return "video";
    if (/song|music/.test(n)) return "songs";
    if (/radio|episode|audio/.test(n)) return "radio";
    return null;
  }

  // Corner leaves that frame every tile so the set feels like one family.
  const corners = (I) => `
    <path d="M-4 -4 C14 2 22 12 20 26 C10 22 2 12 -4 -4Z" fill="${I}" opacity=".22"/>
    <path d="M104 104 C86 98 78 88 80 74 C90 78 98 88 104 104Z" fill="${I}" opacity=".22"/>`;

  function art(name, { shelf = false } = {}) {
    const c = colors(name);
    const key = (shelf && shelfMotif(name)) || pickMotif(name);
    const draw = (shelf && SHELF_MOTIFS[key]) || MOTIFS[key];
    return `<svg class="tile-art" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="100" height="100" fill="${c.bg}"/>
      ${corners(c.ink)}
      ${draw(c.ink, c.hi)}
    </svg>`;
  }

  window.JJArt = { art, colors, pickMotif };
})();
