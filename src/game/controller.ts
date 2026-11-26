import { computeStartMs } from '../core/clip';
import { trimFactor } from '../audio/loudness';
import type { Call, ClipSettings, ResumePoint, Song } from '../core/types';

export interface PlaybackPort {
  /** Resolves 'manual' when the host must play this song themselves (e.g. in the Spotify app). */
  play(uri: string, positionMs: number): Promise<void | 'manual'>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seek(ms: number): Promise<void>;
  setVolume(pct: number): Promise<void>;
  /** Called synchronously inside the host's click/keypress so browsers allow audio to start. */
  prime?(): void;
}

export type Phase = 'idle' | 'loading' | 'playing' | 'manual' | 'paused' | 'gap' | 'done';

export interface ControllerState {
  phase: Phase;
  index: number;
  currentId?: string;
  clipStartMs: number;
  positionMs: number;
  clipElapsedMs: number;
  gapRemainingMs: number;
  volume: number;
  muted: boolean;
  ducked: boolean;
  pausedFrom?: 'playing' | 'gap';
}

export interface ControllerEvents {
  onState(s: ControllerState): void;
  onCall(c: Call): void;
  onError(msg: string): void;
  /** The call order changed (reorder, remove, insert, jump, skipped track) — persist it. */
  onOrder?(order: string[]): void;
}

const NOOP_EVENTS: ControllerEvents = { onState() {}, onCall() {}, onError() {} };
const MAX_SKIPS = 3;
type PlayResult = 'ok' | 'skip' | 'fatal';

export class GameController {
  private s: ControllerState = {
    phase: 'idle', index: -1, clipStartMs: 0, positionMs: 0, clipElapsedMs: 0,
    gapRemainingMs: 0, volume: 70, muted: false, ducked: false,
  };
  private called: Set<string>;
  private lastTick: number | null = null;
  private gapElapsed = 0;
  private lastSentVolume = -1;
  private busy = false;
  /** Order position of the song currently loaded (may be behind index after a replay/previous). */
  private cursor = -1;
  private detached = false;
  /** A manual song waiting for the host to confirm it was played. */
  private pendingManual: string | null = null;
  /** Resumed mid-song after leaving the console: the player has nothing loaded, so play must restart it at the saved spot. */
  private reloadOnResume = false;

  constructor(
    private port: PlaybackPort,
    private order: string[],
    private songs: Map<string, Song>,
    private settings: ClipSettings,
    private events: ControllerEvents,
    private now: () => number = Date.now,
    private rand: () => number = Math.random,
    alreadyCalled: string[] = [],
    resumeAt?: ResumePoint,
  ) {
    this.called = new Set(alreadyCalled);
    if (alreadyCalled.length) {
      // Resume an in-progress game: position after the last called song.
      this.s.index = Math.max(...alreadyCalled.map((id) => this.order.indexOf(id)));
      this.cursor = this.s.index;
      this.s.currentId = this.order[this.s.index];
      this.s.phase = 'gap';
      this.s.gapRemainingMs = 0;
      this.s.pausedFrom = 'gap';
      this.s.phase = 'paused';
      // Left mid-song: pick up that song where it was, not the next one.
      if (resumeAt && resumeAt.songId === this.s.currentId && resumeAt.clipElapsedMs < this.settings.clipSec * 1000) {
        this.s.pausedFrom = 'playing';
        this.s.positionMs = resumeAt.positionMs;
        this.s.clipElapsedMs = resumeAt.clipElapsedMs;
        this.s.clipStartMs = resumeAt.clipStartMs;
        this.reloadOnResume = true;
      }
    }
  }

  /** The spot in the current song to come back to, or null when no called song is part-way through. */
  resumePoint(): ResumePoint | null {
    const midSong = this.s.phase === 'playing' || (this.s.phase === 'paused' && this.s.pausedFrom === 'playing');
    if (!midSong || !this.s.currentId || this.cursor !== this.s.index || this.s.currentId !== this.order[this.s.index]) return null;
    return { songId: this.s.currentId, positionMs: Math.round(this.s.positionMs), clipElapsedMs: Math.round(this.s.clipElapsedMs), clipStartMs: this.s.clipStartMs };
  }

