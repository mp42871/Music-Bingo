# Music Bingo Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A browser-only host app that builds song pools from Spotify, generates/prints bingo cards, runs the game with Spotify playback, checks claims, keeps history, and offers standalone phone cards.

**Architecture:** Pure TypeScript game logic in `src/core/` (no React, fully unit-tested), Spotify access in `src/spotify/`, persistence in `src/db/` (Dexie/IndexedDB), React UI in `src/ui/` routed with a hash router for GitHub Pages. The console broadcasts state to the audience window over `BroadcastChannel`.

**Tech Stack:** Vite, React 19, TypeScript, Tailwind CSS 4 (`@tailwindcss/vite`), react-router-dom 7 (HashRouter), Zustand, Dexie, qrcode, lz-string, Vitest + jsdom + @testing-library/react + fake-indexeddb.

**Spec:** `docs/superpowers/specs/2026-11-25-music-bingo-design.md`

## Global Constraints

- No backend. All data in IndexedDB; full backup/restore to JSON.
- Spotify auth: Authorization Code + PKCE, Client ID entered by host in Settings; scopes `streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state playlist-read-private playlist-read-collaborative playlist-modify-private playlist-modify-public`.
- Redirect URI = `window.location.origin + window.location.pathname` (works for `http://127.0.0.1:5173/` and GitHub Pages).
- Card numbers: printed 1–4999 (displayed zero-padded to 4 digits), phone 5000–9999.
- Defaults: clip 30s, gap 5s, start mode `random` 30–75s (song marker wins if set), auto-advance on, fade 1.5s.
- Grid sizes 3, 4, 5. Paper Letter and A4. Cards per page 1, 2, 4 (6 for 3×3).
- Card generation must be deterministic from (seed, number, pool, layout).
- Spotify 429 / quota errors: honor `Retry-After`, surface a readable message; never hang the UI.
- DJ look: dark background, neon accents (magenta `#ff2bd6`, cyan `#22d3ee`, lime `#a3e635`), display font "Bungee" + body "Inter" from Google Fonts.

## Review Focus

1. **Spotify token expires mid-game (1 h).** Expect silent refresh; playback continues. → test in Task 8 (`getAccessToken refreshes when expired`).
2. **Pool too small / a category column with too few songs.** Expect generation blocked with a clear per-column message, never an infinite loop. → Task 4 (`validatePool reports short columns`, `generateCardSet throws PoolTooSmall`).
3. **More cards requested than unique cards possible** (e.g. 3×3 from 10 songs). Expect a capped count + message, bounded retries. → Task 4 (`generateCardSet caps duplicates with bounded retries`).
4. **Host presses Next / Replay / changes settings during the gap or a fade.** Expect exactly one advance and no orphaned timers. → Task 9 (`next during gap advances once`, `replay during gap cancels countdown`).
5. **A track fails to play (unavailable/removed).** Expect it is skipped, NOT recorded as called, and the host sees a notice. → Task 9 (`play failure skips without recording call`).

---

## File Structure

```
src/
  main.tsx, App.tsx, index.css              shell, routes, theme
  core/types.ts                             all shared types
  core/rng.ts                               seeded RNG, shuffle, hash
  core/patterns.ts                          win patterns → masks
  core/cards.ts                             validatePool, generateCard(Set)
  core/check.ts                             cell marking, checkCard, liveWinners
  core/forecast.ts                          forecast, makeCallOrder, tuneCallOrder
  core/clip.ts                              computeStartMs, defaults
  core/io.ts                                pool JSON/CSV export/import, text parse, merge
  core/phone.ts                             phone link encode/decode
  core/presets.ts                           preset categories
  db/db.ts, db/repo.ts                      Dexie schema + CRUD + backup
  spotify/auth.ts, spotify/api.ts, spotify/query.ts, spotify/sdk.ts
  game/controller.ts                        clip/gap state machine (UI-agnostic)
  game/store.ts                             zustand store wiring controller ↔ UI
  game/broadcast.ts                         BroadcastChannel audience sync
  ui/components/*                           shared buttons, panels, CardGrid
  ui/pages/Home, Pools, PoolEditor, Designer, Print, Console, Audience, Check, History, Settings, Phone
tests mirror src/: src/**/*.test.ts(x)
.github/workflows/deploy.yml
```

