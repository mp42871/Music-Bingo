import { usePreview } from '../../app/preview';
import type { Song } from '../../core/types';

export function PreviewButton({ song, from = 'default', label }: { song: Song; from?: 'default' | 'marker'; label?: string }) {
  const playing = usePreview((s) => s.current?.id === song.id);
  const toggle = usePreview((s) => s.toggle);
  const name = label ?? `Preview ${song.title}`;
  return (
    <button type="button" aria-label={playing ? `Stop ${song.title}` : name} title={playing ? 'Stop preview' : name}
      onClick={() => void toggle(song, from)}
      className={`grid size-9 shrink-0 place-items-center rounded-full border ${playing ? 'border-deck-b text-deck-b' : 'border-rail text-dim hover:border-deck-a hover:text-ink'}`}>
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden><path d={playing ? 'M6 6h12v12H6z' : 'M8 5v14l11-7z'} fill="currentColor" /></svg>
    </button>
  );
}
