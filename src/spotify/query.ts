export interface SearchFilters {
  text?: string; track?: string; artist?: string; album?: string;
  yearFrom?: number; yearTo?: number; genre?: string;
}

const field = (name: string, v?: string) => {
  const clean = v?.replace(/"/g, '').trim();
  return clean ? `${name}:"${clean}"` : null;
};

export function buildSearchQuery(q: SearchFilters): string {
  const parts: string[] = [];
  if (q.text?.trim()) parts.push(q.text.trim());
  for (const p of [field('track', q.track), field('artist', q.artist), field('album', q.album)]) if (p) parts.push(p);
  if (q.yearFrom && q.yearTo && q.yearTo !== q.yearFrom) parts.push(`year:${q.yearFrom}-${q.yearTo}`);
  else if (q.yearFrom || q.yearTo) parts.push(`year:${q.yearFrom ?? q.yearTo}`);
  const g = field('genre', q.genre);
  if (g) parts.push(g);
  return parts.join(' ');
}

export function parsePlaylistId(input: string): string | null {
  const s = input.trim();
  const m = s.match(/playlist[/:]([A-Za-z0-9]{10,40})/);
  if (m) return m[1];
  return /^[A-Za-z0-9]{16,40}$/.test(s) ? s : null;
}
