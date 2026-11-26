import { getPool } from '../db/repo';
import type { CardSet, Song } from '../core/types';

/** Current songs (with music-file links) of every playlist a card set was made from. */
export async function liveSongsFor(set: Pick<CardSet, 'poolId' | 'poolIds'>): Promise<Song[] | undefined> {
  const ids = set.poolIds?.length ? set.poolIds : [set.poolId];
  const pools = (await Promise.all(ids.map((id) => getPool(id).catch(() => undefined)))).filter(Boolean);
  if (!pools.length) return undefined;
  const byId = new Map<string, Song>();
  for (const p of pools) for (const s of p!.songs) if (!byId.has(s.id) || (!byId.get(s.id)!.fileId && s.fileId)) byId.set(s.id, s);
  return [...byId.values()];
}
