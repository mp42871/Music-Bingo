import { computeStartMs, DEFAULT_CLIP } from './clip';
import { song } from '../test/fixtures';

test('defaults match spec', () => {
  expect(DEFAULT_CLIP).toMatchObject({ clipSec: 30, gapSec: 5, startMode: 'random', randomMinSec: 30, randomMaxSec: 75, autoAdvance: true, fadeSec: 1.5 });
});
test('random start is within range', () => {
  const s = song(1, { durationMs: 300_000 });
  const ms = computeStartMs(s, DEFAULT_CLIP, () => 0.5);
  expect(ms).toBe(52_500);
});
test('start clamps so the clip fits in a short song', () => {
  expect(computeStartMs(song(1, { durationMs: 40_000 }), DEFAULT_CLIP, () => 0.99)).toBe(10_000);
  expect(computeStartMs(song(1, { durationMs: 20_000 }), DEFAULT_CLIP, () => 0.99)).toBe(0);
});
test('song marker wins in any mode', () => {
  expect(computeStartMs(song(1, { startMs: 65_000 }), DEFAULT_CLIP, () => 0)).toBe(65_000);
});
test('beginning and fixed modes', () => {
  expect(computeStartMs(song(1), { ...DEFAULT_CLIP, startMode: 'beginning' }, () => 0.5)).toBe(0);
  expect(computeStartMs(song(1), { ...DEFAULT_CLIP, startMode: 'fixed', fixedStartSec: 45 }, () => 0.5)).toBe(45_000);
});
