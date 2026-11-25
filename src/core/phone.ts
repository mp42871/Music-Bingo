import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { CardLayout, Pool } from './types';

export interface PhoneDef {
  v: 1; seed: number; layout: CardLayout; title: string;
  songs: [id: string, title: string, artist: string, categories?: string[]][];
}

export function encodePhoneDef(d: PhoneDef): string {
  return compressToEncodedURIComponent(JSON.stringify(d));
}

export function decodePhoneDef(s: string): PhoneDef {
  const json = decompressFromEncodedURIComponent(s);
  if (!json) throw new Error('Broken card link');
  const d = JSON.parse(json) as PhoneDef;
  if (d?.v !== 1 || !Array.isArray(d.songs) || !d.layout) throw new Error('Broken card link');
  return d;
}

export function phoneCardNumber(rand: () => number): number {
  return 5000 + Math.floor(rand() * 5000);
}

export function poolToPhoneDef(pool: Pool, seed: number, layout: CardLayout, title: string): PhoneDef {
  const needCats = layout.headerMode !== 'letters';
  return {
    v: 1, seed, layout, title,
    songs: pool.songs.filter((s) => !s.excluded).map((s) =>
      needCats ? [s.id, s.displayTitle ?? s.title, s.artist, s.categories] : [s.id, s.displayTitle ?? s.title, s.artist]),
  };
}

export function phoneDefToPool(d: PhoneDef): Pool {
  return {
    id: 'phone', name: d.title, categories: [], createdAt: 0, updatedAt: 0,
    songs: d.songs.map(([id, title, artist, categories]) => ({
      id, uri: `spotify:track:${id}`, title, artist, album: '', durationMs: 0, categories: categories ?? [],
    })),
  };
}

export function phoneUrl(d: PhoneDef): string {
  const base = window.location.href.split('#')[0];
  return `${base}#/phone?d=${encodePhoneDef(d)}`;
}
