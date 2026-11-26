import { create } from 'zustand';
import { useSpotify } from '../app/spotifyStore';
import { cleanTitle } from '../core/io';
import { masksFor, patternName } from '../core/patterns';
import { phoneUrl } from '../core/phone';
import { setPhoneDef } from './phoneLink';
import { createSpotifyPort } from './spotifyPort';
import { DEFAULT_STYLE } from '../core/style';
import type { CardSet, ClipSettings, Game, Song } from '../core/types';
import { getCardSet, getGame, saveGame } from '../db/repo';
import { liveSongsFor } from './liveSongs';
import { withLatestFiles } from '../core/offline';
import { getAccessToken } from '../spotify/auth';
import { liveBackend, encodeProject, siteProject } from '../live/config';
import type { LiveClaim } from '../live/types';
import { liveDef } from './phoneLink';
import { checkClaim, missingCount } from '../core/claim';
import { getSetting } from '../db/repo';
import { loadPlayer } from '../spotify/sdk';
import { openChannel, type AudienceMessage } from './broadcast';
import { createHybridPort } from './hybridPort';
import { createFilePlayer } from '../audio/filePlayer';
import { getAudioBlob, getAudioGain } from '../db/audio';
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
  // Make the browser the active Spotify device now, so the first song doesn't start on a cold device.
  await useSpotify.getState().api.transfer(deviceId).catch(() => {});
  return deviceId;
}

export function setDevice(id: string) { currentDeviceId = id; }
export function getDevice() { return currentDeviceId; }
export function browserDeviceId() { return sdkDeviceId; }

export const spotifyPort = (): PlaybackPort => createSpotifyPort({
  api: () => useSpotify.getState().api,
  device: () => currentDeviceId,
  browserPlayer: () => (sdkPlayer && currentDeviceId && currentDeviceId === sdkDeviceId ? sdkPlayer : null),
  wait: (ms) => new Promise((r) => setTimeout(r, ms)),
});

let filePlayer: ReturnType<typeof createFilePlayer> | null = null;

/** Default port: per song, Spotify / music file / manual depending on the game's music source and the connection. */
export const hybridPort = (): PlaybackPort => createHybridPort({
  spotify: spotifyPort(),
  file: (filePlayer ??= createFilePlayer()),
  getSong: (uri) => [...useGame.getState().songs.values()].find((s) => s.uri === uri),
  getBlob: getAudioBlob,
  getFileGain: getAudioGain,
  policy: () => useGame.getState().game?.settings.source ?? 'auto',
  clipMs: () => (useGame.getState().game?.settings.clipSec ?? 30) * 1000,
  online: () => useNet.getState().online,
  spotifyReady: () => useSpotify.getState().connected && !!getDevice(),
  onSource: (source) => useGame.setState({ source }),
  onNotice: (m) => useGame.setState((s) => ({ errors: [...s.errors.slice(-3), m] })),
  onNetworkFailure: reportNetworkFailure,
});

