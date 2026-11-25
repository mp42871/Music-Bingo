# Music Bingo — Design

Date: 2026-11-25
Status: Draft for approval

## 1. Intent

A web app the **host** uses to run music bingo end to end at private parties,
charity events, and work gatherings: build a song playlist, generate and print
randomized cards, play song clips through the host's Spotify Premium account
with DJ-style controls, randomize the call order, verify bingo claims in
seconds, and keep a history of every game.

Players primarily use **printed paper cards** they daub by hand. Phone cards are
an optional extra. The host experience should feel like a DJ booth: dark, neon,
energetic — but simple enough to run while talking to a crowd.

## 2. Goals

- Run a whole game from one screen: play, pause, resume, seek, volume, mute,
  replay last song, skip, jump to any song.
- Change settings mid-game without stopping (clip length, gap, start point,
  auto/manual advance, volume, remaining queue).
- Build playlists in-app from categories (decades, genres, presets like
  "80s", "90s", "Top Country") and search.
- Cards with **category columns** (one category per column instead of B‑I‑N‑G‑O),
  a **single-category board**, or other themed layouts.
- Print cards in multiple styles, sizes, colors, and per-page layouts.
- Verify a claim by **card number** in seconds, with called songs highlighted.
- Keep a history of games: what was played, in what order, who won.
- Phone cards (Phase 1: standalone links; Phase 2: live-connected).

## 3. Non-goals

- Player accounts, logins, or app installs.
- Selling or ticketing; payment handling.
- Non-Spotify audio sources in Phase 1 (local MP3s could come later).
- Multi-host collaboration.

## 4. Anti-goals (failure even if it "works")

- Anything that can break mid-event when it doesn't need to (e.g. requiring a
  server for paper-only games).
- A cluttered console where the host hunts for the pause button.
- Cards that are hard to read when printed, or that produce a flood of
  simultaneous winners with no warning.

## 5. Constraints

- **Spotify:** the host registers a free Spotify developer app (requires
  Premium — host has it) and pastes its **Client ID** into Settings. Auth uses
  Authorization Code with PKCE (no secret, no server). Development-mode apps are
  capped at a handful of users (fine: only the host signs in). Playback uses the
  **Web Playback SDK** (the browser tab becomes a Spotify device) or controls
  another Spotify Connect device (e.g. a speaker/phone at the venue).
- Since late 2024 new Spotify apps can't use recommendations, audio
  analysis, featured/category playlists, or (in many cases) Spotify-owned
  editorial playlists. Category building therefore uses **Search with
  `year:` / `genre:` filters**, the host's own playlists, pasted playlist links,
  and in-app presets. No automatic "find the chorus."
- 2026 dev-mode changes reduced some endpoints and quotas; the app must handle
  rate limits / quota errors gracefully (back off, show a clear message) and
  keep search requests small and paginated.
- Spotify redirect URIs must be HTTPS or loopback (`http://127.0.0.1:<port>`).
- No backend in Phase 1. All data lives in the host's browser (IndexedDB) with
  **export/import backups** so history isn't lost.

## 6. Approaches considered

1. **Paper first + phone cards as standalone links (no server)** — free, nothing
   to maintain, works offline except for streaming; phones can't notify the host.
2. **Live-connected phones via a free realtime service (Supabase/Firebase)** —
   players join the host's game by QR; "Bingo!" pops up on the host screen
   pre-verified. Needs a free account, venue connectivity, more moving parts.
3. **Own server** — dropped: cost and upkeep without real benefit.

**Chosen:** build **1 first**, structured so **2** is added as Phase 2. Paper is
the primary experience, so the host console, printing, and claim checking get
polish first; live phones become an upgrade, not a dependency.

## 7. Architecture

