# Import playlists from Spotify — short design

Date: 2026-11-25 · Status: approved in chat

**Why:** the host builds playlists in the Spotify app and wants to pull them in, not build them here.

**What**
- Playlists page: primary **Import from Spotify** button → picker of the host's Spotify playlists (cover, name, count), search box, paste-a-link field. Multi-select.
- One playlist → bingo playlist of the same name, no categories (cards default to letter headers).
- Several playlists → one bingo playlist; each Spotify playlist name becomes a category (song in two playlists gets both). Default name "A + B + C", editable.
- The bingo playlist remembers its sources. **Update from Spotify** re-pulls them: adds new songs, removes songs no longer in any source, keeps host settings (start point, music file link, card title, on/off), refreshes source categories. Songs added by hand via search are never removed by an update.
- Search stays inside the playlist editor as a secondary tool. Disabled offline.

**Constraint:** Spotify only returns items for playlists the user owns or collaborates on (editorial playlists fail with a clear message). Playlist items endpoint: try `/playlists/{id}/items`, fall back to `/tracks`.

**Approaches:** (1) improve the buried Import tab — rejected, still two steps; (2) dedicated picker on Playlists page with source tracking — chosen.

**Builder's calls:** `Pool.sources?: {id,name}[]`; `Song.sourceIds?: string[]` marks which source playlists a song came from; single-source pools get no category.
