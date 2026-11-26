import { normalizeTitle } from '../core/io';
import type { Song } from '../core/types';
import { getSetting, setSetting } from '../db/repo';
import type { SpotifyApi } from './api';

export interface CuratedLine { artist: string; title: string }

/** "Artist - Title" per line. */
export function parseCurated(text: string): CuratedLine[] {
  return text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const i = l.indexOf(' - ');
    return i < 0 ? { artist: '', title: l } : { artist: l.slice(0, i).trim(), title: l.slice(i + 3).trim() };
  });
}

const VERSION_NOISE = /\b(live|karaoke|instrumental|cover|remix|acoustic|demo|re-?recorded|tribute|in the style of|originally performed)\b/i;
const artistKey = (a: string) => a.toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, '');
const artistMatches = (want: string, got: string) => {
  const w = artistKey(want.split(/,|&| feat\.?| and /i)[0]);
  return got.split(/,\s*/).some((g) => { const k = artistKey(g); return k.includes(w) || w.includes(k); });
};

const cacheKey = (l: CuratedLine) => `curated:${l.artist}|${l.title}`.toLowerCase();

/** Finds the studio version of one listed song on Spotify (remembered for next time). */
export async function lookupSong(api: Pick<SpotifyApi, 'searchTracks'>, line: CuratedLine): Promise<Song | null> {
  const cached = await getSetting<Song | null | undefined>(cacheKey(line), undefined);
  if (cached !== undefined) return cached;
  const want = normalizeTitle(line.title);
  const pick = (songs: Song[]) => {
    const byArtist = songs.filter((s) => artistMatches(line.artist, s.artist));
    const clean = (s: Song) => !VERSION_NOISE.test(s.title) && !VERSION_NOISE.test(s.album);
    return byArtist.find((s) => normalizeTitle(s.title) === want && clean(s))
      ?? byArtist.find((s) => normalizeTitle(s.title) === want)
      ?? byArtist.find((s) => normalizeTitle(s.title).startsWith(want) && clean(s))
      ?? null;
  };
  let found = pick((await api.searchTracks(`track:"${line.title}" artist:"${line.artist}"`, 0, 10)).songs);
  if (!found) found = pick((await api.searchTracks(`${line.title} ${line.artist}`, 0, 10)).songs);
  await setSetting(cacheKey(line), found);
  return found;
}

/** Looks up listed songs in order from `start` until `want` new songs are found. */
export async function collectCurated(
  api: Pick<SpotifyApi, 'searchTracks'>, lines: CuratedLine[], want: number, start = 0, seen: Set<string> = new Set(),
): Promise<{ songs: Song[]; next: number; done: boolean }> {
  const songs: Song[] = [];
  let i = start;
  for (; i < lines.length && songs.length < want; i++) {
    const s = await lookupSong(api, lines[i]).catch(() => null);
    if (!s || seen.has(s.id)) continue;
    seen.add(s.id);
    songs.push(s);
  }
  return { songs, next: i, done: i >= lines.length };
}
