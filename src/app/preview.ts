import { create } from 'zustand';
import { createFilePlayer } from '../audio/filePlayer';
import type { Song } from '../core/types';
import { getAudioBlob, getAudioGain } from '../db/audio';
import type { PlaybackPort } from '../game/controller';
import { createHybridPort } from '../game/hybridPort';
import { connectBrowserPlayer, getDevice, spotifyPort, useGame } from '../game/store';
import { reportNetworkFailure, useNet } from './online';
import { useSpotify } from './spotifyStore';

export const PREVIEW_MS = 20_000;
export const DEFAULT_PREVIEW_START_MS = 30_000;

let filePlayer: ReturnType<typeof createFilePlayer> | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

/** Previews play through the same Spotify connection as games (or the linked music file). */
export function previewPort(): PlaybackPort {
  return createHybridPort({
    spotify: spotifyPort(),
    file: (filePlayer ??= createFilePlayer()),
    getSong: (uri) => (usePreview.getState().current?.uri === uri ? usePreview.getState().current! : undefined),
    getBlob: getAudioBlob,
    getFileGain: getAudioGain,
    policy: () => 'auto',
    clipMs: () => PREVIEW_MS,
    online: () => useNet.getState().online,
    spotifyReady: () => useSpotify.getState().connected && !!getDevice(),
    onSource: () => {},
    onNotice: (m) => usePreview.setState({ error: m }),
    onNetworkFailure: reportNetworkFailure,
  });
}

interface Preview {
  current: Song | null;
  positionMs: number;
  error: string | null;
  makePort: () => PlaybackPort;
  play(song: Song, from?: 'default' | 'marker'): Promise<void>;
  toggle(song: Song, from?: 'default' | 'marker'): Promise<void>;
  seek(ms: number): Promise<void>;
  stop(): void;
}

let port: PlaybackPort | null = null;
let portMaker: (() => PlaybackPort) | null = null;
let endsAt = 0;

export const usePreview = create<Preview>((set, get) => ({
  current: null, positionMs: 0, error: null, makePort: previewPort,

  async play(song, from = 'default') {
    const cs = useGame.getState().cs;
    if (cs && (cs.phase === 'playing' || cs.phase === 'loading')) return set({ error: 'Pause the game to preview songs.' });
    if (!port || portMaker !== get().makePort) { portMaker = get().makePort; port = portMaker(); }
    port.prime?.(); // inside the click, so the browser allows audio
    if (timer) clearInterval(timer);
    const dur = song.durationMs || 0;
    const wanted = from === 'marker' && song.startMs !== undefined ? song.startMs : DEFAULT_PREVIEW_START_MS;
    const start = dur ? Math.max(0, Math.min(wanted, dur - PREVIEW_MS)) : wanted;
    set({ current: song, positionMs: start, error: null });
    try {
      const sp = useSpotify.getState();
      if (sp.connected && !getDevice() && useNet.getState().online && !song.id.startsWith('file:'))
        await connectBrowserPlayer((m) => set({ error: m }));
      const r = await port.play(song.uri, start);
      if (r === 'manual') { set({ current: null, error: get().error ?? 'This song can’t be previewed right now (no internet and no music file).' }); return; }
    } catch (e) {
      set({ current: null, error: e instanceof Error ? e.message : String(e) });
      return;
    }
    if (get().current?.id !== song.id) return; // replaced meanwhile
    endsAt = Date.now() + PREVIEW_MS;
    let last = Date.now();
    timer = setInterval(() => {
      const now = Date.now();
      set((s) => ({ positionMs: s.positionMs + (now - last) }));
      last = now;
      if (now >= endsAt) get().stop();
    }, 250);
  },

  async toggle(song, from) {
    if (get().current?.id === song.id) return get().stop();
    return get().play(song, from);
  },

  async seek(ms) {
    if (!get().current || !port) return;
    set({ positionMs: ms });
    endsAt = Math.max(endsAt, Date.now() + 5_000); // give a little time after moving
    await port.seek(ms).catch(() => {});
  },

  stop() {
    if (timer) clearInterval(timer);
    timer = null;
    if (get().current && port) void port.pause().catch(() => {});
    set({ current: null });
  },
}));
