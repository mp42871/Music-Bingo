import type { Pool } from './types';

export function decadeOf(year: number | undefined): string | null {
  if (!year) return null;
  const d = Math.floor(year / 10) * 10;
  return d >= 2000 ? `${d}s` : `${String(d).slice(2)}s`;
}

const decadeSort = (a: string, b: string) => {
  const v = (s: string) => { const n = parseInt(s, 10); return n < 100 ? 1900 + n : n; };
  return v(a) - v(b);
};

export function tagDecades(pool: Pool): Pool {
  const songs = pool.songs.map((s) => {
    const d = decadeOf(s.year);
    return d && !s.categories.includes(d) ? { ...s, categories: [...s.categories, d] } : s;
  });
  const decades = [...new Set(songs.map((s) => decadeOf(s.year)).filter(Boolean) as string[])].sort(decadeSort);
  return { ...pool, songs, categories: [...new Set([...pool.categories, ...decades])] };
}

export function decadesIn(pool: Pool): string[] {
  return [...new Set(pool.songs.filter((s) => !s.excluded).map((s) => decadeOf(s.year)).filter(Boolean) as string[])].sort(decadeSort);
}
