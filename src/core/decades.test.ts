import { decadeOf, tagDecades } from './decades';
import { flatPool } from '../test/fixtures';

test('decadeOf', () => {
  expect(decadeOf(1985)).toBe('80s');
  expect(decadeOf(2003)).toBe('2000s');
  expect(decadeOf(1969)).toBe('60s');
  expect(decadeOf(undefined)).toBeNull();
});
test('tagDecades adds decade categories by year', () => {
  const p = flatPool(3);
  p.songs[0].year = 1984; p.songs[1].year = 1991;
  const t = tagDecades(p);
  expect(t.songs[0].categories).toContain('80s');
  expect(t.songs[1].categories).toContain('90s');
  expect(t.songs[2].categories).toEqual([]);
  expect(t.categories).toEqual(['80s', '90s']);
});
