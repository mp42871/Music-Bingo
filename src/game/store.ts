import { create } from 'zustand';
import { useSpotify } from '../app/spotifyStore';
import { cleanTitle } from '../core/io';
import { masksFor, patternName } from '../core/patterns';
import { phoneUrl, poolToPhoneDef } from '../core/phone';
import { DEFAULT_STYLE } from '../core/style';
import type { CardSet, ClipSettings, Game, Song } from '../core/types';
import { getCardSet, getGame, saveGame } from '../db/repo';
import { getAccessToken } from '../spotify/auth';
import type { SpotifyError } from '../spotify/api';
import { loadPlayer } from '../spotify/sdk';
import { openChannel, type AudienceMessage } from './broadcast';
import { createHybridPort } from './hybridPort';
import { createFilePlayer } from '../audio/filePlayer';
import { getAudioBlob } from '../db/audio';
import { reportNetworkFailure, useNet } from '../app/online';
import type { Source } from '../core/offline';
import { GameController, type ControllerState, type PlaybackPort } from './controller';

export type PortFactory = () => Promise<{ port: PlaybackPort; deviceName: string }>;

/** Playback goes through the Spotify Web API to the selected device (the in-browser SDK player or any Connect device). */
let currentDeviceId: string | null = null;
let sdkPlayer: Spotify.Player | null = null;
let sdkDeviceId: string | null = null;

export async function connectBrowserPlayer(onError: (m: string) => void): Promise<string> {
  if (sdkPlayer && sdkDeviceId) { currentDeviceId = sdkDeviceId; return sdkDeviceId; }
  const { clientId } = useSpotify.getState();
  const { deviceId, player } = await loadPlayer(() => getAccessToken(clientId), 'Music Bingo DJ', onError);
  sdkPlayer = player;
  sdkDeviceId = deviceId;
  currentDeviceId = deviceId;
  return deviceId;
}

export function setDevice(id: string) { currentDeviceId = id; }
export function getDevice() { return currentDeviceId; }
export function browserDeviceId() { return sdkDeviceId; }

export const spotifyPort = (): PlaybackPort => {
  const api = () => useSpotify.getState().api;
  const dev = () => {
    if (!currentDeviceId) throw new Error('No Spotify device selected. Pick a device in the console.');
    return currentDeviceId;
  };
  return {
    play: async (uri, pos) => {
      try {
        // Unlock audio on browsers that need a user gesture before the SDK can play.
        if (sdkPlayer && currentDeviceId === sdkDeviceId) await sdkPlayer.activateElement().catch(() => {});
        await api().play(dev(), uri, pos);
      } catch (e) {
        // Device/auth problems affect every song: stop instead of skipping through the list.
        const status = (e as SpotifyError).status;
        const msg = e instanceof Error ? e.message : String(e);
        if (status === 401 || status === 403 || status === 429 || (status === 404 && /device|player/i.test(msg)) || /No Spotify device|Connect Spotify/i.test(msg))
          throw Object.assign(e instanceof Error ? e : new Error(msg), { fatal: true });
        throw e;
      }
    },
    pause: async () => { await api().pause(dev()); },
    resume: async () => { await api().resume(dev()); },
    seek: async (ms) => { await api().seek(dev(), ms); },
    setVolume: async (v) => {
      if (sdkPlayer && currentDeviceId === sdkDeviceId) await sdkPlayer.setVolume(Math.max(0, Math.min(1, v / 100)));
      else await api().volume(dev(), v);
    },
  };
};

let filePlayer: ReturnType<typeof createFilePlayer> | null = null;

/** Default port: per song, Spotify / music file / manual depending on the game's music source and the connection. */
export const hybridPort = (): PlaybackPort => createHybridPort({
  spotify: spotifyPort(),
  file: (filePlayer ??= createFilePlayer()),
  getSong: (uri) => [...useGame.getState().songs.values()].find((s) => s.uri === uri),
  getBlob: getAudioBlob,
  policy: () => useGame.getState().game?.settings.source ?? 'auto',
  online: () => useNet.getState().online,
  spotifyReady: () => useSpotify.getState().connected && !!getDevice(),
  onSource: (source) => useGame.setState({ source }),
  onNotice: (m) => useGame.setState((s) => ({ errors: [...s.errors.slice(-3), m] })),
  onNetworkFailure: reportNetworkFailure,
});

interface GameStore {
  game: Game | null;
  cardSet: CardSet | null;
  songs: Map<string, Song>;
  ctrl: GameController | null;
  cs: ControllerState | null;
  revealed: boolean;
  showQr: boolean;
  errors: string[];
  source: Source | null;
  makePort: () => PlaybackPort;
  load(id: string): Promise<boolean>;
  unload(): void;
  dismissError(i: number): void;
  setReveal(v: boolean): void;
  setShowQr(v: boolean): void;
  updateSettings(p: Partial<ClipSettings>): void;
  endRound(winners: { cardNumber: number; name?: string; prize?: string }[]): Promise<void>;
  startRound(patternId: string, customMask?: number[]): Promise<void>;
  recordWinner(w: { cardNumber: number; name?: string; prize?: string; atCall: number }): Promise<void>;
  finish(): Promise<void>;
  persist(): Promise<void>;
}

let channel: BroadcastChannel | null = null;

