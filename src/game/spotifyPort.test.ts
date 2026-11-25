import { createSpotifyPort } from './spotifyPort';
import { SpotifyError } from '../spotify/api';

function setup(opts: { browser?: boolean; states?: (null | { paused: boolean; position: number })[] } = {}) {
  const api = {
    play: vi.fn(async () => undefined), pause: vi.fn(async () => undefined), resume: vi.fn(async () => undefined),
    seek: vi.fn(async () => undefined), volume: vi.fn(async () => undefined),
  };
  const states = [...(opts.states ?? [{ paused: false, position: 500 }])];
  const sdk = {
    activateElement: vi.fn(async () => {}), pause: vi.fn(async () => {}), resume: vi.fn(async () => {}),
    seek: vi.fn(async () => {}), setVolume: vi.fn(async () => {}),
    getCurrentState: vi.fn(async () => (states.length > 1 ? states.shift() : states[0])),
  };
  const port = createSpotifyPort({
    api: () => api as never, device: () => 'dev1', browserPlayer: () => (opts.browser === false ? null : (sdk as never)),
    wait: async () => {},
  });
  return { port, api, sdk };
}

test('pause, resume and seek on the in-browser player happen locally (instant)', async () => {
  const h = setup();
  await h.port.pause();
  await h.port.resume();
  await h.port.seek(5000);
  expect(h.sdk.pause).toHaveBeenCalled();
  expect(h.sdk.resume).toHaveBeenCalled();
  expect(h.sdk.seek).toHaveBeenCalledWith(5000);
  expect(h.api.pause).not.toHaveBeenCalled();
  expect(h.api.seek).not.toHaveBeenCalled();
});

test('external speakers are controlled through Spotify', async () => {
  const h = setup({ browser: false });
  await h.port.pause();
  await h.port.seek(1000);
  expect(h.api.pause).toHaveBeenCalledWith('dev1');
  expect(h.api.seek).toHaveBeenCalledWith('dev1', 1000);
});

test('prime unlocks the in-browser player synchronously', () => {
  const h = setup();
  h.port.prime!();
  expect(h.sdk.activateElement).toHaveBeenCalledTimes(1);
});

test('a silent first start is retried once (pause, then play again)', async () => {
  const h = setup({ states: [null, null, null, null, null, null, null, null, null, null, { paused: false, position: 800 }] });
  await h.port.play('spotify:track:x', 30000);
  expect(h.api.play).toHaveBeenCalledTimes(2);
  expect(h.api.play).toHaveBeenLastCalledWith('dev1', 'spotify:track:x', 30000);
  expect(h.sdk.pause).toHaveBeenCalled();
});

test('a start that is really playing is not retried', async () => {
  const h = setup({ states: [{ paused: false, position: 400 }] });
  await h.port.play('spotify:track:x', 0);
  expect(h.api.play).toHaveBeenCalledTimes(1);
});

test('device and sign-in errors are marked fatal', async () => {
  const h = setup();
  h.api.play.mockRejectedValueOnce(new SpotifyError('Spotify player not found. Pick a device', 404));
  await expect(h.port.play('spotify:track:x', 0)).rejects.toMatchObject({ fatal: true });
});
