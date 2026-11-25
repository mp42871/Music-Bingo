import { useEffect, useMemo, useState } from 'react';
import { useSpotify } from '../../app/spotifyStore';
import { buildPoolFromPlaylists, type SourceList } from '../../core/spotifyImport';
import type { Pool } from '../../core/types';

interface Item { id: string; name: string; count: number; image?: string }

export function SpotifyPicker({ onDone, onClose }: { onDone(pool: Pool): void; onClose(): void }) {
  const { api, connected } = useSpotify();
  const [items, setItems] = useState<Item[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [link, setLink] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!connected) return;
    api.myPlaylists().then(setItems).catch((e) => { setItems([]); setErr(e instanceof Error ? e.message : String(e)); });
  }, [api, connected]);

  const shown = useMemo(() => (items ?? []).filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase())), [items, q]);
  const chosen = picked.map((id) => items?.find((p) => p.id === id)).filter(Boolean) as Item[];
  const defaultName = chosen.map((p) => p.name).join(' + ');
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const addLink = async () => {
    setErr(null);
    try {
      const info = await api.playlistInfo(link);
      setItems((xs) => [info, ...(xs ?? []).filter((x) => x.id !== info.id)]);
      setPicked((p) => (p.includes(info.id) ? p : [...p, info.id]));
      setLink('');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };

  const run = async () => {
    setErr(null);
    const lists: SourceList[] = [];
    try {
      for (const [i, p] of chosen.entries()) {
        setBusy(`Loading “${p.name}” (${i + 1} of ${chosen.length})…`);
        lists.push({ id: p.id, name: p.name, songs: await api.playlistSongs(p.id) });
      }
    } catch (e) {
      setBusy(null);
      return setErr(e instanceof Error ? e.message : String(e));
    }
    setBusy(null);
    onDone(buildPoolFromPlaylists(lists, name || undefined));
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Import from Spotify" className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/70 p-4">
      <div className="panel mt-8 w-full max-w-2xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold">Import from Spotify</h2>
          <button type="button" className="btn px-3" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        {!connected ? (
          <p className="text-peak">Connect Spotify in Settings first.</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-dim">Pick one playlist, or several — each one becomes a category (card column).</p>
            <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto]">
              <input aria-label="Search your playlists" placeholder="Search your playlists" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <ul className="mb-3 grid max-h-[45vh] grid-cols-1 gap-1 overflow-auto pr-1">
              {items === null && <li className="text-dim">Loading your playlists…</li>}
              {items?.length === 0 && !err && <li className="text-dim">No playlists found in your Spotify account.</li>}
              {shown.map((p) => (
                <li key={p.id}>
                  <label className={`flex cursor-pointer items-center gap-3 rounded-lg border px-2 py-1.5 ${picked.includes(p.id) ? 'border-deck-b bg-deck-b/10' : 'border-transparent hover:border-rail'}`}>
                    <input type="checkbox" checked={picked.includes(p.id)} onChange={() => toggle(p.id)} aria-label={`${p.name} (${p.count} songs)`} />
                    {p.image ? <img src={p.image} alt="" className="size-10 rounded" /> : <span className="size-10 rounded bg-rail" />}
                    <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                    <span className="text-sm text-dim tabular-nums">{p.count}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="mb-4 flex gap-2">
              <input aria-label="Spotify playlist link" placeholder="…or paste a playlist link" value={link} onChange={(e) => setLink(e.target.value)} className="flex-1" />
              <button type="button" className="btn" disabled={!link.trim()} onClick={addLink}>Add link</button>
            </div>
            {chosen.length > 0 && (
              <label className="mb-4 flex flex-col gap-1">
                <span className="label">Bingo playlist name</span>
                <input value={name} placeholder={defaultName} onChange={(e) => setName(e.target.value)} />
              </label>
            )}
            {err && <p role="alert" className="mb-3 text-deck-b">{err}</p>}
            {busy && <p role="status" className="mb-3 text-deck-a">{busy}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn" onClick={onClose}>Cancel</button>
              <button type="button" className="btn btn-b" disabled={!chosen.length || !!busy} onClick={run}>
                Import {chosen.length} playlist{chosen.length === 1 ? '' : 's'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
