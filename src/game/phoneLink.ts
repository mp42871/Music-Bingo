import { poolToPhoneDef, type PhoneDef } from '../core/phone';
import { DEFAULT_STYLE } from '../core/style';
import type { CardSet } from '../core/types';

/** One place that builds a card set's phone-card definition, so every QR code gives a player the same card. */
export function setPhoneDef(set: CardSet): PhoneDef {
  const style = { ...DEFAULT_STYLE, ...set.style };
  const title = style.title || 'Music Bingo';
  return poolToPhoneDef({ id: set.poolId, name: title, songs: set.songs ?? [], categories: [], createdAt: 0, updatedAt: 0 }, set.seed, set.layout, title);
}
