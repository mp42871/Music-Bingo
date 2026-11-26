import { collectCurated, lookupSong, parseCurated } from './curated';
import { db } from '../db/db';
import { song } from '../test/fixtures';

beforeEach(async () => { await Promise.all(db.tables.map((t) => t.clear())); });

test('parseCurated reads "Artist - Title" lines', () => {
  expect(parseCurated(`
    Queen - We Will Rock You
    The White Stripes - Seven Nation Army
  `)).toEqual([{ artist: 'Queen', title: 'We Will Rock You' }, { artist: 'The White Stripes', title: 'Seven Nation Army' }]);
});

test('finds the exact song by title and artist, skipping live/karaoke versions', async () => {
  const api = { searchTracks: vi.fn(async (_q: string) => ({ total: 3, songs: [
    song(1, { title: 'We Will Rock You - Live at Wembley', artist: 'Queen' }),
    song(2, { title: 'We Will Rock You (Karaoke Version)', artist: 'Karaoke Hits' }),
    song(3, { title: 'We Will Rock You - Remastered 2011', artist: 'Queen' }),
  ] })) };
  const s = await lookupSong(api, { artist: 'Queen', title: 'We Will Rock You' });
  expect(s!.id).toBe('s3');
  expect(api.searchTracks.mock.calls[0][0]).toBe('track:"We Will Rock You" artist:"Queen"');
});

test('a song by someone else is not accepted', async () => {
  const api = { searchTracks: vi.fn(async () => ({ total: 1, songs: [song(1, { title: 'Anthem', artist: 'Random Band' })] })) };
  expect(await lookupSong(api, { artist: 'Queen', title: 'We Will Rock You' })).toBeNull();
});

test('lookups are remembered', async () => {
  const api = { searchTracks: vi.fn(async () => ({ total: 1, songs: [song(7, { title: 'Jolene', artist: 'Dolly Parton' })] })) };
  await lookupSong(api, { artist: 'Dolly Parton', title: 'Jolene' });
  const again = await lookupSong(api, { artist: 'Dolly Parton', title: 'Jolene' });
  expect(again!.id).toBe('s7');
  expect(api.searchTracks).toHaveBeenCalledTimes(1);
});

test('collectCurated stops at the amount wanted and can continue', async () => {
  const lines = Array.from({ length: 10 }, (_, i) => ({ artist: `A${i}`, title: `T${i}` }));
  const api = { searchTracks: vi.fn(async (q: string) => {
    const i = Number(q.match(/T(\d+)/)![1]);
    return { total: 1, songs: [song(i, { title: `T${i}`, artist: `A${i}` })] };
  }) };
  const first = await collectCurated(api, lines, 4);
  expect(first.songs.map((s) => s.id)).toEqual(['s0', 's1', 's2', 's3']);
  const rest = await collectCurated(api, lines, 100, first.next);
  expect(rest.songs).toHaveLength(6);
  expect(rest.done).toBe(true);
});
