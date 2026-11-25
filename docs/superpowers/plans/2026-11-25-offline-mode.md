# Offline Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run whole games with no internet: installable cached app, songs played from the host's own music files, and a manual "play it in the Spotify app" mode — chosen per song.

**Architecture:** Service worker precaches the app; fonts bundled; Spotify art cached at runtime. Music files live in a new Dexie `audio` table and link to songs via `Song.fileId`. A `HybridPort` decides per song (policy + online state + file presence) between Spotify, a Web-Audio file player, or "manual"; the controller gains a `manual` phase that records the call when the host confirms.

**Tech Stack:** existing stack + `vite-plugin-pwa@2`, `@fontsource/bungee`, `@fontsource/sora`, `music-metadata@12` (`parseBlob`).

**Spec:** `docs/superpowers/specs/2026-11-25-offline-mode-design.md`

## Global Constraints

- Everything except Spotify search/import/export/playback must work with `navigator.onLine === false`.
- Source policies: `auto` (default) | `files` | `manual`, live-switchable in the console.
- Manual songs never auto-advance; the call is recorded on **Played** or **Next**.
- Ambiguous file matches go to review, never guessed.
- Backups exclude audio blobs.

## Review Focus

1. **Offline reload of the installed app.** Expect the app and fonts to load from cache with zero network. → Task 7 Playwright offline check.
2. **Spotify fails mid-game when the connection drops (auto policy).** Expect the next song to use its file (or manual prompt), not a skip storm. → Task 5 test `auto policy falls back to file when Spotify play fails offline`.
3. **Unsupported/corrupt audio file.** Expect a notice and manual prompt for that song, not a stuck console. → Task 5 test `file that fails to decode falls back to manual`.
4. **Manual song then Next.** Expect exactly one call recorded for the manual song before advancing. → Task 5 test `next on a manual song records it once then advances`.
5. **Storage quota exceeded while adding files.** Expect a clear message and the files that fit still saved. → Task 4 test `quota error reports which files were not saved`.

---

## Shared types (Task 2 produces)

```ts
// core/types.ts additions
Song.fileId?: string
ClipSettings.source: 'auto' | 'files' | 'manual'      // DEFAULT_CLIP.source = 'auto'
export interface AudioFile { id: string; name: string; title: string; artist: string; album?: string;
  durationMs: number; size: number; type: string; addedAt: number }
// core/offline.ts
export type Source = 'spotify' | 'file' | 'manual';
pickSource(song: Song, policy: ClipSettings['source'], ctx: { online: boolean; spotifyReady: boolean }): Source
parseFileName(name: string): { title: string; artist: string }
matchFiles(songs: Song[], files: AudioFile[]): { matched: { songId: string; fileId: string }[];
  ambiguous: { songId: string; fileIds: string[] }[]; unmatchedSongs: string[]; unusedFiles: string[] }
readiness(songs: Song[], fileIds: Set<string>): { total: number; withFile: number; manual: number; missing: Song[] }
fileSong(f: AudioFile): Song   // id `file:${f.id}`, uri `file:${f.id}`, fileId f.id
```

### Task 1: Offline app shell and online indicator

**Files:** `vite.config.ts`, `index.html`, `src/main.tsx`, `src/app/online.ts`, `src/ui/components/Nav.tsx`, `src/ui/components/SearchPanel.tsx`, `src/ui/components/ImportDialog.tsx`, `src/ui/pages/PoolEditor.tsx`, tests `src/app/online.test.ts`, `src/ui/components/SearchPanel.test.tsx`.

**Interfaces:** Produces `useOnline(): boolean` (zustand store `useNet` with `online`, updated by `online`/`offline` window events and by `reportNetworkFailure()`), `requestPersistentStorage(): Promise<boolean>`.

- [ ] Tests: `useNet` flips false on `offline` event and true on `online`; SearchPanel with offline state shows "You're offline — Spotify search needs internet. Your saved playlists still work." and disables the search button.
- [ ] Run → FAIL. Implement: VitePWA (`registerType: 'autoUpdate'`, precache `**/*.{js,css,html,woff2,svg,png}`, runtimeCaching CacheFirst for `^https://i\.scdn\.co/` and `^https://image-cdn` max 2000 entries, `navigateFallback: 'index.html'`), manifest (name "Music Bingo DJ", theme `#0d0820`, generated SVG icon); replace Google Fonts with `@fontsource/bungee` + `@fontsource/sora/{400,500,600,700}.css` imports in main.tsx; Nav shows Online/Offline chip; ImportDialog Spotify tab and PoolEditor "Save to Spotify" disabled offline with reason. Run → PASS. `npm run build` emits `sw.js`. Commit.

### Task 2: Offline core logic

**Files:** `src/core/types.ts`, `src/core/clip.ts`, `src/core/offline.ts`, test `src/core/offline.test.ts`.

- [ ] Tests: `parseFileName('01 Queen - Bohemian Rhapsody.mp3')` → `{artist:'Queen', title:'Bohemian Rhapsody'}`, `'Jolene.m4a'` → `{artist:'', title:'Jolene'}`; `matchFiles` matches remaster-suffixed titles, sends two equally-good files to `ambiguous`, lists unused files; `pickSource` table: auto+online+ready+file→spotify, auto+offline+file→file, auto+offline+no file→manual, files+online+file→file, files+no file+online→spotify, manual→manual, auto+online+not ready+no file→manual; `readiness` counts; `fileSong` ids; `DEFAULT_CLIP.source === 'auto'`.
- [ ] FAIL → implement → PASS → commit.

