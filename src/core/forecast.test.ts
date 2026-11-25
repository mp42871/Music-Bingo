import { estimate, forecast, makeCallOrder, tuneCallOrder } from './forecast';
import { generateCardSet } from './cards';
import { masksFor } from './patterns';
import { catPool, layout } from '../test/fixtures';

const pool = catPool();
const byId = new Map(pool.songs.map((s) => [s.id, s]));

test('makeCallOrder is deterministic and skips excluded songs', () => {
  const p = catPool();
  p.songs[3].excluded = true;
  const a = makeCallOrder(p, 9);
  expect(a).toEqual(makeCallOrder(p, 9));
  expect(a).toHaveLength(p.songs.length - 1);
  expect(a).not.toContain(p.songs[3].id);
});

test('forecast finds the first winning call', () => {
  const { set } = generateCardSet(pool, layout(), { seed: 1, count: 30, startNumber: 1 });
  const order = makeCallOrder(pool, 4);
  const f = forecast(set.cards, order, masksFor('line', 5), byId);
  expect(f.firstWinCall).not.toBeNull();
  expect(f.winnersAtFirst).toBeGreaterThan(0);
  // calling the full order is a blackout for everyone
  const b = forecast(set.cards, order, masksFor('blackout', 5), byId);
  expect(b.firstWinCall).toBeLessThanOrEqual(order.length);
});

test('tuneCallOrder hits a wide window', () => {
  const { set } = generateCardSet(pool, layout(), { seed: 1, count: 30, startNumber: 1 });
  const t = tuneCallOrder(pool, set.cards, masksFor('line', 5), byId, { min: 1, max: 75 }, 5);
  expect(t.hit).toBe(true);
  expect(t.forecast.firstWinCall).toBeGreaterThanOrEqual(1);
  expect(t.order).toHaveLength(75);
});

test('estimate summarizes random orders', () => {
  const { set } = generateCardSet(pool, layout(), { seed: 1, count: 40, startNumber: 1 });
  const e = estimate(pool, set.cards, masksFor('line', 5), byId, 10, 1);
  expect(e.median).toBeGreaterThan(0);
  expect(e.min).toBeLessThanOrEqual(e.median);
  expect(e.max).toBeGreaterThanOrEqual(e.median);
});