## Core types (Task 2 produces these; every later task consumes them)

```ts
export interface Song { id: string; uri: string; title: string; artist: string; album: string;
  year?: number; durationMs: number; artUrl?: string; displayTitle?: string;
  startMs?: number; categories: string[]; excluded?: boolean }
export interface Pool { id: string; name: string; songs: Song[]; categories: string[];
  createdAt: number; updatedAt: number }
export type HeaderMode = 'categories' | 'theme' | 'letters';
export type CellContent = 'title' | 'artist' | 'both' | 'artistBingo';
export interface CardLayout { size: 3 | 4 | 5; freeCenter: boolean; freeText: string;
  headerMode: HeaderMode; columnCategories: string[]; themeCategory?: string;
  letters: string; cellContent: CellContent }
export type Cell = { kind: 'song'; songId: string } | { kind: 'artist'; artist: string } | { kind: 'free' };
export interface Card { number: number; cells: Cell[] }            // row-major, length size*size
export interface CardSet { id: string; poolId: string; seed: number; layout: CardLayout; cards: Card[]; createdAt: number }
export interface PatternDef { id: string; name: string }
export interface Call { songId: string; at: number }
export interface Winner { cardNumber: number; name?: string; prize?: string; atCall: number }
export interface Round { patternId: string; customMask?: number[]; winners: Winner[]; startCall: number; endCall?: number }
export interface ClipSettings { clipSec: number; gapSec: number;
  startMode: 'beginning' | 'fixed' | 'random' | 'marker'; fixedStartSec: number;
  randomMinSec: number; randomMaxSec: number; autoAdvance: boolean; fadeSec: number; hideTitles: boolean }
export interface PrintStyle { theme: 'neon'|'vinyl'|'minimal'|'cassette'|'festival'|'holiday';
  accent: string; background: string; inkSaver: boolean; paper: 'letter'|'a4'; perPage: 1|2|4|6;
  title: string; subtitle: string; logoDataUrl?: string; cutLines: boolean;
  showArt: boolean; bonusCorners: boolean; mysteryColumn: number | null }
export interface Game { id: string; name: string; createdAt: number; pool: Pool; cardSetId: string;
  settings: ClipSettings; callOrder: string[]; calls: Call[]; rounds: Round[];
  status: 'setup' | 'live' | 'finished' }
```

---

### Task 1: Scaffold, theme, shell, deploy config

**Files:** Create `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/ui/components/Nav.tsx`, `src/App.test.tsx`, `.github/workflows/deploy.yml`, `.gitignore`.

**Interfaces:** Produces routes `/`, `/pools`, `/pools/:id`, `/designer`, `/print/:setId`, `/console/:gameId`, `/audience`, `/check`, `/history`, `/settings`, `/phone` (placeholder pages each rendering an `<h1>` with the page name).

- [ ] Step 1: Install deps (pin TypeScript to `~5.9` if TS 7 breaks the Vite/Vitest toolchain). `vite.config.ts`: `base: './'`, plugins react + tailwind, vitest `environment: 'jsdom'`.
- [ ] Step 2: Write `App.test.tsx`: renders App at `#/settings` and finds heading "Settings"; nav contains links "Play", "Playlists", "Cards", "Check", "History", "Settings".
- [ ] Step 3: Run `npx vitest run` → FAIL.
- [ ] Step 4: Implement shell: dark neon theme tokens in `index.css` (`@theme` vars for the three neon colors, bg `#0a0a12`), Bungee/Inter fonts, top nav.
- [ ] Step 5: `npx vitest run` → PASS; `npx vite build` → succeeds.
- [ ] Step 6: `deploy.yml`: on push to `main`, `npm ci && npm run build`, deploy `dist` with `actions/deploy-pages`.
- [ ] Step 7: Commit `feat: scaffold app shell`.

### Task 2: Types, seeded RNG

**Files:** Create `src/core/types.ts` (as above), `src/core/rng.ts`, `src/core/rng.test.ts`.