### Task 3: Audio storage

**Files:** `src/db/db.ts` (version 2 adds `audio: 'id, addedAt'` storing `{...AudioFile, blob}`), `src/db/audio.ts`, test `src/db/audio.test.ts`.

**Interfaces:** `saveAudio(meta: AudioFile, blob: Blob)`, `listAudio(): Promise<AudioFile[]>` (no blobs), `getAudioBlob(id): Promise<Blob | undefined>`, `deleteAudio(id)`, `audioUsage(): Promise<{ count: number; bytes: number }>`. `exportBackup` unchanged (audio table excluded).

- [ ] Tests: save/list (list omits blob)/getAudioBlob/delete; usage sums sizes; backup JSON has no `audio` key. FAIL → implement → PASS → commit.

### Task 4: Music library UI and linking

**Files:** `src/audio/ingest.ts` (`readAudioMeta(file: File): Promise<AudioFile & { blob: Blob }>` via `music-metadata` `parseBlob`, falling back to `parseFileName` + `<audio>` duration), `src/ui/pages/Library.tsx` (route `/library`, nav label "Music files"), `src/ui/components/LinkFilesDialog.tsx`, `src/ui/pages/PoolEditor.tsx`, `src/ui/components/SongRow.tsx`, tests `src/ui/pages/Library.test.tsx`, `src/ui/components/LinkFilesDialog.test.tsx`.

- [ ] Tests: adding two files (mock `readAudioMeta`) lists them with titles and shows storage used; `quota error reports which files were not saved` (saveAudio rejects `QuotaExceededError` for the 2nd file → message names it, 1st still listed); "Make a playlist from these files" creates a pool whose songs have `file:` ids; LinkFilesDialog shows Matched/Pick one/No file groups and applying sets `fileId` on songs; SongRow shows a "File" badge when `fileId` set.
- [ ] FAIL → implement (folder picker via `webkitdirectory`, accept `audio/*`, delete file unlinks songs in all pools) → PASS → commit.

### Task 5: Hybrid playback and manual phase

**Files:** `src/audio/filePlayer.ts`, `src/game/hybridPort.ts`, `src/game/controller.ts`, `src/game/store.ts`, tests `src/game/hybridPort.test.ts`, additions to `src/game/controller.test.ts`.

**Interfaces:**
- `PlaybackPort.play(uri, pos): Promise<void | 'manual'>` — `'manual'` means "host plays it elsewhere".
- `FilePlayer { load(blob: Blob, posMs: number): Promise<void>; pause(); resume(); seek(ms); setVolume(pct); stop() }` (HTMLAudioElement + GainNode; injectable in tests).
- `createHybridPort(deps: { spotify: PlaybackPort; file: FilePlayer; getSong(uri): Song | undefined; getBlob(fileId): Promise<Blob | undefined>; policy(): ClipSettings['source']; online(): boolean; spotifyReady(): boolean; onSource(s: Source): void }): PlaybackPort` — routes each call to the active source; on Spotify failure while `auto` and the song has a file, retries with the file (Review Focus 2); file decode failure → returns `'manual'` with a notice (Review Focus 3).
- Controller: `ControllerState.phase` adds `'manual'`; `markPlayed()` records the manual song's call and moves to `gap` (respecting autoAdvance only for non-manual); `next()` from `manual` records it once then advances; tick in `manual` advances `clipElapsedMs` as a guide but never ends the clip.

- [ ] Tests: hybrid routes per `pickSource`; `auto policy falls back to file when Spotify play fails offline`; `file that fails to decode falls back to manual`; controller: manual song not recorded until `markPlayed`; `next on a manual song records it once then advances`; manual never auto-advances after 60s of ticks.
- [ ] FAIL → implement (store builds hybrid port; `useNet` + Spotify connected feed `online/spotifyReady`) → PASS → commit.

### Task 6: Console + setup UI for offline

**Files:** `src/ui/console/Deck.tsx`, `src/ui/console/SourceBadge.tsx`, `src/ui/components/ClipSettingsPanel.tsx`, `src/ui/pages/Home.tsx`, `src/ui/components/Readiness.tsx`, `src/ui/pages/Console.tsx`, tests `src/ui/components/Readiness.test.tsx`, additions to `Console.test.tsx`.

- [ ] Tests: in manual phase the deck shows "Play now in Spotify" with title and artist and a **Played** button that records the call; Space in manual phase = Played; ClipSettingsPanel has "Music source" radio (Automatic / Prefer my files / Manual only) that updates the game; Readiness shows "Offline ready: 3 songs play automatically, 2 will prompt you…" for a 5-song game with 3 files; "Save call order to Spotify" calls `api.createPlaylist(name, uris in callOrder)` and is disabled offline.
- [ ] FAIL → implement → PASS → commit.

### Task 7: Offline verification, docs, review

- [ ] `npm run build && npx vite preview`; Playwright: load once online, `context.setOffline(true)`, reload → app renders, fonts load from cache, open console of a game whose songs have files (seeded via repo + generated WAV blobs), press play → audio element plays, no failed requests except Spotify.
- [ ] README "Playing offline" section. Full suite + tsc + build. Commit, push, final whole-branch review.
