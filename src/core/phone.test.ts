import { decodePhoneDef, encodePhoneDef, phoneCardNumber, type PhoneDef } from './phone';
import { layout } from '../test/fixtures';
import { mulberry32 } from './rng';

test('phone def round-trips', () => {
  const d: PhoneDef = { v: 1, seed: 5, layout: layout(), title: 'Party', songs: [['s1', 'Song 1', 'A'], ['s2', 'Song 2', 'B']] };
  expect(decodePhoneDef(encodePhoneDef(d))).toEqual(d);
});
test('garbage throws', () => expect(() => decodePhoneDef('%%%garbage')).toThrow());
test('phone numbers are in 5000-9999', () => {
  const r = mulberry32(1);
  for (let i = 0; i < 1000; i++) {
    const n = phoneCardNumber(r);
    expect(n >= 5000 && n <= 9999).toBe(true);
  }
});
