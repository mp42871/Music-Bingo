import { getSetting, setSetting } from '../db/repo';
import { isLoggedIn } from '../spotify/auth';

/*
 * Early versions had the host's Spotify Client ID built in. Every visitor must now use their own Spotify app.
 * A browser that had already connected with it keeps it (saved into its own settings), so the host stays
 * connected; a new visitor never gets it. (Google Drive uses the app's built-in Client ID — see drive/config.)
 */
const OLD_SPOTIFY_ID = 'bbb45131b8a14409ad1cbe8d1c338d44';

export async function migrateBuiltInIds(): Promise<void> {
  if (isLoggedIn() && !(await getSetting('clientId', ''))) await setSetting('clientId', OLD_SPOTIFY_ID);
}
