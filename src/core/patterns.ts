import type { PatternDef } from './types';

export const PATTERNS: PatternDef[] = [
  { id: 'line', name: 'Single line' },
  { id: 'twoLines', name: 'Two lines' },
  { id: 'fourCorners', name: 'Four corners' },
  { id: 'x', name: 'Letter X' },
  { id: 't', name: 'Letter T' },
  { id: 'l', name: 'Letter L' },
  { id: 'plus', name: 'Plus sign' },
  { id: 'frame', name: 'Picture frame' },
  { id: 'smallDiamond', name: 'Small diamond' },
  { id: 'largeDiamond', name: 'Large diamond' },
  { id: 'blackout', name: 'Blackout (full card)' },
  { id: 'custom', name: 'Custom pattern' },
];

export function patternName(id: string): string {
  return PATTERNS.find((p) => p.id === id)?.name ?? id;
}

const uniq = (xs: number[]) => [...new Set(xs)].sort((a, b) => a - b);

export function lines(size: number): number[][] {
  const out: number[][] = [];
  const r = [...Array(size).keys()];
  for (const row of r) out.push(r.map((c) => row * size + c));
  for (const col of r) out.push(r.map((row) => row * size + col));
  out.push(r.map((i) => i * size + i));
  out.push(r.map((i) => i * size + (size - 1 - i)));
  return out;
}

function diamond(size: number, edgeOnly: boolean, radius: number): number[] {
  // Center is a cell for odd sizes; for 4x4 use the 2x2 middle block as center.
  const c = (size - 1) / 2;
  const cells: number[] = [];
  for (let r = 0; r < size; r++)
    for (let col = 0; col < size; col++) {
      const d = Math.abs(r - c) + Math.abs(col - c);
      const rr = Math.round(d);
      if (edgeOnly ? rr === radius : d <= radius) cells.push(r * size + col);
    }
  return cells;
}

/** A card wins if ALL indices of ANY returned mask are marked. */
export function masksFor(patternId: string, size: 3 | 4 | 5, customMask?: number[]): number[][] {
  const n = size;
  const last = n - 1;
  const mid = Math.floor(n / 2);
  const all = [...Array(n * n).keys()];
  const row = (r: number) => [...Array(n).keys()].map((c) => r * n + c);
  const col = (c: number) => [...Array(n).keys()].map((r) => r * n + c);
  const [d1, d2] = lines(n).slice(-2);
  switch (patternId) {
    case 'line':
      return lines(n);
    case 'twoLines': {
      const ls = lines(n);
      const out: number[][] = [];
      for (let i = 0; i < ls.length; i++)
        for (let j = i + 1; j < ls.length; j++) out.push(uniq([...ls[i], ...ls[j]]));
      return out;
    }
    case 'fourCorners':
      return [[0, last, last * n, n * n - 1]];
    case 'x':
      return [uniq([...d1, ...d2])];
    case 't':
      return [uniq([...row(0), ...col(mid)])];
    case 'l':
      return [uniq([...col(0), ...row(last)])];
    case 'plus':
      // 4x4 has no single middle; use row/col index 1 (nearest equivalent).
      return [uniq([...row(n === 4 ? 1 : mid), ...col(n === 4 ? 1 : mid)])];
    case 'frame':
      return [uniq([...row(0), ...row(last), ...col(0), ...col(last)])];
    case 'smallDiamond':
      return [diamond(n, false, 1)];
    case 'largeDiamond':
      return [diamond(n, true, n === 3 ? 1 : 2)];
    case 'blackout':
      return [all];
    case 'custom': {
      const m = uniq((customMask ?? []).filter((i) => i >= 0 && i < n * n));
      return [m.length ? m : all];
    }
    default:
      throw new Error(`Unknown pattern: ${patternId}`);
  }
}
