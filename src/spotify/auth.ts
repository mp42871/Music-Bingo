import { redirectUri, SCOPES } from './config';

export const TOKENS_KEY = 'mb.spotify.tokens';
const VERIFIER_KEY = 'mb.spotify.verifier';
const STATE_KEY = 'mb.spotify.state';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';

interface Stored { accessToken: string; refreshToken: string; expiresAt: number }

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(digest));
}

export async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const rnd = crypto.getRandomValues(new Uint8Array(64));
  const verifier = Array.from(rnd, (b) => chars[b % chars.length]).join('');
  return { verifier, challenge: await challengeFor(verifier) };
}

export function saveTokens(t: { access_token: string; refresh_token?: string; expires_in: number }) {
  const prev = readTokens();
  const s: Stored = {
    accessToken: t.access_token,
    refreshToken: t.refresh_token ?? prev?.refreshToken ?? '',
    expiresAt: Date.now() + t.expires_in * 1000,
  };
  localStorage.setItem(TOKENS_KEY, JSON.stringify(s));
}

function readTokens(): Stored | null {
  try {
    return JSON.parse(localStorage.getItem(TOKENS_KEY) ?? 'null');
  } catch {
    return null;
  }
}

export async function beginLogin(clientId: string): Promise<void> {
  const { verifier, challenge } = await createPkcePair();
  const state = b64url(crypto.getRandomValues(new Uint8Array(12)));
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);
  // Remember where to return (hash route) after the redirect.
  sessionStorage.setItem('mb.spotify.returnHash', window.location.hash || '#/settings');
  const params = new URLSearchParams({
    client_id: clientId, response_type: 'code', redirect_uri: redirectUri(),
    code_challenge_method: 'S256', code_challenge: challenge, scope: SCOPES, state,
  });
  window.location.assign(`https://accounts.spotify.com/authorize?${params}`);
}

/** Handles ?code=… on return from Spotify. Returns true if a login completed. */
export async function completeLogin(url: URL, clientId: string): Promise<boolean> {
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  if (!code && !error) return false;
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  const state = sessionStorage.getItem(STATE_KEY);
  const back = sessionStorage.getItem('mb.spotify.returnHash') ?? '#/settings';
  window.history.replaceState(null, '', url.origin + url.pathname + back);
  if (error || !verifier || url.searchParams.get('state') !== state) return false;
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code', code: code!, redirect_uri: redirectUri(),
      client_id: clientId, code_verifier: verifier,
    }),
  });
  sessionStorage.removeItem(VERIFIER_KEY);
  if (!res.ok) return false;
  saveTokens(await res.json());
  return true;
}

let refreshing: Promise<string | null> | null = null;

export async function getAccessToken(clientId: string, force = false): Promise<string | null> {
  const t = readTokens();
  if (!t) return null;
  if (!force && t.expiresAt - Date.now() > 60_000) return t.accessToken;
  if (!t.refreshToken) return null;
  refreshing ??= (async () => {
    try {
      const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: t.refreshToken, client_id: clientId }),
      });
      if (!res.ok) {
        if (res.status === 400) logout();
        return null;
      }
      saveTokens(await res.json());
      return readTokens()!.accessToken;
    } catch (e) {
      // No connection: say so, instead of looking logged out.
      if (e instanceof TypeError) throw e;
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export function isLoggedIn(): boolean {
  return !!readTokens();
}

export function logout() {
  localStorage.removeItem(TOKENS_KEY);
}
