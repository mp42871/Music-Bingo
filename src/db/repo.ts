import { db } from './db';
import type { CardSet, Game, Pool } from '../core/types';

export const savePool = (p: Pool) => db.pools.put(p);
export const getPool = (id: string) => db.pools.get(id);
export const listPools = () => db.pools.orderBy('updatedAt').reverse().toArray();
export const deletePool = (id: string) => db.pools.delete(id);

export const saveCardSet = (s: CardSet) => db.cardSets.put(s);
export const getCardSet = (id: string) => db.cardSets.get(id);
export const listCardSets = () => db.cardSets.orderBy('createdAt').reverse().toArray();
export const deleteCardSet = (id: string) => db.cardSets.delete(id);

export const saveGame = (g: Game) => db.games.put(g);
export const getGame = (id: string) => db.games.get(id);
export const listGames = () => db.games.orderBy('createdAt').reverse().toArray();
export const deleteGame = (id: string) => db.games.delete(id);
export const clearGames = () => db.games.clear();

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.kv.get(key);
  return row === undefined ? fallback : (row.value as T);
}
export const setSetting = (key: string, value: unknown) => db.kv.put({ key, value });

export async function exportBackup(): Promise<string> {
  const [pools, cardSets, games, kv] = await Promise.all([
    db.pools.toArray(), db.cardSets.toArray(), db.games.toArray(), db.kv.toArray(),
  ]);
  return JSON.stringify({ format: 'music-bingo-backup', version: 1, exportedAt: Date.now(), pools, cardSets, games, kv });
}

export async function importBackup(json: string, mode: 'merge' | 'replace'): Promise<void> {
  let d: { format?: string; pools?: Pool[]; cardSets?: CardSet[]; games?: Game[]; kv?: { key: string; value: unknown }[] };
  try {
    d = JSON.parse(json);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  if (d?.format !== 'music-bingo-backup') throw new Error('This file is not a Music Bingo backup.');
  await db.transaction('rw', [db.pools, db.cardSets, db.games, db.kv], async () => {
    if (mode === 'replace') await Promise.all([db.pools.clear(), db.cardSets.clear(), db.games.clear(), db.kv.clear()]);
    await db.pools.bulkPut(d.pools ?? []);
    await db.cardSets.bulkPut(d.cardSets ?? []);
    await db.games.bulkPut(d.games ?? []);
    await db.kv.bulkPut(d.kv ?? []);
  });
}
