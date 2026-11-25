import { uid } from './rng';
import type { Pool, Song } from './types';

export interface SourceList { id: string; name: string; songs: Song[] }

const sourceCats = (lists: SourceList[]) => (lists.length > 1 ? lists.map((l) => l.name) : []);

/** Which sources contain each song id, in source order. */
function membership(lists: SourceList[]) {
  const map = new Map<string, { song: Song; ids: string[] }>();
  for (const l of lists) for (const s of l.songs) {
    const m = map.get(s.id);
    if (m) { if (!m.ids.includes(l.id)) m.ids.push(l.id); } else map.set(s.id, { song: s, ids: [l.id] });
  }
  return map;
}

const catsFor = (lists: SourceList[], ids: string[]) => (lists.length > 1 ? lists.filter((l) => ids.includes(l.id)).map((l) => l.name) : []);

export function buildPoolFromPlaylists(lists: SourceList[], name?: string): Pool {
  const m = membership(lists);
  const now = Date.now();
  return {
    id: uid(), name: name?.trim() || lists.map((l) => l.name).join(' + '), createdAt: now, updatedAt: now,
    categories: sourceCats(lists), sources: lists.map((l) => ({ id: l.id, name: l.name })),
    songs: [...m.values()].map(({ song, ids }) => ({ ...song, categories: catsFor(lists, ids), sourceIds: ids })),
  };
}

/** Re-applies the source playlists: keeps host settings, adds new songs, drops songs no longer in any source. */
export function mergeFromSources(pool: Pool, lists: SourceList[]): { pool: Pool; added: number; removed: number } {
  const m = membership(lists);
  const oldNames = new Set([...(pool.sources ?? []).map((s) => s.name), ...lists.map((l) => l.name)]);
  const isSourceCat = (c: string) => oldNames.has(c);
  let removed = 0;
  const kept: Song[] = [];
  for (const s of pool.songs) {
    const inNow = m.get(s.id);
    if (!s.sourceIds?.length) { kept.push(s); continue; } // added by hand
    if (!inNow) { removed++; continue; }
    kept.push({ ...s, sourceIds: inNow.ids, categories: [...s.categories.filter((c) => !isSourceCat(c)), ...catsFor(lists, inNow.ids)] });
  }
  const have = new Set(kept.map((s) => s.id));
  const fresh = [...m.values()].filter(({ song }) => !have.has(song.id))
    .map(({ song, ids }) => ({ ...song, categories: catsFor(lists, ids), sourceIds: ids }));
  const handCats = pool.categories.filter((c) => !isSourceCat(c));
  return {
    pool: {
      ...pool, songs: [...kept, ...fresh], sources: lists.map((l) => ({ id: l.id, name: l.name })),
      categories: [...new Set([...handCats, ...sourceCats(lists)])], updatedAt: Date.now(),
    },
    added: fresh.length, removed,
  };
}
