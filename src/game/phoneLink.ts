import { poolToPhoneDef, toRanges, type PhoneDef } from '../core/phone';
import { DEFAULT_STYLE } from '../core/style';
import type { CardSet } from '../core/types';

/** One place that builds a card set's phone-card definition, so every QR code gives a player the same card. */
export function setPhoneDef(set: CardSet): PhoneDef {
  const style = { ...DEFAULT_STYLE, ...set.style };
  const title = style.title || 'Music Bingo';
  const def = poolToPhoneDef({ id: set.poolId, name: title, songs: set.songs ?? [], categories: [], createdAt: 0, updatedAt: 0 }, set.seed, set.layout, title);
  return { ...def, nums: toRanges(set.cards.map((c) => c.number)) };
}

/** Live play: include the exact printed cards so a phone holding a paper card's number matches it. */
export function liveDef(set: CardSet): PhoneDef {
  const def = setPhoneDef(set);
  const active = (set.songs ?? []).filter((s) => !s.excluded);
  const index = new Map(active.map((s, i) => [s.id, i]));
  delete def.nums;
  def.printed = set.cards.map((c) => [c.number, c.cells.map((x) => (x.kind === 'free' ? null : x.kind === 'artist' ? x.artist : index.get(x.songId) ?? null))]);
  return def;
}
