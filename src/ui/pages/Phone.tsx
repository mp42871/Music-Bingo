import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { generateCard } from '../../core/cards';
import { decodePhoneDef, phoneCardNumber, phoneDefToPool, type PhoneDef } from '../../core/phone';
import { hashSeed } from '../../core/rng';
import { DEFAULT_STYLE } from '../../core/style';
import type { Card } from '../../core/types';
import { CardGrid, cardNo } from '../components/CardGrid';

function load<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function store(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } }

export default function Phone() {
  const [params] = useSearchParams();
  const raw = params.get('d') ?? '';
  const def = useMemo<PhoneDef | null>(() => { try { return decodePhoneDef(raw); } catch { return null; } }, [raw]);
  const key = def ? `mb.phone.${hashSeed(def.seed, def.title, def.s.length)}` : '';

  const card = useMemo<Card | null>(() => {
    if (!def) return null;
    let number = load<number | null>(`${key}.number`, null);
    if (!number) { number = phoneCardNumber(Math.random); store(`${key}.number`, number); }
    try { return generateCard(phoneDefToPool(def), def.layout, def.seed, number); } catch { return null; }
  }, [def, key]);

  const [marked, setMarked] = useState<boolean[]>([]);
  useEffect(() => {
    if (!card) return;
    const saved = load<boolean[]>(`${key}.marks`, []);
    setMarked(card.cells.map((c, i) => c.kind === 'free' || !!saved[i]));
  }, [card, key]);

  if (!def || !card) return (
    <main className="grid min-h-screen place-items-center p-6 text-center">
      <div><div className="font-display text-3xl text-deck-b">Oops</div><p className="mt-2 text-dim">This card link is broken — ask the host for a new QR code.</p></div>
    </main>
  );

  const songs = new Map(phoneDefToPool(def).songs.map((s) => [s.id, s]));
  const toggle = (i: number) => {
    if (card.cells[i].kind === 'free') return;
    const next = marked.map((m, j) => (j === i ? !m : m));
    setMarked(next);
    store(`${key}.marks`, next);
    navigator.vibrate?.(15);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 p-3">
      <div className="flex items-center justify-between px-1 pt-2">
        <div className="font-display text-xl">{def.title}</div>
        <div data-testid="card-number" className="font-display text-2xl text-deck-a">{cardNo(card.number)}</div>
      </div>
      <div className="aspect-square w-full">
        <CardGrid card={card} layout={def.layout} songsById={songs} style={{ ...DEFAULT_STYLE, title: def.title }} marked={marked} onToggle={toggle} />
      </div>
      <p className="px-1 text-center text-sm text-dim">Tap a square when you hear that song. Got a pattern? Shout BINGO and show the host card {cardNo(card.number)}.</p>
      <button type="button" className="btn mx-auto text-sm" onClick={() => { if (confirm('Clear all your daubs?')) { const cleared = card.cells.map((c) => c.kind === 'free'); setMarked(cleared); store(`${key}.marks`, cleared); } }}>Clear daubs</button>
    </main>
  );
}
