import { useState } from 'react';
import { useOnline } from '../../app/online';
import { useSpotify } from '../../app/spotifyStore';
import { presetQueries, type Preset } from '../../core/presets';
import { collect } from '../../spotify/collect';
import { collectCurated, parseCurated, type CuratedLine } from '../../spotify/curated';
import { PresetPicker } from './PresetPicker';
import { PreviewButton } from './PreviewButton';
import type { Song } from '../../core/types';
import { buildSearchQuery, type SearchFilters } from '../../spotify/query';
import { NumberInput } from './NumberInput';

export function SearchPanel({ inPool, onAdd, onAddMany, onPreset }: {
  inPool: Set<string>;
  onAdd: (s: Song) => void;
  onAddMany: (s: Song[]) => void;
  onPreset: (p: Preset) => void;
}) {
  const { api, connected } = useSpotify();
  const online = useOnline();
  const [f, setF] = useState<SearchFilters>({});
  const [more, setMore] = useState(false);
  const [results, setResults] = useState<Song[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [paging, setPaging] = useState<{ queries: string[]; offsets: number[]; done: boolean; seen: Set<string>; curated?: { lines: CuratedLine[]; next: number } } | null>(null);

  const BATCH = 50;
  const runQueries = async (queries: string[], label: string, more = false) => {
    if (!queries.length) return;
    setBusy(true);
    setErr(null);
    try {
      const seen = more && paging ? paging.seen : new Set<string>();
      const r = await collect(api, queries, BATCH, more && paging ? paging.offsets : undefined, seen);
      setPaging({ queries, offsets: r.offsets, done: r.done, seen });
      setQuery(label);
      if (!more) setTotal(r.total);
      setResults((prev) => (more ? [...prev, ...r.songs] : r.songs));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  // Hand-picked categories: look each listed song up exactly, 25 at a time.
  const runCurated = async (lines: CuratedLine[], label: string, more = false) => {
    setBusy(true);
    setErr(null);
    try {
      const seen = more && paging ? paging.seen : new Set<string>();
      const r = await collectCurated(api, lines, 25, more && paging?.curated ? paging.curated.next : 0, seen);
      setPaging({ queries: [], offsets: [], done: r.done, seen, curated: { lines, next: r.next } });
      setQuery(label);
      if (!more) setTotal(lines.length);
      setResults((prev) => (more ? [...prev, ...r.songs] : r.songs));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const run = (filters: SearchFilters) => { const q = buildSearchQuery(filters); return runQueries(q ? [q] : [], q); };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="label">Quick categories</span>
        <div className="mt-2">
          <PresetPicker mode="pick" disabled={!online} onPick={(p) => {
            setF(p.query ?? {});
            if (p.query?.genre || p.query?.yearFrom) setMore(true);
            onPreset(p);
            if (p.songs) void runCurated(parseCurated(p.songs), `${p.name} (hand-picked)`);
            else void runQueries(presetQueries(p), p.name);
          }} />
        </div>
      </div>
      <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); void run(f); }}>
        <input aria-label="Search songs" placeholder="Anything: song, artist or keyword" value={f.text ?? ''} onChange={(e) => setF({ ...f, text: e.target.value })} />
        <button type="button" className="self-start text-sm text-dim underline" aria-expanded={more} onClick={() => setMore(!more)}>
          {more ? 'Fewer search options' : 'More search options (title, artist, album, genre, years)'}
        </button>
        {more && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input aria-label="Song title" placeholder="Song title" value={f.track ?? ''} onChange={(e) => setF({ ...f, track: e.target.value })} />
            <input aria-label="Artist" placeholder="Artist" value={f.artist ?? ''} onChange={(e) => setF({ ...f, artist: e.target.value })} />
            <input aria-label="Album" placeholder="Album" value={f.album ?? ''} onChange={(e) => setF({ ...f, album: e.target.value })} />
            <input aria-label="Genre" placeholder="Genre (e.g. country, disco)" value={f.genre ?? ''} onChange={(e) => setF({ ...f, genre: e.target.value })} />
            <div className="grid grid-cols-2 gap-2 sm:col-span-2">
              <NumberInput aria-label="From year" className="w-full" value={f.yearFrom ?? 0} min={0} max={2100} onChange={(n) => setF({ ...f, yearFrom: n || undefined })} />
              <NumberInput aria-label="To year" className="w-full" value={f.yearTo ?? 0} min={0} max={2100} onChange={(n) => setF({ ...f, yearTo: n || undefined })} />
            </div>
            <p className="text-xs text-dim sm:col-span-2">Fill in any mix — e.g. Artist “Fleetwood Mac” + Album “Rumours”. Years: 0 means any.</p>
          </div>
        )}
        <div className="flex gap-2">
          <button className="btn btn-a flex-1" disabled={busy || !online || !buildSearchQuery(f)}>{busy ? 'Searching…' : 'Search Spotify'}</button>
          <button type="button" className="btn" onClick={() => { setF({}); setResults([]); setTotal(0); setPaging(null); }}>Clear</button>
        </div>
      </form>
      {!online && <p className="text-sm text-peak">You're offline — Spotify search needs internet. Your saved playlists still work.</p>}
      {online && !connected && <p className="text-sm text-peak">Connect Spotify in Settings to search.</p>}
      {err && <p role="alert" className="text-sm text-deck-b">{err}</p>}
      {results.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="label">{results.length} of {Math.max(total, results.length).toLocaleString()} results · <span className="font-mono">{query}</span></span>
            <button type="button" className="btn text-xs" onClick={() => onAddMany(results.filter((s) => !inPool.has(s.id)))}>Add all shown</button>
          </div>
          <ul className="flex max-h-[55vh] flex-col gap-1 overflow-auto pr-1">
            {results.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-lg border border-transparent px-2 py-1.5 hover:border-rail">
                <PreviewButton song={s} />
                {s.artUrl ? <img src={s.artUrl} alt="" className="size-10 rounded" /> : <div className="size-10 rounded bg-rail" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{s.title}</div>
                  <div className="truncate text-sm text-dim">{s.artist}{s.year ? ` · ${s.year}` : ''}</div>
                </div>
                <button type="button" aria-label={`Add ${s.title}`} disabled={inPool.has(s.id)}
                  className={`btn px-3 ${inPool.has(s.id) ? '' : 'btn-b'}`} onClick={() => onAdd(s)}>
                  {inPool.has(s.id) ? 'Added' : 'Add'}
                </button>
              </li>
            ))}
          </ul>
          {paging && !paging.done && (
            <button type="button" className="btn" disabled={busy} onClick={() => (paging.curated ? runCurated(paging.curated.lines, query, true) : runQueries(paging.queries, query, true))}>{busy ? 'Loading…' : 'Load more'}</button>
          )}
        </div>
      )}
    </div>
  );
}
