import { GameController, type PlaybackPort, type ControllerState } from './controller';
import { DEFAULT_CLIP } from '../core/clip';
import type { Call, ClipSettings } from '../core/types';
import { song } from '../test/fixtures';

const songs = Array.from({ length: 5 }, (_, i) => song(i, { durationMs: 300_000 }));
const byId = new Map(songs.map((s) => [s.id, s]));
const order = songs.map((s) => s.id);

function setup(settings: Partial<ClipSettings> = {}, failIds: string[] = []) {
  let t = 0;
  const plays: { uri: string; pos: number }[] = [];
  const volumes: number[] = [];
  const port: PlaybackPort = {
    play: vi.fn(async (uri: string, pos: number) => {
      if (failIds.some((id) => uri.endsWith(id))) throw new Error('unavailable');
      plays.push({ uri, pos });
    }),
    pause: vi.fn(async () => {}),
    resume: vi.fn(async () => {}),
    seek: vi.fn(async () => {}),
    setVolume: vi.fn(async (v: number) => { volumes.push(v); }),
  };
  const calls: Call[] = [];
  const errors: string[] = [];
  let state!: ControllerState;
  const c = new GameController(port, [...order], byId, { ...DEFAULT_CLIP, startMode: 'beginning', fadeSec: 0, ...settings }, {
    onState: (s) => (state = s), onCall: (x) => calls.push(x), onError: (m) => errors.push(m),
  }, () => t, () => 0.5);
  const advance = async (ms: number, step = 250) => {
    for (let x = 0; x < ms; x += step) { t += step; c.tick(); await Promise.resolve(); await Promise.resolve(); }
  };
  return { c, port, plays, calls, errors, volumes, advance, get state() { return state; } };
}

test('start plays first song and records one call', async () => {
  const h = setup();
  await h.c.start();
  expect(h.plays).toEqual([{ uri: 'spotify:track:s0', pos: 0 }]);
  expect(h.calls.map((x) => x.songId)).toEqual(['s0']);
  expect(h.state.phase).toBe('playing');
});

test('clip end → gap → auto next', async () => {
  const h = setup({ clipSec: 10, gapSec: 3 });
  await h.c.start();
  await h.advance(10_000);
  expect(h.state.phase).toBe('gap');
  expect(h.port.pause).toHaveBeenCalled();
  await h.advance(3_000);
  expect(h.calls.map((x) => x.songId)).toEqual(['s0', 's1']);
  expect(h.state.phase).toBe('playing');
});

test('next during gap advances once', async () => {
  const h = setup({ clipSec: 10, gapSec: 1 });
  await h.c.start();
  await h.advance(10_000);
  const p = h.c.next();
  await h.advance(2_000);
  await p;
  await h.advance(500);
  expect(h.calls.map((x) => x.songId)).toEqual(['s0', 's1']);
});

test('replay during gap cancels countdown and replays without a new call', async () => {
  const h = setup({ clipSec: 10, gapSec: 3 });
  await h.c.start();
  await h.advance(10_000);
  await h.c.replayLast();
  expect(h.state.phase).toBe('playing');
  expect(h.plays.map((p) => p.uri)).toEqual(['spotify:track:s0', 'spotify:track:s0']);
  await h.advance(2_000);
  expect(h.calls).toHaveLength(1);
});

test('play failure skips without recording call', async () => {
  const h = setup({}, ['s1']);
  await h.c.start();
  await h.c.next();
  expect(h.errors.join(' ')).toMatch(/Song 1/);
  expect(h.calls.map((x) => x.songId)).toEqual(['s0', 's2']);
});

test('autoAdvance off waits in gap', async () => {
  const h = setup({ clipSec: 5, autoAdvance: false });
  await h.c.start();
  await h.advance(20_000);
  expect(h.state.phase).toBe('gap');
  expect(h.calls).toHaveLength(1);
  await h.c.next();
  expect(h.calls).toHaveLength(2);
});

test('updateSettings clipSec mid-clip ends clip at new length', async () => {
  const h = setup({ clipSec: 30 });
  await h.c.start();
  await h.advance(5_000);
  h.c.updateSettings({ clipSec: 10 });
  await h.advance(5_000);
  expect(h.state.phase).toBe('gap');
});

test('mute sets volume 0 and unmute restores', async () => {
  const h = setup();
  await h.c.start();
  h.c.setVolume(80);
  await h.advance(250);
  h.c.toggleMute();
  await h.advance(250);
  expect(h.volumes.at(-1)).toBe(0);
  h.c.toggleMute();
  await h.advance(250);
  expect(h.volumes.at(-1)).toBe(80);
});

test('reorder affects only upcoming songs', async () => {
  const h = setup();
  await h.c.start();
  h.c.reorder(['s4', 's3', 's2', 's1']);
  expect(h.c.upcoming()).toEqual(['s4', 's3', 's2', 's1']);
  await h.c.next();
  expect(h.calls.map((x) => x.songId)).toEqual(['s0', 's4']);
});

test('pause and resume', async () => {
  const h = setup({ clipSec: 10 });
  await h.c.start();
  await h.c.togglePause();
  expect(h.state.phase).toBe('paused');
  await h.advance(30_000);
  expect(h.state.phase).toBe('paused');
  await h.c.togglePause();
  expect(h.port.resume).toHaveBeenCalled();
  expect(h.state.phase).toBe('playing');
});

test('end of list goes to done', async () => {
  const h = setup({ clipSec: 1, gapSec: 0 });
  await h.c.start();
  await h.advance(20_000);
  expect(h.calls).toHaveLength(5);
  expect(h.state.phase).toBe('done');
});
