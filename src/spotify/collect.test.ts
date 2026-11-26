import { collect } from './collect';
import { song } from '../test/fixtures';

/** Fake search: each query has `total` songs, served 10 per page. */
function fakeApi(totals: Record<string, number>) {
  return {
    searchTracks: vi.fn(async (q: string, offset = 0, limit = 10) => {
      const total = totals[q] ?? 0;
      const base = Object.keys(totals).indexOf(q) * 1000;
      const songs = Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, i) => song(base + offset + i, { title: `${q} ${offset + i}` }));
      return { songs, total };
    }),
  };
}

test('pages through one query 10 at a time up to the amount wanted', async () => {
  const api = fakeApi({ rock: 500 });
  const r = await collect(api, ['rock'], 50);
  expect(r.songs).toHaveLength(50);
  expect(api.searchTracks.mock.calls.map((c) => c[1])).toEqual([0, 10, 20, 30, 40]);
  expect(r.offsets).toEqual([50]);
  expect(r.done).toBe(false);
});

test('continues from saved offsets and stops when results run out', async () => {
  const api = fakeApi({ rock: 63 });
  const r = await collect(api, ['rock'], 50, [50]);
  expect(r.songs).toHaveLength(13);
  expect(r.done).toBe(true);
});

test('mixes several queries round-robin', async () => {
  const api = fakeApi({ red: 100, blue: 100 });
  const r = await collect(api, ['red', 'blue'], 40);
  expect(r.songs.filter((s) => s.title.startsWith('red'))).toHaveLength(20);
  expect(r.songs.filter((s) => s.title.startsWith('blue'))).toHaveLength(20);
});

test('drops remastered repeats of a song already found', async () => {
  const api = {
    searchTracks: vi.fn(async (_q: string, offset = 0) => ({
      total: 3,
      songs: offset === 0 ? [song(1, { title: 'Go Your Own Way', artist: 'Fleetwood Mac' }), song(2, { title: 'Go Your Own Way - 2004 Remaster', artist: 'Fleetwood Mac' }), song(3)] : [],
    })),
  };
  const r = await collect(api, ['x'], 50, undefined, new Set());
  expect(r.songs.map((s) => s.id)).toEqual(['s1', 's3']);
});

test('keeps going when Spotify sends fewer songs per page than asked (no songs skipped)', async () => {
  const api = {
    searchTracks: vi.fn(async (_q: string, offset = 0) => ({
      total: 1000, songs: Array.from({ length: 5 }, (_, i) => song(offset + i, { title: `t${offset + i}` })),
    })),
  };
  const r = await collect(api, ['year:2005-2015'], 50);
  expect(r.songs).toHaveLength(50);
  expect(api.searchTracks.mock.calls.map((c) => c[1]).slice(0, 3)).toEqual([0, 5, 10]);
});

test('one failing search does not stop the others; all failing reports the error', async () => {
  const ok = fakeApi({ good: 100 });
  const api = { searchTracks: vi.fn(async (q: string, o?: number, l?: number) => { if (q === 'bad') throw new Error('Spotify said no'); return ok.searchTracks(q, o, l); }) };
  const r = await collect(api, ['bad', 'good'], 30);
  expect(r.songs).toHaveLength(30);
  await expect(collect(api, ['bad'], 30)).rejects.toThrow('Spotify said no');
});

test('a search that keeps sending the same songs is dropped instead of asked 200 times', async () => {
  const api = { searchTracks: vi.fn(async () => ({ total: 1000, songs: [song(1), song(2)] })) };
  const r = await collect(api, ['stuck'], 50);
  expect(r.songs).toHaveLength(2);
  expect(api.searchTracks.mock.calls.length).toBeLessThanOrEqual(3);
});
