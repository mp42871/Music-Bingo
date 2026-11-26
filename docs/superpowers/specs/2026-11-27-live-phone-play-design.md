# Live phone play — design

Date: 2026-11-27 · Status: draft for approval
Supersedes the "phone cards via a QR that carries the whole game" approach for hosts who set up live play.

## Why
The old phone QR carried every song title, so it was too dense to scan from a screen, players couldn't
choose their card, and nothing reached the host. Players need: a short way in, their own card(s), easy
daubing with undo, and a BINGO button the host sees.

## Player experience
- **Join:** the players' screen shows **"Join at mp42871.github.io/Music-Bingo — code 4821"** plus a small,
  easy QR for `…/#/join/4821`. Typing the site address gives a code box.
- **Pick a card:** enter a card number (e.g. the paper card in your hand) **or** "Give me a random card"
  (an unused number 5000–9999). Optional first name. **Add another card** to play several (tabs).
- **Daub:** tap a square to daub/undaub; **Undo** (last daub, repeatable) and **Clear card** (confirm).
  Daubs live on the phone and survive a reload. No auto-daub — players listen, like paper.
- **BINGO!** button → sends a claim. The phone shows "Sent — the host is checking card #5123".
- Big card number always visible. Works on any phone browser; needs internet.

## Host experience
- Console header: **Live: 4821 · 12 phones** once live play is set up (game goes live automatically
  when the console opens; ends when the game is finished or you press Stop live).
- **Claims pop up** on the console: "Sam · card #5123 says BINGO — VALID ✓ (on song 17)" or "NOT YET",
  already checked with the current round's pattern, with **Check card** / **Record winner** / **Dismiss**.
- Quick game: players' screen switches to the join code automatically.

## How it works (no server of our own)
- Free **Supabase** project owned by the host (Project URL + publishable/anon key in Settings,
  like the Spotify/Google IDs; never built in).
- Tables: `live_games(code pk, host uid, title, def jsonb, status, created_at)`,
  `live_players(id, code, card_number, name, joined_at)`, `live_claims(id, code, card_number, name, created_at)`.
  `def` = the compact phone-card definition (seed, layout, song titles/artists/categories) — never Spotify IDs.
- Security (Row Level Security): the host signs in anonymously (Supabase anonymous sign-in) and only
  that host can create/update/delete their game and read its claims and players; anyone can read a game
  by code, and add a player or a claim to an existing open game. Realtime streams claims/players to the host.
- Codes: 4 digits, unique among open games; old games (>48 h) are removed when a new one is published.
- Cards: a phone card N is `generateCard(def, seed, N)` — identical to what the host's claim check uses
  (numbers ≤4999 = the printed card with that number).
- One-time setup (~10 min): create Supabase project → run the provided SQL (copy button in Settings)
  → Authentication: enable **Anonymous sign-ins** → paste Project URL + publishable key in Settings.
- Without setup, the old phone link still works as a fallback.

## Approaches considered
- Full-screen dense QR only — no setup, but no short link and nothing reaches the host. Declined.
- Google Drive public file — needs an extra API key, no live claims. Declined.
- **Supabase (chosen)** — short code, card choice, live claims; free tier is plenty.

## Builder's calls
- 4-digit codes; random phone numbers avoid numbers already taken in that game.
- A player may pick a printed number (to mirror their paper card); two phones may hold the same
  printed number, but random picks never collide.
- Claims are rate-limited on the phone (one pending claim per card at a time).
