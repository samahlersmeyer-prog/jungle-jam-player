# Jungle Jam & Friends Player

A little web app for playing the Jungle Jam and Friends episodes straight from Google Drive. It runs on GitHub Pages and can be saved to the home screen on an iPhone or iPad, where it behaves like a regular app.

**What it does**

- Every folder inside **Jungle Jam and Friends** in Drive becomes a shelf (Radio Episodes, Little Dogs on the Prairie Songs, Video Episodes).
- Each episode plays its parts in order. It uses the MP3 versions, skips the promo clip at the start, and moves on to the next part by itself.
- It remembers where you stopped, so episodes can be resumed, and the home screen shows "Keep listening" and ★ Favorites.
- A sleep timer (15, 30 or 45 minutes, or end of episode) fades out and stops playback, which helps at bedtime.
- Lock-screen and AirPods controls work.
- New episodes added to the Drive folder show up on their own. Tap the refresh button (top right) to see them right away.

---

## One-time setup (about 10 minutes)

### 1. Share the Drive folder by link

1. In Google Drive, right-click **Jungle Jam and Friends** → **Share**.
2. Under **General access**, choose **Anyone with the link** → **Viewer** → **Done**.

The folder isn't listed or searchable anywhere, but anyone who has the link (or the folder ID in `config.js`) can open it.

### 2. Get a Google API key

1. Go to <https://console.cloud.google.com/> and sign in with the Google account that owns the Drive folder.
2. At the top, click the project picker → **New project** → name it `Jungle Jam` → **Create**, then select it.
3. Open **APIs & Services → Library**, search for **Google Drive API**, and click **Enable**.
4. Open **APIs & Services → Credentials → Create credentials → API key**. Copy the key.
5. Click the new key to lock it down:
   - **Application restrictions** → **Websites** → add `https://samahlersmeyer-prog.github.io/*`
   - **API restrictions** → **Restrict key** → check **Google Drive API**
   - **Save**

Because of those restrictions, the key only works from your GitHub Pages site and only for reading Drive, so it's fine for it to sit in a public repo.

### 3. Put the key in the app

Open `config.js` and replace `PASTE_YOUR_API_KEY_HERE` with your key. (On GitHub you can do this right in the browser: open the file → pencil icon → edit → **Commit changes**.)

### 4. Turn on GitHub Pages

1. In the repo, go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**, **Branch** to `main` and the folder to `/ (root)`, then **Save**.
3. After about a minute, the app is live at
   **https://samahlersmeyer-prog.github.io/jungle-jam-player/**

### 5. Add it to the kids' iPads/iPhones

Open that link in **Safari** → tap **Share** → **Add to Home Screen**. It opens full-screen with the palm-tree icon.

---

## If something doesn't work

| What you see | Fix |
|---|---|
| "Almost ready" | The API key in `config.js` hasn't been filled in yet. |
| "The API key was refused" | Check that the Drive API is enabled and the website restriction is exactly `https://samahlersmeyer-prog.github.io/*`. |
| "Google Drive couldn't find the folder" | The folder isn't shared by link yet (step 1). |
| An episode won't play | Make sure the files inside were uploaded by you. Files added by someone else need their own link sharing. |
| New episodes aren't showing | Tap the refresh button at the top. |

## Files

| File | What it is |
|---|---|
| `index.html` | The page |
| `app.js` | Reads Drive, the player, resume and the sleep timer |
| `style.css` | The look |
| `config.js` | API key and Drive folder ID (the only file you need to edit) |
| `manifest.webmanifest`, `icons/` | Home-screen app name and icon |
