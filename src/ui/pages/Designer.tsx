import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { generateCard, generateCardSet, PoolTooSmallError, validatePool } from '../../core/cards';
import { decadesIn, tagDecades } from '../../core/decades';
import { combinePools } from '../../core/combine';
import { estimate } from '../../core/forecast';
import { masksFor, PATTERNS } from '../../core/patterns';
import { randomSeed } from '../../core/rng';
import { DEFAULT_STYLE } from '../../core/style';
import type { CardLayout, CardSet, CellContent, HeaderMode, Pool, PrintStyle } from '../../core/types';
import { deleteCardSet, getCardSet, getSetting, listCardSets, listGames, listPools, saveCardSet, savePool, setSetting } from '../../db/repo';
import { nextVersionName } from '../../core/cardEdit';
import { CardGrid, cardNo } from '../components/CardGrid';
import { Field, PageHeader, Section } from '../components/Field';
import { NumberInput } from '../components/NumberInput';
import { StyleControls } from '../components/StyleControls';

const DEFAULT_LAYOUT: CardLayout = {
  size: 5, freeCenter: true, freeText: 'FREE', headerMode: 'categories', columnCategories: [],
  letters: 'BINGO', cellContent: 'title',
};

const HEADER_MODES: { id: HeaderMode; label: string; hint: string }[] = [
  { id: 'categories', label: 'Category columns', hint: 'Each column is a category, like 80s | 90s | Country.' },
  { id: 'theme', label: 'Whole-card theme', hint: 'Every square comes from one category.' },
  { id: 'letters', label: 'Letters', hint: 'Classic header word (BINGO, MUSIC, PARTY…). Songs from the whole playlist.' },
];
const CONTENT: { id: CellContent; label: string }[] = [
  { id: 'title', label: 'Song title' }, { id: 'artist', label: 'Artist' },
  { id: 'both', label: 'Title + artist' }, { id: 'artistBingo', label: 'Artist bingo (any song by them counts)' },
];

