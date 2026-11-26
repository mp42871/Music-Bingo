import { migrateBuiltInIds } from './setupIds';
import { db } from '../db/db';
import { getSetting, setSetting } from '../db/repo';
import { TOKENS_KEY } from '../spotify/auth';

beforeEach(async () => { await Promise.all(db.tables.map((t) => t.clear())); localStorage.clear(); });

test('a new visitor gets no Spotify or Google ID', async () => {
  await migrateBuiltInIds();
  expect(await getSetting('clientId', '')).toBe('');
  expect(await getSetting('googleClientId', '')).toBe('');
});

test('a browser already connected keeps working: the old built-in IDs are saved into its settings', async () => {
  localStorage.setItem(TOKENS_KEY, JSON.stringify({ accessToken: 'a', refreshToken: 'r', expiresAt: 1 }));
  localStorage.setItem('mb.google.granted', '1');
  await migrateBuiltInIds();
  expect(await getSetting('clientId', '')).toMatch(/^[0-9a-f]{32}$/);
  expect(await getSetting('googleClientId', '')).toMatch(/apps\.googleusercontent\.com$/);
});

test('IDs the host already saved are never overwritten', async () => {
  localStorage.setItem(TOKENS_KEY, JSON.stringify({ accessToken: 'a', refreshToken: 'r', expiresAt: 1 }));
  await setSetting('clientId', 'mine');
  await migrateBuiltInIds();
  expect(await getSetting('clientId', '')).toBe('mine');
});
