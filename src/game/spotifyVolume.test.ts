import { throttleVolume } from './spotifyVolume';

test('volume changes to external speakers are limited to one per 500ms, keeping the last value', async () => {
  vi.useFakeTimers();
  const send = vi.fn(async () => {});
  const set = throttleVolume(send, 500);
  for (let v = 10; v <= 50; v += 10) { void set(v); await vi.advanceTimersByTimeAsync(100); }
  await vi.advanceTimersByTimeAsync(1000);
  expect(send.mock.calls.length).toBeLessThanOrEqual(3);
  expect(send.mock.calls.at(-1)).toEqual([50]);
  vi.useRealTimers();
});