export default function Designer() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [pools, setPools] = useState<Pool[]>([]);
  const [poolIds, setPoolIds] = useState<string[]>(params.get('pool') ? [params.get('pool')!] : []);
  const [tagged, setTagged] = useState<Pool | null>(null);
  const [layout, setLayout] = useState<CardLayout>(DEFAULT_LAYOUT);
  const [style, setStyle] = useState<PrintStyle>(DEFAULT_STYLE);
  const [count, setCount] = useState(40);
  const [startNumber, setStartNumber] = useState(1);
  const [seed, setSeed] = useState(randomSeed());
  const [pattern, setPattern] = useState('line');
  const [sets, setSets] = useState<CardSet[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const editId = params.get('edit');
  const [editing, setEditing] = useState<CardSet | null>(null);

  useEffect(() => {
    listCardSets().then(setSets);
    if (editId) {
      // Change layout of an existing set: start from its current settings.
      Promise.all([getCardSet(editId), listPools()]).then(([s, ps]) => {
        setPools(ps);
        if (!s) return setErr('That card set doesn’t exist any more.');
        setEditing(s);
        setPoolIds((s.poolIds ?? [s.poolId]).filter((id) => ps.some((p) => p.id === id)));
        setLayout(s.layout);
        setStyle({ ...DEFAULT_STYLE, ...s.style });
        setCount(s.cards.length);
        setStartNumber(Math.min(...s.cards.map((c) => c.number)));
        setSeed(s.seed);
      });
      return;
    }
    listPools().then((ps) => { setPools(ps); setPoolIds((ids) => (ids.length ? ids.filter((id) => ps.some((p) => p.id === id)) : ps[0] ? [ps[0].id] : [])); });
    getSetting('printStyle', DEFAULT_STYLE).then((s) => setStyle({ ...DEFAULT_STYLE, ...s }));
    getSetting('layout', DEFAULT_LAYOUT).then((l) => setLayout({ ...DEFAULT_LAYOUT, ...l }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chosen = useMemo(() => poolIds.map((id) => pools.find((p) => p.id === id)).filter(Boolean) as Pool[], [poolIds, pools]);
  const combined = useMemo(() => (chosen.length ? combinePools(chosen) : undefined), [chosen]);
  const pool = tagged && combined && tagged.id === combined.id ? tagged : combined;
  const togglePool = (id: string) => { setTagged(null); setPoolIds((ids) => (ids.includes(id) ? (ids.length > 1 ? ids.filter((x) => x !== id) : ids) : [...ids, id])); };
  const perColumn = () => setLayout((l) => ({ ...l, headerMode: 'categories', columnCategories: Array.from({ length: l.size }, (_, i) => chosen[i % chosen.length].name) }));
  const songsById = useMemo(() => new Map(pool?.songs.map((s) => [s.id, s])), [pool]);

  // Keep column categories sensible for the chosen pool.
  useEffect(() => {
    if (!pool) return;
    setLayout((l) => {
      const cats = Array.from({ length: l.size }, (_, i) => (pool.categories.includes(l.columnCategories[i]) ? l.columnCategories[i] : pool.categories[i % Math.max(1, pool.categories.length)] ?? ''));
      // Theme defaults to the whole playlist; keep a chosen category only if this playlist has it.
      const theme = l.themeCategory && pool.categories.includes(l.themeCategory) ? l.themeCategory : '';
      // A playlist without categories can only make letter-header cards.
      const headerMode = pool.categories.length === 0 ? 'letters' : l.headerMode;
      return { ...l, columnCategories: cats, themeCategory: theme, themeLabel: pool.name, headerMode };
    });
  }, [pool, layout.size, layout.headerMode]);

  const validation = pool ? validatePool(pool, layout) : null;
  const preview = useMemo(() => {
    if (!pool || !validation?.ok) return null;
    try { return generateCard(pool, layout, seed, startNumber); } catch { return null; }
  }, [pool, layout, seed, startNumber, validation?.ok]);

  const est = useMemo(() => {
    if (!pool || !validation?.ok) return null;
    try {
      const { set } = generateCardSet(pool, layout, { seed, count: Math.min(count, 150), startNumber });
      return estimate(pool, set.cards, masksFor(pattern, layout.size), songsById, 12, seed);
    } catch { return null; }
  }, [pool, layout, seed, count, startNumber, pattern, songsById, validation?.ok]);

  const set = <K extends keyof CardLayout>(k: K, v: CardLayout[K]) => setLayout((l) => ({ ...l, [k]: v }));

  const decadeDash = async () => {
    if (!pool) return;
    const t = tagDecades(pool);
    if (chosen.length === 1) { await savePool(t); setPools((ps) => ps.map((p) => (p.id === t.id ? t : p))); }
    else setTagged(t);
    const decades = decadesIn(t);
    setLayout((l) => ({ ...l, headerMode: 'categories', columnCategories: Array.from({ length: l.size }, (_, i) => decades[i] ?? decades[decades.length - 1] ?? '') }));
  };

  const [saved, setSaved] = useState<string | null>(null);
  const generate = async (thenPrint = true) => {
    if (!pool) return;
    setErr(null);
    setSaved(null);
    try {
      const res = generateCardSet(pool, layout, { seed, count, startNumber, name: `${style.title || pool.name} · ${pool.name}` });
      const cs: CardSet = { ...res.set, style, ...(chosen.length > 1 ? { poolIds: chosen.map((p) => p.id) } : {}) };
      await saveCardSet(cs);
      await setSetting('printStyle', style);
      await setSetting('layout', layout);
      if (res.capped) alert(res.message);
      if (thenPrint) nav(`/print/${cs.id}`);
      else {
        setSets(await listCardSets());
        setSeed(randomSeed()); // the next save makes a different set
        setSaved(`Saved ${cs.cards.length} cards as “${cs.name}”. Print them any time from Saved card sets.`);
      }
    } catch (e) {
      setErr(e instanceof PoolTooSmallError ? e.message : String(e));
    }
  };

  const rebuild = async () => {
    if (!pool || !editing) return;
    setErr(null);
    const used = (await listGames()).some((g) => g.cardSetId === editing.id);
    const msg = used
      ? `“${editing.name}” was used in a game, so the rebuilt cards will be saved as a new set. Continue?`
      : `Rebuild all ${count} cards of “${editing.name}”? Every card changes and must be reprinted.`;
    if (!confirm(msg)) return;
    try {
      // Songs removed from this set earlier stay removed after a rebuild.
      const removed = new Set(editing.songs?.filter((x) => x.excluded).map((x) => x.id));
      const src = { ...pool, songs: pool.songs.map((x) => (removed.has(x.id) ? { ...x, excluded: true } : x)) };
      const res = generateCardSet(src, layout, { seed, count, startNumber, name: editing.name });
      res.set.songs = [...(res.set.songs ?? []), ...src.songs.filter((x) => x.excluded && removed.has(x.id))];
      const names = (await listCardSets()).map((x) => x.name);
      const cs: CardSet = {
        ...res.set, style, ...(chosen.length > 1 ? { poolIds: chosen.map((p) => p.id) } : {}),
        ...(used ? { name: nextVersionName(editing.name, names) } : { id: editing.id, name: editing.name, createdAt: editing.createdAt }),
      };
      await saveCardSet(cs);
      if (res.capped) alert(res.message);
      nav(`/sets/${cs.id}`);
    } catch (e) {
      setErr(e instanceof PoolTooSmallError ? e.message : String(e));
    }
  };

  if (!pools.length) return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <PageHeader title="Cards" />
      <div className="panel p-10 text-center"><p className="mb-4">Cards are made from a playlist. Build one first.</p><Link to="/pools" className="btn btn-a">Go to playlists</Link></div>
    </main>
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <PageHeader title="Cards">
        {editing ? (
          <>
            <Link to={`/sets/${editing.id}`} className="btn">Cancel</Link>
            <button type="button" className="btn btn-b" disabled={!validation?.ok} onClick={rebuild}>Rebuild cards</button>
          </>
        ) : (
          <>
            <button type="button" className="btn" disabled={!validation?.ok} onClick={() => generate(false)}>Save cards</button>
            <button type="button" className="btn btn-b" disabled={!validation?.ok} onClick={() => generate(true)}>Make {count} cards &amp; print</button>
          </>
        )}
      </PageHeader>
      {editing && <p className="mb-4 rounded-lg border border-deck-a/40 bg-deck-a/10 px-3 py-2 text-sm">Changing the layout of “{editing.name}”. Rebuilding replaces every card with the same numbers — reprint them all afterwards.</p>}
      {err && <p role="alert" className="mb-4 text-deck-b">{err}</p>}
      {saved && <p role="status" className="mb-4 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-ok">{saved}</p>}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
          <Section title="Playlist and layout">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-1 sm:col-span-2">
                <span className="label">Playlists — pick one, or several to give each column its own playlist</span>
                <div className="flex flex-wrap gap-1.5">
                  {pools.map((p) => (
                    <label key={p.id} className={`chip cursor-pointer ${poolIds.includes(p.id) ? 'border-deck-b text-deck-b' : ''}`}>
                      <input type="checkbox" className="sr-only" checked={poolIds.includes(p.id)} onChange={() => togglePool(p.id)} aria-label={`${p.name} (${p.songs.length} songs)`} />
                      {poolIds.includes(p.id) ? '✓ ' : ''}{p.name} <span className="text-dim">{p.songs.length}</span>
                    </label>
                  ))}
                </div>
                {chosen.length > 1 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" className="btn text-xs" onClick={perColumn}>One playlist per column</button>
                    <span className="text-xs text-dim">{combined!.songs.filter((x) => !x.excluded).length} songs from {chosen.length} playlists. Each playlist is also a category you can pick per column below.</span>
                  </div>
                )}
              </div>
              <div className="flex min-w-0 flex-col gap-1" role="group" aria-labelledby="card-size-label">
                <span id="card-size-label" className="label">Card size</span>
                <div className="flex gap-1.5">
                  {([3, 4, 5] as const).map((n) => <button key={n} type="button" className="chip" aria-pressed={layout.size === n} onClick={() => set('size', n)}>{n}×{n}</button>)}
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              <span className="label">Across the top</span>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {HEADER_MODES.map((m) => (
                  <button key={m.id} type="button" onClick={() => set('headerMode', m.id)}
                    className={`rounded-xl border p-3 text-left ${layout.headerMode === m.id ? 'border-deck-b bg-deck-b/10' : 'border-rail hover:border-dim'}`}>
                    <div className="font-semibold">{m.label}</div><div className="text-xs text-dim">{m.hint}</div>
                  </button>
                ))}
              </div>
            </div>
            {layout.headerMode === 'categories' && pool && (
              <div className="mt-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="label">Column categories</span>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn text-xs" onClick={decadeDash} title="Tags songs by release year and makes each column a decade">Decade Dash</button>
                  </div>
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${layout.size}, minmax(0,1fr))` }}>
                  {Array.from({ length: layout.size }, (_, i) => (
                    <select key={i} aria-label={`Column ${i + 1} category`} value={layout.columnCategories[i] ?? ''}
                      onChange={(e) => set('columnCategories', layout.columnCategories.map((c, j) => (j === i ? e.target.value : c)))}>
                      <option value="">—</option>
                      {pool.categories.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  ))}
                </div>
                {pool.categories.length === 0 && <p className="mt-2 text-sm text-peak">This playlist has no categories yet. Add some in the playlist, or try Decade Dash.</p>}
              </div>
            )}
            {layout.headerMode === 'theme' && pool && (
              <Field label="Theme">
                <select aria-label="Theme" value={layout.themeCategory ?? ''} onChange={(e) => set('themeCategory', e.target.value)}>
                  <option value="">Whole playlist ({pool.songs.filter((x) => !x.excluded).length} songs)</option>
                  {pool.categories.map((c) => <option key={c} value={c}>{c} ({pool.songs.filter((x) => !x.excluded && x.categories.includes(c)).length} songs)</option>)}
                </select>
              </Field>
            )}
            {layout.headerMode === 'letters' && (
              <div className="mt-4"><Field label={`Header word (${layout.size} letters)`}>
                <input value={layout.letters} maxLength={layout.size} onChange={(e) => set('letters', e.target.value.toUpperCase())} className="w-40 font-display tracking-widest" />
              </Field></div>
            )}
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Squares show">
                <select value={layout.cellContent} onChange={(e) => set('cellContent', e.target.value as CellContent)}>
                  {CONTENT.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Free center square">
                <div className="flex items-center gap-2">
                  <input type="checkbox" aria-label="Free center square" checked={layout.freeCenter} disabled={layout.size === 4} onChange={(e) => set('freeCenter', e.target.checked)} />
                  <input aria-label="Free square text" value={layout.freeText} onChange={(e) => set('freeText', e.target.value)} disabled={!layout.freeCenter || layout.size === 4} className="flex-1" />
                </div>
              </Field>
            </div>
            {validation && (
              <div className={`mt-4 rounded-xl border p-3 text-sm ${validation.ok ? 'border-ok/40' : 'border-deck-b/60'}`}>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {validation.columns.map((c, i) => (
                    <span key={i} className={c.available < c.needed ? 'text-deck-b' : 'text-dim'}>{c.label}: {c.available}/{c.needed}+</span>
                  ))}
                </div>
                {validation.messages.map((m, i) => <p key={i} className="mt-1 text-deck-b">{m}</p>)}
                {pool && !validation.ok && chosen.length === 1 && <Link to={`/pools/${pool.id}`} className="mt-2 inline-block text-deck-a underline">Add songs to {pool.name}</Link>}
              </div>
            )}
          </Section>

          <Section title="How many">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Number of cards"><NumberInput value={count} min={1} max={4999 - startNumber + 1} onChange={setCount} className="w-full" /></Field>
              <Field label="First card number"><NumberInput value={startNumber} min={1} max={4999} onChange={setStartNumber} className="w-full" /></Field>
              <Field label="Shuffle">
                <button type="button" className="btn" onClick={() => setSeed(randomSeed())}>Reshuffle cards</button>
              </Field>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[14rem_1fr] sm:items-center">
              <Field label="Forecast for pattern">
                <select value={pattern} onChange={(e) => setPattern(e.target.value)}>
                  {PATTERNS.filter((p) => p.id !== 'custom').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              {est && (
                <p className="text-sm">
                  First bingo usually around <strong className="text-deck-a">song {est.median}</strong>
                  <span className="text-dim"> (range {est.min}–{est.max}), about {est.avgWinners.toFixed(1)} winner{est.avgWinners >= 1.5 ? 's' : ''} at once.</span>
                  {est.avgWinners >= 2 && <span className="block text-peak">Lots of ties — try fewer cards, more songs, or a harder pattern.</span>}
                  {est.median > 0 && est.median < 8 && <span className="block text-peak">That’s very fast — add songs or pick a harder pattern.</span>}
                </p>
              )}
            </div>
          </Section>

          <Section title="Look">
            <StyleControls style={style} onChange={setStyle} layout={layout} />
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-20 lg:h-fit">
          <div className="panel p-4">
            <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Preview</h2><span className="text-sm text-dim">card {cardNo(startNumber)}</span></div>
            {preview && pool
              ? <div className="mx-auto aspect-[8.5/11] max-h-[70vh] w-full"><CardGrid card={preview} layout={layout} songsById={songsById} style={style} /></div>
              : <p className="py-16 text-center text-dim">Fix the layout warnings to see a card.</p>}
          </div>
          {sets.length > 0 && (
            <div className="panel p-4">
              <h2 className="mb-2 font-bold">Saved card sets</h2>
              <ul className="grid grid-cols-1 gap-1.5 text-sm">
                {sets.map((s) => (
                  <li key={s.id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate">{s.name} <span className="text-dim">· {s.cards.length} cards · {new Date(s.createdAt).toLocaleDateString()}</span></span>
                    <Link to={`/sets/${s.id}`} className="btn px-2 py-1 text-xs">Edit</Link>
                    <Link to={`/print/${s.id}`} className="btn px-2 py-1 text-xs">Print</Link>
                    <button type="button" className="btn px-2 py-1 text-xs" aria-label={`Delete ${s.name}`}
                      onClick={async () => { if (confirm('Delete this card set? Games that used it can no longer check cards.')) { await deleteCardSet(s.id); setSets(await listCardSets()); } }}>✕</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
