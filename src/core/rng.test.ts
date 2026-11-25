import { hashSeed, mulberry32, shuffle } from './rng';

test('same seed gives identical sequence', () => {
  const a = mulberry32(42), b = mulberry32(42);
  const sa = Array.from({ length: 5 }, a), sb = Array.from({ length: 5 }, b);
  expect(sa).toEqual(sb);
  sa.forEach((v) => expect(v >= 0 && v < 1).toBe(true));
});

test('different seeds differ', () => {
  expect(mulberry32(1)()).not.toBe(mulberry32(2)());
});

test('shuffle is a deterministic non-mutating permutation', () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const copy = [...input];
  const out = shuffle(input, mulberry32(7));
  expect(input).toEqual(copy);
  expect([...out].sort((x, y) => x - y)).toEqual(input);
  expect(shuffle(input, mulberry32(7))).toEqual(out);
});

test('hashSeed is stable and sensitive to parts', () => {
  expect(hashSeed(1, 'a')).toBe(hashSeed(1, 'a'));
  expect(hashSeed(1, 'a')).not.toBe(hashSeed(1, 'b'));
  expect(Number.isInteger(hashSeed(1, 'a'))).toBe(true);
});
