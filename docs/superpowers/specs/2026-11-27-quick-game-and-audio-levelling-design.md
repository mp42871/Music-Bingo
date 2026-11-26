# Quick game + audio levelling — short design

Date: 2026-11-27 · Status: draft for approval

## A. Quick game (crowd request → playing in ~30 s)

**Why:** someone shouts "do a 90s game!" — the host should go from request to playing without visiting four screens.

- **Quick game** button on Home and in the console header (console asks to end/pause the current game first).
- One dialog: **What did they ask for?**
  - pick a category (the ~85 quick categories, searchable), **or**
  - type an **artist** ("Taylor Swift") → that artist's songs, **or**
  - type anything else → Spotify keyword search (marked "loose match").
- Options with sensible defaults: songs **50** (30/50/75), cards **40**, size **5×5**, first pattern **single line**, title = the request ("90s Bingo"), look = last used style.
- **Start** builds: playlist (named after the request, saved like any other), card set (whole-card theme, header = request), game, then opens the **DJ console** with the **phone-card QR turned on** on the players' screen and opens the **print screen in a new tab** (Both).
- Progress shown step by step; if Spotify returns fewer songs than a 5×5 card needs (24), it says so and suggests a smaller card or another category.
- Offline: disabled with a reason (needs Spotify search).

## B. Audio levelling

**Constraint:** Spotify streams are encrypted; apps can't measure or alter them beyond volume, and Spotify withdrew loudness data for new apps (2024).

- **Music files:** measured once when added (and on demand for files added earlier): integrated loudness approximated from decoded audio (RMS with a simple K-weighting-free gate), stored as a per-file gain toward a target of about −14 LUFS, capped at ±9 dB, applied by the file player.
- **Per-song volume trim** (−9…+9 dB, step 1) in the playlist song row for any song (Spotify or file); stored on the song, copied into card sets/games, applied on top of the console volume whenever that song plays (Spotify: scales the volume sent; file: gain).
- Settings note: for Spotify, turn on **Normalize volume** in your Spotify app's settings (applies where Spotify supports it).

## Builder's calls
- Quick game cards: whole-card theme with the request as banner; 5×5, free centre.
- Volume trim scales the host's volume (e.g. 70 with +3 dB → ~99, clamped to 100; −3 dB → ~50).
- File loudness measured in a Web Audio OfflineAudioContext; files that fail to decode keep gain 0.
