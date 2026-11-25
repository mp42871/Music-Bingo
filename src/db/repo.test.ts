import { db } from './db';
import * as repo from './repo';
import { catPool } from '../test/fixtures';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

test('save, get, list, delete pool', async () => {
  const p = catPool(2);
  await repo.savePool(p);
  expect(await repo.getPool(p.id)).toEqual(p);
  expect((await repo.listPools()).map((x) => x.id)).toEqual([p.id]);
  await repo.deletePool(p.id);
  expect(await repo.getPool(p.id)).toBeUndefined();
});

test('settings fall back and persist', async () => {
  expect(await repo.getSetting('clip', { a: 1 })).toEqual({ a: 1 });
  await repo.setSetting('clip', { a: 2 });
  expect(await repo.getSetting('clip', { a: 1 })).toEqual({ a: 2 });
});

test('backup → wipe → restore replace', async () => {
  const p = catPool(1);
  await repo.savePool(p);
  await repo.setSetting('clientId', 'abc');
  const backup = await repo.exportBackup();
  await Promise.all(db.tables.map((t) => t.clear()));
  await repo.importBackup(backup, 'replace');
  expect(await repo.getPool(p.id)).toEqual(p);
  expect(await repo.getSetting('clientId', '')).toBe('abc');
});

test('restore merge keeps existing records', async () => {
  const a = catPool(1);
  await repo.savePool(a);
  const backup = await repo.exportBackup();
  await Promise.all(db.tables.map((t) => t.clear()));
  const b = { ...catPool(1), id: 'other' };
  await repo.savePool(b);
  await repo.importBackup(backup, 'merge');
  expect((await repo.listPools()).map((x) => x.id).sort()).toEqual(['other', 'p1']);
});

test('restore rejects a non-backup file', async () => {
  await expect(repo.importBackup('{"x":1}', 'merge')).rejects.toThrow();
});
