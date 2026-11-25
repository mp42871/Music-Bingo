import { NumberInput } from './NumberInput';
import type { ClipSettings } from '../../core/types';

const SOURCES: { id: ClipSettings['source']; label: string; hint: string }[] = [
  { id: 'auto', label: 'Automatic', hint: 'Spotify when online, your music files when not, otherwise you play it.' },
  { id: 'files', label: 'Prefer my files', hint: 'Use your music files whenever a song has one.' },
  { id: 'manual', label: 'Manual only', hint: 'Play each song yourself in the Spotify app; this screen tells you which.' },
];

const START_MODES: { id: ClipSettings['startMode']; label: string }[] = [
  { id: 'random', label: 'Random spot' },
  { id: 'fixed', label: 'Fixed time' },
  { id: 'beginning', label: 'Song start' },
];

export function ClipSettingsPanel({ value, onChange, compact }: { value: ClipSettings; onChange: (v: ClipSettings) => void; compact?: boolean }) {
  const set = <K extends keyof ClipSettings>(k: K, v: ClipSettings[K]) => onChange({ ...value, [k]: v });
  const num = (k: 'clipSec' | 'gapSec' | 'fixedStartSec' | 'randomMinSec' | 'randomMaxSec' | 'fadeSec', label: string, min: number, max: number, step = 1) => (
    <label className="flex flex-col gap-1">
      <span className="label flex justify-between"><span>{label}</span><span className="text-ink tabular-nums">{value[k]}</span></span>
      <div className="flex items-center gap-2">
        <input type="range" min={min} max={max} step={step} value={value[k]} aria-hidden tabIndex={-1}
          onChange={(e) => set(k, Number(e.target.value))} className="min-w-0 flex-1" />
        <NumberInput aria-label={label} min={min} max={max} step={step} value={value[k]} onChange={(n) => set(k, n)} />
      </div>
    </label>
  );
  return (
    <div className={`grid gap-4 ${compact ? '' : 'sm:grid-cols-2'}`}>
      {num('clipSec', 'Clip length (seconds)', 5, 240)}
      {num('gapSec', 'Break between songs (seconds)', 0, 60)}
      <div className="flex flex-col gap-1">
        <span className="label">Where the clip starts</span>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Where the clip starts">
          {START_MODES.map((m) => (
            <button key={m.id} type="button" className="chip" role="radio" aria-checked={value.startMode === m.id}
              aria-pressed={value.startMode === m.id} onClick={() => set('startMode', m.id)}>{m.label}</button>
          ))}
        </div>
        <span className="text-xs text-dim">A start point you mark on a song always wins.</span>
      </div>
      {value.startMode === 'fixed' && num('fixedStartSec', 'Start at (seconds in)', 0, 180)}
      {value.startMode === 'random' && (
        <div className={`grid gap-2 ${compact ? "" : "grid-cols-2"}`}>
          {num('randomMinSec', 'Earliest (s)', 0, 180)}
          {num('randomMaxSec', 'Latest (s)', 0, 240)}
        </div>
      )}
      {num('fadeSec', 'Fade in/out (seconds)', 0, 5, 0.5)}
      <div className="flex flex-col gap-1">
        <span className="label">Music source</span>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Music source">
          {SOURCES.map((m) => (
            <button key={m.id} type="button" className="chip" role="radio" aria-checked={(value.source ?? 'auto') === m.id}
              aria-pressed={(value.source ?? 'auto') === m.id} title={m.hint} onClick={() => set('source', m.id)}>{m.label}</button>
          ))}
        </div>
        <span className="text-xs text-dim">{SOURCES.find((m) => m.id === (value.source ?? 'auto'))!.hint}</span>
      </div>
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2"><input type="checkbox" checked={value.autoAdvance} onChange={(e) => set('autoAdvance', e.target.checked)} /> Play next song automatically</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={value.hideTitles} onChange={(e) => set('hideTitles', e.target.checked)} /> Hide song titles on my screen until revealed</label>
      </div>
    </div>
  );
}
