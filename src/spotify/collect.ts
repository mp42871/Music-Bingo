import { songKey } from '../core/io';
import type { Song } from '../core/types';
import type { SpotifyApi } from './api';

const PAGE = 10; // Spotify's maximum per search request for apps like this (Feb 2026)

/**
 * Gathers up to `want` new songs from one or more searches, 10 at a time, taking turns between queries.
 * Skips songs already seen (including remastered/live repeats). `offsets` lets "Load more" continue.
 */
export async function collect(
  api: Pick<SpotifyApi, 'searchTracks'>, queries: string[], want: number,
  offsets: number[] = queries.map(() => 0), seen: Set<string> = new Set(),
): Promise<{ songs: Song[]; offsets: number[]; done: boolean; total: number }> {
  const offs = [...offsets];
  const finished = queries.map(() => false);
  const songs: Song[] = [];
  let total = 0;
  let guard = 0;
  while (songs.length < want && finished.some((f) => !f) && guard++ < 200) {
    for (let i = 0; i < queries.length && songs.length < want; i++) {
      if (finished[i]) continue;
      const r = await api.searchTracks(queries[i], offs[i], PAGE);
      if (guard === 1) total += r.total;
      offs[i] += PAGE;
      if (!r.songs.length || offs[i] >= r.total || offs[i] >= 1000) finished[i] = true;
      for (const s of r.songs) {
        const k = songKey(s);
        if (seen.has(s.id) || seen.has(k)) continue;
        seen.add(s.id); seen.add(k);
        songs.push(s);
        if (songs.length >= want) break;
      }
    }
  }
  return { songs, offsets: offs, done: finished.every(Boolean), total };
}
