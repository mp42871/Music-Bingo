import { create } from 'zustand';

interface Net { online: boolean }

export const useNet = create<Net>(() => ({ online: typeof navigator === 'undefined' ? true : navigator.onLine }));

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => useNet.setState({ online: true }));
  window.addEventListener('offline', () => useNet.setState({ online: false }));
}

/** Call when a request fails for network reasons (browsers often report online on bad Wi-Fi). */
export function reportNetworkFailure() {
  useNet.setState({ online: false });
}

export const useOnline = () => useNet((s) => s.online);

export async function requestPersistentStorage(): Promise<boolean> {
  try { return (await navigator.storage?.persist?.()) ?? false; } catch { return false; }
}
