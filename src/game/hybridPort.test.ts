import { createHybridPort, type FilePlayer } from './hybridPort';
import type { PlaybackPort } from './controller';
import type { ClipSettings, Song } from '../core/types';
import { song } from '../test/fixtures';

function setup(opts: { policy?: ClipSettings['source']; online?: boolean; spotifyFails?: Error; fileFails?: boolean; blob?: boolean } = {}) {
  const spotify = { play: vi.fn(async () => { if (opts.spotifyFails) throw opts.spotifyFails; }), pause: vi.fn(async () => {}), resume: vi.fn(async () => {}), seek: vi.fn(async () => {}), setVolume: vi.fn(async () => {}) } satisfies PlaybackPort;
  const file = { load: vi.fn(async () => { if (opts.fileFails) throw new Error('decode'); }), pause: vi.fn(async () => {}), resume: vi.fn(async () => {}), seek: vi.fn(async () => {}), setVolume: vi.fn(async () => {}), stop: vi.fn() } satisfies FilePlayer;
  const songs: Song[] = [song(1, { fileId: 'f1' }), song(2), song(3, { id: 'file:f3', uri: 'file:f3', fileId: 'f3' })];
  const sources: string[] = [];
  const notices: string[] = [];
  const port = createHybridPort({
    spotify, file, getSong: (uri) => songs.find((s) => s.uri === uri),
    getBlob: async (id) => (opts.blob === false ? undefined : new Blob([id])),
    policy: () => opts.policy ?? 'auto', online: () => opts.online ?? true, spotifyReady: () => true, clipMs: () => 30_000,
    onSource: (s) => sources.push(s), onNotice: (m) => notices.push(m), onNetworkFailure: () => notices.push('NET'),
  });
  return { port, spotify, file, sources, notices };
}

test('online auto plays through Spotify; controls go to Spotify', async () => {
  const h = setup();
  expect(await h.port.play('spotify:track:s1', 1000)).toBeUndefined();
  expect(h.spotify.play).toHaveBeenCalledWith('spotify:track:s1', 1000);
  await h.port.pause();
  expect(h.spotify.pause).toHaveBeenCalled();
  expect(h.sources).toEqual(['spotify']);
});

test('offline auto plays the file and routes controls to it', async () => {
  const h = setup({ online: false });
  await h.port.play('spotify:track:s1', 5000);
  expect(h.file.load).toHaveBeenCalledWith(expect.any(Blob), 5000, 30_000);
  await h.port.seek(9000);
  await h.port.setVolume(40);
  expect(h.file.seek).toHaveBeenCalledWith(9000);
  expect(h.file.setVolume).toHaveBeenCalledWith(40);
  expect(h.spotify.play).not.toHaveBeenCalled();
});

test('auto policy falls back to file when Spotify play fails offline', async () => {
  const h = setup({ spotifyFails: new TypeError('Failed to fetch') });
  await h.port.play('spotify:track:s1', 0);
  expect(h.file.load).toHaveBeenCalled();
  expect(h.sources.at(-1)).toBe('file');
  expect(h.notices).toContain('NET');
});

test('network failure with no file becomes a manual prompt', async () => {
  const h = setup({ spotifyFails: new TypeError('Failed to fetch') });
  expect(await h.port.play('spotify:track:s2', 0)).toBe('manual');
});

test('file that fails to decode falls back to manual', async () => {
  const h = setup({ policy: 'files', fileFails: true });
  expect(await h.port.play('spotify:track:s1', 0)).toBe('manual');
  expect(h.notices.join(' ')).toMatch(/Song 1/);
});

test('missing file data falls back to manual', async () => {
  const h = setup({ online: false, blob: false });
  expect(await h.port.play('spotify:track:s1', 0)).toBe('manual');
});

test('manual policy never plays audio and stops the file player', async () => {
  const h = setup({ policy: 'manual' });
  expect(await h.port.play('spotify:track:s1', 0)).toBe('manual');
  expect(h.spotify.play).not.toHaveBeenCalled();
  expect(h.file.load).not.toHaveBeenCalled();
  await h.port.pause();
  expect(h.file.pause).not.toHaveBeenCalled();
});

test('file-only songs use the file even online', async () => {
  const h = setup();
  await h.port.play('file:f3', 0);
  expect(h.file.load).toHaveBeenCalled();
  expect(h.spotify.play).not.toHaveBeenCalled();
});

test('switching to a music file applies the latest volume before it starts', async () => {
  const h = setup();
  await h.port.play('spotify:track:s1', 0);
  await h.port.setVolume(35);
  await h.port.play('file:f3', 0);
  expect(h.file.setVolume).toHaveBeenCalledWith(35);
  expect(h.file.setVolume.mock.invocationCallOrder[0]).toBeLessThan(h.file.load.mock.invocationCallOrder[0]);
});

test('file playback is told the clip length', async () => {
  const h = setup();
  await h.port.play('file:f3', 5000);
  expect(h.file.load).toHaveBeenCalledWith(expect.any(Blob), 5000, 30_000);
});
