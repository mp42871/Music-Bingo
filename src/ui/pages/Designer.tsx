import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { generateCard, generateCardSet, PoolTooSmallError, validatePool } from '../../core/cards';
import { decadesIn, tagDecades } from '../../core/decades';
import { estimate } from '../../core/forecast';
import { masksFor, PATTERNS } from '../../core/patterns';
import { randomSeed } from '../../core/rng';
import { DEFAULT_STYLE, THEMES } from '../../core/style';
import type { CardLayout, CardSet, CellContent, HeaderMode, Pool, PrintStyle } from '../../core/types';
import { deleteCardSet, getSetting, listCardSets, listPools, saveCardSet, savePool, setSetting } from '../../db/repo';
import { CardGrid, cardNo } from '../components/CardGrid';
import { Field, PageHeader, Section } from '../components/Field';
import { NumberInput } from '../components/NumberInput';

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
  const [poolId, setPoolId] = useState(params.get('pool') ?? '');
  const [layout, setLayout] = useState<CardLayout>(DEFAULT_LAYOUT);
  const [style, setStyle] = useState<PrintStyle>(DEFAULT_STYLE);
  const [count, setCount] = useState(40);
  const [startNumber, setStartNumber] = useState(1);
  const [seed, setSeed] = useState(randomSeed());
  const [pattern, setPattern] = useState('line');
  const [sets, setSets] = useState<CardSet[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    listPools().then((ps) => { setPools(ps); if (!poolId && ps[0]) setPoolId(ps[0].id); });
    listCardSets().then(setSets);
    getSetting('printStyle', DEFAULT_STYLE).then((s) => setStyle({ ...DEFAULT_STYLE, ...s }));
    getSetting('layout', DEFAULT_LAYOUT).then((l) => setLayout({ ...DEFAULT_LAYOUT, ...l }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pool = pools.find((p) => p.id === poolId);
  const songsById = useMemo(() => new Map(pool?.songs.map((s) => [s.id, s])), [pool]);

  // Keep column categories sensible for the chosen pool.
  useEffect(() => {
    if (!pool) return;
    setLayout((l) => {
      const cats = Array.from({ length: l.size }, (_, i) => (pool.categories.includes(l.columnCategories[i]) ? l.columnCategories[i] : pool.categories[i % Math.max(1, pool.categories.length)] ?? ''));
      const theme = l.themeCategory && pool.categories.includes(l.themeCategory) ? l.themeCategory : pool.categories[0];
      return { ...l, columnCategories: cats, themeCategory: theme };
    });
  }, [pool, layout.size]);

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
  const st = <K extends keyof PrintStyle>(k: K, v: PrintStyle[K]) => setStyle((s) => ({ ...s, [k]: v }));

  const decadeDash = async () => {
    if (!pool) return;
    const tagged = tagDecades(pool);
    await savePool(tagged);
    setPools((ps) => ps.map((p) => (p.id === tagged.id ? tagged : p)));
    const decades = decadesIn(tagged);
    setLayout((l) => ({ ...l, headerMode: 'categories', columnCategories: Array.from({ length: l.size }, (_, i) => decades[i] ?? decades[decades.length - 1] ?? '') }));
  };

  const generate = async () => {
    if (!pool) return;
    setErr(null);
    try {
      const res = generateCardSet(pool, layout, { seed, count, startNumber, name: `${style.title || pool.name} · ${pool.name}` });
      const cs: CardSet = { ...res.set, style };
      await saveCardSet(cs);
      await setSetting('printStyle', style);
      await setSetting('layout', layout);
      if (res.capped) alert(res.message);
      nav(`/print/${cs.id}`);
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
        <button type="button" className="btn btn-b" disabled={!validation?.ok} onClick={generate}>Make {count} cards &amp; print</button>
      </PageHeader>
      {err && <p role="alert" className="mb-4 text-deck-b">{err}</p>}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
          <Section title="Playlist and layout">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Playlist">
                <select value={poolId} onChange={(e) => setPoolId(e.target.value)}>
                  {pools.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.songs.length})</option>)}
                </select>
              </Field>
              <Field label="Card size">
                <div className="flex gap-1.5">
                  {([3, 4, 5] as const).map((n) => <button key={n} type="button" className="chip" aria-pressed={layout.size === n} onClick={() => set('size', n)}>{n}×{n}</button>)}
                </div>
              </Field>
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
                  <button type="button" className="btn text-xs" onClick={decadeDash} title="Tags songs by release year and makes each column a decade">Decade Dash</button>
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
              <Field label="Theme category">
                <select value={layout.themeCategory ?? ''} onChange={(e) => set('themeCategory', e.target.value)}>
                  {pool.categories.map((c) => <option key={c}>{c}</option>)}
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
                {validation.messages.map((m) => <p key={m} className="mt-1 text-deck-b">{m}</p>)}
                {pool && !validation.ok && <Link to={`/pools/${pool.id}`} className="mt-2 inline-block text-deck-a underline">Add songs to {pool.name}</Link>}
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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {THEMES.map((t) => (
                <button key={t.id} type="button" onClick={() => st('theme', t.id)}
                  className={`flex items-center gap-3 rounded-xl border p-2.5 text-left ${style.theme === t.id ? 'border-deck-b' : 'border-rail hover:border-dim'}`}>
                  <span className="flex h-8 w-12 overflow-hidden rounded" style={{ background: t.bg }}>
                    <span className="m-1 w-3 rounded-sm" style={{ background: t.accent }} /><span className="my-1 w-3 rounded-sm" style={{ background: t.accent2 }} />
                  </span>
                  <span className="text-sm font-semibold">{t.name}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Title"><input value={style.title} onChange={(e) => st('title', e.target.value)} /></Field>
              <Field label="Subtitle (event, date, charity…)"><input value={style.subtitle} onChange={(e) => st('subtitle', e.target.value)} /></Field>
              <Field label="Accent color">
                <div className="flex items-center gap-2">
                  <input type="color" aria-label="Accent color" value={style.accent || '#2de2ff'} onChange={(e) => st('accent', e.target.value)} className="h-9 w-14 p-1" />
                  {style.accent && <button type="button" className="text-xs text-dim underline" onClick={() => st('accent', '')}>theme default</button>}
                </div>
              </Field>
              <Field label="Background color">
                <div className="flex items-center gap-2">
                  <input type="color" aria-label="Background color" value={style.background || '#ffffff'} onChange={(e) => st('background', e.target.value)} className="h-9 w-14 p-1" />
                  {style.background && <button type="button" className="text-xs text-dim underline" onClick={() => st('background', '')}>theme default</button>}
                </div>
              </Field>
              <Field label="Logo (optional)">
                <div className="flex items-center gap-2">
                  <input type="file" accept="image/*" aria-label="Logo" onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const r = new FileReader();
                    r.onload = () => st('logoDataUrl', String(r.result));
                    r.readAsDataURL(f);
                  }} />
                  {style.logoDataUrl && <button type="button" className="text-xs text-dim underline" onClick={() => st('logoDataUrl', undefined)}>remove</button>}
                </div>
              </Field>
              <Field label="Paper and layout">
                <div className="flex gap-2">
                  <select aria-label="Paper size" value={style.paper} onChange={(e) => st('paper', e.target.value as PrintStyle['paper'])}>
                    <option value="letter">US Letter</option><option value="a4">A4</option>
                  </select>
                  <select aria-label="Cards per page" value={style.perPage} onChange={(e) => st('perPage', Number(e.target.value) as PrintStyle['perPage'])}>
                    <option value={1}>1 per page</option><option value={2}>2 per page</option><option value={4}>4 per page</option><option value={6}>6 per page</option>
                  </select>
                </div>
              </Field>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={style.inkSaver} onChange={(e) => st('inkSaver', e.target.checked)} /> Ink saver (white background)</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={style.cutLines} onChange={(e) => st('cutLines', e.target.checked)} /> Cut lines</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={style.showArt} onChange={(e) => st('showArt', e.target.checked)} /> Album art squares</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={style.bonusCorners} onChange={(e) => st('bonusCorners', e.target.checked)} /> Bonus corners ★</label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={style.mysteryColumn !== null} disabled={layout.headerMode !== 'categories'}
                  onChange={(e) => st('mysteryColumn', e.target.checked ? layout.size - 1 : null)} /> Mystery column
                {style.mysteryColumn !== null && (
                  <select aria-label="Mystery column" value={style.mysteryColumn} onChange={(e) => st('mysteryColumn', Number(e.target.value))}>
                    {Array.from({ length: layout.size }, (_, i) => <option key={i} value={i}>Column {i + 1}</option>)}
                  </select>
                )}
              </label>
            </div>
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
