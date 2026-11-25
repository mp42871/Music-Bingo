import type { ControllerState } from '../../game/controller';
import type { Song } from '../../core/types';
import { formatTime } from '../../core/io';
import { songLabel } from '../../game/store';

export function Deck({ cs, song, callNumber, total, hidden, onReveal, onSeek, clipMs, onPlayed, source }: {
  cs: ControllerState; song?: Song; callNumber: number; total: number; hidden: boolean;
  onReveal: () => void; onSeek: (ms: number) => void; clipMs: number; onPlayed: () => void; source?: string | null;
}) {
  const manual = cs.phase === 'manual';
  const spinning = cs.phase === 'playing';
  const clipPct = Math.min(100, (cs.clipElapsedMs / Math.max(1, clipMs)) * 100);
  const status = {
    idle: 'Ready', loading: 'Cueing…', playing: 'On air', manual: 'Play it yourself', paused: 'Paused', gap: cs.gapRemainingMs > 0 ? `Next in ${Math.ceil(cs.gapRemainingMs / 1000)}` : 'Waiting for you', done: 'All songs played',
  }[cs.phase];
  return (
    <div className="panel relative overflow-hidden p-5">
      <div className="pointer-events-none absolute -right-24 -top-24 hidden size-72 rounded-full bg-deck-b/10 blur-3xl sm:block" />
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
        <div className="relative size-48 shrink-0 sm:size-56">
          <div className={`vinyl absolute inset-0 rounded-full ${spinning ? 'vinyl-spin' : ''}`}
            style={{ background: 'repeating-radial-gradient(circle, #0b0716 0 2px, #17112e 2px 4px)' }}>
            <div className="absolute inset-[31%] overflow-hidden rounded-full border-4 border-night bg-deck-b">
              {song?.artUrl && !hidden && <img src={song.artUrl} alt="" className="size-full object-cover" />}
              {(hidden || !song?.artUrl) && <div className="grid size-full place-items-center font-display text-2xl text-night">{callNumber || '♪'}</div>}
            </div>
            <div className="absolute inset-[48.5%] rounded-full bg-night" />
          </div>
          <div className={`absolute -right-2 top-2 h-28 w-2 origin-top rounded-full bg-dim transition-transform duration-500 ${spinning ? 'rotate-[24deg]' : 'rotate-[4deg]'}`} />
        </div>
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <span className={`chip ${cs.phase === 'playing' ? 'border-deck-b text-deck-b' : ''}`} role="status">
              {cs.phase === 'playing' && <span className="size-2 animate-pulse rounded-full bg-deck-b" />}{status}
            </span>
            <span className="text-sm text-dim tabular-nums">Song {callNumber} of {total}</span>
            {source && <span className="chip text-xs" title="Where this song is playing from">{source === 'spotify' ? 'Spotify' : source === 'file' ? 'Music file' : 'Manual'}</span>}
          </div>
          {manual && song ? (
            <div className="mt-3 rounded-2xl border-2 border-peak bg-peak/10 p-4">
              <div className="text-sm font-semibold text-peak">{song.id.startsWith('file:') ? 'This song’s music file is missing — play it from another source' : 'Play now in Spotify'}</div>
              <div className="font-display text-3xl leading-tight">{songLabel(song)}</div>
              <div className="text-lg text-dim">{song.artist}</div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button type="button" className="btn btn-b" onClick={onPlayed}>Played</button>
                <span className="text-sm text-dim tabular-nums">{Math.max(0, Math.ceil((clipMs - cs.clipElapsedMs) / 1000))}s left in the clip — fade it out then press Played (Space)</span>
              </div>
            </div>
          ) : song ? (
            hidden ? (
              <div className="mt-3">
                <div className="font-display text-3xl text-dim">Mystery song #{callNumber}</div>
                <button type="button" className="btn mt-2" onClick={onReveal}>Reveal title</button>
              </div>
            ) : (
              <div className="mt-3">
                <div className="font-display text-3xl leading-tight md:text-4xl">{songLabel(song)}</div>
                <div className="mt-1 text-lg text-dim">{song.artist}{song.year ? ` · ${song.year}` : ''}</div>
                {song.categories.length > 0 && <div className="mt-2 flex flex-wrap justify-center gap-1 sm:justify-start">{song.categories.map((c) => <span key={c} className="chip">{c}</span>)}</div>}
              </div>
            )
          ) : <div className="mt-3 font-display text-3xl text-dim">Press play to start</div>}
          <div className="mt-5 grid gap-2">
            <div className="h-2 overflow-hidden rounded-full bg-rail" aria-label="Clip progress">
              <div className="h-full rounded-full bg-gradient-to-r from-deck-a to-deck-b" style={{ width: `${clipPct}%` }} />
            </div>
            {song && (
              <div className="flex items-center gap-2 text-xs text-dim tabular-nums">
                <span>{formatTime(cs.positionMs)}</span>
                <input type="range" aria-label="Song position" min={0} max={Math.max(1000, song.durationMs)} step={1000} value={Math.min(cs.positionMs, song.durationMs)}
                  onChange={(e) => onSeek(Number(e.target.value))} className="flex-1" />
                <span>{formatTime(song.durationMs)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
