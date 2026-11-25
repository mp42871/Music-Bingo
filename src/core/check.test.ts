import { checkCard, liveWinners, markedCells } from './check';
import { masksFor } from './patterns';
import type { Call, Card } from './types';
import { song } from '../test/fixtures';

const songs = Array.from({ length: 12 }, (_, i) => song(i));
const byId = new Map(songs.map((s) => [s.id, s]));
// 3x3 card, center free; cells s0..s7 around it
const card: Card = {
  number: 42,
  cells: [
    { kind: 'song', songId: 's0' }, { kind: 'song', songId: 's1' }, { kind: 'song', songId: 's2' },
    { kind: 'song', songId: 's3' }, { kind: 'free' }, { kind: 'song', songId: 's4' },
    { kind: 'song', songId: 's5' }, { kind: 'song', songId: 's6' }, { kind: 'song', songId: 's7' },
  ],
};
const calls = (ids: string[]): Call[] => ids.map((songId, i) => ({ songId, at: i }));
const line = masksFor('line', 3);

test('top row called → valid at the 3rd of those calls', () => {
  const r = checkCard(card, calls(['s9', 's0', 's10', 's1', 's2', 's11']), line, byId);
  expect(r.valid).toBe(true);
  expect(r.firstValidAtCall).toBe(5);
  expect(r.winningMask).toEqual([0, 1, 2]);
});

test('two of three is not valid', () => {
  const r = checkCard(card, calls(['s0', 's1']), line, byId);
  expect(r.valid).toBe(false);
  expect(r.firstValidAtCall).toBeNull();
  expect(r.marked.filter(Boolean)).toHaveLength(3); // s0, s1 + free
});

test('free center counts toward a line', () => {
  expect(checkCard(card, calls(['s1', 's6']), line, byId).valid).toBe(true);
});

test('artist cell is marked by any song of that artist', () => {
  const s = [song(100, { artist: 'Prince' }), song(101, { artist: 'Prince' })];
  const m = new Map(s.map((x) => [x.id, x]));
  const c: Card = { number: 1, cells: [{ kind: 'artist', artist: 'Prince' }] };
  expect(markedCells(c, new Set(['s101']), m)).toEqual([true]);
});

test('liveWinners returns only valid card numbers', () => {
  const other: Card = { ...card, number: 7, cells: card.cells.map((c) => (c.kind === 'song' ? { kind: 'song', songId: c.songId + 'x' } : c)) };
  expect(liveWinners([card, other], calls(['s0', 's1', 's2']), line, byId)).toEqual([42]);
});
