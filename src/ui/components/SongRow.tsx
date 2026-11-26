import { useEffect, useState } from 'react';
import { formatTime, parseTime } from '../../core/io';
import type { Song } from '../../core/types';
import { PreviewButton } from './PreviewButton';

export function SongRow({ song, categories, onChange, onRemove }: {
  song: Song; categories: string[]; onChange: (s: Song) => void; onRemove: () => void;
}) {
  const [start, setStart] = useState(song.startMs !== undefined ? formatTime(song.startMs) : '');
  const [title, setTitle] = useState(song.displayTitle ?? song.title);
  useEffect(() => setStart(song.startMs !== undefined ? formatTime(song.startMs) : ''), [song.startMs]);
  useEffect(() => setTitle(song.displayTitle ?? song.title), [song.displayTitle, song.title]);

  const commitStart = () => {
    if (start.trim() === '') {
      if (song.startMs !== undefined) { const { startMs: _drop, ...rest } = song; void _drop; onChange(rest); }
      return;
    }
    const ms = parseTime(start);
    if (ms === null) return setStart(song.startMs !== undefined ? formatTime(song.startMs) : '');
    if (ms !== song.startMs) onChange({ ...song, startMs: ms });
  };
  const commitTitle = () => {
    const t = title.trim();
    if (!t || t === song.title) { if (song.displayTitle) { const { displayTitle: _d, ...rest } = song; void _d; onChange(rest); } return; }
    if (t !== song.displayTitle) onChange({ ...song, displayTitle: t });
  };

  return (
    <li className={`flex flex-wrap items-center gap-3 rounded-xl border border-rail bg-booth-2/60 px-3 py-2 ${song.excluded ? 'opacity-50' : ''}`}>
      {song.artUrl ? <img src={song.artUrl} alt="" className="size-11 rounded" /> : <div className="size-11 rounded bg-rail" />}
      <PreviewButton song={song} />
      <div className="min-w-[12rem] flex-1">
        <input aria-label={`Card title for ${song.title}`} value={title} onChange={(e) => setTitle(e.target.value)} onBlur={commitTitle}
          className="w-full border-transparent bg-transparent px-1 py-0.5 font-semibold hover:border-rail" />
        <div className="truncate px-1 text-sm text-dim">{song.fileId && <span className="mr-1.5 rounded bg-ok/15 px-1.5 py-0.5 text-xs font-semibold text-ok" title="Plays from a music file on this computer">File</span>}{song.artist}{song.year ? ` · ${song.year}` : ''}{song.durationMs ? ` · ${formatTime(song.durationMs)}` : ''}</div>
      </div>
      <div className="flex flex-wrap gap-1">
        {categories.map((c) => {
          const on = song.categories.includes(c);
          return (
            <button key={c} type="button" className="chip" aria-pressed={on}
              onClick={() => onChange({ ...song, categories: on ? song.categories.filter((x) => x !== c) : [...song.categories, c] })}>{c}</button>
          );
        })}
      </div>
      <input aria-label={`Start point for ${song.title}`} placeholder="start m:ss" value={start}
        onChange={(e) => setStart(e.target.value)} onBlur={commitStart} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="w-24 text-center font-mono text-sm" />
      <label className="flex items-center gap-1 text-sm text-dim" title="Make this song louder or softer than the others">
        Vol
        <select aria-label={`Volume adjustment for ${song.title}`} value={song.volumeDb ?? 0} className="px-1 py-0.5 text-sm"
          onChange={(e) => { const v = Number(e.target.value); const { volumeDb: _x, ...rest } = song; void _x; onChange(v ? { ...rest, volumeDb: v } : rest); }}>
          {Array.from({ length: 19 }, (_, i) => i - 9).map((v) => <option key={v} value={v}>{v > 0 ? `+${v}` : v}</option>)}
        </select>
      </label>
      {song.startMs !== undefined && <PreviewButton song={song} from="marker" label={`Play ${song.title} from its start point`} />}
      <label className="flex items-center gap-1 text-sm text-dim">
        <input type="checkbox" checked={!song.excluded} onChange={(e) => onChange({ ...song, excluded: !e.target.checked })} aria-label={`Use ${song.title}`} /> Use
      </label>
      <button type="button" className="btn px-2 text-dim" aria-label={`Remove ${song.title}`} onClick={onRemove}>✕</button>
    </li>
  );
}
