import { startTicker } from './ticker';

test('ticks steadily and stops when asked (falls back to a timer without workers)', () => {
  vi.useFakeTimers();
  const fn = vi.fn();
  const stop = startTicker(fn, 250);
  vi.advanceTimersByTime(1000);
  expect(fn).toHaveBeenCalledTimes(4);
  stop();
  vi.advanceTimersByTime(1000);
  expect(fn).toHaveBeenCalledTimes(4);
  vi.useRealTimers();
});

test('uses a worker when the browser has one, so background tabs keep ticking', () => {
  const made: { onmessage: (() => void) | null; terminate: ReturnType<typeof vi.fn> }[] = [];
  vi.stubGlobal('Worker', class { onmessage: (() => void) | null = null; terminate = vi.fn(); constructor() { made.push(this as never); } });
  URL.createObjectURL ??= (() => 'blob:x') as never;
  URL.revokeObjectURL ??= (() => {}) as never;
  const fn = vi.fn();
  const stop = startTicker(fn, 250);
  made[0].onmessage!();
  expect(fn).toHaveBeenCalledTimes(1);
  stop();
  expect(made[0].terminate).toHaveBeenCalled();
  vi.unstubAllGlobals();
});
