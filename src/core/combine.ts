import type { Pool, Song } from './types';

/**
 * Joins several playlists for one card set. Each playlist's name becomes a category (so it can be a
 * card column); songs in more than one playlist get each name; a song is only off if it's off everywhere.
 */
export function combinePools(pools: Pool[]): Pool {
  if (pools.length === 1) return pools[0];
  const merged = new Map<string, { song: Song; own: Set<string>; from: string[]; on: boolean }>();
  for (const p of pools) for (const s of p.songs) {
    const m = merged.get(s.id) ?? { song: s, own: new Set<string>(), from: [], on: false };
    s.categories.forEach((c) => m.own.add(c));
    if (!s.excluded) { m.from.push(p.name); m.on = true; if (m.song.excluded) m.song = s; }
    merged.set(s.id, m);
  }
  const names = pools.map((p) => p.name);
  const own = [...new Set(pools.flatMap((p) => p.categories))].filter((c) => !names.includes(c));
  return {
    id: `combo:${pools.map((p) => p.id).join('+')}`, name: names.join(' + '), createdAt: 0, updatedAt: 0,
    categories: [...names, ...own],
    songs: [...merged.values()].map(({ song, own: o, from, on }) => {
      const { excluded: _x, ...rest } = song; void _x;
      return { ...rest, ...(on ? {} : { excluded: true }), categories: [...new Set([...o, ...from])] };
    }),
  };
}
