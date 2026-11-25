import { generateCard, generateCardSet, PoolTooSmallError, validatePool } from './cards';
import { catPool, CATS, flatPool, layout } from '../test/fixtures';

const pool = catPool();
const byId = new Map(pool.songs.map((s) => [s.id, s]));

test('category columns only contain songs from their category; center is free', () => {
  const card = generateCard(pool, layout(), 99, 1);
  expect(card.cells).toHaveLength(25);
  expect(card.cells[12]).toEqual({ kind: 'free' });
  card.cells.forEach((c, i) => {
    if (c.kind !== 'song') return;
    expect(byId.get(c.songId)!.categories).toContain(CATS[i % 5]);
  });
});

test('no song repeats within a card', () => {
  const card = generateCard(pool, layout(), 5, 3);
  const ids = card.cells.flatMap((c) => (c.kind === 'song' ? [c.songId] : []));
  expect(new Set(ids).size).toBe(ids.length);
});

test('generateCard is deterministic', () => {
  expect(generateCard(pool, layout(), 1, 7)).toEqual(generateCard(pool, layout(), 1, 7));
  expect(generateCard(pool, layout(), 1, 7)).not.toEqual(generateCard(pool, layout(), 1, 8));
});

test('100 cards are all unique and numbered from startNumber', () => {
  const { set, capped } = generateCardSet(pool, layout(), { seed: 3, count: 100, startNumber: 1 });
  expect(capped).toBe(false);
  expect(set.cards).toHaveLength(100);
  expect(set.cards[0].number).toBe(1);
  const sigs = set.cards.map((c) => JSON.stringify(c.cells));
  expect(new Set(sigs).size).toBe(100);
});

test('validatePool reports short columns', () => {
  const p = catPool();
  p.songs = p.songs.filter((s) => !(s.categories[0] === 'Rock' && Number(s.id.slice(1)) % 100 > 2));
  const v = validatePool(p, layout());
  expect(v.ok).toBe(false);
  expect(v.messages.join(' ')).toMatch(/Rock/);
  expect(v.columns.find((c) => c.label === 'Rock')).toEqual({ label: 'Rock', available: 3, needed: 5 });
  expect(() => generateCardSet(p, layout(), { seed: 1, count: 5, startNumber: 1 })).toThrow(PoolTooSmallError);
});

test('center column needs one fewer with free center', () => {
  const v = validatePool(pool, layout());
  expect(v.columns[2].needed).toBe(4);
  expect(v.ok).toBe(true);
});

test('excluded songs are never used', () => {
  const p = catPool();
  p.songs[0].excluded = true;
  const { set } = generateCardSet(p, layout(), { seed: 2, count: 50, startNumber: 1 });
  expect(set.cards.some((c) => c.cells.some((x) => x.kind === 'song' && x.songId === p.songs[0].id))).toBe(false);
});

test('generateCardSet caps duplicates with bounded retries', () => {
  const t0 = Date.now();
  const res = generateCardSet(flatPool(10), layout({ size: 3, headerMode: 'letters', freeCenter: false }), {
    seed: 1, count: 500, startNumber: 1,
  });
  expect(res.capped).toBe(true);
  expect(res.set.cards.length).toBeLessThan(500);
  expect(res.message).toBeTruthy();
  expect(Date.now() - t0).toBeLessThan(1500);
});

test('artistBingo uses unique artists', () => {
  const p = flatPool(60);
  p.songs.forEach((s, i) => (s.artist = `A${i % 30}`));
  const card = generateCard(p, layout({ headerMode: 'letters', cellContent: 'artistBingo' }), 1, 1);
  const artists = card.cells.flatMap((c) => (c.kind === 'artist' ? [c.artist] : []));
  expect(artists).toHaveLength(24);
  expect(new Set(artists).size).toBe(24);
  p.songs.forEach((s, i) => (s.artist = `A${i % 20}`));
  expect(validatePool(p, layout({ headerMode: 'letters', cellContent: 'artistBingo', size: 5 })).ok).toBe(false);
});

test('theme mode uses only theme category', () => {
  const big = catPool(30);
  const bigById = new Map(big.songs.map((s) => [s.id, s]));
  const card = generateCard(big, layout({ headerMode: 'theme', themeCategory: '80s' }), 1, 1);
  card.cells.forEach((c) => c.kind === 'song' && expect(bigById.get(c.songId)!.categories).toContain('80s'));
});
