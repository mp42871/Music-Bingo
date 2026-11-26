import { gainForSamples, TARGET_DBFS, trimFactor } from './loudness';

const tone = (amp: number, n = 48000) => Float32Array.from({ length: n }, (_, i) => amp * Math.sin(i / 10));

test('quiet audio gets boosted, loud audio turned down, capped at ±9 dB', () => {
  const quiet = gainForSamples([tone(0.05)]);
  const loud = gainForSamples([tone(0.9)]);
  expect(quiet).toBeGreaterThan(0);
  expect(loud).toBeLessThan(0);
  expect(gainForSamples([tone(0.0005)])).toBe(9);
  expect(gainForSamples([tone(1)])).toBeGreaterThanOrEqual(-9);
});

test('audio already at the target needs no change', () => {
  const amp = Math.pow(10, TARGET_DBFS / 20) * Math.SQRT2;
  expect(Math.abs(gainForSamples([tone(amp)]))).toBeLessThanOrEqual(0.5);
});

test('silence is ignored rather than boosted', () => {
  expect(gainForSamples([new Float32Array(48000)])).toBe(0);
});

test('trimFactor converts dB to a volume multiplier', () => {
  expect(trimFactor(0)).toBe(1);
  expect(trimFactor(6)).toBeCloseTo(1.995, 2);
  expect(trimFactor(-6)).toBeCloseTo(0.501, 2);
  expect(trimFactor(undefined)).toBe(1);
});
