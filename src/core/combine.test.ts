import { combinePools } from './combine';
import { song } from '../test/fixtures';
import type { Pool } from './types';

const pool = (id: string, name: string, songs = [song(1)], categories: string[] = []): Pool => ({ id, name, songs, categories, createdAt: 0, updatedAt: 0 });

test('one playlist is used as-is', () => {
  const p = pool('a', 'Rock');
  expect(combinePools([p])).toBe(p);
});

test('several playlists: each name becomes a category; shared songs get both; own categories kept', () => {
  const a = pool('a', '80s Rock', [song(1, { categories: ['Anthems'] }), song(2)], ['Anthems']);
  const b = pool('b', 'Country', [song(2), song(3)]);
  const c = combinePools([a, b]);
  expect(c.id).toBe('combo:a+b');
  expect(c.name).toBe('80s Rock + Country');
  expect(c.categories).toEqual(['80s Rock', 'Country', 'Anthems']);
  expect(c.songs.map((s) => [s.id, s.categories])).toEqual([
    ['s1', ['Anthems', '80s Rock']], ['s2', ['80s Rock', 'Country']], ['s3', ['Country']],
  ]);
});

test('a song switched off in one playlist stays available from the other', () => {
  const a = pool('a', 'A', [song(1, { excluded: true })]);
  const b = pool('b', 'B', [song(1)]);
  const s = combinePools([a, b]).songs[0];
  expect(s.excluded).toBeFalsy();
  expect(s.categories).toEqual(['B']);
});