export function currentRound(g: Game) {
  return g.rounds.length ? g.rounds[g.rounds.length - 1] : null;
}

export function songLabel(s: Song | undefined) {
  return s ? (s.displayTitle ?? cleanTitle(s.title)) : '';
}

export const useGame = create<GameStore>((set, get) => ({
  game: null, cardSet: null, songs: new Map(), ctrl: null, cs: null, revealed: false, showQr: false, errors: [], source: null,
  makePort: hybridPort,

  async load(id) {
    get().ctrl?.detach();
    const game = await getGame(id);
    if (!game) return false;
    const cardSet = (await getCardSet(game.cardSetId)) ?? null;
    const songs = new Map(game.pool.songs.map((s) => [s.id, s]));
    set({ songs });
    const ctrl = new GameController(get().makePort(), [...game.callOrder], songs, game.settings, {
      onState: (cs) => { set({ cs }); broadcast(); },
      onCall: (c) => {
        const g = get().game;
        if (!g) return;
        const next = { ...g, status: 'live' as const, calls: [...g.calls, c], callOrder: get().ctrl?.fullOrder() ?? g.callOrder };
        set({ game: next, revealed: false });
        void saveGame(next);
      },
      onError: (m) => set((s) => ({ errors: [...s.errors.slice(-3), m] })),
      onOrder: (order) => {
        const g = get().game;
        if (!g) return;
        const next = { ...g, callOrder: order };
        set({ game: next });
        void saveGame(next);
      },
    }, Date.now, Math.random, game.calls.map((c) => c.songId));
    channel ??= openChannel();
    set({ game, cardSet, songs, ctrl, cs: ctrl.state, errors: [], revealed: false });
    return true;
  },
  unload() {
    get().ctrl?.detach();
    set({ game: null, cardSet: null, ctrl: null, cs: null });
  },
  dismissError(i) { set((s) => ({ errors: s.errors.filter((_, j) => j !== i) })); },
  setReveal(v) { set({ revealed: v }); broadcast(); },
  setShowQr(v) { set({ showQr: v }); broadcast(); },
  updateSettings(p) {
    const { ctrl, game } = get();
    ctrl?.updateSettings(p);
    if (game) { const next = { ...game, settings: { ...game.settings, ...p } }; set({ game: next }); void saveGame(next); }
  },
  async recordWinner(w) {
    const g = get().game;
    if (!g || !g.rounds.length) return;
    const rounds = g.rounds.map((r, i) => (i === g.rounds.length - 1 ? { ...r, winners: [...r.winners.filter((x) => x.cardNumber !== w.cardNumber), w] } : r));
    const next = { ...g, rounds };
    set({ game: next });
    await saveGame(next);
  },
  async endRound() {
    const g = get().game;
    if (!g) return;
    const rounds = g.rounds.map((r, i) => (i === g.rounds.length - 1 ? { ...r, endCall: g.calls.length } : r));
    const next = { ...g, rounds };
    set({ game: next });
    await saveGame(next);
    broadcast();
  },
  async startRound(patternId, customMask) {
    const g = get().game;
    if (!g) return;
    const next = { ...g, rounds: [...g.rounds, { patternId, customMask, winners: [], startCall: g.calls.length }] };
    set({ game: next });
    await saveGame(next);
    broadcast();
  },
  async finish() {
    const g = get().game;
    if (!g) return;
    const rounds = g.rounds.map((r, i) => (i === g.rounds.length - 1 && r.endCall === undefined ? { ...r, endCall: g.calls.length } : r));
    const next = { ...g, rounds, status: 'finished' as const, callOrder: get().ctrl?.fullOrder() ?? g.callOrder };
    set({ game: next });
    await saveGame(next);
  },
  async persist() {
    const { game, ctrl } = get();
    if (game && ctrl) await saveGame({ ...game, callOrder: ctrl.fullOrder() });
  },
}));

export function roundMasks(g: Game, size: 3 | 4 | 5) {
  const r = currentRound(g);
  return r ? masksFor(r.patternId, size, r.customMask) : masksFor('line', size);
}

function broadcast() {
  const { game, cs, songs, revealed, showQr, cardSet } = useGame.getState();
  if (!channel || !game || !cs) return;
  const r = currentRound(game);
  const cur = cs.currentId ? songs.get(cs.currentId) : undefined;
  const style = { ...DEFAULT_STYLE, ...cardSet?.style };
  const msg: AudienceMessage = {
    type: 'state', title: style.title || game.name, callNumber: game.calls.length, total: game.callOrder.length,
    phase: cs.phase, gapRemainingMs: cs.gapRemainingMs, clipElapsedMs: cs.clipElapsedMs, clipMs: game.settings.clipSec * 1000,
    pattern: r ? patternName(r.patternId) : '', round: game.rounds.length,
    revealed: revealed && cur ? { title: songLabel(cur), artist: cur.artist, art: cur.artUrl } : null,
    recent: [],
    phoneUrl: showQr && cardSet ? phoneUrl(poolToPhoneDef({ ...game.pool, songs: cardSet.songs ?? game.pool.songs }, cardSet.seed, cardSet.layout, style.title || game.name)) : undefined,
    showQr, winners: r?.winners.length ?? 0,
  };
  try { channel.postMessage(msg); } catch { /* window closed */ }
}

export function rebroadcast() { broadcast(); }
