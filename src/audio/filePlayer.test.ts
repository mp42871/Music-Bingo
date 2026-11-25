import { createFilePlayer } from './filePlayer';

function stubMedia(duration = 100) {
  vi.useFakeTimers();
  vi.stubGlobal('AudioContext', undefined);
  const proto = HTMLMediaElement.prototype;
  vi.spyOn(proto, 'play').mockResolvedValue(undefined);
  vi.spyOn(proto, 'load').mockImplementation(function (this: HTMLMediaElement) { setTimeout(() => this.dispatchEvent(new Event('canplay')), 10); });
  vi.spyOn(proto, 'pause').mockImplementation(() => {});
  Object.defineProperty(proto, 'duration', { configurable: true, get: () => duration });
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:x');
  globalThis.URL.revokeObjectURL = vi.fn();
}
function unstub() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (HTMLMediaElement.prototype as any).duration;
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
}

test('a start point past the end of a short file moves back so the whole clip has music', async () => {
  stubMedia(40);
  const p = createFilePlayer();
  const done = p.load(new Blob(['x']), 60_000, 30_000);
  await vi.advanceTimersByTimeAsync(400);
  await done;
  expect(p.position()).toBe(10_000);
  unstub();
});

test('stop releases the file from memory', async () => {
  stubMedia();
  const p = createFilePlayer();
  const done = p.load(new Blob(['x']), 0, 30_000);
  await vi.advanceTimersByTimeAsync(400);
  await done;
  p.stop();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');
  unstub();
});

test('load does not hang when the browser keeps the audio context suspended', async () => {
  vi.useFakeTimers();
  class FakeCtx {
    currentTime = 0;
    destination = {};
    resume = () => new Promise<void>(() => {}); // never settles (no user activation)
    createGain() { return { gain: { value: 1, setTargetAtTime() {} }, connect: () => ({}) }; }
    createMediaElementSource() { return { connect: (g: { connect: () => unknown }) => g }; }
  }
  vi.stubGlobal('AudioContext', FakeCtx);
  const proto = HTMLMediaElement.prototype;
  const play = vi.spyOn(proto, 'play').mockResolvedValue(undefined);
  vi.spyOn(proto, 'load').mockImplementation(function (this: HTMLMediaElement) { setTimeout(() => this.dispatchEvent(new Event('canplay')), 10); });
  vi.spyOn(proto, 'pause').mockImplementation(() => {});
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:x');
  globalThis.URL.revokeObjectURL = vi.fn();
  const p = createFilePlayer();
  let done = false;
  void p.load(new Blob(['x']), 0, 30_000).then(() => { done = true; });
  await vi.advanceTimersByTimeAsync(2000);
  expect(done).toBe(true);
  expect(play).toHaveBeenCalled();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
