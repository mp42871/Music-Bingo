import { buildPoolFromPlaylists, mergeFromSources } from './spotifyImport';
import { song } from '../test/fixtures';

const a = { id: 'A', name: '80s', songs: [song(1), song(2)] };
const b = { id: 'B', name: 'Country', songs: [song(2), song(3)] };

test('one playlist becomes a bingo playlist with its name and no categories', () => {
  const p = buildPoolFromPlaylists([a]);
  expect(p.name).toBe('80s');
  expect(p.categories).toEqual([]);
  expect(p.sources).toEqual([{ id: 'A', name: '80s' }]);
  expect(p.songs.map((s) => [s.id, s.categories, s.sourceIds])).toEqual([['s1', [], ['A']], ['s2', [], ['A']]]);
});

test('several playlists become categories; a shared song gets both', () => {
  const p = buildPoolFromPlaylists([a, b]);
  expect(p.name).toBe('80s + Country');
  expect(p.categories).toEqual(['80s', 'Country']);
  expect(p.songs.map((s) => s.id)).toEqual(['s1', 's2', 's3']);
  expect(p.songs.find((s) => s.id === 's2')!.categories).toEqual(['80s', 'Country']);
  expect(p.songs.find((s) => s.id === 's2')!.sourceIds).toEqual(['A', 'B']);
});

test('update keeps host settings, adds new songs, drops removed ones, keeps hand-added songs', () => {
  const p = buildPoolFromPlaylists([a, b]);
  p.songs = p.songs.map((s) => (s.id === 's2' ? { ...s, startMs: 61000, fileId: 'f2', displayTitle: 'Short', categories: [...s.categories, 'Favorites'] } : s));
  p.songs.push(song(9, { title: 'Hand added' }));
  const res = mergeFromSources(p, [{ ...a, songs: [song(2), song(4)] }, b]);
  const ids = res.pool.songs.map((s) => s.id);
  expect(ids).toEqual(['s2', 's3', 's9', 's4']);
  const s2 = res.pool.songs.find((s) => s.id === 's2')!;
  expect(s2).toMatchObject({ startMs: 61000, fileId: 'f2', displayTitle: 'Short' });
  expect(s2.categories).toEqual(['Favorites', '80s', 'Country']);
  expect(res.pool.songs.find((s) => s.id === 's4')!.categories).toEqual(['80s']);
  expect(res).toMatchObject({ added: 1, removed: 1 });
});

test('a song that leaves one source loses only that category', () => {
  const p = buildPoolFromPlaylists([a, b]);
  const res = mergeFromSources(p, [{ ...a, songs: [song(1)] }, b]);
  const s2 = res.pool.songs.find((s) => s.id === 's2')!;
  expect(s2.categories).toEqual(['Country']);
  expect(s2.sourceIds).toEqual(['B']);
  expect(res.removed).toBe(0);
});
