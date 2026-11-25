import { createFilePlayer } from './filePlayer';

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
  void p.load(new Blob(['x']), 0).then(() => { done = true; });
  await vi.advanceTimersByTimeAsync(2000);
  expect(done).toBe(true);
  expect(play).toHaveBeenCalled();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
