import { create } from 'zustand';
import { getSetting, setSetting } from '../db/repo';
import { beginLogin, completeLogin, getAccessToken, isLoggedIn, logout } from '../spotify/auth';
import { SpotifyApi } from '../spotify/api';
import { DEFAULT_CLIENT_ID } from '../spotify/config';

interface Profile { name: string; product: string; image?: string }

interface SpotifyStore {
  clientId: string;
  connected: boolean;
  profile: Profile | null;
  error: string | null;
  api: SpotifyApi;
  init(): Promise<void>;
  setClientId(id: string): Promise<void>;
  login(): Promise<void>;
  logout(): void;
}

export const useSpotify = create<SpotifyStore>((set, get) => ({
  clientId: DEFAULT_CLIENT_ID,
  connected: isLoggedIn(),
  profile: null,
  error: null,
  api: new SpotifyApi(async (force) => {
    const t = await getAccessToken(get().clientId, force);
    if (!t && get().connected && !isLoggedIn()) set({ connected: false, profile: null });
    return t;
  }),
  async init() {
    const clientId = await getSetting('clientId', DEFAULT_CLIENT_ID);
    set({ clientId });
    try {
      if (await completeLogin(new URL(window.location.href), clientId)) set({ connected: true });
    } catch {
      set({ error: 'Spotify sign-in failed. Try connecting again.' });
    }
    if (!isLoggedIn()) return set({ connected: false });
    try {
      const me = await get().api.me();
      set({ connected: true, profile: { name: me.display_name, product: me.product, image: me.images?.[0]?.url }, error: null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },
  async setClientId(id) {
    await setSetting('clientId', id.trim());
    set({ clientId: id.trim() });
  },
  async login() {
    await beginLogin(get().clientId);
  },
  logout() {
    logout();
    set({ connected: false, profile: null });
  },
}));
