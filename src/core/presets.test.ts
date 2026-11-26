import { PRESET_GROUPS, PRESETS, presetQueries } from './presets';

test('there are lots of categories, grouped, with unique ids and real queries', () => {
  expect(PRESETS.length).toBeGreaterThanOrEqual(70);
  expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
  for (const p of PRESETS) {
    expect(PRESET_GROUPS).toContain(p.group);
    expect(presetQueries(p).length).toBeGreaterThan(0);
    presetQueries(p).forEach((q) => expect(q.trim()).not.toBe(''));
  }
  for (const g of PRESET_GROUPS) expect(PRESETS.filter((p) => p.group === g).length).toBeGreaterThanOrEqual(8);
});

test('decade presets use a year range', () => {
  expect(presetQueries(PRESETS.find((p) => p.id === '80s')!)).toEqual(['year:1980-1989']);
});
