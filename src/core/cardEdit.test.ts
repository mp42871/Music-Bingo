import { addCards, nextVersionName, parseCardRange, swapSong, SwapError } from './cardEdit';
import { generateCardSet } from './cards';
import { catPool, flatPool, layout } from '../test/fixtures';
import type { CardSet } from './types';

const make = (n = 10) => generateCardSet(catPool(), layout(), { seed: 4, count: n, startNumber: 1 }).set;
const sig = (c: CardSet['cards'][number]) => JSON.stringify(c.cells);

test('addCards continues numbering without duplicates', () => {
  const set = make(10);
  const r = addCards(set, 5);
  expect(r.added).toEqual([11, 12, 13, 14, 15]);
  expect(r.set.cards).toHaveLength(15);
  expect(r.set.cards.slice(0, 10)).toEqual(set.cards);
  expect(new Set(r.set.cards.map(sig)).size).toBe(15);
});

test('addCards stops at 4999', () => {
  const set = generateCardSet(catPool(), layout(), { seed: 4, count: 3, startNumber: 4996 }).set;
  const r = addCards(set, 10);
  expect(r.added).toEqual([4999]);
  expect(r.message).toMatch(/4999/);
});

test('addCards caps when no more unique cards are possible', () => {
  const set = generateCardSet(flatPool(9), layout({ size: 3, headerMode: 'letters', freeCenter: false }), { seed: 1, count: 1, startNumber: 1 }).set;
  const r = addCards(set, 5);
  expect(r.added.length).toBeLessThan(5);
  expect(r.message).toBeTruthy();
});

test('removing a song replaces it with a fitting song on every card that had it', () => {
  const set = make(30);
  const target = set.cards[0].cells.find((c) => c.kind === 'song') as { kind: 'song'; songId: string };
  const before = set.cards.filter((c) => c.cells.some((x) => x.kind === 'song' && x.songId === target.songId)).map((c) => c.number);
  const r = swapSong(set, target.songId, null);
  expect(r.changed).toEqual(before);
  const byId = new Map(set.songs!.map((s) => [s.id, s]));
  const cat = byId.get(target.songId)!.categories[0];
  for (const card of r.set.cards) {
    const ids = card.cells.flatMap((c) => (c.kind === 'song' ? [c.songId] : []));
    expect(ids).not.toContain(target.songId);
    expect(new Set(ids).size).toBe(ids.length);
  }
  for (const n of r.changed) {
    const i = set.cards.find((c) => c.number === n)!.cells.findIndex((c) => c.kind === 'song' && c.songId === target.songId);
    const now = r.set.cards.find((c) => c.number === n)!.cells[i] as { songId: string };
    expect(byId.get(now.songId)!.categories).toContain(cat);
  }
});

test('replace with a chosen song; a card that already has it gets another fitting song', () => {
  const set = make(40);
  const a = set.cards[0].cells[0] as { songId: string };
  const b = set.cards[0].cells[5] as { songId: string }; // same column (index 0 and 5 are column 0)
  const r = swapSong(set, a.songId, b.songId);
  const c0 = r.set.cards[0].cells.flatMap((c) => (c.kind === 'song' ? [c.songId] : []));
  expect(new Set(c0).size).toBe(c0.length);
  expect(c0).not.toContain(a.songId);
  const others = r.set.cards.filter((c) => !c.cells.some((x) => x.kind === 'song' && x.songId === b.songId) && set.cards.find((o) => o.number === c.number)!.cells.some((x) => x.kind === 'song' && x.songId === a.songId));
  expect(others).toHaveLength(0);
});

test('no fitting song left → SwapError and nothing changes', () => {
  const set = generateCardSet(catPool(5), layout(), { seed: 1, count: 3, startNumber: 1 }).set;
  const id = (set.cards[0].cells[0] as { songId: string }).songId;
  expect(() => swapSong(set, id, null)).toThrow(SwapError);
});

test('version names and card ranges', () => {
  expect(nextVersionName('Gala', ['Gala'])).toBe('Gala v2');
  expect(nextVersionName('Gala', ['Gala', 'Gala v2'])).toBe('Gala v3');
  expect(nextVersionName('Gala v2', ['Gala', 'Gala v2'])).toBe('Gala v3');
  expect(parseCardRange('41-44, 50,3')).toEqual([3, 41, 42, 43, 44, 50]);
  expect(parseCardRange('nope')).toEqual([]);
});
