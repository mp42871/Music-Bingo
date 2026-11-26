import { PRESET_GROUPS, PRESETS, presetQueries } from './presets';
import { parseCurated } from '../spotify/curated';

test('there are lots of categories, grouped, with unique ids', () => {
  expect(PRESETS.length).toBeGreaterThanOrEqual(70);
  expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
  for (const g of PRESET_GROUPS) expect(PRESETS.filter((p) => p.group === g).length).toBeGreaterThanOrEqual(8);
});

test('every Theme and Occasion is a hand-picked list of at least 30 songs, no repeats', () => {
  for (const p of PRESETS.filter((x) => x.group === 'Themes' || x.group === 'Occasions')) {
    expect(p.songs, p.name).toBeTruthy();
    const lines = parseCurated(p.songs!);
    expect(lines.length, p.name).toBeGreaterThanOrEqual(30);
    lines.forEach((l) => { expect(l.artist, `${p.name}: ${l.title}`).not.toBe(''); expect(l.title).not.toBe(''); });
    const keys = lines.map((l) => `${l.artist}|${l.title}`.toLowerCase());
    expect(new Set(keys).size, p.name).toBe(keys.length);
  }
});

test('decades and genres use Spotify filters', () => {
  expect(presetQueries(PRESETS.find((p) => p.id === '80s')!)).toEqual(['year:1980-1989']);
  for (const p of PRESETS.filter((x) => x.group === 'Decades' || x.group === 'Genres')) expect(presetQueries(p).length).toBeGreaterThan(0);
});
