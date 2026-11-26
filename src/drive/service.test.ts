import { refreshGoogleClientId } from './service';
import { DEFAULT_GOOGLE_CLIENT_ID } from './config';
import { db } from '../db/db';
import { setSetting } from '../db/repo';

beforeEach(async () => { await Promise.all(db.tables.map((t) => t.clear())); });

test('Drive uses the built-in Google Client ID unless you saved your own', async () => {
  expect(await refreshGoogleClientId()).toBe(DEFAULT_GOOGLE_CLIENT_ID);
  await setSetting('googleClientId', 'mine.apps.googleusercontent.com');
  expect(await refreshGoogleClientId()).toBe('mine.apps.googleusercontent.com');
});

test('Spotify stays bring-your-own: no Spotify Client ID is built in', async () => {
  const { useSpotify } = await import('../app/spotifyStore');
  expect(useSpotify.getState().clientId ?? '').toBe('');
});
