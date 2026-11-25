# Offline Mode — Design

Date: 2026-11-25
Status: Draft for approval
Builds on: `2026-11-25-music-bingo-design.md`

## Intent

Venues often have poor internet. The host must be able to run a whole game —
console, music, claim checks, history, printing — with no connection.

## Hard constraint

Spotify does not let third-party apps play audio offline. Songs downloaded in
the Spotify app are DRM-locked to the Spotify app. So offline music comes from
one of two places, and the host asked for **both**, used per song:

1. **Your own music files** (MP3, M4A/AAC, WAV, OGG, FLAC where the browser
   supports it) stored inside the app → full automatic control.
2. **Spotify app downloads + manual mode** → this app tells the host what to
   play; the host plays it in the Spotify app.

## Goals

- The app itself loads and works with no internet once it has been opened
  online one time on that computer ("installable" app).
- Songs with a music file play automatically with every console control
  (clip length, start point, fades, seek, replay, volume, mute, talk-over,
  auto-advance).
- Songs without a file fall back to a clear manual prompt during the game.
- Before an event, a readiness check says exactly what will work offline.

## Non-goals / anti-goals

- No way to play Spotify audio inside this app offline (impossible).
- Searching Spotify offline (impossible) — playlists are built beforehand.
- Phone cards for players without data: their phones must load the page from
  the internet; noted in the UI.
- Not a music-file manager or tagger beyond what matching needs.

## Design

### 1. Installable offline app
- Service worker (vite-plugin-pwa / Workbox) precaches the built app.
- Fonts self-hosted (Bungee, Sora via `@fontsource`) instead of Google Fonts.
- Album art from Spotify's image host cached on first view (cache-first), so
  cards, console and print look the same offline.
- App manifest so the host can "Install" it (Chrome/Edge: install icon).
- Connection indicator in the top bar: Online / Offline. Spotify-only actions
  (search, import from Spotify, save to Spotify) are disabled offline with a
  one-line reason.
- Ask the browser for persistent storage so music files aren't evicted.

### 2. Music library (your files)
- New **Music files** area (tab in Playlists): add files or a whole folder.
- Each file's title/artist read from its tags (ID3/MP4 metadata), falling back
  to the filename ("Artist - Title.mp3"). Duration read from the audio.
- Files stored in IndexedDB as blobs (≈5 MB per song; storage meter shown).
- **Matching:** files auto-match to playlist songs using the same normalized
  title + artist key used for duplicate detection. A review list shows
  matched / unmatched; the host can pick a file for any song by hand or unlink.
- **File-only playlists:** a playlist can be built straight from files (no
  Spotify at all) — songs get `file:` ids and work everywhere (cards, print,
  game, history).

### 3. Playback sources (per song)
- `Song` gains `fileId?`. A song can have Spotify, a file, or both.
- Setting **Music source** (Settings + live in console):
  - *Automatic* (default): Spotify when online and connected; otherwise the
    file; otherwise manual prompt.
  - *Prefer my files*: file whenever one exists, else Spotify, else manual.
  - *Manual only (Spotify app)*: never plays audio; always prompts.
- A hybrid player decides per song at play time. File playback uses an HTML
  audio element with Web Audio gain for smooth fades/volume/mute/talk-over.
  The console shows a small badge for the current source: Spotify / File /
  Manual.

### 4. Manual mode (Spotify app downloads)
- When a song plays "manually", the deck shows a big prompt: **Play now in
  Spotify: Title — Artist**, plus the clip timer as a guide ("fade out in
  5s…"). The song is recorded as called when the host presses **Played**
  (or Next). Auto-advance pauses on manual songs.
- **Prepare for offline (while still online):** on the game setup screen,
  **Save call order to Spotify** creates a Spotify playlist in the exact call
  order. The host downloads it in the Spotify app (shuffle off) and simply
  advances there in step with this app. If the host reorders the queue
  mid-game, the console shows the new "next up" so they can pick it manually.

### 5. Offline readiness check
On game setup and in the console header:
- App available offline ✓/✗
- N of M songs have music files (list of missing)
- Spotify-order playlist saved ✓/–
- Verdict line, e.g. "Offline ready: 61 songs play automatically, 14 will
  prompt you to play them in the Spotify app."

## Approaches considered

- **Files only** — full control but useless without files.
- **Manual only** — zero setup but juggling two apps and no clip control.
- **Both, per song (chosen by host)** — each song uses the best source it has.

## Builder's calls (stated, correctable)
- Libraries: `vite-plugin-pwa`, `@fontsource/bungee`, `@fontsource/sora`,
  `music-metadata` (browser build) for tags; fallback to filename parsing.
- Default source policy *Automatic*; manual songs never auto-advance.
- Matching reuses `songKey()`; ties go to the review list rather than a guess.
- Files are per-browser; backups (JSON) exclude audio — a separate
  "Export music library" is out of scope for now (re-add files instead).

## Testing
- Unit: tag/filename parsing, matching, source selection policy, hybrid port
  routing, manual-play flow in the controller (called on "Played"), readiness
  summary.
- UI: library add/match review, console manual prompt, offline indicator.
- Browser check: build + preview, go offline in Playwright, reload the app,
  run a game with file songs, confirm no network requests are needed.