**Interfaces:** Produces `mulberry32(seed: number): () => number`, `hashSeed(...parts: (string|number)[]): number` (FNV-1a 32-bit), `shuffle<T>(arr: readonly T[], rand: () => number): T[]` (Fisher–Yates, non-mutating), `randomSeed(): number`.

- [ ] Step 1: Tests: same seed → identical first 5 values; different seeds differ; `shuffle` returns permutation, does not mutate input, deterministic for a seed; `hashSeed(1,'a') === hashSeed(1,'a')` and `!== hashSeed(1,'b')`.
- [ ] Step 2: Run → FAIL. Step 3: implement. Step 4: Run → PASS. Step 5: Commit `feat(core): seeded rng`.

### Task 3: Win patterns

**Files:** `src/core/patterns.ts`, `src/core/patterns.test.ts`.

**Interfaces:** Produces `PATTERNS: PatternDef[]` with ids `line, twoLines, fourCorners, x, t, l, plus, frame, smallDiamond, largeDiamond, blackout, custom`; `masksFor(patternId: string, size: 3|4|5, customMask?: number[]): number[][]` — a card wins if ALL indices of ANY mask are marked. Free cell index counts as marked (handled in check).

- [ ] Step 1: Tests (size 5): `line` → 12 masks (5 rows, 5 cols, 2 diags) each length 5; `twoLines` → C(12,2)=66 masks; `fourCorners` → `[[0,4,20,24]]`; `blackout` → one mask of 25; `x` → union of diagonals (9 cells); `frame` → 16 cells; `custom` with `[1,2]` → `[[1,2]]`; size 3 `line` → 8 masks. Unknown id throws.
- [ ] Step 2: FAIL. Step 3: implement (`t` = top row + middle column; `l` = left column + bottom row; `plus` = middle row + middle column; diamonds by Manhattan distance from center ≤ 1 / = size//2 edge diamond; for size 4 use the nearest equivalent and document it in a comment). Step 4: PASS. Step 5: Commit.

### Task 4: Pool validation and card generation

**Files:** `src/core/cards.ts`, `src/core/cards.test.ts`.

**Interfaces:**
- `songsForColumn(pool: Pool, layout: CardLayout, col: number): Song[]` — non-excluded songs; filtered by `columnCategories[col]` in `categories` mode, by `themeCategory` in `theme` mode, all songs in `letters` mode.
- `validatePool(pool, layout): { ok: boolean; columns: { label: string; available: number; needed: number }[]; messages: string[] }` — needed per column = size (minus 1 for the center column if `freeCenter` and size is odd); in non-category modes columns share one pool, so check total ≥ cells.
- `generateCard(pool, layout, seed, number): Card` — rand = `mulberry32(hashSeed(seed, number))`; per column pick distinct songs (a song may not appear twice on a card even across columns); `artistBingo` uses unique artist names instead of song ids.
- `generateCardSet(pool, layout, opts: { seed: number; count: number; startNumber: number }): { set: CardSet; capped: boolean; message?: string }` — de-dupes by sorted cell signature; on a duplicate retry with `hashSeed(seed, number, attempt)` up to 50 attempts, then stop and return `capped: true`.
- `class PoolTooSmallError extends Error`.

- [ ] Step 1: Tests: fixture pool of 75 songs tagged 5 categories ×15. 5×5 category layout → each column's songs belong to its category; center is `free`; no repeat song within a card; `generateCard` same args → identical; 100 cards all unique; `validatePool` with a category of 3 songs → `ok:false`, message names that category; `generateCardSet` on that pool throws `PoolTooSmallError`; 3×3 letters layout with 10 songs and count 500 → `capped: true`, `set.cards.length < 500`, completes < 1s.
- [ ] Step 2: FAIL. Step 3: implement. Step 4: PASS. Step 5: Commit.

### Task 5: Claim checking, live winners, forecast, call order

**Files:** `src/core/check.ts`, `src/core/forecast.ts`, tests for both.

**Interfaces:**
- `markedCells(card: Card, called: ReadonlySet<string>, songsById: Map<string, Song>): boolean[]` — free = true; song cell marked if id called; artist cell marked if any called song has that artist.
- `checkCard(card, calls: Call[], masks: number[][], songsById): { valid: boolean; firstValidAtCall: number | null; winningMask: number[] | null; marked: boolean[] }` — `firstValidAtCall` is the 1-based call index at which it first became valid (scan calls incrementally).
- `liveWinners(cards: Card[], calls, masks, songsById): number[]` — card numbers currently valid.
- `makeCallOrder(pool: Pool, seed: number): string[]` — shuffled non-excluded song ids.
- `forecast(cards, callOrder, masks, songsById): { firstWinCall: number | null; winnersAtFirst: number }`.
- `tuneCallOrder(pool, cards, masks, songsById, window: { min: number; max: number }, baseSeed: number, maxTries = 200): { order: string[]; seed: number; forecast: ReturnType<typeof forecast>; hit: boolean }`.

- [ ] Step 1: Tests: hand-built 3×3 card with line pattern — valid after calling its top row, `firstValidAtCall` = index of 3rd of those calls; calling 2 of 3 → invalid; artist cell marked by any song of that artist; free center counts; `liveWinners` returns only valid card numbers; `makeCallOrder` deterministic and excludes excluded songs; `forecast` on known small set returns expected first call; `tuneCallOrder` with a wide window → `hit:true`.
- [ ] Step 2: FAIL. Step 3: implement. Step 4: PASS. Step 5: Commit.

### Task 6: Clip math, presets, import/export, phone links

**Files:** `src/core/clip.ts`, `src/core/presets.ts`, `src/core/io.ts`, `src/core/phone.ts`, tests for clip/io/phone.

**Interfaces:**
- `DEFAULT_CLIP: ClipSettings` (Global Constraints values, `hideTitles: false`); `computeStartMs(song: Song, s: ClipSettings, rand: () => number): number` — `marker` mode or any song with `startMs` uses it; `random` picks in [min,max]s; result clamped to `max(0, durationMs - clipSec*1000)`.
- `PRESETS: { id: string; name: string; query: { text?: string; yearFrom?: number; yearTo?: number; genre?: string } }[]` — the spec §8.1 list.
- `exportPoolJson(pool): string` (`{ format: 'music-bingo-pool', version: 1, pool }`); `importPoolJson(text): Pool` (throws `ImportError` on wrong format); `exportPoolCsv(pool): string` (header `title,artist,album,year,spotify_url,categories,start`; categories `|`-joined; RFC-4180 quoting); `parseSongLines(text: string): { title: string; artist: string }[]` — accepts CSV with title/artist header (any column order, case-insensitive), or lines `Artist - Title` / `Artist – Title`; `mergeSongs(existing: Song[], incoming: Song[], mode: 'skip'|'keepBoth'|'replace'): Song[]` — duplicate = same id OR same normalized `title|artist` (lowercase, strip `- remaster…`/parentheticals).
- `PhoneDef { v: 1; seed: number; layout: CardLayout; songs: [id: string, title: string, artist: string][]; title: string }`; `encodePhoneDef(d): string` (lz-string `compressToEncodedURIComponent`), `decodePhoneDef(s): PhoneDef` (throws on garbage); `phoneCardNumber(rand): number` in 5000–9999.

- [ ] Step 1: Tests: computeStartMs clamps for a 40s song; marker wins; JSON round-trip equals input; wrong format throws; CSV quotes commas/quotes; `parseSongLines` handles `title,artist` CSV, `Artist,Title` reversed header, and dash lines with en dash; `mergeSongs` skip/keepBoth/replace on a "Song (2011 Remaster)" duplicate; phone encode/decode round-trip; `phoneCardNumber` within range over 1000 draws.
- [ ] Step 2: FAIL. Step 3: implement. Step 4: PASS. Step 5: Commit.

### Task 7: Persistence

**Files:** `src/db/db.ts`, `src/db/repo.ts`, `src/db/repo.test.ts` (uses `fake-indexeddb/auto`).

**Interfaces:** Dexie DB `musicBingo` v1 with tables `pools(id, updatedAt)`, `cardSets(id, poolId, createdAt)`, `games(id, createdAt)`, `kv(key)`. Repo functions: `savePool/getPool/listPools/deletePool`, `saveCardSet/getCardSet/listCardSets`, `saveGame/getGame/listGames/deleteGame`, `getSetting<T>(key, fallback)/setSetting(key, value)`, `exportBackup(): Promise<string>`, `importBackup(json: string, mode: 'merge'|'replace'): Promise<void>`. Settings keys: `clientId`, `clip`, `printStyle`, `layout`, `branding`.

- [ ] Step 1: Tests: save/get/list pool; backup → wipe → import replace restores pools, sets, games, kv; merge keeps existing records with different ids.
- [ ] Step 2: FAIL. Step 3: implement. Step 4: PASS. Step 5: Commit.

### Task 8: Spotify auth, API client, search query builder

**Files:** `src/spotify/auth.ts`, `src/spotify/api.ts`, `src/spotify/query.ts`, tests for each (mock `fetch`).

**Interfaces:**
- `createPkcePair(): Promise<{ verifier: string; challenge: string }>` (verifier 64 chars from `[A-Za-z0-9-._~]`, challenge = base64url SHA-256).
- `beginLogin(clientId: string): Promise<void>` (stores verifier+state in sessionStorage, redirects); `completeLogin(url: URL, clientId: string): Promise<boolean>`; `getAccessToken(clientId: string): Promise<string | null>` — refreshes via refresh_token when within 60s of expiry; tokens in localStorage key `mb.spotify.tokens`; `logout()`.
- `buildSearchQuery(q: { text?: string; yearFrom?: number; yearTo?: number; genre?: string }): string` — e.g. `{text:'love', yearFrom:1980, yearTo:1989, genre:'country'}` → `love year:1980-1989 genre:"country"`.
- `class SpotifyApi { constructor(getToken: () => Promise<string | null>) ; searchTracks(q: string, offset?: number, limit?: number): Promise<{ songs: Song[]; total: number }>; myPlaylists(): Promise<{ id: string; name: string; count: number; image?: string }[]>; playlistSongs(idOrUrl: string): Promise<Song[]>; createPlaylist(name: string, uris: string[]): Promise<string>; devices(); play(deviceId: string, uri: string, positionMs: number); pause(deviceId); resume(deviceId); seek(deviceId, ms); volume(deviceId, pct); transfer(deviceId) ; me() }` — `trackToSong` maps API track → `Song` (year from `album.release_date`, largest image). 429 → wait `Retry-After` seconds (max 3 retries) then throw `SpotifyError` with readable message; 401 → one token refresh retry. Default search limit 10, paginated.
- `parsePlaylistId(input: string): string | null` (accepts URL, `spotify:playlist:` URI, raw id).

- [ ] Step 1: Tests: PKCE challenge matches known RFC 7636 vector; `getAccessToken refreshes when expired` (mock token endpoint called once, new token stored); `buildSearchQuery` cases; 429 then 200 → resolves after retry (fake timers); `trackToSong` mapping; `parsePlaylistId` three forms.
- [ ] Step 2: FAIL. Step 3: implement. Step 4: PASS. Step 5: Commit.

### Task 9: Playback SDK wrapper and game controller

**Files:** `src/spotify/sdk.ts`, `src/game/controller.ts`, `src/game/controller.test.ts`.

**Interfaces:**
- `loadPlayer(getToken, name = 'Music Bingo DJ'): Promise<{ deviceId: string; player: Spotify.Player }>` (injects `https://sdk.scdn.co/spotify-player.js` once).
- `interface PlaybackPort { play(uri: string, positionMs: number): Promise<void>; pause(): Promise<void>; resume(): Promise<void>; seek(ms: number): Promise<void>; setVolume(pct: number): Promise<void>; position(): Promise<number> }` — implemented over SpotifyApi+deviceId in `store.ts`; faked in tests.
- `class GameController` constructed with `(port: PlaybackPort, order: string[], songs: Map<string, Song>, settings: ClipSettings, events: { onState(s: ControllerState): void; onCall(c: Call): void; onError(msg: string): void }, now = Date.now, rand = Math.random)`.
  - `ControllerState = { phase: 'idle'|'playing'|'paused'|'gap'|'done'; index: number; currentId?: string; clipStartMs: number; clipElapsedMs: number; gapRemainingMs: number; volume: number; muted: boolean; ducked: boolean }`.
  - Methods: `start()`, `next()`, `previous()` (replays previous call without new Call record), `replayLast()` (replays current/last clip from its clip start), `togglePause()`, `seekBy(ms)`, `seekTo(ms)`, `setVolume(pct)`, `toggleMute()`, `toggleDuck()` (duck to 25% of volume), `jumpTo(songId)` (moves song to next position and plays it), `reorder(ids: string[])` (upcoming only), `remove(id)`, `insert(id, at)`, `updateSettings(partial)` (applies to current clip timing immediately where meaningful), `tick()` (called every 250ms by store; drives fades, clip end → gap → auto-advance).
  - A song is recorded as called (`onCall`) only after `port.play` resolves.
- Fades: linear volume ramp over `fadeSec` at clip start and end via `setVolume`.

- [ ] Step 1: Tests with fake port + fake clock: `start` plays first id at computed start and emits one Call; clip end → phase `gap` → after gapSec auto `next`; `next during gap advances once` (no second play when gap would expire); `replay during gap cancels countdown` and replays same uri without new Call; `play failure skips without recording call` (port.play rejects → onError, next song plays, calls length unchanged for failed id); `autoAdvance:false` stays in `gap` with 0 remaining until `next()`; `updateSettings({clipSec: 10})` mid-clip ends clip at 10s; mute sets volume 0 and unmute restores; reorder affects upcoming order only.
- [ ] Step 2: FAIL. Step 3: implement. Step 4: PASS. Step 5: Commit.

### Task 10: Settings page and Spotify connection UI

**Files:** `src/ui/pages/Settings.tsx`, `src/spotify/useSpotify.ts` (hook: `{ connected, profile, api, login, logout }`), test `Settings.test.tsx`.

- [ ] Step 1: Test: entering a Client ID and saving persists via `setSetting('clientId', …)`; shows the exact redirect URI to register; "Connect Spotify" disabled until Client ID present; backup "Download" and "Restore" buttons exist.
- [ ] Step 2: FAIL. Step 3: implement Settings (Client ID, step-by-step Spotify app instructions, connection status, default clip settings form, default print style, branding, backup/restore). App root calls `completeLogin` when `?code=` present then cleans the URL. Step 4: PASS. Step 5: Commit.

### Task 11: Playlists (pools) UI with search, presets, tagging, import/export

**Files:** `src/ui/pages/Pools.tsx`, `src/ui/pages/PoolEditor.tsx`, `src/ui/components/SongRow.tsx`, `src/ui/components/ImportDialog.tsx`, test `PoolEditor.test.tsx` (mock SpotifyApi).

- [ ] Step 1: Tests: clicking preset "80s" calls `searchTracks` with `year:1980-1989`; adding a result adds song tagged with the active category; editing a song's start "1:05" stores `startMs: 65000`; health meter shows "needs 5 more" for short category; importing a JSON file adds songs per merge mode; text import shows matched/candidate/not-found groups before saving.
- [ ] Step 2: FAIL. Step 3: implement — left: search box + filters (year range, genre) + preset chips + "Load more"; right: pool list with category tabs, per-song tag chips, start marker input, display-title edit, exclude toggle, art thumbnails; toolbar: Import (JSON / CSV-text / Spotify playlist picker / paste link / other pool), Export (JSON, CSV, Spotify playlist, print list). Step 4: PASS. Step 5: Commit.

### Task 12: Card designer and print views

**Files:** `src/ui/pages/Designer.tsx`, `src/ui/pages/Print.tsx`, `src/ui/components/CardGrid.tsx`, `src/ui/print.css`, test `CardGrid.test.tsx`.

**Interfaces:** `CardGrid({ card, layout, songsById, style, marked?, highlightMask?, size: 'print'|'screen'|'phone', onToggle? })` reused by Print, Check, Phone.

- [ ] Step 1: Tests: 5×5 categories layout renders 5 headers equal to `columnCategories`; free cell shows `freeText`; card number renders zero-padded `#0042`; `cellContent:'artist'` shows artist names; marked cells get `data-marked="true"`.
- [ ] Step 2: FAIL. Step 3: implement Designer (pick pool, layout options incl. variants: Decade Dash preset for column categories, Mixtape (`PrintStyle.showArt` adds album art behind cell text), Two-for-One (`PrintStyle.bonusCorners` stars the 4 corners), Mystery Column (`PrintStyle.mysteryColumn: number | null` prints "?" for that header), count, seed reroll, validation panel, forecast panel for chosen pattern with "Tune call order" window, style pickers, live preview) → "Generate & save" stores CardSet → Print route renders sheets with `@page` size per paper, per-page grid, cut lines, logo, small QR of card number, plus "Host master sheet" and "Phone QR poster" print modes. Step 4: PASS; also screenshot `/print/:id` via Playwright at Letter size and visually check. Step 5: Commit.

### Task 13: Game setup, console, audience display, rounds, live winners

**Files:** `src/game/store.ts`, `src/game/broadcast.ts`, `src/ui/pages/Console.tsx`, `src/ui/pages/Audience.tsx`, `src/ui/components/{Transport,Queue,ClipSettingsPanel,WinnerTracker,RoundBar}.tsx`, test `Console.test.tsx` (fake port).

- [ ] Step 1: Tests: keyboard Space toggles pause, `ArrowRight` next, `r` replay, `m` mute; changing gap slider while live calls `updateSettings`; WinnerTracker lists card numbers from `liveWinners`; ending a round with a recorded winner starts next round with new pattern; Game persisted after each call (`saveGame` called).
- [ ] Step 2: FAIL. Step 3: implement — Home "New Game" flow (name, pool, card set, rounds/patterns, call order: random or tuned) creating a `Game`; Console layout: now-playing (art, title hidden if `hideTitles`, scrub bar), transport (prev, replay, play/pause, next, ±10s), volume + mute + duck, clip settings panel (live), queue (drag reorder, remove, insert from pool, jump), called list with times, round bar with pattern, winner tracker, device picker, "Open audience display" (window.open `#/audience`), visual EQ animation. Broadcast `{ callNumber, total, phase, gapRemainingMs, revealed?: {title, artist, art}, pattern, phoneQr? }`. Step 4: PASS. Step 5: Commit.

### Task 14: Claim checker and history

**Files:** `src/ui/pages/Check.tsx`, `src/ui/pages/History.tsx`, tests for both.

- [ ] Step 1: Tests: entering `42` for an active game shows the card with called cells marked and verdict "VALID" with "Bingo on call 17"; incomplete card shows "NOT YET" and count of marked/needed; phone number 5xxx regenerates via `generateCard`; History lists games newest first, opening one shows call order with timestamps and winners; CSV export of a game contains each call.
- [ ] Step 2: FAIL. Step 3: implement (Check also reachable as a slide-over from Console; "Record winner" form; History has "Reprint cards" → `/print/:setId` and "Export CSV/JSON"). Step 4: PASS. Step 5: Commit.

### Task 15: Phone card page

**Files:** `src/ui/pages/Phone.tsx`, test `Phone.test.tsx`.

- [ ] Step 1: Tests: visiting `#/phone?d=<encoded>` renders a card numbered 5000–9999; reload (same localStorage) keeps the same number; tapping a cell toggles mark and persists; garbage `d` shows "This card link is broken — ask the host for a new QR".
- [ ] Step 2: FAIL. Step 3: implement; Console/Print expose the QR built from `encodePhoneDef` (warn if URL > 2,500 chars: "Pool too large for a single QR — use fewer songs or print cards"). Step 4: PASS. Step 5: Commit.

### Task 16: README, final verification, deploy

- [ ] Step 1: README: what it is, Spotify developer app setup (create app, add redirect URIs `http://127.0.0.1:5173/` and the Pages URL, select Web API + Web Playback SDK, paste Client ID), running locally, enabling GitHub Pages (Source: GitHub Actions), how to play.
- [ ] Step 2: `npx vitest run` all PASS; `npm run build` succeeds; Playwright smoke: load each route, no console errors; screenshot console + print.
- [ ] Step 3: Commit and push.
