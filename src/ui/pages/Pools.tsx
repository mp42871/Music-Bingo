import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { importPoolJson } from '../../core/io';
import { uid } from '../../core/rng';
import type { Pool } from '../../core/types';
import { deletePool, listPools, savePool } from '../../db/repo';
import { PageHeader } from '../components/Field';
import { SpotifyPicker } from '../components/SpotifyPicker';
import { InstantPlaylist } from '../components/InstantPlaylist';
import { useOnline } from '../../app/online';

export default function Pools() {
  const [pools, setPools] = useState<Pool[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [instant, setInstant] = useState(false);
  const online = useOnline();
  const nav = useNavigate();
  const refresh = () => listPools().then(setPools);
  useEffect(() => { void refresh(); }, []);

  const create = async (base?: Partial<Pool>) => {
    const p: Pool = { id: uid(), name: 'New playlist', songs: [], categories: [], createdAt: Date.now(), updatedAt: Date.now(), ...base };
    await savePool(p);
    nav(`/pools/${p.id}`);
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <PageHeader title="Playlists">
        <label className="btn cursor-pointer">
          Import file
          <input type="file" accept=".json,application/json" className="sr-only" aria-label="Import playlist file"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try { const p = importPoolJson(await f.text()); await create({ ...p, id: uid(), updatedAt: Date.now() }); }
              catch (x) { setErr(x instanceof Error ? x.message : String(x)); }
            }} />
        </label>
        <button type="button" className="btn" onClick={() => create()}>Start empty</button>
        <button type="button" className="btn" disabled={!online} title={online ? 'Build a playlist from quick categories' : 'Needs internet'} onClick={() => setInstant(true)}>Instant playlist</button>
        <button type="button" className="btn btn-a" disabled={!online} title={online ? undefined : 'Needs internet'} onClick={() => setPicking(true)}>Import from Spotify</button>
      </PageHeader>
      {!online && <p className="mb-4 text-sm text-peak">You’re offline — importing from Spotify needs internet. Your saved playlists still work.</p>}
      {err && <p role="alert" className="mb-4 text-deck-b">{err}</p>}
      {pools && pools.length === 0 && (
        <div className="panel p-10 text-center">
          <p className="mb-2 text-lg">A playlist is the pool of songs your cards are made from.</p>
          <p className="mb-5 text-dim">Make playlists in the Spotify app, then bring them in here. Pick several to turn each one into a card column.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" className="btn btn-a" disabled={!online} onClick={() => setPicking(true)}>Import from Spotify</button>
            <button type="button" className="btn" disabled={!online} onClick={() => setInstant(true)}>Instant playlist from categories</button>
          </div>
        </div>
      )}
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pools?.map((p) => {
          const art = p.songs.filter((s) => s.artUrl).slice(0, 4);
          return (
            <li key={p.id} className="panel group relative overflow-hidden">
              <Link to={`/pools/${p.id}`} className="flex gap-4 p-4">
                <div className="grid size-20 shrink-0 grid-cols-2 overflow-hidden rounded-lg bg-rail">
                  {art.map((s) => <img key={s.id} src={s.artUrl} alt="" className="size-10 object-cover" />)}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold">{p.name}</h2>
                  <p className="text-sm text-dim">{p.songs.length} songs · {p.categories.length} categories</p>
                  <p className="mt-1 truncate text-xs text-dim">{p.categories.join(' / ')}</p>
                </div>
              </Link>
              <button type="button" aria-label={`Delete ${p.name}`} className="absolute right-1 top-1 rounded px-3 py-2 text-dim hover:text-deck-b focus:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                onClick={async () => { if (confirm(`Delete “${p.name}”? Cards and history that used it are kept.`)) { await deletePool(p.id); void refresh(); } }}>✕</button>
            </li>
          );
        })}
      </ul>
      {instant && (
        <InstantPlaylist onClose={() => setInstant(false)}
          onDone={async (p) => { await savePool(p); setInstant(false); nav(`/pools/${p.id}`); }} />
      )}
      {picking && (
        <SpotifyPicker onClose={() => setPicking(false)}
          onDone={async (p) => { await savePool(p); setPicking(false); nav(`/pools/${p.id}`); }} />
      )}
    </main>
  );
}
