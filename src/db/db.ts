import Dexie, { type Table } from 'dexie';
import type { CardSet, Game, Pool } from '../core/types';

export interface KV { key: string; value: unknown }

class MusicBingoDB extends Dexie {
  pools!: Table<Pool, string>;
  cardSets!: Table<CardSet, string>;
  games!: Table<Game, string>;
  kv!: Table<KV, string>;
  constructor() {
    super('musicBingo');
    this.version(1).stores({
      pools: 'id, updatedAt',
      cardSets: 'id, poolId, createdAt',
      games: 'id, createdAt',
      kv: 'key',
    });
  }
}

export const db = new MusicBingoDB();