  get state(): ControllerState { return { ...this.s }; }
  get clipSettings(): ClipSettings { return { ...this.settings }; }
  upcoming(): string[] { return this.order.slice(this.s.index + 1); }
  fullOrder(): string[] { return [...this.order]; }

  private emit() { this.events.onState({ ...this.s }); }

  private targetVolume(): number {
    if (this.s.muted) return 0;
    const trim = trimFactor(this.s.currentId ? this.songs.get(this.s.currentId)?.volumeDb : undefined);
    let v = Math.min(100, this.s.volume * trim) * (this.s.ducked ? 0.25 : 1);
    const fade = this.settings.fadeSec * 1000;
    if (fade > 0 && this.s.phase === 'playing') {
      const e = this.s.clipElapsedMs, clip = this.settings.clipSec * 1000;
      if (e < fade) v *= Math.max(0.05, e / fade);
      else if (clip - e < fade) v *= Math.max(0, (clip - e) / fade);
    }
    return Math.round(v);
  }

  private pushVolume(force = false) {
    const v = this.targetVolume();
    if (force || Math.abs(v - this.lastSentVolume) >= 2 || (v === 0 && this.lastSentVolume !== 0)) {
      this.lastSentVolume = v;
      this.port.setVolume(v).catch(() => {});
    }
  }

  private holdAfterFailure() {
    this.s = { ...this.s, phase: 'paused', pausedFrom: 'gap', gapRemainingMs: 0 };
    this.emit();
  }

  private orderChanged() { this.events.onOrder?.([...this.order]); }

  /**
   * Plays order[index]. With record=true this is a new call: it moves the game forward and is
   * recorded. With record=false it's a one-off replay that never moves the game position.
   */
  private async playAt(index: number, record: boolean): Promise<PlayResult> {
    const id = this.order[index];
    const song = this.songs.get(id);
    if (!song) return 'skip';
    const prev = { ...this.s };
    this.reloadOnResume = false;
    const start = record || id !== this.s.currentId ? computeStartMs(song, this.settings, this.rand) : this.s.clipStartMs;
    this.s = { ...this.s, phase: 'loading', currentId: id, clipStartMs: start, positionMs: start, clipElapsedMs: 0, gapRemainingMs: 0, pausedFrom: undefined };
    this.emit();
    let result: void | 'manual';
    try {
      if (this.settings.fadeSec > 0) { this.lastSentVolume = -1; await this.port.setVolume(Math.round(this.targetVolume() * 0.05)).catch(() => {}); }
      result = await this.port.play(song.uri, start);
    } catch (e) {
      if (this.detached) return 'fatal';
      const msg = e instanceof Error ? e.message : String(e);
      if ((e as { fatal?: boolean })?.fatal) {
        this.events.onError(`Playback stopped: ${msg}`);
        this.s = { ...prev, phase: 'paused', pausedFrom: 'gap', gapRemainingMs: 0 };
        this.emit();
        return 'fatal';
      }
      this.events.onError(`Couldn't play "${song.displayTitle ?? song.title}"${record ? ' — skipped' : ''}. ${msg}`.trim());
      if (record) {
        this.order.splice(index, 1);
        this.orderChanged();
      } else {
        this.s = { ...prev, phase: 'paused', pausedFrom: 'gap', gapRemainingMs: 0 };
        this.emit();
      }
      return 'skip';
    }
    if (this.detached) return 'fatal';
    this.lastTick = this.now();
    this.cursor = index;
    if (result === 'manual') {
      this.manualAt = index;
      this.s.phase = 'manual';
      if (record) { this.s.index = index; this.pendingManual = this.called.has(id) ? null : id; }
      this.emit();
      return 'ok';
    }
    this.manualAt = -1;
    this.s.phase = 'playing';
    if (record) {
      this.s.index = index;
      if (!this.called.has(id)) {
        this.called.add(id);
        this.events.onCall({ songId: id, at: Date.now() });
      }
    }
    this.pushVolume(true);
    this.emit();
    return 'ok';
  }

  /** Host confirms the manual song was played: record it and wait for Next. */
  markPlayed() {
    if (this.detached || this.s.phase !== 'manual') return;
    this.recordPending();
    this.s = { ...this.s, phase: 'gap', gapRemainingMs: 0 };
    this.emit();
  }

