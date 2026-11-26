import { liveSongsFor } from './liveSongs';
import { db } from '../db/db';
import { savePool } from '../db/repo';
import { song } from '../test/fixtures';

beforeEach(async () => { await Promise.all(db.tables.map((t) => t.clear())); });

test('file links are picked up from every playlist a card set came from', async () => {
  await savePool({ id: 'a', name: 'A', songs: [song(1, { fileId: 'f1' })], categories: [], createdAt: 0, updatedAt: 0 });
  await savePool({ id: 'b', name: 'B', songs: [song(2, { fileId: 'f2' })], categories: [], createdAt: 0, updatedAt: 0 });
  const live = await liveSongsFor({ poolId: 'combo:a+b', poolIds: ['a', 'b'] });
  expect(live!.map((s) => [s.id, s.fileId])).toEqual([['s1', 'f1'], ['s2', 'f2']]);
  expect(await liveSongsFor({ poolId: 'missing' })).toBeUndefined();
});