export interface LiveClaimView extends LiveClaim { valid: boolean; atCall: number | null; missing: number | null }
export interface LiveState { code: string | null; players: number; /** card numbers held on phones */ phoneCards: number[]; claims: LiveClaimView[]; error: string | null; joinUrl: string | null; site: string; typed: boolean }
const NO_LIVE: LiveState = { code: null, players: 0, phoneCards: [], claims: [], error: null, joinUrl: null, site: '', typed: false };
let unwatch: (() => void) | null = null;

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
  live: LiveState;
  goLive(): Promise<void>;
  stopLive(): Promise<void>;
  dismissClaim(id: string): void;
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
  markOrderSaved(): Promise<void>;
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
  game: null, cardSet: null, songs: new Map(), ctrl: null, cs: null, revealed: false, showQr: false, errors: [], source: null, live: NO_LIVE,
  makePort: hybridPort,

  async load(id) {
    get().ctrl?.detach();
    set({ source: null });
    const stored = await getGame(id);
    if (!stored) return false;
    const cardSet = (await getCardSet(stored.cardSetId)) ?? null;
    // Pick up music files linked in the playlist(s) since the cards were made.
    const live = await liveSongsFor(cardSet ?? { poolId: stored.pool.id });
    const game = { ...stored, pool: { ...stored.pool, songs: withLatestFiles(stored.pool.songs, live) } };
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
    if (!channel) {
      channel = openChannel();
      // A players' screen opened later asks for the current state.
      if (channel) channel.onmessage = (e) => { if (e.data?.type === 'hello') broadcast(); };
    }
    unwatch?.(); unwatch = null;
    // Show how to join from the start, so players can connect before the first song.
    set({ game, cardSet, songs, ctrl, cs: ctrl.state, errors: [], revealed: false, source: null, live: NO_LIVE, showQr: true });
    broadcast();
    if (game.status !== 'finished') void get().goLive();
    return true;
  },
  unload() {
    unwatch?.(); unwatch = null;
    get().ctrl?.detach();
    set({ game: null, cardSet: null, ctrl: null, cs: null, source: null, live: NO_LIVE });
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
    await get().stopLive();
  },
  async goLive() {
    const { game, cardSet } = get();
    if (!game || !cardSet) return;
    const backend = await liveBackend();
    if (!backend) return;
    set((st) => ({ live: { ...st.live, error: null } }));
    try {
      const code = await backend.publish(game.name, liveDef(cardSet), game.liveCode);
      if (get().game?.id !== game.id) return;
      if (game.liveCode !== code) { const next = { ...get().game!, liveCode: code }; set({ game: next }); await saveGame(next); }
      const [url, key] = await Promise.all([getSetting('supabaseUrl', ''), getSetting('supabaseKey', '')]);
      const base = window.location.href.split('#')[0].split('?')[0];
      const joinUrl = `${base}#/join/${code}${url && key ? `?p=${encodeProject(url, key)}` : ''}`;
      const site = `${window.location.host}${window.location.pathname}`.replace(/\/$/, '');
      const sp = await siteProject();
      set({ live: { ...NO_LIVE, code, joinUrl, site, typed: !!sp && sp.url === url } });
      unwatch?.();
      unwatch = backend.watch(code, {
        players: (cards) => set((st) => ({ live: { ...st.live, players: cards.length, phoneCards: [...new Set(cards)].sort((a, b) => a - b) } })),
        claim: (c) => {
          const st = get();
          if (!st.game || !st.cardSet) return;
          const r = checkClaim(st.cardSet, st.game, c.cardNumber);
          const view: LiveClaimView = {
            ...c, valid: !!r?.result.valid, atCall: r?.result.firstValidAtCall ?? null,
            missing: r ? missingCount(r.result.marked, r.masks) : null,
          };
          set((s2) => ({ live: { ...s2.live, claims: [...s2.live.claims.filter((x) => x.id !== c.id), view] } }));
          broadcast();
        },
      });
      broadcast();
    } catch (e) {
      set((st) => ({ live: { ...st.live, error: e instanceof Error ? e.message : String(e) } }));
    }
  },
  async stopLive() {
    const code = get().live.code ?? get().game?.liveCode;
    unwatch?.(); unwatch = null;
    set({ live: NO_LIVE });
    broadcast();
    if (!code) return;
    const backend = await liveBackend();
    await backend?.close(code).catch(() => {});
  },
  dismissClaim(id) { set((st) => ({ live: { ...st.live, claims: st.live.claims.filter((c) => c.id !== id) } })); },
  async markOrderSaved() {
    const g = get().game;
    if (!g) return;
    const next = { ...g, orderSavedAt: Date.now() };
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
    phoneUrl: showQr && cardSet ? phoneUrl(setPhoneDef(cardSet)) : undefined,
    showQr, winners: r?.winners.length ?? 0,
    live: useGame.getState().live.code ? { code: useGame.getState().live.code!, joinUrl: useGame.getState().live.joinUrl!, site: useGame.getState().live.typed ? useGame.getState().live.site : '' } : undefined,
  };
  try { channel.postMessage(msg); } catch { /* window closed */ }
}

export function rebroadcast() { broadcast(); }
