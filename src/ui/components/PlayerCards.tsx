import { useMemo, useState } from 'react';
import { phoneCard, phoneDefToPool, type PhoneDef } from '../../core/phone';
import { DEFAULT_STYLE } from '../../core/style';
import { pickFreeNumber } from '../../live/types';
import { CardGrid, cardNo } from './CardGrid';

interface MyCard { number: number; marks: number[]; history: number[] }
interface Saved { name: string; cards: MyCard[]; active: number }

const load = (key: string): Saved => {
  try { return { name: '', cards: [], active: 0, ...JSON.parse(localStorage.getItem(key) ?? '{}') }; } catch { return { name: '', cards: [], active: 0 }; }
};
const store = (key: string, s: Saved) => { try { localStorage.setItem(key, JSON.stringify(s)); } catch { /* private mode */ } };

/**
 * A player's cards on a phone: pick a number or get a random one, several cards in tabs,
 * tap to daub, Undo, Clear. With live play, joining and BINGO go to the host; without, BINGO says "shout".
 */
export function PlayerCards({ def, storageKey, live }: {
  def: PhoneDef; storageKey: string;
  live?: { taken(): Promise<number[]>; join(n: number, name: string): Promise<void>; claim(n: number, name: string): Promise<void> };
}) {
  const [saved, setSaved] = useState<Saved>(() => load(storageKey));
  const [adding, setAdding] = useState(false);
  const [num, setNum] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState(0);
  const pool = useMemo(() => phoneDefToPool(def), [def]);
  const songs = useMemo(() => new Map(pool.songs.map((s) => [s.id, s])), [pool]);

  const update = (s: Saved) => { setSaved(s); store(storageKey, s); };

  const addCard = async (n: number | null) => {
    setBusy(true); setErr(null);
    try {
      const number = n ?? pickFreeNumber(live ? await live.taken() : saved.cards.map((c) => c.number));
      const existing = saved.cards.findIndex((c) => c.number === number);
      if (existing >= 0) { update({ ...saved, active: existing }); setAdding(false); return; }
      await live?.join(number, saved.name);
      const card = phoneCard(def, number);
      const free = card.cells.map((c, i) => (c.kind === 'free' ? i : -1)).filter((i) => i >= 0);
      const cards = [...saved.cards, { number, marks: free, history: [] }];
      update({ ...saved, cards, active: cards.length - 1 });
      setAdding(false); setNum('');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const mine = saved.cards[Math.min(saved.active, saved.cards.length - 1)];
  const card = mine ? phoneCard(def, mine.number) : null;
  const marked = card ? card.cells.map((_, i) => mine.marks.includes(i)) : [];
  const setMine = (c: MyCard) => update({ ...saved, cards: saved.cards.map((x) => (x.number === mine.number ? c : x)) });
  const toggle = (i: number) => {
    if (!card || card.cells[i].kind === 'free') return;
    const on = mine.marks.includes(i);
    setMine({ ...mine, marks: on ? mine.marks.filter((x) => x !== i) : [...mine.marks, i], history: [...mine.history, i] });
    navigator.vibrate?.(12);
  };
  const undo = () => {
    const last = mine.history.at(-1);
    if (last === undefined) return;
    const on = mine.marks.includes(last);
    setMine({ number: mine.number, marks: on ? mine.marks.filter((x) => x !== last) : [...mine.marks, last], history: mine.history.slice(0, -1) });
  };
  const clear = () => {
    if (!card || !confirm(`Clear all daubs on card ${cardNo(mine.number)}?`)) return;
    setMine({ ...mine, marks: card.cells.map((c, i) => (c.kind === 'free' ? i : -1)).filter((i) => i >= 0), history: [] });
  };
  const bingo = async () => {
    if (!mine) return;
    setErr(null);
    if (!live) { setSentAt(Date.now()); setMsg(`Shout BINGO and show the host card ${cardNo(mine.number)}!`); return; }
    try {
      await live.claim(mine.number, saved.name);
      setSentAt(Date.now());
      setMsg(`Sent! The host is checking card ${cardNo(mine.number)}.`);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };
  const recentlySent = Date.now() - sentAt < 15_000;

  const picker = (
    <div className="panel grid gap-3 p-4">
      {live && (
        <label className="grid gap-1"><span className="label">Your first name (optional)</span>
          <input aria-label="Your first name (optional)" value={saved.name} maxLength={40} onChange={(e) => update({ ...saved, name: e.target.value })} />
        </label>
      )}
      <div className="grid gap-1">
        <span className="label">Have a paper card? Type its number</span>
        <div className="flex gap-2">
          <input aria-label="Card number" inputMode="numeric" value={num} onChange={(e) => setNum(e.target.value.replace(/\D/g, '').slice(0, 4))} className="w-28 font-display text-2xl" placeholder="0042" />
          <button type="button" className="btn" disabled={!num || busy || Number(num) < 1} onClick={() => addCard(Number(num))}>Use this card</button>
        </div>
      </div>
      <button type="button" className="btn btn-b py-3 text-lg" disabled={busy} onClick={() => addCard(null)}>Give me a random card</button>
      {saved.cards.length > 0 && <button type="button" className="btn text-sm" onClick={() => setAdding(false)}>Cancel</button>}
    </div>
  );

  return (
    <>
      {err && <p role="alert" className="rounded-lg border border-deck-b/50 bg-deck-b/10 px-3 py-2">{err}</p>}
      {(saved.cards.length === 0 || adding) ? picker : (
        <>
          <div role="tablist" aria-label="Your cards" className="flex flex-wrap items-center gap-1">
            {saved.cards.map((c, i) => (
              <button key={c.number} type="button" role="tab" aria-selected={c.number === mine.number} className="chip font-mono" aria-pressed={c.number === mine.number}
                onClick={() => update({ ...saved, active: i })}>{cardNo(c.number)}</button>
            ))}
            <button type="button" className="chip" onClick={() => setAdding(true)}>+ Add a card</button>
          </div>
          {card && (
            <>
              <div className="flex items-center justify-between px-1">
                <span className="text-sm text-dim">Tap a square when you hear that song</span>
                <span data-testid="card-number" className="font-display text-3xl text-deck-a">{cardNo(card.number)}</span>
              </div>
              <div className="aspect-square w-full">
                <CardGrid card={card} layout={def.layout} songsById={songs} style={{ ...DEFAULT_STYLE, title: def.title }} marked={marked} onToggle={toggle} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="btn" disabled={!mine.history.length} onClick={undo}>Undo</button>
                <button type="button" className="btn" onClick={clear}>Clear card</button>
              </div>
              <button type="button" className="btn btn-b py-4 font-display text-3xl" disabled={recentlySent && !!live} onClick={bingo}>BINGO!</button>
              {msg && recentlySent && <p role="status" className="text-center text-xl text-ok">{msg}</p>}
            </>
          )}
        </>
      )}
    </>
  );
}
