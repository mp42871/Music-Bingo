import type { Pool, Song } from './types';

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportError';
  }
}

export function exportPoolJson(pool: Pool): string {
  return JSON.stringify({ format: 'music-bingo-pool', version: 1, pool }, null, 2);
}

export function importPoolJson(text: string): Pool {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportError('This file is not valid JSON.');
  }
  const d = data as { format?: string; pool?: Pool };
  if (d?.format !== 'music-bingo-pool' || !d.pool || !Array.isArray(d.pool.songs))
    throw new ImportError('This file is not a Music Bingo playlist export.');
  return d.pool;
}

const q = (v: unknown) => {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function formatTime(ms: number): string {
  const t = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export function parseTime(text: string): number | null {
  const m = text.trim().match(/^(?:(\d+):)?(\d{1,2})$/);
  if (!m) return null;
  return ((Number(m[1] ?? 0) * 60) + Number(m[2])) * 1000;
}

export function exportPoolCsv(pool: Pool): string {
  const rows = [['title', 'artist', 'album', 'year', 'spotify_url', 'categories', 'start']];
  for (const s of pool.songs)
    rows.push([
      s.displayTitle ?? s.title, s.artist, s.album, s.year?.toString() ?? '',
      `https://open.spotify.com/track/${s.id}`, s.categories.join('|'),
      s.startMs !== undefined ? formatTime(s.startMs) : '',
    ]);
  return rows.map((r) => r.map(q).join(',')).join('\n');
}

/** Minimal RFC-4180 CSV parser. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQ = false;
      else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export function parseSongLines(text: string): { title: string; artist: string }[] {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim()) ?? '';
  const header = parseCsv(firstLine)[0]?.map((h) => h.trim().toLowerCase()) ?? [];
  const ti = header.findIndex((h) => h === 'title' || h === 'song' || h === 'track' || h === 'name');
  const ai = header.findIndex((h) => h === 'artist' || h === 'artists');
  if (ti >= 0 && ai >= 0) {
    return parseCsv(text).slice(1)
      .map((r) => ({ title: (r[ti] ?? '').trim(), artist: (r[ai] ?? '').trim() }))
      .filter((r) => r.title);
  }
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = l.match(/^(.+?)\s+[-–—]\s+(.+)$/);
    return m ? { artist: m[1].trim(), title: m[2].trim() } : { artist: '', title: l };
  });
}

export function normalizeTitle(t: string): string {
  return t.toLowerCase()
    .replace(/\s*[-–—]\s*(\d{4}\s*)?(remaster(ed)?|remix|live|mono|stereo|single|radio edit|version|edit).*$/i, '')
    .replace(/\s*[([].*?[)\]]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export const songKey = (s: Pick<Song, 'title' | 'artist'>) =>
  `${normalizeTitle(s.title)}|${s.artist.toLowerCase().split(/,|&| feat/)[0].trim()}`;

export function mergeSongs(existing: Song[], incoming: Song[], mode: 'skip' | 'keepBoth' | 'replace'): Song[] {
  let out = [...existing];
  for (const s of incoming) {
    const dupIdx = out.findIndex((e) => e.id === s.id || songKey(e) === songKey(s));
    if (dupIdx < 0) out.push(s);
    else if (mode === 'replace') out = [...out.slice(0, dupIdx), ...out.slice(dupIdx + 1), s];
    else if (mode === 'keepBoth' && out[dupIdx].id !== s.id) out.push(s);
  }
  return out;
}

export function download(filename: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
