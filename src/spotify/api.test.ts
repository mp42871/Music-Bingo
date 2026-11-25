import { SpotifyApi, SpotifyError, trackToSong } from './api';

const track = {
  id: 't1', uri: 'spotify:track:t1', name: 'Jolene', duration_ms: 160000,
  artists: [{ name: 'Dolly Parton' }, { name: 'X' }],
  album: { name: 'Jolene', release_date: '1973-10-15', images: [{ url: 'big', width: 640 }, { url: 'small', width: 64 }] },
};

test('trackToSong maps fields', () => {
  expect(trackToSong(track)).toEqual({
    id: 't1', uri: 'spotify:track:t1', title: 'Jolene', artist: 'Dolly Parton, X', album: 'Jolene',
    year: 1973, durationMs: 160000, artUrl: 'big', categories: [],
  });
});

test('429 then 200 resolves after Retry-After', async () => {
  vi.useFakeTimers();
  const f = vi.fn()
    .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '2' } }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ tracks: { items: [track], total: 1 } }), { status: 200 }));
  vi.stubGlobal('fetch', f);
  const api = new SpotifyApi(async () => 'tok');
  const p = api.searchTracks('jolene');
  await vi.advanceTimersByTimeAsync(2100);
  const res = await p;
  expect(res.songs[0].title).toBe('Jolene');
  expect(f).toHaveBeenCalledTimes(2);
  expect(String(f.mock.calls[0][0])).toContain('limit=10');
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test('persistent 429 throws a readable SpotifyError', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response('', { status: 429, headers: { 'Retry-After': '1' } })));
  const api = new SpotifyApi(async () => 'tok');
  const p = api.searchTracks('x').catch((e) => e);
  await vi.advanceTimersByTimeAsync(10_000);
  const err = await p;
  expect(err).toBeInstanceOf(SpotifyError);
  expect(err.message).toMatch(/busy|limit/i);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test('not connected throws', async () => {
  const api = new SpotifyApi(async () => null);
  await expect(api.searchTracks('x')).rejects.toThrow(/Connect Spotify/);
});
