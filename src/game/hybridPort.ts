import { pickSource, type Source } from '../core/offline';
import type { ClipSettings, Song } from '../core/types';
import type { PlaybackPort } from './controller';

export interface FilePlayer {
  /** Starts the file at positionMs, moved earlier if needed so clipMs of music remains. */
  load(blob: Blob, positionMs: number, clipMs: number): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seek(ms: number): Promise<void>;
  setVolume(pct: number): Promise<void>;
  stop(): void;
  /** Called inside the host's click so the browser lets audio start. */
  prime?(): void;
}

export interface HybridDeps {
  spotify: PlaybackPort;
  file: FilePlayer;
  getSong(uri: string): Song | undefined;
  getBlob(fileId: string): Promise<Blob | undefined>;
  policy(): ClipSettings['source'];
  clipMs(): number;
  online(): boolean;
  spotifyReady(): boolean;
  onSource(s: Source): void;
  onNotice(msg: string): void;
  onNetworkFailure(): void;
}

const isNetworkError = (e: unknown) =>
  e instanceof TypeError || /failed to fetch|network|load failed|offline/i.test(e instanceof Error ? e.message : String(e));

/** Plays each song from the best source it has right now: Spotify, a music file, or "manual" (host plays it). */
export function createHybridPort(d: HybridDeps): PlaybackPort & { current(): Source | null } {
  let active: Source | null = null;
  let volume: number | null = null;
  const name = (s: Song) => s.displayTitle ?? s.title;

  const use = (s: Source) => {
    if (active === 'file' && s !== 'file') d.file.stop();
    if (active === 'spotify' && s !== 'spotify') d.spotify.pause().catch(() => {});
    active = s;
    d.onSource(s);
  };

  const playFile = async (song: Song, pos: number): Promise<void | 'manual'> => {
    const blob = song.fileId ? await d.getBlob(song.fileId) : undefined;
    if (!blob) {
      d.onNotice(`The music file for "${name(song)}" isn't on this computer — play it from the Spotify app.`);
      use('manual');
      return 'manual';
    }
    try {
      if (active === 'spotify') d.spotify.pause().catch(() => {});
      if (volume !== null) await d.file.setVolume(volume);
      await d.file.load(blob, pos, d.clipMs());
      use('file');
    } catch {
      d.onNotice(`Couldn't play the music file for "${name(song)}" — play it from the Spotify app.`);
      use('manual');
      return 'manual';
    }
  };

  return {
    current: () => active,
    prime() { d.spotify.prime?.(); d.file.prime?.(); },
    async play(uri, pos) {
      const song = d.getSong(uri);
      if (!song) throw new Error('Unknown song');
      const src = pickSource(song, d.policy(), { online: d.online(), spotifyReady: d.spotifyReady() });
      if (src === 'manual') { use('manual'); return 'manual'; }
      if (src === 'file') return playFile(song, pos);
      try {
        if (active === 'file') d.file.stop();
        await d.spotify.play(uri, pos);
        use('spotify');
      } catch (e) {
        const net = isNetworkError(e);
        if (net) d.onNetworkFailure();
        if (song.fileId && d.policy() !== 'manual') return playFile(song, pos);
        if (net) { use('manual'); return 'manual'; }
        throw e;
      }
    },
    pause: async () => { if (active === 'spotify') await d.spotify.pause(); else if (active === 'file') await d.file.pause(); },
    resume: async () => { if (active === 'spotify') await d.spotify.resume(); else if (active === 'file') await d.file.resume(); },
    seek: async (ms) => { if (active === 'spotify') await d.spotify.seek(ms); else if (active === 'file') await d.file.seek(ms); },
    setVolume: async (v) => { volume = v; if (active === 'spotify') await d.spotify.setVolume(v); else if (active === 'file') await d.file.setVolume(v); },
  };
}
