import { normalizeTitle } from './io';
import type { AudioFile, ClipSettings, Song } from './types';

export type Source = 'spotify' | 'file' | 'manual';

export function parseFileName(name: string): { title: string; artist: string } {
  const base = name.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/_/g, ' ').trim();
  const noTrack = base.replace(/^\d{1,3}[\s.\-–)]+\s*/, '');
  const m = noTrack.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  return m ? { artist: m[1].trim(), title: m[2].trim() } : { artist: '', title: noTrack };
}

const artistKey = (a: string) => a.toLowerCase().split(/,|&| feat\.?| ft\.?| and /)[0].replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();

export function matchFiles(songs: Song[], files: AudioFile[]) {
  const matched: { songId: string; fileId: string }[] = [];
  const ambiguous: { songId: string; fileIds: string[] }[] = [];
  const unmatchedSongs: string[] = [];
  const used = new Set<string>();
  const titleCount = new Map<string, number>();
  for (const s of songs) titleCount.set(normalizeTitle(s.title), (titleCount.get(normalizeTitle(s.title)) ?? 0) + 1);
  for (const s of songs) {
    const t = normalizeTitle(s.title);
    const cands = files.filter((f) => {
      if (normalizeTitle(f.title) !== t) return false;
      if (!f.artist) return titleCount.get(t) === 1;
      return artistKey(f.artist) === artistKey(s.artist);
    });
    if (cands.length === 1) { matched.push({ songId: s.id, fileId: cands[0].id }); used.add(cands[0].id); }
    else if (cands.length > 1) { ambiguous.push({ songId: s.id, fileIds: cands.map((f) => f.id) }); cands.forEach((f) => used.add(f.id)); }
    else unmatchedSongs.push(s.id);
  }
  return { matched, ambiguous, unmatchedSongs, unusedFiles: files.filter((f) => !used.has(f.id)).map((f) => f.id) };
}

export const isFileOnly = (s: Song) => s.id.startsWith('file:');

export function pickSource(song: Song, policy: ClipSettings['source'], ctx: { online: boolean; spotifyReady: boolean }): Source {
  if (policy === 'manual') return 'manual';
  const spotifyOk = !isFileOnly(song) && ctx.online && ctx.spotifyReady;
  if (isFileOnly(song)) return song.fileId ? 'file' : 'manual';
  if (policy === 'files') return song.fileId ? 'file' : spotifyOk ? 'spotify' : 'manual';
  return spotifyOk ? 'spotify' : song.fileId ? 'file' : 'manual';
}

export function readiness(songs: Song[], fileIds: Set<string>) {
  const missing = songs.filter((s) => !s.fileId || !fileIds.has(s.fileId));
  return { total: songs.length, withFile: songs.length - missing.length, manual: missing.length, missing };
}

export function fileSong(f: AudioFile): Song {
  return {
    id: `file:${f.id}`, uri: `file:${f.id}`, fileId: f.id, title: f.title, artist: f.artist,
    album: f.album ?? '', durationMs: f.durationMs, categories: [],
  };
}

/** Brings a card-set/game song snapshot up to date with the playlist's current music-file links. */
export function withLatestFiles(snapshot: Song[], live: Song[] | undefined): Song[] {
  if (!live) return snapshot;
  const byId = new Map(live.map((s) => [s.id, s]));
  return snapshot.map((s) => {
    if (s.id.startsWith('file:')) return s;
    const l = byId.get(s.id);
    if (!l) return s;
    if (l.fileId) return { ...s, fileId: l.fileId };
    const { fileId: _x, ...rest } = s; void _x; return rest;
  });
}
