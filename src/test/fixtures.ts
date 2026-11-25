import type { CardLayout, Pool, Song } from '../core/types';

export const CATS = ['70s', '80s', '90s', 'Country', 'Rock'];

export function song(i: number, over: Partial<Song> = {}): Song {
  return {
    id: `s${i}`, uri: `spotify:track:s${i}`, title: `Song ${i}`, artist: `Artist ${i}`,
    album: `Album ${i}`, durationMs: 200_000, categories: [], ...over,
  };
}

export function catPool(perCat = 15): Pool {
  const songs: Song[] = [];
  CATS.forEach((c, ci) => {
    for (let k = 0; k < perCat; k++) songs.push(song(ci * 100 + k, { categories: [c] }));
  });
  return { id: 'p1', name: 'Test', songs, categories: CATS, createdAt: 0, updatedAt: 0 };
}

export function flatPool(n: number): Pool {
  return {
    id: 'p2', name: 'Flat', songs: Array.from({ length: n }, (_, i) => song(i)),
    categories: [], createdAt: 0, updatedAt: 0,
  };
}

export function layout(over: Partial<CardLayout> = {}): CardLayout {
  return {
    size: 5, freeCenter: true, freeText: 'FREE', headerMode: 'categories',
    columnCategories: CATS, letters: 'BINGO', cellContent: 'title', ...over,
  };
}