  private recordPending() {
    const id = this.pendingManual;
    this.pendingManual = null;
    if (id && !this.called.has(id)) {
      this.called.add(id);
      this.events.onCall({ songId: id, at: Date.now() });
    }
  }

  private async advance(): Promise<void> {
    if (this.busy || this.detached) return;
    this.recordPending();
    this.busy = true;
    try {
      for (let tries = 0; tries < MAX_SKIPS; tries++) {
        const i = this.s.index + 1;
        if (i >= this.order.length) {
          this.s = { ...this.s, phase: 'done', gapRemainingMs: 0 };
          await this.port.pause().catch(() => {});
          this.emit();
          return;
        }
        const r = await this.playAt(i, true);
        if (r !== 'skip') return;
      }
      this.events.onError('Several songs in a row would not play. Check your Spotify device, then press play.');
      this.holdAfterFailure();
    } finally {
      this.busy = false;
    }
  }

  private async oneOff(index: number): Promise<void> {
    if (this.busy || this.detached) return;
    this.busy = true;
    try { await this.playAt(index, false); } finally { this.busy = false; }
  }

  /** Stops playback and disconnects this controller from the game (used when leaving the console). */
  detach() {
    if (this.detached) return;
    this.detached = true;
    this.events = NOOP_EVENTS;
    this.port.pause().catch(() => {});
  }

  start(): Promise<void> { this.port.prime?.(); return this.advance(); }
  next(): Promise<void> { this.port.prime?.(); return this.advance(); }

  async previous(): Promise<void> {
    this.port.prime?.();
    const target = (this.cursor >= 0 ? this.cursor : this.s.index) - 1;
    if (target < 0) return this.replayLast();
    return this.oneOff(target);
  }

  async replayLast(): Promise<void> {
    this.port.prime?.();
    if (this.s.index < 0 || !this.s.currentId) return;
    const at = this.order.indexOf(this.s.currentId);
    if (at < 0) return;
    return this.oneOff(at);
  }

  async jumpTo(songId: string): Promise<void> {
    this.port.prime?.();
    const at = this.order.indexOf(songId);
    if (at < 0) return;
    if (at <= this.s.index) return this.oneOff(at);
    this.order.splice(at, 1);
    this.order.splice(this.s.index + 1, 0, songId);
    this.orderChanged();
    await this.advance();
  }

  async togglePause(): Promise<void> {
    this.port.prime?.();
    if (this.s.phase === 'playing') {
      this.s.phase = 'paused';
      this.s.pausedFrom = 'playing';
      this.emit();
      await this.port.pause().catch((e) => this.events.onError(String(e?.message ?? e)));
    } else if (this.s.phase === 'gap') {
      this.s.phase = 'paused';
      this.s.pausedFrom = 'gap';
      this.emit();
    } else if (this.s.phase === 'paused') {
      if (this.s.pausedFrom === 'playing' && this.reloadOnResume) {
        return this.reloadSong();
      } else if (this.s.pausedFrom === 'playing') {
        await this.port.resume().catch((e) => this.events.onError(String(e?.message ?? e)));
        this.lastTick = this.now();
        this.s.phase = 'playing';
      } else if (this.s.index < 0 || this.s.gapRemainingMs <= 0 && this.settings.autoAdvance) {
        this.s.pausedFrom = undefined;
        this.emit();
        return this.advance();
      } else {
        this.s.phase = 'gap';
        this.lastTick = this.now();
      }
      this.s.pausedFrom = undefined;
      this.emit();
    } else if (this.s.phase === 'idle') {
      return this.start();
    }
  }

  /** Starts the current song again at the saved spot (after coming back to the console). */
  private async reloadSong(): Promise<void> {
    const id = this.s.currentId;
    const song = id ? this.songs.get(id) : undefined;
    if (!song || this.busy || this.detached) return;
    this.busy = true;
    try {
      const keep = { positionMs: this.s.positionMs, clipElapsedMs: this.s.clipElapsedMs };
      const r = await this.port.play(song.uri, keep.positionMs);
      if (this.detached) return;
      this.reloadOnResume = false;
      this.lastTick = this.now();
      this.s = { ...this.s, ...keep, phase: r === 'manual' ? 'manual' : 'playing', pausedFrom: undefined };
      this.lastSentVolume = -1;
      this.pushVolume(true);
      this.emit();
    } catch (e) {
      this.events.onError(`Couldn't restart "${song.displayTitle ?? song.title}". ${e instanceof Error ? e.message : String(e)}`.trim());
    } finally {
      this.busy = false;
    }
  }

