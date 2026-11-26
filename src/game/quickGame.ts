import { generateCardSet } from '../core/cards';
import { DEFAULT_CLIP } from '../core/clip';
import { makeCallOrder } from '../core/forecast';
import { presetQueries, type Preset } from '../core/presets';
import { randomSeed, shuffle, uid } from '../core/rng';
import { DEFAULT_STYLE } from '../core/style';
import type { CardLayout, CardSet, ClipSettings, Game, Pool, PrintStyle, Song } from '../core/types';
import { getSetting, saveCardSet, saveGame, savePool } from '../db/repo';
import type { SpotifyApi } from '../spotify/api';
import { collect } from '../spotify/collect';
import { collectCurated, parseCurated } from '../spotify/curated';

export class QuickGameError extends Error {
  constructor(message: string) { super(message); this.name = 'QuickGameError'; }
}

export type QuickRequest =
  | { kind: 'preset'; preset: Preset }
  | { kind: 'artist'; name: string }
  | { kind: 'text'; text: string };

export interface QuickOptions { songs: number; cards: number; size: 3 | 4 | 5 }

const needed = (size: number) => size * size - (size % 2 ? 1 : 0);

export function requestTitle(r: QuickRequest): string {
  const base = r.kind === 'preset' ? r.preset.name : r.kind === 'artist' ? r.name.trim() : r.text.trim();
  return `${base} Bingo`;
}

/** Crowd request → saved playlist, card set and game, ready for the console. */
export async function buildQuickGame(
  api: Pick<SpotifyApi, 'searchTracks'>, req: QuickRequest, opts: QuickOptions, onStep: (s: string) => void = () => {},
): Promise<{ pool: Pool; cardSet: CardSet; game: Game }> {
  const title = requestTitle(req);
  onStep('Finding songs…');
  let songs: Song[];
  if (req.kind === 'preset' && req.preset.songs)
    songs = (await collectCurated(api, shuffle(parseCurated(req.preset.songs), Math.random), opts.songs)).songs;
  else {
    const queries = req.kind === 'preset' ? presetQueries(req.preset) : req.kind === 'artist' ? [`artist:"${req.name.replace(/"/g, '').trim()}"`] : [req.text.trim()];
    songs = (await collect(api, queries, opts.songs)).songs;
  }
  songs = songs.map((s) => ({ ...s, categories: [] }));
  if (songs.length < needed(opts.size)) {
    const fits = ([5, 4, 3] as const).find((n) => songs.length >= needed(n));
    throw new QuickGameError(
      `Only ${songs.length} songs found — a ${opts.size}×${opts.size} card needs at least ${needed(opts.size)}. ` +
      (fits ? `Try a ${fits}×${fits} card, or another request.` : 'Try another request.'),
    );
  }

  const now = Date.now();
  const pool: Pool = { id: uid(), name: title, songs, categories: [], createdAt: now, updatedAt: now };
  await savePool(pool);

  onStep('Making cards…');
  const layout: CardLayout = {
    size: opts.size, freeCenter: true, freeText: 'FREE', headerMode: 'theme', columnCategories: [],
    themeLabel: title, letters: 'BINGO', cellContent: 'title',
  };
  const style: PrintStyle = { ...DEFAULT_STYLE, ...(await getSetting<Partial<PrintStyle>>('printStyle', {})), title, subtitle: '' };
  const { set } = generateCardSet(pool, layout, { seed: randomSeed(), count: opts.cards, startNumber: 1, name: title });
  const cardSet: CardSet = { ...set, style };
  await saveCardSet(cardSet);

  onStep('Setting up the game…');
  const settings: ClipSettings = { ...DEFAULT_CLIP, ...(await getSetting<Partial<ClipSettings>>('clip', {})) };
  const game: Game = {
    id: uid(), name: title, createdAt: Date.now(), pool: { ...pool, songs: set.songs ?? songs }, cardSetId: cardSet.id, settings,
    callOrder: makeCallOrder(pool, randomSeed()), calls: [], rounds: [{ patternId: 'line', winners: [], startCall: 0 }], status: 'setup',
  };
  await saveGame(game);
  return { pool, cardSet, game };
}
