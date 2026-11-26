import { hostProject, liveBackend } from './config';
import { db } from '../db/db';
import { setSetting } from '../db/repo';

beforeEach(async () => { await Promise.all(db.tables.map((t) => t.clear())); });
afterEach(() => vi.unstubAllGlobals());

const siteJson = (body: unknown, ok = true) =>
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok, json: async () => body })));

test('a host whose browser has no live settings (e.g. a phone) uses the site’s own project', async () => {
  siteJson({ url: 'https://site.supabase.co', key: 'sb_publishable_site' });
  expect(await hostProject()).toEqual({ url: 'https://site.supabase.co', key: 'sb_publishable_site', fromSite: true });
  expect(await liveBackend()).not.toBeNull();
});

test('the project saved in Settings wins over the site’s', async () => {
  siteJson({ url: 'https://site.supabase.co', key: 'k1' });
  await setSetting('supabaseUrl', 'https://mine.supabase.co');
  await setSetting('supabaseKey', 'k2');
  expect(await hostProject()).toEqual({ url: 'https://mine.supabase.co', key: 'k2', fromSite: false });
});

test('no settings and no site project: live play stays off', async () => {
  siteJson({}, false);
  expect(await hostProject()).toBeNull();
  expect(await liveBackend()).toBeNull();
});
