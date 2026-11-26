import { usePreview, PREVIEW_MS } from '../../app/preview';
import { cleanTitle, formatTime } from '../../core/io';

/** Floating bar while a preview plays: seek, save the spot as the song's start point, stop. */
export function PreviewBar({ onSetStart }: { onSetStart?: (songId: string, ms: number) => void }) {
  const { current, positionMs, error, seek, stop } = usePreview();
  if (!current && !error) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-rail bg-night/95 px-4 py-3 backdrop-blur" role="region" aria-label="Song preview">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
        {current ? (
          <>
            {current.artUrl && <img src={current.artUrl} alt="" className="size-10 rounded" />}
            <div className="min-w-0">
              <div className="truncate font-semibold">{current.displayTitle ?? cleanTitle(current.title)}</div>
              <div className="truncate text-sm text-dim">{current.artist} · preview ({PREVIEW_MS / 1000}s)</div>
            </div>
            <div className="flex min-w-[12rem] flex-1 items-center gap-2 text-xs tabular-nums text-dim">
              <span>{formatTime(positionMs)}</span>
              <input type="range" aria-label="Preview position" min={0} max={Math.max(1000, current.durationMs || 300_000)} step={1000}
                value={Math.min(positionMs, current.durationMs || positionMs)} onChange={(e) => void seek(Number(e.target.value))} className="min-w-0 flex-1" />
              <span>{formatTime(current.durationMs)}</span>
            </div>
            {onSetStart && (
              <button type="button" className="btn btn-a" onClick={() => onSetStart(current.id, Math.round(positionMs / 1000) * 1000)}>
                {`Set ${formatTime(positionMs)} as start point`}
              </button>
            )}
            <button type="button" className="btn" onClick={stop}>Stop</button>
          </>
        ) : (
          <>
            <p role="alert" className="flex-1 text-deck-b">{error}</p>
            <button type="button" className="btn" onClick={() => usePreview.setState({ error: null })}>OK</button>
          </>
        )}
      </div>
    </div>
  );
}
