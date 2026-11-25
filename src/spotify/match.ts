import { normalizeTitle } from '../core/io';
import type { Song } from '../core/types';
import type { SpotifyApi } from './api';

export interface MatchLine { title: string; artist: string; categories?: string[]; startMs?: number }
export interface MatchResult { line: MatchLine; status: 'matched' | 'choose' | 'none'; candidates: Song[]; chosen?: Song }

const artistOk = (line: MatchLine, s: Song) => {
  if (!line.artist) return true;
  const want = line.artist.toLowerCase().replace(/^the /, '');
  const got = s.artist.toLowerCase();
  return got.includes(want) || want.includes(got.split(',')[0].trim().replace(/^the /, ''));
};

export async function matchLines(
  api: Pick<SpotifyApi, 'searchTracks'>, lines: MatchLine[], onProgress?: (done: number) => void,
): Promise<MatchResult[]> {
  const out: MatchResult[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const q = line.artist ? `track:"${line.title}" artist:"${line.artist}"` : line.title;
    let candidates: Song[] = [];
    try {
      candidates = (await api.searchTracks(q, 0, 5)).songs;
      if (!candidates.length && line.artist) candidates = (await api.searchTracks(`${line.title} ${line.artist}`, 0, 5)).songs;
    } catch {
      candidates = [];
    }
    const exact = candidates.filter((c) => normalizeTitle(c.title) === normalizeTitle(line.title) && artistOk(line, c));
    const decorate = (s: Song): Song => ({ ...s, categories: line.categories ?? [], ...(line.startMs !== undefined ? { startMs: line.startMs } : {}) });
    if (exact.length === 1 || (exact.length > 1 && line.artist)) out.push({ line, status: 'matched', candidates: candidates.map(decorate), chosen: decorate(exact[0]) });
    else if (candidates.length) out.push({ line, status: 'choose', candidates: candidates.map(decorate) });
    else out.push({ line, status: 'none', candidates: [] });
    onProgress?.(i + 1);
  }
  return out;
}