  async seekTo(ms: number): Promise<void> {
    if (!this.s.currentId) return;
    const dur = this.songs.get(this.s.currentId)?.durationMs ?? 0;
    const pos = Math.max(0, Math.min(ms, Math.max(0, dur - 1000)));
    this.s.positionMs = pos;
    this.emit();
    await this.port.seek(pos).catch((e) => this.events.onError(String(e?.message ?? e)));
  }
  seekBy(ms: number) { return this.seekTo(this.s.positionMs + ms); }

  setVolume(pct: number) { this.s.volume = Math.max(0, Math.min(100, pct)); this.s.muted = false; this.pushVolume(); this.emit(); }
  toggleMute() { this.s.muted = !this.s.muted; this.pushVolume(true); this.emit(); }
  toggleDuck() { this.s.ducked = !this.s.ducked; this.pushVolume(true); this.emit(); }

  reorder(ids: string[]) {
    const head = this.order.slice(0, this.s.index + 1);
    this.order = [...head, ...ids.filter((id) => !head.includes(id))];
    this.orderChanged();
    this.emit();
  }
  remove(id: string) {
    const i = this.order.indexOf(id);
    if (i > this.s.index) { this.order.splice(i, 1); this.orderChanged(); }
    this.emit();
  }
  insert(id: string, at = 0) {
    if (this.order.indexOf(id) >= 0 && this.order.indexOf(id) <= this.s.index) return;
    this.order = this.order.filter((x) => x !== id);
    this.order.splice(this.s.index + 1 + Math.max(0, at), 0, id);
    this.orderChanged();
    this.emit();
  }

  updateSettings(p: Partial<ClipSettings>) {
    const old = this.settings;
    this.settings = { ...this.settings, ...p };
    const gapChanged = p.gapSec !== undefined && p.gapSec !== old.gapSec;
    const autoChanged = p.autoAdvance !== undefined && p.autoAdvance !== old.autoAdvance;
    if (this.s.phase === 'gap' && (gapChanged || autoChanged)) {
      if (!this.settings.autoAdvance) this.s.gapRemainingMs = 0;
      else if (autoChanged) { this.gapElapsed = 0; this.s.gapRemainingMs = this.settings.gapSec * 1000; }
      else this.s.gapRemainingMs = Math.max(0, this.settings.gapSec * 1000 - this.gapElapsed);
    }
    this.emit();
  }

  private manualAt = -1;
  private cursorIsManual() { return this.manualAt === this.cursor; }

  tick(): void {
    const t = this.now();
    const dt = Math.max(0, t - (this.lastTick ?? t));
    this.lastTick = t;
    if (this.busy || this.detached) return;
    if (this.s.phase === 'playing') {
      this.s.clipElapsedMs += dt;
      this.s.positionMs += dt;
      if (this.s.clipElapsedMs >= this.settings.clipSec * 1000) {
        this.s.phase = 'gap';
        this.gapElapsed = 0;
        this.s.gapRemainingMs = this.settings.autoAdvance ? this.settings.gapSec * 1000 : 0;
        // Finish the fade at silence, then pause — no abrupt cut.
        const silence = this.settings.fadeSec > 0 ? this.port.setVolume(0).catch(() => {}) : Promise.resolve();
        this.lastSentVolume = 0;
        void silence.then(() => this.port.pause().catch(() => {}));
        this.emit();
        if (this.settings.autoAdvance && this.s.gapRemainingMs <= 0) void this.advance();
        return;
      }
      this.pushVolume();
      this.emit();
    } else if (this.s.phase === 'manual') {
      this.s.clipElapsedMs += dt;
      this.s.positionMs += dt;
      this.emit();
    } else if (this.s.phase === 'gap') {
      this.gapElapsed += dt;
      if (!this.settings.autoAdvance || this.cursorIsManual()) return;
      this.s.gapRemainingMs = Math.max(0, this.s.gapRemainingMs - dt);
      this.emit();
      if (this.s.gapRemainingMs <= 0) void this.advance();
    }
  }
}
