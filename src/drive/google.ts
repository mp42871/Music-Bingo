import { DRIVE_SCOPE } from './config';

interface TokenResponse { access_token?: string; expires_in?: number; error?: string }
interface TokenClient { requestAccessToken(o?: { prompt?: string }): void }
declare global {
  interface Window {
    google?: { accounts: { oauth2: {
      initTokenClient(c: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: { type: string }) => void }): TokenClient;
      revoke(token: string, done?: () => void): void;
    } } };
  }
}

const GRANTED_KEY = 'mb.google.granted';
let token: { value: string; exp: number } | null = null;
let loading: Promise<void> | null = null;

export function loadGoogle(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { loading = null; reject(new Error('Couldn’t reach Google. Check your internet connection.')); };
    document.head.appendChild(s);
  });
  return loading;
}

export const googleConnected = () => localStorage.getItem(GRANTED_KEY) === '1';

/** A Drive access token. Opens Google's sign-in popup when needed — call from a click. */
export async function getDriveToken(clientId: string): Promise<string> {
  if (token && token.exp - Date.now() > 60_000) return token.value;
  if (!clientId) throw new Error('Add your Google Client ID in Settings first.');
  await loadGoogle();
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId, scope: DRIVE_SCOPE,
      callback: (r) => {
        if (r.error || !r.access_token) return reject(new Error(`Google sign-in failed (${r.error ?? 'no token'}).`));
        token = { value: r.access_token, exp: Date.now() + (r.expires_in ?? 3600) * 1000 };
        localStorage.setItem(GRANTED_KEY, '1');
        resolve(r.access_token);
      },
      error_callback: (e) => reject(new Error(e.type === 'popup_closed' ? 'Google sign-in was closed.' : e.type === 'popup_failed_to_open' ? 'Your browser blocked the Google sign-in window. Allow pop-ups for this site.' : 'Google sign-in failed.')),
    });
    client.requestAccessToken({ prompt: googleConnected() ? '' : 'consent' });
  });
}

export function disconnectGoogle() {
  if (token) window.google?.accounts.oauth2.revoke(token.value);
  token = null;
  localStorage.removeItem(GRANTED_KEY);
}
