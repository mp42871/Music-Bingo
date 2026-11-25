import type { FilePlayer } from '../game/hybridPort';

/** Plays music files from this computer through an <audio> element, with Web Audio gain for smooth volume. */
export function createFilePlayer(): FilePlayer {
  const el = new Audio();
  el.preload = 'auto';
  let url: string | null = null;
  let ctx: AudioContext | null = null;
  let gain: GainNode | null = null;
  let volume = 0.7;

  const ensureGraph = () => {
    if (ctx) return;
    try {
      ctx = new AudioContext();
      gain = ctx.createGain();
      gain.gain.value = volume;
      ctx.createMediaElementSource(el).connect(gain).connect(ctx.destination);
    } catch {
      ctx = null; gain = null; // fall back to element volume
    }
  };

  /** resume() never settles while the browser blocks audio; don't wait on it forever. */
  const wake = () => Promise.race([ctx?.resume().catch(() => {}), new Promise((r) => setTimeout(r, 300))]);

  const ready = () => new Promise<void>((resolve, reject) => {
    if (el.readyState >= 2) return resolve();
    const ok = () => { cleanup(); resolve(); };
    const bad = () => { cleanup(); reject(new Error('This file could not be played.')); };
    const timer = setTimeout(bad, 10000);
    const cleanup = () => { clearTimeout(timer); el.removeEventListener('canplay', ok); el.removeEventListener('error', bad); };
    el.addEventListener('canplay', ok);
    el.addEventListener('error', bad);
  });

  return {
    async load(blob, positionMs) {
      ensureGraph();
      await wake();
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(blob);
      el.src = url;
      el.load();
      await ready();
      el.currentTime = Math.max(0, Math.min(positionMs / 1000, (el.duration || 0) - 1));
      await el.play();
    },
    async pause() { el.pause(); },
    async resume() { await wake(); await el.play(); },
    async seek(ms) { el.currentTime = Math.max(0, ms / 1000); },
    async setVolume(pct) {
      volume = Math.max(0, Math.min(1, pct / 100));
      if (gain && ctx) gain.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
      else el.volume = volume;
    },
    stop() { el.pause(); },
  };
}
