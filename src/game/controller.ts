import { computeStartMs } from '../core/clip';
import type { Call, ClipSettings, Song } from '../core/types';

export interface PlaybackPort {
  play(uri: string, positionMs: number): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seek(ms: number): Promise<void>;
  setVolume(pct: number): Promise<void>;
}

export type Phase = 'idle' | 'loading' | 'playing' | 'paused' | 'gap' | 'done';

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
}

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

  constructor(
    private port: PlaybackPort,
    private order: string[],
    private songs: Map<string, Song>,
    private settings: ClipSettings,
    private events: ControllerEvents,
    private now: () => number = Date.now,
    private rand: () => number = Math.random,
    alreadyCalled: string[] = [],
  ) {
    this.called = new Set(alreadyCalled);
    if (alreadyCalled.length) {
      // Resume an in-progress game: position after the last called song.
      this.s.index = Math.max(...alreadyCalled.map((id) => this.order.indexOf(id)));
      this.s.currentId = this.order[this.s.index];
      this.s.phase = 'gap';
      this.s.gapRemainingMs = 0;
      this.s.pausedFrom = 'gap';
      this.s.phase = 'paused';
    }
  }

  get state(): ControllerState { return { ...this.s }; }
  get clipSettings(): ClipSettings { return { ...this.settings }; }
  upcoming(): string[] { return this.order.slice(this.s.index + 1); }
  fullOrder(): string[] { return [...this.order]; }

  private emit() { this.events.onState({ ...this.s }); }

  private targetVolume(): number {
    if (this.s.muted) return 0;
    let v = this.s.volume * (this.s.ducked ? 0.25 : 1);
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

  private async playAt(index: number, record: boolean): Promise<boolean> {
    const id = this.order[index];
    const song = this.songs.get(id);
    if (!song) return false;
    const start = computeStartMs(song, this.settings, this.rand);
    this.s = { ...this.s, phase: 'loading', index, currentId: id, clipStartMs: start, positionMs: start, clipElapsedMs: 0, gapRemainingMs: 0, pausedFrom: undefined };
    this.emit();
    try {
      if (this.settings.fadeSec > 0) { this.lastSentVolume = -1; await this.port.setVolume(Math.round(this.targetVolume() * 0.05)).catch(() => {}); }
      await this.port.play(song.uri, start);
    } catch (e) {
      this.events.onError(`Couldn't play "${song.displayTitle ?? song.title}" — skipped. ${e instanceof Error ? e.message : ''}`.trim());
      this.order.splice(index, 1);
      this.s.index = index - 1;
      return false;
    }
    this.lastTick = this.now();
    this.s.phase = 'playing';
    if (record && !this.called.has(id)) {
      this.called.add(id);
      this.events.onCall({ songId: id, at: Date.now() });
    }
    this.pushVolume(true);
    this.emit();
    return true;
  }

  private async advance(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      let tries = 0;
      while (tries++ < 10) {
        const i = this.s.index + 1;
        if (i >= this.order.length) {
          this.s = { ...this.s, phase: 'done', gapRemainingMs: 0 };
          await this.port.pause().catch(() => {});
          this.emit();
          return;
        }
        if (await this.playAt(i, true)) return;
      }
    } finally {
      this.busy = false;
    }
  }

  start(): Promise<void> { return this.advance(); }
  next(): Promise<void> { return this.advance(); }

  async previous(): Promise<void> {
    if (this.busy || this.s.index <= 0) return this.replayLast();
    this.busy = true;
    try { await this.playAt(this.s.index - 1, false); } finally { this.busy = false; }
  }

  async replayLast(): Promise<void> {
    if (this.busy || this.s.index < 0 || !this.s.currentId) return;
    this.busy = true;
    try {
      const song = this.songs.get(this.s.currentId)!;
      const start = this.s.clipStartMs;
      this.s = { ...this.s, phase: 'loading', positionMs: start, clipElapsedMs: 0, gapRemainingMs: 0, pausedFrom: undefined };
      this.emit();
      try {
        await this.port.play(song.uri, start);
      } catch (e) {
        this.events.onError(`Couldn't replay: ${e instanceof Error ? e.message : ''}`);
        this.s.phase = 'gap';
        this.emit();
        return;
      }
      this.lastTick = this.now();
      this.s.phase = 'playing';
      this.pushVolume(true);
      this.emit();
    } finally {
      this.busy = false;
    }
  }

  async jumpTo(songId: string): Promise<void> {
    const at = this.order.indexOf(songId);
    if (at < 0) return;
    if (at <= this.s.index) {
      if (this.busy) return;
      this.busy = true;
      try { await this.playAt(at, false); } finally { this.busy = false; }
      return;
    }
    this.order.splice(at, 1);
    this.order.splice(this.s.index + 1, 0, songId);
    await this.advance();
  }

  async togglePause(): Promise<void> {
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
      if (this.s.pausedFrom === 'playing') {
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
    this.emit();
  }
  remove(id: string) {
    const i = this.order.indexOf(id);
    if (i > this.s.index) this.order.splice(i, 1);
    this.emit();
  }
  insert(id: string, at = 0) {
    if (this.order.indexOf(id) >= 0 && this.order.indexOf(id) <= this.s.index) return;
    this.order = this.order.filter((x) => x !== id);
    this.order.splice(this.s.index + 1 + Math.max(0, at), 0, id);
    this.emit();
  }

  updateSettings(p: Partial<ClipSettings>) {
    const oldGap = this.settings.gapSec;
    this.settings = { ...this.settings, ...p };
    if (this.s.phase === 'gap' && p.gapSec !== undefined && p.gapSec !== oldGap)
      this.s.gapRemainingMs = this.settings.autoAdvance ? Math.max(0, p.gapSec * 1000 - this.gapElapsed) : 0;
    this.emit();
  }

  tick(): void {
    const t = this.now();
    const dt = Math.max(0, t - (this.lastTick ?? t));
    this.lastTick = t;
    if (this.busy) return;
    if (this.s.phase === 'playing') {
      this.s.clipElapsedMs += dt;
      this.s.positionMs += dt;
      if (this.s.clipElapsedMs >= this.settings.clipSec * 1000) {
        this.s.phase = 'gap';
        this.gapElapsed = 0;
        this.s.gapRemainingMs = this.settings.autoAdvance ? this.settings.gapSec * 1000 : 0;
        this.port.pause().catch(() => {});
        this.emit();
        if (this.settings.autoAdvance && this.s.gapRemainingMs <= 0) void this.advance();
        return;
      }
      this.pushVolume();
      this.emit();
    } else if (this.s.phase === 'gap') {
      this.gapElapsed += dt;
      if (!this.settings.autoAdvance) return;
      this.s.gapRemainingMs = Math.max(0, this.s.gapRemainingMs - dt);
      this.emit();
      if (this.s.gapRemainingMs <= 0) void this.advance();
    }
  }
}
