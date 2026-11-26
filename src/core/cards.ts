import { hashSeed, mulberry32, shuffle, uid } from './rng';
import type { Card, CardLayout, CardSet, Cell, Pool, Song } from './types';

export const MAX_PRINTED = 4999;

export class PoolTooSmallError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PoolTooSmallError';
  }
}

export function freeIndex(layout: CardLayout): number | null {
  if (!layout.freeCenter || layout.size % 2 === 0) return null;
  return Math.floor((layout.size * layout.size) / 2);
}

const active = (pool: Pool) => pool.songs.filter((s) => !s.excluded);

export function songsForColumn(pool: Pool, layout: CardLayout, col: number): Song[] {
  const songs = active(pool);
  if (layout.headerMode === 'categories') {
    const cat = layout.columnCategories[col];
    return songs.filter((s) => s.categories.includes(cat));
  }
  if (layout.headerMode === 'theme' && layout.themeCategory) {
    return songs.filter((s) => s.categories.includes(layout.themeCategory!));
  }
  return songs;
}

/** Candidate cell keys for a column: song ids, or artist names in artist-bingo mode. */
function candidates(pool: Pool, layout: CardLayout, col: number): string[] {
  const songs = songsForColumn(pool, layout, col);
  if (layout.cellContent === 'artistBingo') return [...new Set(songs.map((s) => s.artist))].sort();
  return songs.map((s) => s.id);
}

function neededForColumn(layout: CardLayout, col: number): number {
  const free = freeIndex(layout);
  return layout.size - (free !== null && free % layout.size === col ? 1 : 0);
}

export interface PoolValidation {
  ok: boolean;
  columns: { label: string; available: number; needed: number }[];
  messages: string[];
}

export function validatePool(pool: Pool, layout: CardLayout): PoolValidation {
  const unit = layout.cellContent === 'artistBingo' ? 'artists' : 'songs';
  const messages: string[] = [];
  const columns: PoolValidation['columns'] = [];
  if (layout.headerMode === 'categories') {
    for (let c = 0; c < layout.size; c++) {
      const label = layout.columnCategories[c] ?? `Column ${c + 1}`;
      const available = layout.columnCategories[c] ? candidates(pool, layout, c).length : 0;
      const needed = neededForColumn(layout, c);
      columns.push({ label, available, needed });
      if (!layout.columnCategories[c]) messages.push(`Pick a category for column ${c + 1}.`);
      else if (available === 0)
        messages.push(`No songs are tagged “${label}” yet — tag songs with it in the playlist, or pick another category.`);
      else if (available < needed)
        messages.push(`“${label}” has ${available} ${unit} — needs at least ${needed} (add ${needed - available} more).`);
    }
    const union = new Set(layout.columnCategories.slice(0, layout.size).flatMap((_, c) => candidates(pool, layout, c)));
    const total = columns.reduce((a, c) => a + c.needed, 0);
    if (messages.length === 0 && union.size < total)
      messages.push(`Columns share too many ${unit}: ${union.size} distinct, ${total} needed per card.`);
  } else {
    const label = layout.headerMode === 'theme' && layout.themeCategory ? layout.themeCategory : layout.themeLabel || 'Whole playlist';
    const available = candidates(pool, layout, 0).length;
    const needed = layout.size * layout.size - (freeIndex(layout) === null ? 0 : 1);
    columns.push({ label, available, needed });
    if (available === 0 && layout.headerMode === 'theme' && layout.themeCategory)
      messages.push(`No songs are tagged “${label}” yet — pick “Whole playlist”, or tag songs with it in the playlist.`);
    else if (available < needed)
      messages.push(`"${label}" has ${available} ${unit} — needs at least ${needed} (add ${needed - available} more).`);
  }
  const unique = [...new Set(messages)];
  return { ok: unique.length === 0, columns, messages: unique };
}

function toCell(layout: CardLayout, key: string): Cell {
  return layout.cellContent === 'artistBingo' ? { kind: 'artist', artist: key } : { kind: 'song', songId: key };
}

function buildCard(pool: Pool, layout: CardLayout, rand: () => number, number: number): Card {
  const n = layout.size;
  const free = freeIndex(layout);
  const cells: Cell[] = new Array(n * n);
  const used = new Set<string>();
  const shared = layout.headerMode !== 'categories' ? shuffle(candidates(pool, layout, 0), rand) : null;
  let sharedPos = 0;
  for (let c = 0; c < n; c++) {
    const list = shared ?? shuffle(candidates(pool, layout, c), rand);
    let pos = shared ? sharedPos : 0;
    for (let r = 0; r < n; r++) {
      const idx = r * n + c;
      if (idx === free) {
        cells[idx] = { kind: 'free' };
        continue;
      }
      while (pos < list.length && used.has(list[pos])) pos++;
      if (pos >= list.length) throw new PoolTooSmallError(validatePool(pool, layout).messages.join(' ') || 'Not enough songs for this card layout.');
      used.add(list[pos]);
      cells[idx] = toCell(layout, list[pos]);
      pos++;
    }
    if (shared) sharedPos = pos;
  }
  return { number, cells };
}

export function generateCard(pool: Pool, layout: CardLayout, seed: number, number: number): Card {
  return buildCard(pool, layout, mulberry32(hashSeed(seed, number)), number);
}

export const cardSignature = (card: Card) =>
  card.cells.map((c) => (c.kind === 'song' ? c.songId : c.kind === 'artist' ? `a:${c.artist}` : '*')).sort().join('|');

export function generateCardSet(
  pool: Pool,
  layout: CardLayout,
  opts: { seed: number; count: number; startNumber: number; name?: string },
): { set: CardSet; capped: boolean; message?: string } {
  const v = validatePool(pool, layout);
  if (!v.ok) throw new PoolTooSmallError(v.messages.join(' '));
  const seen = new Set<string>();
  const cards: Card[] = [];
  let capped = false;
  // Printed cards stop at 4999; 5000–9999 belong to phone cards.
  const count = Math.max(0, Math.min(opts.count, MAX_PRINTED - opts.startNumber + 1));
  const numberCapped = count < opts.count;
  for (let i = 0; i < count && !capped; i++) {
    const number = opts.startNumber + i;
    let card = generateCard(pool, layout, opts.seed, number);
    let attempt = 0;
    while (seen.has(cardSignature(card)) && attempt < 50) {
      attempt++;
      card = buildCard(pool, layout, mulberry32(hashSeed(opts.seed, number, attempt)), number);
    }
    if (seen.has(cardSignature(card))) {
      capped = true;
      break;
    }
    seen.add(cardSignature(card));
    cards.push(card);
  }
  const set: CardSet = {
    id: uid(), name: opts.name ?? `${pool.name} — ${cards.length} cards`, poolId: pool.id,
    seed: opts.seed, layout, cards, createdAt: Date.now(), songs: active(pool),
  };
  if (capped) return { set, capped, message: `Only ${cards.length} unique cards are possible with this playlist — add more songs for more cards.` };
  if (numberCapped) return { set, capped: true, message: `Printed card numbers stop at ${MAX_PRINTED} (higher numbers are for phone cards), so ${cards.length} cards were made.` };
  return { set, capped };
}
