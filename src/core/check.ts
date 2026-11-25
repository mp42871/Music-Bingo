import type { Call, Card, Song } from './types';

export function markedCells(card: Card, called: ReadonlySet<string>, songsById: Map<string, Song>): boolean[] {
  let artists: Set<string> | null = null;
  return card.cells.map((c) => {
    if (c.kind === 'free') return true;
    if (c.kind === 'song') return called.has(c.songId);
    artists ??= new Set([...called].map((id) => songsById.get(id)?.artist).filter(Boolean) as string[]);
    return artists.has(c.artist);
  });
}

const complete = (marked: boolean[], masks: number[][]) => masks.find((m) => m.every((i) => marked[i])) ?? null;

export interface CheckResult {
  valid: boolean;
  firstValidAtCall: number | null;
  winningMask: number[] | null;
  marked: boolean[];
}

export function checkCard(card: Card, calls: Call[], masks: number[][], songsById: Map<string, Song>): CheckResult {
  const called = new Set<string>();
  let first: number | null = complete(markedCells(card, called, songsById), masks) ? 0 : null;
  for (let i = 0; i < calls.length && first === null; i++) {
    called.add(calls[i].songId);
    if (complete(markedCells(card, called, songsById), masks)) first = i + 1;
  }
  const marked = markedCells(card, new Set(calls.map((c) => c.songId)), songsById);
  const winningMask = complete(marked, masks);
  return { valid: winningMask !== null, firstValidAtCall: first, winningMask, marked };
}

export function liveWinners(cards: Card[], calls: Call[], masks: number[][], songsById: Map<string, Song>): number[] {
  const called = new Set(calls.map((c) => c.songId));
  return cards.filter((card) => complete(markedCells(card, called, songsById), masks)).map((c) => c.number);
}
