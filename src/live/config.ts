import { getSetting } from '../db/repo';
import { createSupabaseBackend } from './supabase';
import type { LiveBackend } from './types';

let override: LiveBackend | null | undefined;
let cached: { key: string; backend: LiveBackend } | null = null;

/** Tests (and demos) can plug in a backend directly. */
export function setLiveBackend(b: LiveBackend | null | undefined) { override = b; }

/** The host's live backend, or null when live play isn't set up. */
export async function liveBackend(): Promise<LiveBackend | null> {
  if (override !== undefined) return override;
  const url = await getSetting('supabaseUrl', '');
  const key = await getSetting('supabaseKey', '');
  if (!url || !key) return null;
  if (cached?.key !== url + key) cached = { key: url + key, backend: createSupabaseBackend(url, key) };
  return cached.backend;
}

/**
 * Players' phones don't have the host's settings: the join link carries the project address.
 * `p` = base64url of "url|key" (both public by design).
 */
export function encodeProject(url: string, key: string) {
  return btoa(`${url}|${key}`).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeProject(p: string): { url: string; key: string } | null {
  try {
    const [url, key] = atob(p.replace(/-/g, '+').replace(/_/g, '/')).split('|');
    return url?.startsWith('https://') && key ? { url, key } : null;
  } catch { return null; }
}

/** The site's own live project for players who type the address (public/live.json), if the owner added one. */
export async function siteProject(): Promise<{ url: string; key: string } | null> {
  try {
    const r = await fetch('./live.json', { cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    return typeof j?.url === 'string' && typeof j?.key === 'string' && j.url.startsWith('https://') ? j : null;
  } catch { return null; }
}

export async function joinBackendFor(p: string | null): Promise<LiveBackend | null> {
  if (override !== undefined) return override;
  const proj = (p ? decodeProject(p) : null) ?? (await siteProject());
  if (proj) return createSupabaseBackend(proj.url, proj.key);
  return liveBackend();
}
