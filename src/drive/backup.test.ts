import { autoBackupOnClick, backupFileName, backupNow, installPendingRetry, loadAutoBackupSetting, setAutoBackup } from './backup';
import { db } from '../db/db';
import { getSetting, setSetting } from '../db/repo';
import { useNet } from '../app/online';

const fakeDrive = () => ({ upload: vi.fn(async () => 'id'), prune: vi.fn(async () => {}) });

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  useNet.setState({ online: true });
  localStorage.removeItem('mb.google.granted');
  await loadAutoBackupSetting();
});

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
  await setAutoBackup(false);
  const r = autoBackupOnClick(async () => {}, () => d);
  await r.saved;
  expect(await r.result).toBe('off');
  expect(d.upload).not.toHaveBeenCalled();
});

test('auto backup defaults to on once Google is connected (same rule as the Settings checkbox)', async () => {
  localStorage.setItem('mb.google.granted', '1');
  await loadAutoBackupSetting();
  const d = fakeDrive();
  expect(await autoBackupOnClick(async () => {}, () => d).result).toBe('done');
});

test('Google sign-in starts synchronously inside the click, before anything is awaited', async () => {
  await setAutoBackup(true);
  const drive = vi.fn(fakeDrive);
  void autoBackupOnClick(async () => {}, drive);
  expect(drive).toHaveBeenCalledTimes(1);
});

test('saving the game finishes even if the backup never does', async () => {
  await setAutoBackup(true);
  const d = { upload: vi.fn(() => new Promise<string>(() => {})), prune: vi.fn() };
  const prepare = vi.fn(async () => {});
  const r = autoBackupOnClick(prepare, () => d);
  await r.saved;
  expect(prepare).toHaveBeenCalled();
});

test('auto backup offline marks it pending, then runs on the next click online', async () => {
  const d = fakeDrive();
  await setAutoBackup(true);
  useNet.setState({ online: false });
  expect(await autoBackupOnClick(async () => {}, () => d).result).toBe('pending');
  expect(await getSetting('driveBackupPending', false)).toBe(true);
  const stop = installPendingRetry(() => d);
  useNet.setState({ online: true });
  document.body.click();
  await vi.waitFor(() => expect(d.upload).toHaveBeenCalledTimes(1));
  document.body.click();
  await new Promise((r) => setTimeout(r, 20));
  expect(d.upload).toHaveBeenCalledTimes(1);
  stop();
});

test('a Google sign-in failure is reported and never throws', async () => {
  await setAutoBackup(true);
  const d = { upload: vi.fn(async () => { throw new Error('Google sign-in was closed'); }), prune: vi.fn() };
  expect(await autoBackupOnClick(async () => {}, () => d).result).toMatch(/Google sign-in was closed/);
  expect(await getSetting('driveLastError', '')).toMatch(/closed/);
});
