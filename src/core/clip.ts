import type { ClipSettings, Song } from './types';

export const DEFAULT_CLIP: ClipSettings = {
  clipSec: 30, gapSec: 5, startMode: 'random', fixedStartSec: 30,
  randomMinSec: 30, randomMaxSec: 75, autoAdvance: true, fadeSec: 1.5, hideTitles: false, source: 'auto',
};

export function computeStartMs(song: Song, s: ClipSettings, rand: () => number): number {
  let start: number;
  if (song.startMs !== undefined) start = song.startMs;
  else if (s.startMode === 'beginning' || s.startMode === 'marker') start = 0;
  else if (s.startMode === 'fixed') start = s.fixedStartSec * 1000;
  else {
    const lo = Math.min(s.randomMinSec, s.randomMaxSec), hi = Math.max(s.randomMinSec, s.randomMaxSec);
    start = Math.round((lo + rand() * (hi - lo)) * 1000);
  }
  if (song.startMs !== undefined) return Math.max(0, Math.min(start, song.durationMs - 1000));
  return Math.max(0, Math.min(start, song.durationMs - s.clipSec * 1000));
}
