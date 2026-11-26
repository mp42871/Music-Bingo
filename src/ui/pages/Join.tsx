import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { phoneCard, phoneDefToPool } from '../../core/phone';
import { DEFAULT_STYLE } from '../../core/style';
import { joinBackendFor } from '../../live/config';
import { pickFreeNumber, type LiveBackend, type LiveGame } from '../../live/types';
import { CardGrid, cardNo } from '../components/CardGrid';

interface MyCard { number: number; marks: number[]; history: number[] }
interface Saved { name: string; cards: MyCard[]; active: number }

const key = (code: string) => `mb.join.${code}`;
const load = (code: string): Saved => {
  try { return { name: '', cards: [], active: 0, ...JSON.parse(localStorage.getItem(key(code)) ?? '{}') }; } catch { return { name: '', cards: [], active: 0 }; }
};
const store = (code: string, s: Saved) => { try { localStorage.setItem(key(code), JSON.stringify(s)); } catch { /* private mode */ } };

export default function Join() {
  const { code } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [backend, setBackend] = useState<LiveBackend | null | undefined>(undefined);
  const [game, setGame] = useState<LiveGame | null | undefined>(undefined);
  const [typed, setTyped] = useState('');
  const [saved, setSaved] = useState<Saved>(() => (code ? load(code) : { name: '', cards: [], active: 0 }));
  const [adding, setAdding] = useState(false);
  const [num, setNum] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState(0);

  useEffect(() => { void joinBackendFor(params.get('p')).then(setBackend); }, [params]);
  useEffect(() => {
    if (!code || backend === undefined) return;
    if (!backend) { setGame(null); return; }
    setSaved(load(code));
    backend.getGame(code).then((g) => setGame(g)).catch((e) => { setErr(e instanceof Error ? e.message : String(e)); setGame(null); });
  }, [code, backend]);

  const update = (s: Saved) => { setSaved(s); if (code) store(code, s); };
  const pool = useMemo(() => (game ? phoneDefToPool(game.def) : null), [game]);
  const songs = useMemo(() => new Map(pool?.songs.map((s) => [s.id, s])), [pool]);

  if (!code) return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="font-display text-4xl"><span className="text-deck-a">Music</span> <span className="text-deck-b">Bingo</span></h1>
      <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); if (typed.trim()) nav(`/join/${typed.trim()}${params.get('p') ? `?p=${params.get('p')}` : ''}`); }}>
        <label className="grid gap-1"><span className="label">Game code</span>
          <input aria-label="Game code" inputMode="numeric" autoFocus value={typed} onChange={(e) => setTyped(e.target.value.replace(/\D/g, '').slice(0, 6))} className="font-display text-4xl tracking-widest" placeholder="4821" />
        </label>
        <button className="btn btn-b py-3 text-lg" disabled={!typed}>Join</button>
      </form>
    </main>
  );

  if (game === undefined) return <main className="p-6 text-dim">Finding game {code}…</main>;
  if (!game) return (
    <main className="mx-auto max-w-md p-6">
      <p className="text-lg">{err ?? (backend ? `No game with code ${code}. Check the code on the big screen.` : `No game with code ${code} on this site. Scan the QR code on the big screen instead.`)}</p>
      <button type="button" className="btn mt-4" onClick={() => nav('/join')}>Try another code</button>
    </main>
  );
  if (game.status !== 'open') return <main className="mx-auto max-w-md p-6 text-lg">This game has ended. Thanks for playing!</main>;

  const addCard = async (n: number | null) => {
    if (!backend) return;
    setBusy(true); setErr(null);
    try {
      const number = n ?? pickFreeNumber(await backend.takenNumbers(code));
      if (saved.cards.some((c) => c.number === number)) { update({ ...saved, active: saved.cards.findIndex((c) => c.number === number) }); setAdding(false); return; }
      await backend.join(code, number, saved.name);
      const card = phoneCard(game.def, number);
      const free = card.cells.map((c, i) => (c.kind === 'free' ? i : -1)).filter((i) => i >= 0);
      const cards = [...saved.cards, { number, marks: free, history: [] }];
      update({ ...saved, cards, active: cards.length - 1 });
      setAdding(false); setNum('');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const mine = saved.cards[saved.active];
  const card = mine ? phoneCard(game.def, mine.number) : null;
  const marked = card ? card.cells.map((_, i) => mine.marks.includes(i)) : [];
  const setMine = (c: MyCard) => update({ ...saved, cards: saved.cards.map((x, i) => (i === saved.active ? c : x)) });
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
    setMine({ marks: on ? mine.marks.filter((x) => x !== last) : [...mine.marks, last], history: mine.history.slice(0, -1), number: mine.number });
  };
  const clear = () => {
    if (!card || !confirm(`Clear all daubs on card ${cardNo(mine.number)}?`)) return;
    setMine({ ...mine, marks: card.cells.map((c, i) => (c.kind === 'free' ? i : -1)).filter((i) => i >= 0), history: [] });
  };
  const bingo = async () => {
    if (!backend || !mine) return;
    setErr(null);
    try {
      await backend.claim(code, mine.number, saved.name);
      setSentAt(Date.now());
      setMsg(`Sent! The host is checking card ${cardNo(mine.number)}.`);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };
  const recentlySent = Date.now() - sentAt < 15_000;

  const picker = (
    <div className="panel grid gap-3 p-4">
      <label className="grid gap-1"><span className="label">Your first name (optional)</span>
        <input aria-label="Your first name (optional)" value={saved.name} maxLength={40} onChange={(e) => update({ ...saved, name: e.target.value })} />
      </label>
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
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-3 p-3">
      <div className="flex items-center justify-between px-1 pt-2">
        <h1 className="font-display text-xl">{game.title}</h1>
        <span className="chip text-xs">Game {code}</span>
      </div>
      {err && <p role="alert" className="rounded-lg border border-deck-b/50 bg-deck-b/10 px-3 py-2">{err}</p>}
      {(saved.cards.length === 0 || adding) ? picker : (
        <>
          <div role="tablist" aria-label="Your cards" className="flex flex-wrap items-center gap-1">
            {saved.cards.map((c, i) => (
              <button key={c.number} type="button" role="tab" aria-selected={i === saved.active} className="chip font-mono" aria-pressed={i === saved.active}
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
                <CardGrid card={card} layout={game.def.layout} songsById={songs} style={{ ...DEFAULT_STYLE, title: game.title }} marked={marked} onToggle={toggle} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="btn" disabled={!mine.history.length} onClick={undo}>Undo</button>
                <button type="button" className="btn" onClick={clear}>Clear card</button>
              </div>
              <button type="button" className="btn btn-b py-4 font-display text-3xl" disabled={recentlySent} onClick={bingo}>BINGO!</button>
              {msg && recentlySent && <p role="status" className="text-center text-ok">{msg}</p>}
            </>
          )}
        </>
      )}
    </main>
  );
}
