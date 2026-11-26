import { getSetting, setSetting } from '../db/repo';
import { isLoggedIn } from '../spotify/auth';
import { googleConnected } from '../drive/google';

/*
 * Early versions had the host's Spotify and Google Client IDs built in. Every visitor must now use their
 * own. A browser that had already connected with those IDs keeps them (saved into its own settings), so the
 * host stays connected; a new visitor never gets them.
 */
const OLD_SPOTIFY_ID = 'bbb45131b8a14409ad1cbe8d1c338d44';
const OLD_GOOGLE_ID = '211738025923-j67cqp7taivk4bd9d4f6a70utk9s6aq2.apps.googleusercontent.com';

export async function migrateBuiltInIds(): Promise<void> {
  if (isLoggedIn() && !(await getSetting('clientId', ''))) await setSetting('clientId', OLD_SPOTIFY_ID);
  if (googleConnected() && !(await getSetting('googleClientId', ''))) await setSetting('googleClientId', OLD_GOOGLE_ID);
}
