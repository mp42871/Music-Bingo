import { useMemo, useState } from 'react';
import { matchFiles } from '../../core/offline';
import type { AudioFile, Song } from '../../core/types';

export function LinkFilesDialog({ songs, files, onApply, onClose }: {
  songs: Song[]; files: AudioFile[]; onApply(links: Record<string, string | null>): void; onClose(): void;
}) {
  const m = useMemo(() => matchFiles(songs, files), [songs, files]);
  const [links, setLinks] = useState<Record<string, string | null>>(() => {
    const init: Record<string, string | null> = {};
    for (const s of songs) init[s.id] = s.fileId && files.some((f) => f.id === s.fileId) ? s.fileId : null;
    for (const x of m.matched) init[x.songId] = x.fileId;
    return init;
  });
  const byId = new Map(songs.map((s) => [s.id, s]));
  const label = (f: AudioFile) => `${f.title}${f.artist ? ` — ${f.artist}` : ''} (${f.name})`;
  const linked = Object.values(links).filter(Boolean).length;

  const groups: { title: string; ids: string[]; options: (id: string) => AudioFile[] }[] = [
    { title: 'Matched', ids: m.matched.map((x) => x.songId), options: () => files },
    { title: 'Pick one', ids: m.ambiguous.map((x) => x.songId), options: (id) => files.filter((f) => m.ambiguous.find((a) => a.songId === id)!.fileIds.includes(f.id)) },
    { title: 'No file', ids: m.unmatchedSongs, options: () => files },
  ];

  return (
    <div role="dialog" aria-modal="true" aria-label="Link music files" className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/70 p-4">
      <div className="panel mt-10 w-full max-w-3xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold">Link music files</h2>
          <button type="button" className="btn px-3" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <p className="mb-4 text-sm text-dim">Songs with a file play straight from this computer — no internet needed. Songs without one can still be played from the Spotify app.</p>
        {files.length === 0 && <p className="mb-4 text-peak">No music files yet. Add some under Music files first.</p>}
        <div className="grid gap-3">
          {groups.map((g) => (
            <details key={g.title} open={g.title !== 'Matched'} className="rounded-lg border border-rail p-3">
              <summary className="cursor-pointer font-semibold">{g.title} ({g.ids.length})</summary>
              <ul className="mt-2 grid gap-1.5 text-sm">
                {g.ids.map((id) => {
                  const s = byId.get(id)!;
                  return (
                    <li key={id} className="flex flex-wrap items-center gap-2">
                      <span className="min-w-[12rem] flex-1"><span className="font-semibold">{s.title}</span> <span className="text-dim">· {s.artist}</span></span>
                      <select aria-label={`File for ${s.title}`} value={links[id] ?? ''} className="max-w-full sm:max-w-sm"
                        onChange={(e) => setLinks({ ...links, [id]: e.target.value || null })}>
                        <option value="">No file</option>
                        {g.options(id).map((f) => <option key={f.id} value={f.id}>{label(f)}</option>)}
                      </select>
                    </li>
                  );
                })}
              </ul>
            </details>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-b" onClick={() => { onApply(links); onClose(); }}>Link {linked} song{linked === 1 ? '' : 's'}</button>
        </div>
      </div>
    </div>
  );
}
