import { songKey } from '../core/io';
import type { Song } from '../core/types';
import type { SpotifyApi } from './api';

const PAGE = 10; // Spotify's maximum per search request for apps like this (Feb 2026)

/**
 * Gathers up to `want` new songs from one or more searches, 10 at a time, taking turns between queries.
 * Skips songs already seen (including remastered/live repeats). `offsets` lets "Load more" continue.
 * A search that fails is dropped; only if every search fails is the error passed on.
 */
export async function collect(
  api: Pick<SpotifyApi, 'searchTracks'>, queries: string[], want: number,
  offsets: number[] = queries.map(() => 0), seen: Set<string> = new Set(),
): Promise<{ songs: Song[]; offsets: number[]; done: boolean; total: number }> {
  const offs = [...offsets];
  const finished = queries.map(() => false);
  const stale = queries.map(() => 0);
  const songs: Song[] = [];
  let total = 0;
  let guard = 0;
  let failure: unknown = null;
  let answered = false;
  while (songs.length < want && finished.some((f) => !f) && guard++ < 200) {
    for (let i = 0; i < queries.length && songs.length < want; i++) {
      if (finished[i]) continue;
      let r: Awaited<ReturnType<SpotifyApi['searchTracks']>>;
      try { r = await api.searchTracks(queries[i], offs[i], PAGE); } catch (e) { failure = e; finished[i] = true; continue; }
      answered = true;
      if (guard === 1) total += r.total;
      // Spotify sometimes sends fewer than asked; move on by what came back so nothing is skipped.
      offs[i] += r.songs.length || PAGE;
      if (!r.songs.length || offs[i] >= r.total || offs[i] >= 1000) finished[i] = true;
      const before = songs.length;
      for (const s of r.songs) {
        const k = songKey(s);
        if (seen.has(s.id) || seen.has(k)) continue;
        seen.add(s.id); seen.add(k);
        songs.push(s);
        if (songs.length >= want) break;
      }
      // Two pages in a row with nothing new: this search has nothing more to give.
      stale[i] = songs.length > before ? 0 : stale[i] + 1;
      if (stale[i] >= 2) finished[i] = true;
    }
  }
  if (!answered && failure) throw failure;
  return { songs, offsets: offs, done: finished.every(Boolean), total };
}
