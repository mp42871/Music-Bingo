import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { addCards, nextVersionName, swapSong, SwapError } from '../../core/cardEdit';
import { cleanTitle } from '../../core/io';
import { uid } from '../../core/rng';
import { DEFAULT_STYLE } from '../../core/style';
import type { CardSet, PrintStyle } from '../../core/types';
import { getCardSet, listCardSets, listGames, saveCardSet } from '../../db/repo';
import { CardGrid, cardNo } from '../components/CardGrid';
import { Field, PageHeader, Section } from '../components/Field';
import { NumberInput } from '../components/NumberInput';
import { StyleControls } from '../components/StyleControls';

const range = (ns: number[]) => {
  if (!ns.length) return '';
  const sorted = [...ns].sort((a, b) => a - b);
  const contiguous = sorted.every((n, i) => i === 0 || n === sorted[i - 1] + 1);
  return contiguous && sorted.length > 1 ? `${sorted[0]}-${sorted.at(-1)}` : sorted.join(',');
};

export default function SetEditor() {
  const { id } = useParams();
  const [set, setSet] = useState<CardSet | null>(null);
  const [missing, setMissing] = useState(false);
  const [used, setUsed] = useState(false);
  const [name, setName] = useState('');
  const [style, setStyle] = useState<PrintStyle>(DEFAULT_STYLE);
  const [lookMsg, setLookMsg] = useState<string | null>(null);
  const [more, setMore] = useState(10);
  const [addMsg, setAddMsg] = useState<{ text: string; link?: string } | null>(null);
  const [target, setTarget] = useState('');
  const [replacement, setReplacement] = useState('');
  const [swapMsg, setSwapMsg] = useState<{ text: string; link?: string; editLink?: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getCardSet(id!).then((s) => {
      if (!s) return setMissing(true);
      setSet(s); setName(s.name); setStyle({ ...DEFAULT_STYLE, ...s.style });
    });
    listGames().then((gs) => setUsed(gs.some((g) => g.cardSetId === id)));
  }, [id]);

  const songs = useMemo(() => new Map(set?.songs?.map((s) => [s.id, s])), [set]);
  const artistMode = set?.layout.cellContent === 'artistBingo';
  const onCards = useMemo(() => {
    if (!set) return [] as { key: string; label: string }[];
    const keys = new Set<string>();
    for (const c of set.cards) for (const x of c.cells) {
      if (x.kind === 'song') keys.add(x.songId); else if (x.kind === 'artist') keys.add(x.artist);
    }
    return [...keys].map((k) => {
      const s = songs.get(k);
      return { key: k, label: artistMode || !s ? k : `${s.displayTitle ?? cleanTitle(s.title)} — ${s.artist}` };
    }).sort((a, b) => a.label.localeCompare(b.label));
  }, [set, songs, artistMode]);
  const replacements = useMemo(() => {
    if (!set?.songs) return [];
    if (artistMode) return [...new Set(set.songs.filter((s) => !s.excluded).map((s) => s.artist))].filter((a) => a !== target).sort().map((a) => ({ key: a, label: a }));
    return set.songs.filter((s) => !s.excluded && s.id !== target)
      .map((s) => ({ key: s.id, label: `${s.displayTitle ?? cleanTitle(s.title)} — ${s.artist}` })).sort((a, b) => a.label.localeCompare(b.label));
  }, [set, target, artistMode]);

  if (missing) return <main className="mx-auto max-w-5xl px-4 py-6">That card set doesn’t exist. <Link className="text-deck-a underline" to="/designer">Back to cards</Link></main>;
  if (!set) return <main className="mx-auto max-w-5xl px-4 py-6 text-dim">Loading…</main>;

  const saveLook = async () => {
    const next = { ...set, name: name.trim() || set.name, style };
    await saveCardSet(next);
    setSet(next);
    setLookMsg('Saved. The squares on every card are unchanged — reprint whenever you like.');
  };

  const doAdd = async () => {
    setErr(null);
    const r = addCards(set, more);
    if (!r.added.length) return setAddMsg({ text: r.message ?? 'No cards could be added.' });
    await saveCardSet(r.set);
    setSet(r.set);
    const first = cardNo(r.added[0]), last = cardNo(r.added.at(-1)!);
    setAddMsg({ text: `Added cards ${first}${r.added.length > 1 ? `–${last}` : ''}.${r.message ? ` ${r.message}` : ''}`, link: `/print/${set.id}?cards=${range(r.added)}` });
  };

  const doSwap = async (replace: boolean) => {
    setErr(null);
    setSwapMsg(null);
    try {
      const r = swapSong(set, target, replace ? replacement : null);
      if (!r.changed.length) return setSwapMsg({ text: 'That song isn’t on any card.' });
      const label = onCards.find((o) => o.key === target)?.label.split(' — ')[0] ?? target;
      let saved: CardSet = r.set;
      if (used) {
        const names = (await listCardSets()).map((s) => s.name);
        saved = { ...r.set, id: uid(), name: nextVersionName(set.name, names), createdAt: Date.now() };
      }
      await saveCardSet(saved);
      if (!used) setSet(saved);
      const what = replace ? `“${label}” was replaced` : `“${label}” is off the cards`;
      setSwapMsg({
        text: `${what} — ${r.changed.length} card${r.changed.length === 1 ? '' : 's'} changed${used ? `, saved as a new set “${saved.name}”` : ''}.`,
        link: `/print/${saved.id}?cards=${range(r.changed)}`,
        editLink: used ? `/sets/${saved.id}` : undefined,
      });
      setTarget('');
      setReplacement('');
    } catch (e) {
      setErr(e instanceof SwapError ? e.message : String(e));
    }
  };

  const first = set.cards[0];

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <PageHeader title="Edit cards">
        <Link to={`/print/${set.id}`} className="btn">Print all</Link>
        <Link to="/designer" className="btn">Back to cards</Link>
      </PageHeader>
      <p className="mb-4 text-dim">{set.name} · {set.cards.length} cards ({cardNo(Math.min(...set.cards.map((c) => c.number)))}–{cardNo(Math.max(...set.cards.map((c) => c.number)))})</p>
      {used && (
        <p className="mb-4 rounded-lg border border-peak/50 bg-peak/10 px-3 py-2 text-sm">
          These cards have already been used in a game. Looks and extra cards change this set; swapping songs or changing the layout saves a new version so that game’s history and claim checks stay correct.
        </p>
      )}
      {err && <p role="alert" className="mb-4 text-deck-b">{err}</p>}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
          <Section title="Name and look">
            <div className="mb-4"><Field label="Set name"><input aria-label="Set name" value={name} onChange={(e) => setName(e.target.value)} /></Field></div>
            <StyleControls style={style} onChange={setStyle} layout={set.layout} />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" className="btn btn-a" onClick={saveLook}>Save look</button>
              {lookMsg && <span role="status" className="text-sm text-ok">{lookMsg}</span>}
            </div>
          </Section>

          <Section title="Add more cards">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="How many cards to add"><NumberInput aria-label="How many cards to add" value={more} min={1} max={2000} onChange={setMore} className="w-28" /></Field>
              <button type="button" className="btn btn-a" onClick={doAdd}>Add cards</button>
            </div>
            <p className="mt-2 text-xs text-dim">New cards continue the numbering. Cards you already printed don’t change.</p>
            {addMsg && (
              <p role="status" className="mt-3 text-sm">{addMsg.text} {addMsg.link && <Link to={addMsg.link} className="text-deck-a underline">Print only the new cards</Link>}</p>
            )}
          </Section>

          <Section title="Swap songs">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Song to swap">
                <select aria-label="Song to swap" value={target} onChange={(e) => { setTarget(e.target.value); setSwapMsg(null); }}>
                  <option value="">Choose a {artistMode ? 'artist' : 'song'} on the cards…</option>
                  {onCards.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Replace with (optional)" hint="Cards where it doesn’t fit the column, or that already have it, get another fitting song.">
                <select aria-label="Replace with" value={replacement} disabled={!target} onChange={(e) => setReplacement(e.target.value)}>
                  <option value="">Any song that fits</option>
                  {replacements.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn" disabled={!target} onClick={() => doSwap(false)}>Remove from cards</button>
              <button type="button" className="btn btn-a" disabled={!target || !replacement} onClick={() => doSwap(true)}>Replace</button>
            </div>
            <p className="mt-2 text-xs text-dim">Cards that change need reprinting. A removed song is also left out of future games with this set.</p>
            {swapMsg && (
              <p role="status" className="mt-3 text-sm">{swapMsg.text}{' '}
                {swapMsg.link && <Link to={swapMsg.link} className="text-deck-a underline">Print only changed cards</Link>}
                {swapMsg.editLink && <> · <Link to={swapMsg.editLink} className="text-deck-a underline">Edit the new set</Link></>}
              </p>
            )}
          </Section>

          <Section title="Change layout">
            <p className="mb-3 text-sm text-dim">Change the playlists, card size, columns or theme. This rebuilds every card{used ? ' as a new version' : ''}, so all cards need reprinting.</p>
            <Link to={`/designer?edit=${set.id}`} className="btn">Change layout…</Link>
          </Section>
        </div>
        <div className="panel h-fit p-4 lg:sticky lg:top-20">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Preview</h2><span className="text-sm text-dim">card {cardNo(first.number)}</span></div>
          <div className="mx-auto aspect-[8.5/11] max-h-[70vh] w-full"><CardGrid card={first} layout={set.layout} songsById={songs} style={style} /></div>
        </div>
      </div>
    </main>
  );
}
