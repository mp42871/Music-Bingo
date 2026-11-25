import { useState } from 'react';
import { readiness } from '../../core/offline';
import type { Song } from '../../core/types';
import { songLabel } from '../../game/store';

export function Readiness({ songs, fileIds, online, onSaveOrder, compact }: {
  songs: Song[]; fileIds: Set<string>; online: boolean; onSaveOrder?: (uris: string[]) => Promise<string>; compact?: boolean;
}) {
  const r = readiness(songs, fileIds);
  const [saved, setSaved] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const spotifySongs = songs.filter((s) => !s.id.startsWith('file:'));
  const verdict = r.manual === 0
    ? `Offline ready: all ${r.total} songs play automatically.`
    : `Offline ready: ${r.withFile} songs play automatically, ${r.manual} will prompt you to play them in the Spotify app.`;
  return (
    <div className="grid gap-3 text-sm">
      <p className={r.manual === 0 ? 'text-ok' : 'text-ink'}>{verdict}</p>
      {r.manual > 0 && !compact && (
        <details className="text-dim">
          <summary className="cursor-pointer">Songs without a music file ({r.manual})</summary>
          <ul className="mt-1 max-h-40 overflow-auto">{r.missing.map((s) => <li key={s.id}>{songLabel(s)} · {s.artist}</li>)}</ul>
        </details>
      )}
      {onSaveOrder && spotifySongs.length > 0 && r.manual > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn" disabled={!online}
            onClick={async () => {
              setErr(null);
              try { setSaved(await onSaveOrder!(spotifySongs.map((s) => s.uri))); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
            }}>Save call order to Spotify</button>
          <span className="text-xs text-dim">{online ? 'Then download that playlist in the Spotify app (shuffle off) and step through it in time with the game.' : 'Needs internet — do this before you leave.'}</span>
        </div>
      )}
      {saved && <p className="text-ok" role="status">Saved to your Spotify. Download it in the Spotify app before the event.</p>}
      {err && <p className="text-deck-b" role="alert">{err}</p>}
    </div>
  );
}
