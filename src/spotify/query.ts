export interface SearchFilters { text?: string; yearFrom?: number; yearTo?: number; genre?: string }

export function buildSearchQuery(q: SearchFilters): string {
  const parts: string[] = [];
  if (q.text?.trim()) parts.push(q.text.trim());
  if (q.yearFrom && q.yearTo && q.yearTo !== q.yearFrom) parts.push(`year:${q.yearFrom}-${q.yearTo}`);
  else if (q.yearFrom || q.yearTo) parts.push(`year:${q.yearFrom ?? q.yearTo}`);
  if (q.genre?.trim()) parts.push(`genre:"${q.genre.trim()}"`);
  return parts.join(' ');
}

export function parsePlaylistId(input: string): string | null {
  const s = input.trim();
  const m = s.match(/playlist[/:]([A-Za-z0-9]{10,40})/);
  if (m) return m[1];
  return /^[A-Za-z0-9]{16,40}$/.test(s) ? s : null;
}
