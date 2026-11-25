import Dexie, { type Table } from 'dexie';
import type { AudioFile, CardSet, Game, Pool } from '../core/types';

export interface KV { key: string; value: unknown }
export interface AudioData { id: string; data: ArrayBuffer; type: string }

class MusicBingoDB extends Dexie {
  pools!: Table<Pool, string>;
  cardSets!: Table<CardSet, string>;
  games!: Table<Game, string>;
  kv!: Table<KV, string>;
  audio!: Table<AudioFile, string>;
  audioData!: Table<AudioData, string>;
  constructor() {
    super('musicBingo');
    this.version(1).stores({
      pools: 'id, updatedAt',
      cardSets: 'id, poolId, createdAt',
      games: 'id, createdAt',
      kv: 'key',
    });
    this.version(2).stores({ audio: 'id, addedAt', audioData: 'id' });
  }
}

export const db = new MusicBingoDB();