- **Stack (builder's call, stated):** React + TypeScript + Vite; Tailwind CSS;
  Zustand for state; Dexie (IndexedDB) for storage; `qrcode` for QR codes;
  `lz-string` for compact phone-card links; Vitest for tests.
- **Hosting:** GitHub Pages (free HTTPS) from this repo, plus local dev on
  `http://127.0.0.1:5173`. Both URLs registered as Spotify redirect URIs.
- **Modules**
  - `spotify/` — PKCE auth & token refresh; Web API client (search, playlists,
    devices, play/seek/volume); Web Playback SDK wrapper; rate-limit handling.
  - `library/` — saved song pools ("bingo playlists"), categories, presets.
  - `cards/` — seeded deterministic card generation, card-set statistics,
    print layouts.
  - `game/` — game state machine, call order, clip timer, claim checker,
    live "who has bingo" tracker.
  - `history/` — persisted games, export/import.
  - `ui/` — host console, playlist builder, card designer, print view,
    claim checker, history, settings, audience display, phone card page.
- **Determinism:** every card set has a seed. Card *N* of a set can always be
  regenerated from (seed, card number, song pool, layout). The full set is also
  stored so history and reprints are exact.

## 8. Features

### 8.1 Playlist builder ("song pools")
- Search Spotify by text; filters for **year/decade range** and **genre**.
- **Preset categories** (one click fills a search): 60s, 70s, 80s, 90s, 2000s,
  2010s, 2020s, Top Country, 80s Rock, 90s Hip‑Hop, Disco, Motown, Boy Bands,
  One‑Hit Wonders, Movie Soundtracks, Christmas, Party Anthems, Yacht Rock,
  Emo/Pop‑Punk, Latin, etc. Presets are editable/user-addable (name + query).
- Import from the host's Spotify playlists or a pasted playlist link.
- Each song in a pool can be **tagged with one or more categories** (used for
  category columns), given a **custom start point** (mm:ss), a display-title
  override (e.g. shorten "… – 2011 Remaster"), and excluded/included.
- Duplicate detection (same title+artist across versions).
- Pool health meter: songs needed vs available for the chosen card layout
  (e.g. 5×5 with 5 category columns needs ≥ 5 songs per column, recommends 15+
  per column / 50–75 total).
- Optional: save the pool back to Spotify as a playlist.

### 8.1a Playlist import / export
- **Export** a pool as:
  - **Bingo playlist file (`.json`)** — full fidelity: songs, Spotify IDs,
    category tags, custom start points, display-title overrides, exclusions.
    Re-importing restores it exactly (e.g. move to another computer or share
    with another host).
  - **CSV** — title, artist, album, year, Spotify link, categories, start point;
    opens in Excel/Google Sheets.
  - **Spotify playlist** — creates/updates a playlist in the host's account.
  - **Printable song list** (PDF via print).
- **Import** from:
  - a bingo playlist `.json` file (exact restore; merge into an existing pool
    or create a new one),
  - **CSV / Excel-exported CSV / pasted text** ("Artist – Title" per line, or
    columns) — each line is matched via Spotify search; the host reviews a
    match list (confident / pick from candidates / not found) before saving,
  - a Spotify playlist (own playlists or pasted link),
  - another pool in the app (copy/merge).
- Duplicate handling on import: skip, keep both, or replace.

### 8.2 Card layouts & themes
- Grid sizes: **3×3, 4×4, 5×5**. Free space on/off with custom text or logo.
- Header modes:
  - **Category columns** — each column header is a category (e.g. 70s | 80s |
    90s | Country | Rock); that column only gets songs from that category.
  - **Whole-board theme** — one category for the entire card.
  - **Classic letters** — custom 5-letter word (BINGO, MUSIC, PARTY, or any).
- Cell content options: song title, artist, title + artist, or **"Artist
  Bingo"** (cells show artist names; any of their songs called counts).
- Fun variants (builder's suggestions): **Decade Dash** (columns are decades),
  **Mixtape** (album-art cells), **Two-for-One** (corner cells worth double for
  side prizes), **Mystery Column** (header revealed mid-game).
- Generation guarantees: no duplicate cards; no duplicate songs on a card;
  balanced song usage across the set.
- **Winner forecast:** for a given call order, simulate how many calls until the
  first winner and how many cards would win at once; warn if too fast or if
  many cards tie. Optional "shuffle until first winner lands between calls X–Y".

### 8.3 Printing
- Paper: US Letter & A4. Cards per page: 1, 2, 4 (also 6 for 3×3).
- Styles: Neon Club, Retro Vinyl, Clean Minimal, Cassette, Festival, Holiday;
  color pickers for accent/background; ink-saver (white background) toggle.
- Event title, subtitle, sponsor/charity logo upload, card number (large,
  plus small QR encoding card number for quick scan-to-check), cut lines.
- Also printable: **host master sheet** (call list with checkboxes in call
  order), and table tents/posters with the phone-card QR.
- Implemented as print-optimized pages + browser "Print / Save as PDF".

### 8.4 Game console (DJ booth)
- Big now-playing panel: album art, title/artist (can be **hidden** from the
  host view until revealed, toggle), progress bar with **scrubbing**,
  call number "Song 14 of 60".
- Transport: play/pause, **replay last song** (from its clip start), skip to
  next, previous, restart clip, seek ±10s, jump to any song in queue.
- Volume slider + **mute**, fade in/out on clip start/end.
- Clip settings, all editable **live**:
  - clip length (e.g. 15s–full song),
  - gap between songs (0–60s) with on-screen countdown,
  - start point: song start / fixed offset / random within a range / per-song
    custom marker,
  - auto-advance vs manual (host presses Next),
  - talk-over ducking (lower volume while host announces — button/hotkey).
- Queue panel: upcoming calls (drag to reorder, remove, insert song), called
  list with timestamps.
- Keyboard shortcuts (Space pause, → next, R replay, M mute, ↑/↓ volume).
- Device picker: this browser or any Spotify Connect device.
- **Audience display** (second window / projector, optional): song count,
  countdown, visualizer animation, optionally reveal title after each clip,
  current pattern (e.g. "Playing for: 4 Corners"), phone-card QR.
- **Live winner tracker:** because the app knows every card, it shows
  "cards with bingo right now: #0042, #0117" — host can wait for claims.
- Rounds: multiple rounds per game with the same cards (e.g. One Line → Two
  Lines → Full House), each with its own winning pattern.

### 8.5 Winning patterns
Single line (any row/column/diagonal), two lines, four corners, X, T, L,
plus/cross, frame/outside edge, small/large diamond, blackout, and a
**custom pattern drawer** (click cells to define).

### 8.6 Claim checker
- Enter or scan the card number → shows that card with called songs
  highlighted, uncalled songs dimmed, the current pattern overlaid, and a clear
  **VALID / NOT YET** verdict with which calls completed it (and the call number
  where it first became valid — helps resolve "who was first").
- Record winner (optional name/prize), continue the round or end it.

### 8.7 History
- Every game saved: event name, date, pool, settings, card set (seed + cards),
  rounds, full call order with timestamps, winners.
- Browse, search, re-open read-only, **reprint cards** for a past set, replay a
  game's call list, export CSV/JSON, delete.
- Backup/restore all data to a JSON file.

### 8.8 Phone cards — Phase 1 (standalone)
- Phone cards use a reserved number range (e.g. 5000–9999) so they never
  collide with printed cards.
- The host shows **one QR** (projector / table tent). It encodes a compact link
  containing the card-set definition (seed, layout, song pool) compressed into
  the URL fragment. The phone picks a random unused-looking card number from
  the phone range, generates its card deterministically, and stores it locally
  so a refresh keeps the same card. (Small chance two phones pick the same
  number; acceptable — the checker would just show both as the same card.)
- Phone card page: tap to daub, works offline, shows its card number large
  for the host to check like paper.
- No connection back to the host in Phase 1.

### 8.9 Phone cards — Phase 2 (live)
- Free realtime backend (Supabase preferred). Host creates a game room; QR
  joins the room; server hands out unique card numbers.
- Player "Bingo!" button → instant alert on host console with auto-verification.
- Optional auto-daub for phone players; player names; host sees player count.
- Paper games continue to work with no backend.

## 9. Settings
Spotify Client ID & connection, default device, default clip/gap/start
behavior, fade times, default card layout/style, paper size, branding (event
name, logo), hide-titles-on-host-screen default, keyboard shortcuts reference,
data backup/restore.

## 10. Testing
- Unit tests: seeded RNG & card generation (no duplicates, column constraints,
  determinism), pattern matching, claim checker, winner forecast, call-order
  shuffling, clip-timing state machine, phone-link encode/decode.
- Spotify layer tested with a mocked client; manual checklist for real playback.
- Visual check of print pages via headless browser screenshots.

## 11. Builder's calls (made without asking)
- Tech stack (React/TS/Vite/Tailwind/Zustand/Dexie) and GitHub Pages hosting.
- Card numbers: printed 0001–4999, phone 5000–9999.
- Default settings: 30s clips, 5s gap, random start between 0:30–1:15 (or the
  song's custom marker), manual advance off (auto), fades 1.5s.
- Fun variants list and preset category list (editable in-app).

## 12. Build order (Phase 1)
1. Project scaffold, theme, navigation shell.
2. Card engine (seeded generation, patterns, checker, forecast) — pure logic.
3. Spotify auth + search + playback.
4. Playlist builder with presets & category tagging.
5. Card designer + print layouts.
6. Game console + audience display + live winner tracker.
7. Claim checker, history, backup.
8. Phone-card standalone page.
9. Deploy to GitHub Pages.

Phase 2 (live phones) follows as a separate plan.
