import { masksFor, PATTERNS } from './patterns';

test('line on 5x5 has 12 masks of 5', () => {
  const m = masksFor('line', 5);
  expect(m).toHaveLength(12);
  m.forEach((x) => expect(x).toHaveLength(5));
  expect(m).toContainEqual([0, 6, 12, 18, 24]);
  expect(m).toContainEqual([4, 8, 12, 16, 20]);
});
test('line on 3x3 has 8 masks', () => expect(masksFor('line', 3)).toHaveLength(8));
test('twoLines has C(12,2)=66 masks', () => expect(masksFor('twoLines', 5)).toHaveLength(66));
test('fourCorners', () => expect(masksFor('fourCorners', 5)).toEqual([[0, 4, 20, 24]]));
test('blackout', () => expect(masksFor('blackout', 5)[0]).toHaveLength(25));
test('x is both diagonals (9 cells)', () => expect(masksFor('x', 5)[0]).toHaveLength(9));
test('frame is 16 cells', () => expect(masksFor('frame', 5)[0]).toHaveLength(16));
test('custom uses given mask', () => expect(masksFor('custom', 5, [1, 2])).toEqual([[1, 2]]));
test('unknown id throws', () => expect(() => masksFor('nope', 5)).toThrow());
test('every listed pattern produces masks for every size', () => {
  for (const p of PATTERNS) for (const s of [3, 4, 5] as const) {
    const m = masksFor(p.id, s, [0]);
    expect(m.length).toBeGreaterThan(0);
    m.forEach((mask) => mask.forEach((i) => expect(i >= 0 && i < s * s).toBe(true)));
  }
});
