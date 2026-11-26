import { cardSignature, freeIndex, generateCard, MAX_PRINTED, songsForColumn } from './cards';
import { setPool } from './claim';
import { hashSeed, mulberry32 } from './rng';
import type { CardSet, Cell } from './types';

export class SwapError extends Error {
  constructor(message: string) { super(message); this.name = 'SwapError'; }
}

/** Adds cards after the highest number, never duplicating an existing card. */
export function addCards(set: CardSet, count: number): { set: CardSet; added: number[]; message?: string } {
  const pool = setPool(set);
  const seen = new Set(set.cards.map(cardSignature));
  const start = Math.max(0, ...set.cards.map((c) => c.number)) + 1;
  const room = Math.max(0, MAX_PRINTED - start + 1);
  const want = Math.min(count, room);
  const cards = [...set.cards];
  const added: number[] = [];
  let message: string | undefined;
  for (let i = 0; i < want; i++) {
    const number = start + i;
    let card = generateCard(pool, set.layout, set.seed, number);
    for (let attempt = 1; seen.has(cardSignature(card)) && attempt <= 50; attempt++)
      card = generateCard(pool, set.layout, hashSeed(set.seed, 'more', attempt), number);
    if (seen.has(cardSignature(card))) { message = `Only ${added.length} more unique cards are possible with these songs — add songs for more.`; break; }
    seen.add(cardSignature(card));
    cards.push(card);
    added.push(number);
  }
  if (!message && want < count) message = `Printed card numbers stop at ${MAX_PRINTED}, so ${added.length} cards were added.`;
  return { set: { ...set, cards }, added, message };
}

/**
 * Removes a song (or artist, in artist bingo) from every card, or replaces it with a chosen one.
 * Each affected square gets a song that fits its column and isn't already on that card.
 */
export function swapSong(set: CardSet, key: string, replacement: string | null): { set: CardSet; changed: number[] } {
  const pool = setPool(set);
  const artistMode = set.layout.cellContent === 'artistBingo';
  const n = set.layout.size;
  const free = freeIndex(set.layout);
  const colKeys = Array.from({ length: n }, (_, c) => {
    const songs = songsForColumn(pool, set.layout, c);
    return artistMode ? [...new Set(songs.map((s) => s.artist))].sort() : songs.map((s) => s.id);
  });
  const toCell = (k: string): Cell => (artistMode ? { kind: 'artist', artist: k } : { kind: 'song', songId: k });
  const raw = (c: Cell) => (c.kind === 'song' ? c.songId : c.kind === 'artist' ? c.artist : null);
  const changed: number[] = [];
  const cards = set.cards.map((card) => {
    const i = card.cells.findIndex((c) => raw(c) === key);
    if (i < 0 || i === free) return card;
    const onCard = new Set(card.cells.map(raw).filter(Boolean) as string[]);
    const options = colKeys[i % n].filter((k) => k !== key && !onCard.has(k));
    let pick: string | undefined;
    if (replacement && options.includes(replacement)) pick = replacement;
    else if (options.length) pick = options[Math.floor(mulberry32(hashSeed(set.seed, 'swap', key, card.number))() * options.length)];
    if (!pick) throw new SwapError(`Card #${String(card.number).padStart(4, '0')} has no other song that fits that column. Add songs to the playlist first.`);
    changed.push(card.number);
    return { ...card, cells: card.cells.map((c, j) => (j === i ? toCell(pick!) : c)) };
  });
  // A removed song shouldn't be played in future games of this set.
  const songs = replacement || artistMode ? set.songs : set.songs?.map((s) => (s.id === key ? { ...s, excluded: true } : s));
  return { set: { ...set, cards, songs }, changed };
}

export function nextVersionName(name: string, existing: string[]): string {
  const base = name.replace(/\s+v\d+$/, '');
  for (let v = 2; ; v++) if (!existing.includes(`${base} v${v}`)) return `${base} v${v}`;
}

export function parseCardRange(s: string): number[] {
  const out = new Set<number>();
  for (const part of s.split(',')) {
    const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) continue;
    const a = Number(m[1]), b = m[2] ? Number(m[2]) : a;
    for (let x = Math.min(a, b); x <= Math.max(a, b) && out.size < 5000; x++) out.add(x);
  }
  return [...out].sort((x, y) => x - y);
}
