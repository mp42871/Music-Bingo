import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSpotify } from '../../app/spotifyStore';
import { download, exportPoolCsv, exportPoolJson, mergeSongs } from '../../core/io';
import type { Preset } from '../../core/presets';
import type { Pool, Song } from '../../core/types';
import { getPool, savePool } from '../../db/repo';
import { ImportDialog } from '../components/ImportDialog';
import { mergeFromSources } from '../../core/spotifyImport';
import { useOnline } from '../../app/online';
import { LinkFilesDialog } from '../components/LinkFilesDialog';
import { listAudio } from '../../db/audio';
import type { AudioFile } from '../../core/types';
import { SearchPanel } from '../components/SearchPanel';
import { SongRow } from '../components/SongRow';
import { PreviewBar } from '../components/PreviewBar';
import { usePreview } from '../../app/preview';

const MIN_PER_COLUMN = 5;
const GOOD_PER_COLUMN = 15;

function printSongList(pool: Pool) {
  const w = window.open('', '_blank');
  if (!w) return;
  const rows = pool.songs.filter((s) => !s.excluded)
    .map((s, i) => `<tr><td>${i + 1}</td><td>${esc(s.displayTitle ?? s.title)}</td><td>${esc(s.artist)}</td><td>${s.year ?? ''}</td><td>${esc(s.categories.join(', '))}</td></tr>`).join('');
  w.document.write(`<!doctype html><title>${esc(pool.name)}</title><style>body{font:13px system-ui;margin:24px}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ccc;padding:4px 6px;text-align:left}</style><h1>${esc(pool.name)}</h1><table><tr><th>#</th><th>Title</th><th>Artist</th><th>Year</th><th>Categories</th></tr>${rows}</table><script>print()</script>`);
  w.document.close();
}
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export default function PoolEditor() {
  const { id } = useParams();
  const { api } = useSpotify();
  const [pool, setPool] = useState<Pool | null>(null);
  const [missing, setMissing] = useState(false);
  const [active, setActive] = useState<string>('');
  const [view, setView] = useState<string>('__all');
  const [newCat, setNewCat] = useState('');
  const [importing, setImporting] = useState(false);
  const [linking, setLinking] = useState<AudioFile[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const online = useOnline();
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => { getPool(id!).then((p) => (p ? setPool(p) : setMissing(true))); }, [id]);
  useEffect(() => () => usePreview.getState().stop(), []); // leaving the page stops any preview

  const update = useCallback((fn: (p: Pool) => Pool) => {
    setPool((prev) => {
      if (!prev) return prev;
      const next = { ...fn(prev), updatedAt: Date.now() };
      void savePool(next);
      return next;
    });
  }, []);

  const flash = (m: string) => { setNote(m); setTimeout(() => setNote(null), 3500); };
  const ensureCat = (p: Pool, c: string) => (c && !p.categories.includes(c) ? [...p.categories, c] : p.categories);
  const tag = (s: Song, c: string): Song => (c && !s.categories.includes(c) ? { ...s, categories: [...s.categories, c] } : s);

  const addSongs = (songs: Song[], cat = active) => update((p) => ({
    ...p, categories: ensureCat(p, cat), songs: mergeSongs(p.songs, songs.map((s) => tag(s, cat)), 'skip'),
  }));

  const onPreset = (pr: Preset) => {
    setActive(pr.name);
    update((p) => ({ ...p, categories: ensureCat(p, pr.name) }));
  };

  const inPool = useMemo(() => new Set(pool?.songs.map((s) => s.id)), [pool]);
  const health = useMemo(() => pool?.categories.map((c) => {
    const n = pool.songs.filter((s) => !s.excluded && s.categories.includes(c)).length;
    return { c, n };
  }) ?? [], [pool]);

  if (missing) return <main className="mx-auto max-w-7xl px-4 py-6"><p>That playlist doesn’t exist. <Link className="text-deck-a underline" to="/pools">Back to playlists</Link></p></main>;
  if (!pool) return <main className="mx-auto max-w-7xl px-4 py-6 text-dim">Loading…</main>;

  const shown = pool.songs.filter((s) => view === '__all' || (view === '__none' ? s.categories.length === 0 : s.categories.includes(view)));
  const usable = pool.songs.filter((s) => !s.excluded).length;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link to="/pools" className="text-dim hover:text-ink">Playlists</Link>
        <span className="text-dim">/</span>
        <input aria-label="Playlist name" value={pool.name} onChange={(e) => update((p) => ({ ...p, name: e.target.value }))}
          className="min-w-0 flex-1 border-transparent bg-transparent font-display text-2xl md:text-3xl hover:border-rail" />
        <div className="flex flex-wrap gap-2">
          {pool.sources?.length ? (
            <button type="button" className="btn btn-a" disabled={!online || syncing} title={`From: ${pool.sources.map((x) => x.name).join(', ')}`}
              onClick={async () => {
                setSyncing(true);
                try {
                  const lists = [];
                  for (const src of pool.sources!) lists.push({ ...src, songs: await api.playlistSongs(src.id) });
                  const res = mergeFromSources(pool, lists);
                  update(() => res.pool);
                  flash(`Updated from Spotify: ${res.added} song${res.added === 1 ? '' : 's'} added, ${res.removed} removed.`);
                } catch (e) { flash(e instanceof Error ? e.message : String(e)); }
                finally { setSyncing(false); }
              }}>{syncing ? 'Updating…' : 'Update from Spotify'}</button>
          ) : null}
          <button type="button" className="btn" onClick={() => setImporting(true)}>Import</button>
          <button type="button" className="btn" onClick={async () => setLinking(await listAudio())}>Link music files</button>
          <details className="relative">
            <summary className="btn list-none cursor-pointer">Export</summary>
            <div className="panel absolute right-0 z-20 mt-1 flex w-56 flex-col p-1">
              {[
                ['Bingo playlist (.json)', () => download(`${pool.name}.json`, exportPoolJson(pool))],
                ['Spreadsheet (.csv)', () => download(`${pool.name}.csv`, exportPoolCsv(pool), 'text/csv')],
                ['Save to Spotify', async () => {
                  if (!navigator.onLine) return flash('You’re offline — saving to Spotify needs internet.');
                  try { await api.createPlaylist(pool.name, pool.songs.filter((s) => !s.excluded).map((s) => s.uri)); flash('Saved to your Spotify as a private playlist.'); }
                  catch (e) { flash(e instanceof Error ? e.message : String(e)); }
                }],
                ['Print song list', () => printSongList(pool)],
              ].map(([label, fn]) => (
                <button key={label as string} type="button" className="rounded-lg px-3 py-2 text-left hover:bg-booth-2" onClick={fn as () => void}>{label as string}</button>
              ))}
            </div>
          </details>
          <Link to={`/designer?pool=${pool.id}`} className="btn btn-b">Make cards</Link>
        </div>
      </div>
      {note && <p role="status" className="mb-4 rounded-lg border border-deck-a/40 bg-deck-a/10 px-3 py-2">{note}</p>}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <section className="panel h-fit p-4 lg:sticky lg:top-20">
          <h2 className="mb-3 text-lg font-bold">Find songs</h2>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="label">Tag added songs as</span>
            <select aria-label="Tag added songs as" value={active} onChange={(e) => setActive(e.target.value)}>
              <option value="">No category</option>
              {pool.categories.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <SearchPanel inPool={inPool} onAdd={(s) => addSongs([s])} onAddMany={(ss) => addSongs(ss)} onPreset={onPreset} />
        </section>

        <section className="flex flex-col gap-4">
          <div className="panel p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold">Categories</h2>
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const c = newCat.trim(); if (c) { update((p) => ({ ...p, categories: ensureCat(p, c) })); setNewCat(''); } }}>
                <input aria-label="New category" placeholder="New category" value={newCat} onChange={(e) => setNewCat(e.target.value)} className="w-40" />
                <button className="btn">Add</button>
              </form>
            </div>
            {health.length === 0
              ? <p className="text-sm text-dim">Categories become card columns (like “80s | 90s | Country”) or a whole-card theme. Pick a quick category or add your own.</p>
              : (
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {health.map(({ c, n }) => {
                    const pct = Math.min(100, (n / GOOD_PER_COLUMN) * 100);
                    const color = n < MIN_PER_COLUMN ? 'bg-deck-b' : n < GOOD_PER_COLUMN ? 'bg-peak' : 'bg-ok';
                    return (
                      <li key={c} className="rounded-lg border border-rail p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <button type="button" className="font-semibold hover:text-deck-a" onClick={() => setView(c)}>{c}</button>
                          <span className="text-sm tabular-nums">{n}</span>
                          <button type="button" className="text-xs text-dim hover:text-deck-b" aria-label={`Delete category ${c}`}
                            onClick={() => update((p) => ({ ...p, categories: p.categories.filter((x) => x !== c), songs: p.songs.map((s) => ({ ...s, categories: s.categories.filter((x) => x !== c) })) }))}>✕</button>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded bg-rail"><div className={`h-full rounded ${color}`} style={{ width: `${pct}%` }} /></div>
                        <p className="mt-1 text-xs text-dim">
                          {n < MIN_PER_COLUMN ? `needs ${MIN_PER_COLUMN - n} more for a 5×5 column` : n < GOOD_PER_COLUMN ? `works · ${GOOD_PER_COLUMN}+ gives more variety` : 'great variety'}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
          </div>

          <div className="panel p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold">Songs <span className="text-dim tabular-nums">({usable} in play{usable !== pool.songs.length ? ` · ${pool.songs.length - usable} off` : ''})</span></h2>
              <div className="flex flex-wrap gap-1">
                {[['__all', 'All'], ...pool.categories.map((c) => [c, c]), ['__none', 'No category']].map(([v, l]) => (
                  <button key={v} type="button" className="chip" aria-pressed={view === v} onClick={() => setView(v)}>{l}</button>
                ))}
              </div>
            </div>
            {shown.length === 0
              ? <p className="py-8 text-center text-dim">No songs here yet. Search on the left, pick a quick category, or import a list.</p>
              : (
                <ul className="flex flex-col gap-2">
                  {shown.map((s) => (
                    <SongRow key={s.id} song={s} categories={pool.categories}
                      onChange={(ns) => update((p) => ({ ...p, songs: p.songs.map((x) => (x.id === s.id ? ns : x)) }))}
                      onRemove={() => update((p) => ({ ...p, songs: p.songs.filter((x) => x.id !== s.id) }))} />
                  ))}
                </ul>
              )}
          </div>
        </section>
      </div>

      <PreviewBar onSetStart={(id, ms) => {
        if (!pool.songs.some((x) => x.id === id)) return flash('Add the song to the playlist first, then set its start point.');
        update((p) => ({ ...p, songs: p.songs.map((x) => (x.id === id ? { ...x, startMs: ms } : x)) }));
        flash('Start point saved.');
      }} />
      {linking && (
        <LinkFilesDialog songs={pool.songs.filter((s) => !s.id.startsWith('file:'))} files={linking} onClose={() => setLinking(null)}
          onApply={(links) => {
            update((p) => ({ ...p, songs: p.songs.map((s) => {
              if (!(s.id in links)) return s;
              const f = links[s.id];
              if (f) return { ...s, fileId: f };
              const { fileId: _x, ...rest } = s; void _x; return rest;
            }) }));
            const n = Object.values(links).filter(Boolean).length;
            flash(`${n} song${n === 1 ? '' : 's'} linked to music files.`);
          }} />
      )}
      {importing && (
        <ImportDialog currentPoolId={pool.id} onClose={() => setImporting(false)}
          onImport={(songs, mode) => {
            update((p) => {
              const cats = [...new Set([...p.categories, ...songs.flatMap((s) => s.categories)])];
              return { ...p, categories: cats, songs: mergeSongs(p.songs, songs, mode) };
            });
            flash(`Imported ${songs.length} song${songs.length === 1 ? '' : 's'}.`);
          }} />
      )}
    </main>
  );
}
