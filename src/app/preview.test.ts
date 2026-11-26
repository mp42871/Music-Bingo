import { usePreview, PREVIEW_MS, DEFAULT_PREVIEW_START_MS } from './preview';
import { useGame } from '../game/store';
import type { PlaybackPort } from '../game/controller';
import { song } from '../test/fixtures';

function fakePort() {
  return {
    play: vi.fn(async () => undefined), pause: vi.fn(async () => {}), resume: vi.fn(async () => {}),
    seek: vi.fn(async () => {}), setVolume: vi.fn(async () => {}), prime: vi.fn(),
  } satisfies PlaybackPort;
}

let port: ReturnType<typeof fakePort>;
beforeEach(() => {
  vi.useFakeTimers();
  port = fakePort();
  usePreview.setState({ makePort: () => port, current: null, error: null, positionMs: 0 });
  useGame.setState({ cs: null });
});
afterEach(() => { usePreview.getState().stop(); vi.useRealTimers(); });

test('plays from about 30 seconds in and stops by itself after 20 seconds', async () => {
  await usePreview.getState().play(song(1, { durationMs: 200_000 }));
  expect(port.prime).toHaveBeenCalled();
  expect(port.play).toHaveBeenCalledWith('spotify:track:s1', DEFAULT_PREVIEW_START_MS);
  expect(usePreview.getState().current?.id).toBe('s1');
  await vi.advanceTimersByTimeAsync(PREVIEW_MS + 300);
  expect(port.pause).toHaveBeenCalled();
  expect(usePreview.getState().current).toBeNull();
});

test('play from the start point uses the song’s marker', async () => {
  await usePreview.getState().play(song(1, { startMs: 65_000, durationMs: 200_000 }), 'marker');
  expect(port.play).toHaveBeenCalledWith('spotify:track:s1', 65_000);
});

test('short songs start early enough to hear the whole preview', async () => {
  await usePreview.getState().play(song(1, { durationMs: 40_000 }));
  expect(port.play).toHaveBeenCalledWith('spotify:track:s1', 20_000);
});

test('pressing the same song again stops it; a new song replaces the old one', async () => {
  await usePreview.getState().play(song(1));
  await usePreview.getState().toggle(song(1));
  expect(usePreview.getState().current).toBeNull();
  await usePreview.getState().play(song(1));
  await usePreview.getState().play(song(2));
  expect(usePreview.getState().current?.id).toBe('s2');
  expect(port.play).toHaveBeenLastCalledWith('spotify:track:s2', expect.any(Number));
});

test('position advances, seek moves it, and the preview never counts as a call', async () => {
  await usePreview.getState().play(song(1, { durationMs: 200_000 }));
  await vi.advanceTimersByTimeAsync(2_000);
  expect(usePreview.getState().positionMs).toBeGreaterThanOrEqual(DEFAULT_PREVIEW_START_MS + 1_750);
  await usePreview.getState().seek(90_000);
  expect(port.seek).toHaveBeenCalledWith(90_000);
  expect(usePreview.getState().positionMs).toBe(90_000);
});

test('no previews while a game is playing', async () => {
  useGame.setState({ cs: { phase: 'playing' } as never });
  await usePreview.getState().play(song(1));
  expect(port.play).not.toHaveBeenCalled();
  expect(usePreview.getState().error).toMatch(/Pause the game/);
});
