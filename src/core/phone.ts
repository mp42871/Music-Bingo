import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { cleanTitle } from './io';
import { generateCard } from './cards';
import { parseCardRange } from './cardEdit';
import type { Card, CardLayout, Pool } from './types';

/**
 * Compact phone-card definition. Songs carry no Spotify ids (cards depend only on song order,
 * titles, artists and categories), artists only when the layout shows them, categories as indexes.
 */
export interface PhoneDef {
  v: 2; seed: number; layout: CardLayout; title: string; cats: string[];
  s: [title: string, artist?: string, cats?: number[]][];
  /** Live play only: the exact printed cards (song index, artist name, or null = free) by card number. */
  printed?: [number, (number | string | null)[]][];
  /** The printed card numbers in this game, e.g. "1-40" or "1-40,61-80" (phone links without `printed`). */
  nums?: string;
}

/** "1-5,9" from [1,2,3,4,5,9]. */
export function toRanges(nums: number[]): string {
  const xs = [...new Set(nums)].sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < xs.length; i++) {
    let j = i;
    while (j + 1 < xs.length && xs[j + 1] === xs[j] + 1) j++;
    out.push(i === j ? String(xs[i]) : `${xs[i]}-${xs[j]}`);
    i = j;
  }
  return out.join(',');
}

const pad = (n: number) => `#${String(n).padStart(4, '0')}`;

/** The printed card numbers a game knows about, or null for old links that don't say. */
export function printedNumbers(d: PhoneDef): number[] | null {
  if (d.printed) return d.printed.map(([n]) => n).sort((a, b) => a - b);
  if (d.nums) return parseCardRange(d.nums);
  return null;
}

/** Why a typed card number can't be used in this game, or null when it's fine. */
export function typedNumberProblem(d: PhoneDef, n: number): string | null {
  const printed = printedNumbers(d);
  const list = printed?.length
    ? toRanges(printed).split(',').map((r) => r.split('-').map((x) => pad(Number(x))).join('–')).join(', ')
    : '';
  if (n >= 5000) return `Numbers from 5000 up are phone cards — tap “Give me a random card” instead.`;
  if (n < 1 || (printed && !printed.includes(n))) {
    return `Card ${pad(n)} isn’t in this game.${list ? ` The paper cards are ${list}.` : ''} No paper card? Tap “Give me a random card”.`;
  }
  return null;
}

/** The card a phone shows for a number: the exact printed card if known, else generated like the host does. */
export function phoneCard(d: PhoneDef, number: number): Card {
  const printed = d.printed?.find(([n]) => n === number);
  if (printed) {
    return { number, cells: printed[1].map((c) => (c === null ? { kind: 'free' } : typeof c === 'string' ? { kind: 'artist', artist: c } : { kind: 'song', songId: `p${c}` })) };
  }
  return generateCard(phoneDefToPool(d), d.layout, d.seed, number);
}

export function encodePhoneDef(d: PhoneDef): string {
  return compressToEncodedURIComponent(JSON.stringify(d));
}

export function decodePhoneDef(s: string): PhoneDef {
  const json = decompressFromEncodedURIComponent(s);
  if (!json) throw new Error('Broken card link');
  const d = JSON.parse(json) as PhoneDef;
  if (d?.v !== 2 || !Array.isArray(d.s) || !d.layout) throw new Error('Broken card link');
  return d;
}

export function phoneCardNumber(rand: () => number): number {
  return 5000 + Math.floor(rand() * 5000);
}

export function poolToPhoneDef(pool: Pool, seed: number, layout: CardLayout, title: string): PhoneDef {
  const songs = pool.songs.filter((s) => !s.excluded);
  const needArtist = layout.cellContent !== 'title';
  const needCats = layout.headerMode !== 'letters';
  const cats = needCats ? [...new Set(songs.flatMap((s) => s.categories))] : [];
  return {
    v: 2, seed, layout, title, cats,
    s: songs.map((s) => {
      const row: PhoneDef['s'][number] = [s.displayTitle ?? cleanTitle(s.title)];
      if (needArtist || needCats) row.push(needArtist ? s.artist : '');
      if (needCats) row.push(s.categories.map((c) => cats.indexOf(c)));
      return row;
    }),
  };
}

export function phoneDefToPool(d: PhoneDef): Pool {
  return {
    id: 'phone', name: d.title, categories: d.cats, createdAt: 0, updatedAt: 0,
    songs: d.s.map(([title, artist, cats], i) => ({
      id: `p${i}`, uri: '', title, artist: artist ?? '', album: '', durationMs: 0,
      categories: (cats ?? []).map((c) => d.cats[c]),
    })),
  };
}

export function phoneUrl(d: PhoneDef): string {
  const base = window.location.href.split('#')[0].split('?')[0];
  return `${base}#/phone?d=${encodePhoneDef(d)}`;
}
