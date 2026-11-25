import { create } from 'zustand';

interface Net { online: boolean }

export const useNet = create<Net>(() => ({ online: typeof navigator === 'undefined' ? true : navigator.onLine }));

export const RECHECK_MS = 30_000;
const PROBE_URL = 'https://api.spotify.com/v1/';
let recheck: ReturnType<typeof setInterval> | null = null;

function stopRecheck() {
  if (recheck) clearInterval(recheck);
  recheck = null;
}

function markOnline() {
  stopRecheck();
  useNet.setState({ online: true });
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', markOnline);
  window.addEventListener('offline', () => { stopRecheck(); useNet.setState({ online: false }); });
}

/**
 * Call when a request fails for network reasons. Browsers often still report "online" on bad Wi-Fi,
 * so we probe every 30s until a request gets through.
 */
export function reportNetworkFailure() {
  useNet.setState({ online: false });
  if (recheck || typeof window === 'undefined') return;
  recheck = setInterval(() => {
    if (!navigator.onLine) return; // the browser's 'online' event will clear it
    fetch(PROBE_URL, { mode: 'no-cors', cache: 'no-store' }).then(markOnline, () => {});
  }, RECHECK_MS);
}

/** Call when any request to the internet succeeds. */
export function reportNetworkSuccess() {
  if (!useNet.getState().online) markOnline();
}

export const useOnline = () => useNet((s) => s.online);

export async function requestPersistentStorage(): Promise<boolean> {
  try { return (await navigator.storage?.persist?.()) ?? false; } catch { return false; }
}
