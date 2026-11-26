import { autoBackupOnClick, backupFileName, backupNow } from './backup';
import { db } from '../db/db';
import { getSetting, setSetting } from '../db/repo';
import { useNet } from '../app/online';

const fakeDrive = () => ({ upload: vi.fn(async () => 'id'), prune: vi.fn(async () => {}) });

beforeEach(async () => { await Promise.all(db.tables.map((t) => t.clear())); useNet.setState({ online: true }); });

test('file name format', () => {
  expect(backupFileName(new Date(2026, 10, 26, 21, 5))).toBe('Music Bingo backup 2026-11-26 21-05.json');
});

test('backupNow uploads the backup, prunes, and records the time', async () => {
  const d = fakeDrive();
  await setSetting('driveBackupPending', true);
  await backupNow(d);
  expect(d.upload).toHaveBeenCalledWith(expect.stringMatching(/^Music Bingo backup/), expect.stringContaining('"format":"music-bingo-backup"'));
  expect(d.prune).toHaveBeenCalledWith(20);
  expect(await getSetting('driveLastBackupAt', 0)).toBeGreaterThan(0);
  expect(await getSetting('driveBackupPending', true)).toBe(false);
});

test('auto backup does nothing when turned off', async () => {
  const d = fakeDrive();
  await setSetting('driveAutoBackup', false);
  expect(await autoBackupOnClick(async () => {}, () => d)).toBe('off');
  expect(d.upload).not.toHaveBeenCalled();
});

test('auto backup offline marks it pending, then runs on the next click online', async () => {
  const d = fakeDrive();
  await setSetting('driveAutoBackup', true);
  useNet.setState({ online: false });
  const prepare = vi.fn(async () => {});
  expect(await autoBackupOnClick(prepare, () => d)).toBe('pending');
  expect(prepare).toHaveBeenCalled();
  expect(await getSetting('driveBackupPending', false)).toBe(true);
  useNet.setState({ online: true });
  expect(await autoBackupOnClick(async () => {}, () => d)).toBe('done');
  expect(d.upload).toHaveBeenCalledTimes(1);
});

test('a Google sign-in failure is reported and never throws', async () => {
  await setSetting('driveAutoBackup', true);
  const d = { upload: vi.fn(async () => { throw new Error('Google sign-in was closed'); }), prune: vi.fn() };
  const prepare = vi.fn(async () => {});
  expect(await autoBackupOnClick(prepare, () => d)).toMatch(/Google sign-in was closed/);
  expect(prepare).toHaveBeenCalled();
  expect(await getSetting('driveLastError', '')).toMatch(/closed/);
});
