import { useState } from 'react';
import type { Call, Song } from '../../core/types';
import { songLabel } from '../../game/store';

export function Queue({ upcoming, removed, calls, songs, onReorder, onPlayNow, onRemove, onRestore, onReplayCalled }: {
  upcoming: string[]; removed: string[]; calls: Call[]; songs: Map<string, Song>;
  onReorder(ids: string[]): void; onPlayNow(id: string): void; onRemove(id: string): void; onRestore(id: string): void; onReplayCalled(id: string): void;
}) {
  const [tab, setTab] = useState<'next' | 'played' | 'removed'>('next');
  const [drag, setDrag] = useState<string | null>(null);
  const move = (id: string, to: number) => {
    const ids = upcoming.filter((x) => x !== id);
    ids.splice(to, 0, id);
    onReorder(ids);
  };
  const row = 'flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-booth-2';
  return (
    <div className="panel flex min-h-0 flex-col p-4">
      <div role="tablist" className="mb-3 flex gap-1">
        {([['next', `Up next (${upcoming.length})`], ['played', `Played (${calls.length})`], ['removed', `Removed (${removed.length})`]] as const).map(([id, l]) => (
          <button key={id} role="tab" type="button" className="chip" aria-selected={tab === id} aria-pressed={tab === id} onClick={() => setTab(id)}>{l}</button>
        ))}
      </div>
      <ol className="flex max-h-[50vh] flex-col gap-0.5 overflow-auto pr-1 text-sm">
        {tab === 'next' && upcoming.slice(0, 80).map((id, i) => {
          const s = songs.get(id);
          return (
            <li key={id} draggable onDragStart={() => setDrag(id)} onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (drag && drag !== id) move(drag, i); setDrag(null); }}
              className={`${row} cursor-grab ${drag === id ? 'opacity-40' : ''}`}>
              <span className="w-6 text-right text-dim tabular-nums">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate"><span className="font-semibold">{songLabel(s)}</span> <span className="text-dim">· {s?.artist}</span></span>
              <button type="button" className="rounded px-1.5 text-dim hover:text-ink" aria-label={`Move ${songLabel(s)} up`} disabled={i === 0} onClick={() => move(id, i - 1)}>↑</button>
              <button type="button" className="rounded px-1.5 text-dim hover:text-deck-a" aria-label={`Play ${songLabel(s)} now`} onClick={() => onPlayNow(id)}>▶</button>
              <button type="button" className="rounded px-1.5 text-dim hover:text-deck-b" aria-label={`Remove ${songLabel(s)}`} onClick={() => onRemove(id)}>✕</button>
            </li>
          );
        })}
        {tab === 'next' && upcoming.length > 80 && <li className="px-2 py-1 text-dim">+ {upcoming.length - 80} more</li>}
        {tab === 'played' && [...calls].reverse().map((c, i) => {
          const s = songs.get(c.songId);
          return (
            <li key={c.songId} className={row}>
              <span className="w-6 text-right text-dim tabular-nums">{calls.length - i}</span>
              <span className="min-w-0 flex-1 truncate"><span className="font-semibold">{songLabel(s)}</span> <span className="text-dim">· {s?.artist}</span></span>
              <span className="text-xs text-dim tabular-nums">{new Date(c.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
              <button type="button" className="rounded px-1.5 text-dim hover:text-deck-a" aria-label={`Replay ${songLabel(s)}`} onClick={() => onReplayCalled(c.songId)}>↻</button>
            </li>
          );
        })}
        {tab === 'removed' && removed.map((id) => {
          const s = songs.get(id);
          return (
            <li key={id} className={row}>
              <span className="min-w-0 flex-1 truncate">{songLabel(s)} <span className="text-dim">· {s?.artist}</span></span>
              <button type="button" className="btn px-2 py-0.5 text-xs" onClick={() => onRestore(id)}>Put back</button>
            </li>
          );
        })}
        {tab === 'removed' && removed.length === 0 && <li className="px-2 text-dim">Nothing removed.</li>}
      </ol>
    </div>
  );
}
