import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { cleanTitle } from './io';
import type { CardLayout, Pool } from './types';

/**
 * Compact phone-card definition. Songs carry no Spotify ids (cards depend only on song order,
 * titles, artists and categories), artists only when the layout shows them, categories as indexes.
 */
export interface PhoneDef {
  v: 2; seed: number; layout: CardLayout; title: string; cats: string[];
  s: [title: string, artist?: string, cats?: number[]][];
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
