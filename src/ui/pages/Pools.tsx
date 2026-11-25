import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { importPoolJson } from '../../core/io';
import { uid } from '../../core/rng';
import type { Pool } from '../../core/types';
import { deletePool, listPools, savePool } from '../../db/repo';
import { PageHeader } from '../components/Field';

export default function Pools() {
  const [pools, setPools] = useState<Pool[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
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
        <button type="button" className="btn btn-a" onClick={() => create()}>New playlist</button>
      </PageHeader>
      {err && <p role="alert" className="mb-4 text-deck-b">{err}</p>}
      {pools && pools.length === 0 && (
        <div className="panel p-10 text-center">
          <p className="mb-4 text-lg">A playlist is the pool of songs your cards are made from.</p>
          <button type="button" className="btn btn-a" onClick={() => create()}>Make your first playlist</button>
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
              <button type="button" aria-label={`Delete ${p.name}`} className="absolute right-2 top-2 rounded px-2 text-dim opacity-0 hover:text-deck-b focus:opacity-100 group-hover:opacity-100"
                onClick={async () => { if (confirm(`Delete “${p.name}”? Cards and history that used it are kept.`)) { await deletePool(p.id); void refresh(); } }}>✕</button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
