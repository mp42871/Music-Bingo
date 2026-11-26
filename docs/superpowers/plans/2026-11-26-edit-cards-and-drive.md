# Edit Card Sets + Drive Backup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Edit saved card sets (look, add cards, swap songs, change layout) and back up/restore everything to Google Drive.
**Architecture:** Pure set-editing functions in `src/core/cardEdit.ts`; a `/sets/:id` editor page reusing an extracted `StyleControls`; Designer gains `?edit=<setId>` mode. Drive via Google Identity Services token client + Drive REST (`drive.file`) in `src/drive/`.
**Spec:** `docs/superpowers/specs/2026-11-26-edit-cards-and-drive-backup-design.md`

## Global Constraints
- Card numbers never change; printed numbers stop at 4999.
- Sets used by any game: swaps/layout changes save as a new set named "`<name>` v2" (v3…); look edits and added cards apply in place.
- Drive scope exactly `https://www.googleapis.com/auth/drive.file`; folder "Music Bingo Backups"; file `Music Bingo backup YYYY-MM-DD HH-mm.json`; keep newest 20.
- Auto-backup runs on the End game click; offline → queued (flag in settings), retried on next click while online.

## Review Focus
1. Swap where the replacement already sits on a card → that card gets another fitting song, never a duplicate. → Task 1 test.
2. Remove a song when a column has no spare fitting song → clear error, set unchanged. → Task 1 test.
3. Adding cards to a set whose pool can't make more unique cards → capped with message. → Task 1 test.
4. Google token expired at auto-backup → re-requests via the click; failure shows a message, never blocks End game. → Task 4 test.
5. Restore picks a backup from another computer with overlapping ids → merge keeps both sides (existing importBackup semantics). → Task 4 test.

### Task 1: Core edits — `src/core/cardEdit.ts`
- `addCards(set: CardSet, count: number): { set: CardSet; added: number[]; message?: string }` — new numbers from max+1 using `set.seed`, deduped against existing card signatures, capped at 4999.
- `swapSong(set: CardSet, songId: string, replacementId: string | null): { set: CardSet; changed: number[] }` — throws `SwapError` when a card has no fitting alternative. Fitting = same column source (`songsForColumn` over `setPool(set)`), not already on that card. Random choice seeded by `hashSeed(set.seed, 'swap', songId, card.number)`. Artist-bingo sets: swap by artist name.
- `nextVersionName(name: string, existing: string[]): string` — "X v2", "X v3".
- `parseCardRange(s: string): number[]` — "41-60", "3,9,12".
- Tests for each, including Review Focus 1–3.

### Task 2: Set editor page + print subset
- Extract `StyleControls({ style, onChange, layout })` from Designer's Look section (Designer uses it unchanged).
- `src/ui/pages/SetEditor.tsx` route `/sets/:id`: sections Name & look (Save look), Add cards (+ "Print only the new cards" → `/print/:id?cards=…`), Swap songs (song picker over songs on cards, Remove / Replace with…, result "N cards changed" + print link), Change layout (link `/designer?edit=:id`). In-use banner when a game used the set.
- Print page honours `?cards=`.
- Designer "Saved card sets" rows get **Edit**.
- Designer `?edit=<id>`: prefill pools/layout/style/count/start/seed from set; primary button "Rebuild cards" → replaces set in place, or new "v2" set if used in a game (confirm text states which).
- Tests: SetEditor look save keeps cards; add cards; swap shows changed count; used-in-game swap creates v2; Print subset renders only listed cards; Designer edit prefill + rebuild.

### Task 3: Google sign-in + Drive client — `src/drive/`
- `google.ts`: `loadGis()`, `getDriveToken({ interactive }): Promise<string>` (GIS `initTokenClient`, cache token+expiry, `prompt: ''` when previously granted).
- `drive.ts` class `DriveBackups(getToken)`: `folderId()`, `upload(name, json)`, `list(): {id,name,createdTime,size}[]` newest first, `download(id)`, `prune(keep=20)`.
- `DEFAULT_GOOGLE_CLIENT_ID` in `src/drive/config.ts` (empty until provided); Settings field overrides.
- Tests with fetch mocks: folder created once then reused; upload multipart body has name+parent; list ordering; prune deletes oldest beyond 20.

### Task 4: Settings UI + auto-backup
- Settings "Google Drive" section: Client ID, Connect, Back up now, Restore (list → merge/replace), auto-backup toggle, last backup / pending status, setup steps.
- `backupNow()` in `src/drive/backup.ts` (uses `exportBackup`, records `driveLastBackupAt`, clears pending flag). `autoBackupOnClick()` called from End game handler: if enabled — online → backupNow (errors → notice); offline → set pending.
- Tests: Back up now uploads and shows time; restore merge calls importBackup; End game triggers backup when enabled; offline marks pending; token failure shows message and game still ends.

### Task 5: Verify, review, merge (after asking)
Full suite, build, smoke; fresh reviewer; fix important findings; ask before merging.
