# Music Bingo DJ

A web app for hosting music bingo at parties, charity events and work gatherings. It covers the whole game: building playlists, printing cards, playing clips through Spotify, checking claims and keeping a history of every game.

## What it does

- **Playlists.** Search Spotify by keyword, decade or genre, or use one-click categories (80s, 90s, Top Country, Yacht Rock and more). You can tag songs with categories, mark where each song should start, and shorten long titles for the cards.
- **Import and export playlists.** Bingo playlist files (.json), spreadsheets (.csv), pasted "Artist – Title" lists, and Spotify playlists all work in both directions.
- **Card layouts.** Cards come in 3×3, 4×4 or 5×5. The headers can be category columns (like 80s | 90s | Country), one theme for the whole card, or a custom word. Squares can show titles, artists, both, or use "artist bingo".
- **Fun variants.** Decade Dash, album-art squares, bonus corners, and a mystery column.
- **Printing.** Six styles (Neon club, Retro vinyl, Clean minimal, Cassette, Festival, Holiday), custom colors, ink saver, your logo, and 1, 2, 4 or 6 cards per page on Letter or A4. Every card has a number and a QR code. You can also print a host call sheet and a QR poster for phone cards.
- **Winner forecast.** Shows roughly when the first bingo will happen and how many people will win at once. You can also aim the call order so the first bingo lands between, say, songs 12 and 20.
- **DJ console.** Play, pause, seek, ±10 seconds, next, previous, replay the last song, volume, mute, and a talk-over button that lowers the music while you speak. You can change clip length, break length and start point mid-game, and drag the queue to reorder it. Keyboard shortcuts are listed on screen.
- **Rounds.** Keep the same cards for one line, then two lines, then a full card. There are 11 built-in patterns, plus a custom pattern you draw yourself.
- **Live winner tracker.** Shows which card numbers have bingo right now, before anyone shouts.
- **Claim check.** Type or scan the card number to get a VALID or NOT YET result, including which song completed the bingo. You can record winners and prizes.
- **Players' screen.** A second window to put on a TV or projector. It shows the song count, a countdown, the current pattern, an optional reveal of each song, and the phone-card QR code.
- **Phone cards.** Players scan a QR code and get their own card (numbers 5000–9999). They tap squares to daub and it works offline. Phone cards connected live to your console are planned for phase 2.
- **History.** Every game is saved with each song called, timestamps and winners. You can reprint cards, export CSV or JSON, and back up or restore everything.

All data stays in your browser. Use **Settings → Backup** now and then.

## Playing offline

Spotify can't stream without internet, so offline games use **your own music files**, **manual play** from the Spotify app, or a mix of both. Each song uses the best source it has.

**Before the event, while you're online:**
1. Open the app once on the laptop you'll use. It saves itself for offline use, and Chrome and Edge also offer to **Install** it.
2. **Music files:** add MP3, M4A, WAV, OGG or FLAC files you own. In each playlist, press **Link music files** to match them to songs. You can also make a playlist straight from your files.
3. **Optional, for songs without a file:** open the game's console and press **Save call order to Spotify**. Download that playlist in the Spotify app with shuffle off.
4. The game setup screen and the console's **Offline** panel tell you how many songs will play automatically.

**At the venue:** the Online/Offline badge shows the connection.
- Songs with a file play with every console control: clip length, start point, fades, seek, replay, volume and talk-over.
- Songs without a file show **Play now in Spotify: Title — Artist**. Play it in the Spotify app, then press **Played** or Space.
- **Music source** in Live settings can be switched mid-game: *Automatic*, *Prefer my files* or *Manual only*.

Music files are stored only in this browser and are not included in backups. Phone cards need the players' phones to be online.

## One-time Spotify setup

You need Spotify **Premium**.

1. Go to <https://developer.spotify.com/dashboard> and create an app.
2. Under **APIs used**, tick **Web API** and **Web Playback SDK**.
3. Add these **Redirect URIs**:
   - `https://mp42871.github.io/Music-Bingo/`, for the hosted app
   - `http://127.0.0.1:5173/`, for running it on your own computer
4. Your Client ID is already built into the app. Open **Settings** and press **Connect Spotify**.

Spotify development-mode apps allow up to 5 signed-in users, which is fine for a host-only tool. Spotify's own editorial playlists may not import, but your own playlists do.

## Running it

```bash
npm install
npm run dev     # http://127.0.0.1:5173/
npm test        # unit and UI tests
npm run build   # production build in dist/
```

### Publishing on GitHub Pages

1. In the repo, go to **Settings → Pages → Source** and choose **GitHub Actions**.
2. Merge to `main`. The workflow in `.github/workflows/deploy.yml` tests, builds and publishes the app.

## Running a game

1. **Playlists:** make a playlist and tag songs with categories. You need at least 5 per column for 5×5 cards; 15 or more gives more variety.
2. **Cards:** pick a layout and style, check the forecast, then **Make cards & print**. In the print dialog, turn on "Background graphics" and set margins to "None".
3. **Play:** choose the card set and first pattern, then open the DJ console. Use **Open screen for players** for the TV.
4. When someone shouts, use **Check a card** and enter their card number.
