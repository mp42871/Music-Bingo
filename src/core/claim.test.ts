import { checkClaim, findCard, gameToCsv, missingCount } from './claim';
import { generateCard, generateCardSet } from './cards';
import { DEFAULT_CLIP } from './clip';
import { masksFor } from './patterns';
import type { Game } from './types';
import { catPool, layout } from '../test/fixtures';

const pool = catPool();
const { set } = generateCardSet(pool, layout(), { seed: 3, count: 50, startNumber: 1 });
const card42 = set.cards.find((c) => c.number === 42)!;
const row = card42.cells.slice(0, 5).map((c) => (c.kind === 'song' ? c.songId : ''));
const others = pool.songs.map((s) => s.id).filter((id) => !row.includes(id));
// 12 other songs, then the row's songs interleaved so the 5th row song is call 17
const order = [...others.slice(0, 12), row[0], row[1], row[2], row[3], row[4], ...others.slice(12)];

function game(callCount: number): Game {
  return {
    id: 'g', name: 'G', createdAt: 1, pool: { ...pool, songs: set.songs! }, cardSetId: set.id, settings: DEFAULT_CLIP,
    callOrder: order, calls: order.slice(0, callCount).map((songId, i) => ({ songId, at: 1000 * i })),
    rounds: [{ patternId: 'line', winners: [], startCall: 0 }], status: 'live',
  };
}

test('valid claim reports the call it became valid on', () => {
  const r = checkClaim(set, game(20), 42)!;
  expect(r.source).toBe('printed');
  expect(r.result.valid).toBe(true);
  expect(r.result.firstValidAtCall).toBe(17);
});

test('not-yet claim reports how many are missing', () => {
  const r = checkClaim(set, game(15), 42)!;
  expect(r.result.valid).toBe(false);
  expect(missingCount(r.result.marked, masksFor('line', 5))).toBe(2);
});

test('unknown printed number returns null; phone numbers regenerate', () => {
  expect(checkClaim(set, game(5), 999)).toBeNull();
  const phone = findCard(set, 6123)!;
  expect(phone.source).toBe('phone');
  expect(phone.card).toEqual(generateCard({ ...pool, songs: set.songs! }, set.layout, set.seed, 6123));
});

test('gameToCsv lists every call', () => {
  const csv = gameToCsv(game(3));
  const lines = csv.split('\n');
  expect(lines[0]).toBe('call,title,artist,time');
  expect(lines).toHaveLength(4);
});
