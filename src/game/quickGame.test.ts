import { buildQuickGame, QuickGameError } from './quickGame';
import { PRESETS } from '../core/presets';
import { db } from '../db/db';
import { getCardSet, getGame, getPool } from '../db/repo';
import { song } from '../test/fixtures';

beforeEach(async () => { await Promise.all(db.tables.map((t) => t.clear())); });

const searchApi = (n = 200) => {
  let i = 0;
  return { searchTracks: vi.fn(async (q: string) => {
    const m = q.match(/^track:"(.+)" artist:"(.+)"$/);
    if (m) return { total: 1, songs: [song(500000 + i++, { title: m[1], artist: m[2] })] };
    return { total: n, songs: Array.from({ length: Math.max(0, Math.min(10, n - i)) }, () => song(i++, { title: `Hit ${i}`, artist: `Band ${i}` })) };
  }) };
};

test('a category request builds and saves playlist, cards and game', async () => {
  const api = searchApi();
  const steps: string[] = [];
  const r = await buildQuickGame(api, { kind: 'preset', preset: PRESETS.find((p) => p.id === '90s')! }, { songs: 50, cards: 40, size: 5 }, (s) => steps.push(s));
  expect(r.pool.name).toBe('90s Bingo');
  expect(r.pool.songs).toHaveLength(50);
  expect(r.cardSet.cards).toHaveLength(40);
  expect(r.cardSet.layout).toMatchObject({ headerMode: 'theme', themeLabel: '90s Bingo', size: 5 });
  expect(r.cardSet.style!.title).toBe('90s Bingo');
  expect(r.game.callOrder).toHaveLength(50);
  expect(r.game.rounds[0].patternId).toBe('line');
  expect(await getPool(r.pool.id)).toBeTruthy();
  expect(await getCardSet(r.cardSet.id)).toBeTruthy();
  expect(await getGame(r.game.id)).toBeTruthy();
  expect(steps.join(' ')).toMatch(/Finding songs.*Making cards/);
});

test('an artist request searches that artist', async () => {
  const api = searchApi();
  const r = await buildQuickGame(api, { kind: 'artist', name: 'Taylor Swift' }, { songs: 30, cards: 10, size: 5 });
  expect(api.searchTracks.mock.calls[0][0]).toBe('artist:"Taylor Swift"');
  expect(r.pool.name).toBe('Taylor Swift Bingo');
});

test('too few songs for the card size explains what to do', async () => {
  const api = searchApi(12);
  await expect(buildQuickGame(api, { kind: 'text', text: 'obscure' }, { songs: 50, cards: 10, size: 5 }))
    .rejects.toThrow(QuickGameError);
  await expect(buildQuickGame(searchApi(12), { kind: 'text', text: 'obscure' }, { songs: 50, cards: 10, size: 5 }))
    .rejects.toThrow(/Only 12 songs found.*3×3/);
});
