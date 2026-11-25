import { markedCells } from './check';
import { hashSeed, mulberry32, shuffle } from './rng';
import type { Card, Pool, Song } from './types';

export function makeCallOrder(pool: Pool, seed: number): string[] {
  return shuffle(pool.songs.filter((s) => !s.excluded).map((s) => s.id), mulberry32(seed));
}

export interface Forecast { firstWinCall: number | null; winnersAtFirst: number }

export function forecast(cards: Card[], callOrder: string[], masks: number[][], songsById: Map<string, Song>): Forecast {
  const called = new Set<string>();
  for (let i = 0; i < callOrder.length; i++) {
    called.add(callOrder[i]);
    const winners = cards.filter((c) => {
      const m = markedCells(c, called, songsById);
      return masks.some((mask) => mask.every((x) => m[x]));
    }).length;
    if (winners > 0) return { firstWinCall: i + 1, winnersAtFirst: winners };
  }
  return { firstWinCall: null, winnersAtFirst: 0 };
}

export function tuneCallOrder(
  pool: Pool, cards: Card[], masks: number[][], songsById: Map<string, Song>,
  window: { min: number; max: number }, baseSeed: number, maxTries = 200,
): { order: string[]; seed: number; forecast: Forecast; hit: boolean } {
  let best: { order: string[]; seed: number; forecast: Forecast; score: number } | null = null;
  for (let t = 0; t < maxTries; t++) {
    const seed = t === 0 ? baseSeed : hashSeed(baseSeed, t);
    const order = makeCallOrder(pool, seed);
    const f = forecast(cards, order, masks, songsById);
    const at = f.firstWinCall ?? Infinity;
    const inWin = at >= window.min && at <= window.max;
    // Prefer in-window with a single winner; otherwise closest to the window.
    const dist = inWin ? 0 : Math.min(Math.abs(at - window.min), Math.abs(at - window.max));
    const score = dist * 100 + (f.winnersAtFirst - 1);
    if (!best || score < best.score) best = { order, seed, forecast: f, score };
    if (inWin && f.winnersAtFirst === 1) break;
  }
  const b = best!;
  const at = b.forecast.firstWinCall ?? Infinity;
  return { order: b.order, seed: b.seed, forecast: b.forecast, hit: at >= window.min && at <= window.max };
}
