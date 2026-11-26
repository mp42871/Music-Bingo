# Edit card sets + Google Drive backup — Design

Date: 2026-11-26 · Status: draft for approval

## A. Edit a card set

**Why:** fix a set after making it — rename/restyle, add players, drop a song, or change the layout — without starting over.

**Where:** Cards → Saved card sets → **Edit** opens `/sets/:id` with four sections.

1. **Name and look** — name, title, subtitle, theme, colors, logo, paper, cards per page, cut lines, art, bonus corners, mystery column. Live preview. **Save** changes only the look; every square stays the same; reprint any time.
2. **Add more cards** — "Add N cards" continues the numbering (e.g. #0041–#0060), never duplicates an existing card, stops at #4999. **Print only the new cards** button.
3. **Swap songs** — pick a song on the cards → **Remove** (each card holding it gets a different song that fits that column) or **Replace with…** (a chosen song; a card that already has it gets a different fitting song). Shows "12 cards changed" with **Print only changed cards**.
4. **Change layout** — opens the card designer pre-filled with the set (playlists, size, columns, theme…). Saving rebuilds every card under the same name; everything must be reprinted (stated before saving).

**Sets already used in a game:** Adding cards is safe (new numbers only). Sections 3–4 change existing squares, which would break claim checks and history for that game, so they save as a **new set "Name v2"** and the old set stays for history (said before saving). Section 1 always edits in place.

Print page gains `?cards=41-60` / `?cards=3,9,12` to print a subset.

## B. Google Drive backup & restore

**Why:** don't lose playlists, cards and game history if the laptop or browser data is lost; move to another computer.

- **Settings → Google Drive:** Connect Google · **Back up now** · **Restore from Drive** (list of backups, newest first, with date and size → merge or replace) · **Back up automatically when a game ends** (on by default once connected).
- Backups are the existing backup JSON (playlists, card sets, games, settings — not music files), saved as `Music Bingo backup YYYY-MM-DD HH-mm.json` in a Drive folder **Music Bingo Backups**. Keep the newest 20; older ones the app made are deleted.
- **Access:** Google sign-in in the browser (Google Identity Services token client) with scope `drive.file` — the app can only see files it created. No server.
- Google's browser sign-in lasts about an hour, so automatic backup runs when you press **End game** (a click, so the Google sign-in can refresh). If you're offline then, it's queued and runs next time a click happens while online; the Settings panel shows "Last backup: … / Backup waiting for internet".
- **Host setup (one time, ~10 min):** Google Cloud console → new project → enable Google Drive API → OAuth consent screen (External, app name, your email; add scope `drive.file`; publish to production — `drive.file` needs no Google review) → Credentials → OAuth client ID (Web) with authorized JavaScript origins `https://mp42871.github.io` and `http://127.0.0.1:5173`. Paste the Client ID in Settings (or give it to me to build in).

## Approaches considered

- Edit: (1) everything in place — rejected, breaks history/claims for played sets; (2) always copy — rejected, clutters sets; (3) **in place unless used in a game, else new version** — chosen.
- Drive: (1) **backup file per save via `drive.file`** — chosen; (2) app-data hidden folder (`drive.appdata`) — hidden from you in Drive, harder to see/share; (3) live sync — declined.

## Builder's calls

- Card changes keep card numbers; swaps are deterministic from the set seed.
- `CardSet.usedInGame` derived from the games table at edit time.
- Auto-backup on End game only (not on a timer).
- Google Client ID default built in once provided; editable in Settings.
