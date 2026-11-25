import { generateCard } from './cards';
import { checkCard, type CheckResult } from './check';
import { cleanTitle } from './io';
import { masksFor } from './patterns';
import type { Card, CardSet, Game, Pool } from './types';

export const PHONE_MIN = 5000;
export const PHONE_MAX = 9999;

export function setPool(set: CardSet): Pool {
  return { id: set.poolId, name: set.name, songs: set.songs ?? [], categories: [], createdAt: 0, updatedAt: 0 };
}

export function findCard(set: CardSet, number: number): { card: Card; source: 'printed' | 'phone' } | null {
  const printed = set.cards.find((c) => c.number === number);
  if (printed) return { card: printed, source: 'printed' };
  if (number >= PHONE_MIN && number <= PHONE_MAX && set.songs?.length) {
    try { return { card: generateCard(setPool(set), set.layout, set.seed, number), source: 'phone' }; } catch { return null; }
  }
  return null;
}

export function checkClaim(set: CardSet, game: Game, number: number): { card: Card; source: 'printed' | 'phone'; result: CheckResult; masks: number[][] } | null {
  const found = findCard(set, number);
  if (!found) return null;
  const round = game.rounds.at(-1);
  const masks = masksFor(round?.patternId ?? 'line', set.layout.size, round?.customMask);
  const songs = new Map(game.pool.songs.map((s) => [s.id, s]));
  return { ...found, masks, result: checkCard(found.card, game.calls, masks, songs) };
}

/** Fewest squares still needed to complete any winning mask. */
export function missingCount(marked: boolean[], masks: number[][]): number {
  return Math.min(...masks.map((m) => m.filter((i) => !marked[i]).length));
}

const q = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function gameToCsv(game: Game): string {
  const songs = new Map(game.pool.songs.map((s) => [s.id, s]));
  const rows = [['call', 'title', 'artist', 'time']];
  game.calls.forEach((c, i) => {
    const s = songs.get(c.songId);
    rows.push([String(i + 1), s ? s.displayTitle ?? cleanTitle(s.title) : c.songId, s?.artist ?? '', new Date(c.at).toISOString()]);
  });
  return rows.map((r) => r.map(q).join(',')).join('\n');
}
