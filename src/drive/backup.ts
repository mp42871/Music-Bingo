import { useNet } from '../app/online';
import { exportBackup, getSetting, setSetting } from '../db/repo';
import type { DriveBackups } from './drive';

type Uploader = Pick<DriveBackups, 'upload' | 'prune'>;
const KEEP = 20;
const pad = (n: number) => String(n).padStart(2, '0');

export function backupFileName(d = new Date()): string {
  return `Music Bingo backup ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}-${pad(d.getMinutes())}.json`;
}

export async function backupNow(drive: Uploader): Promise<void> {
  await drive.upload(backupFileName(), await exportBackup());
  await setSetting('driveLastBackupAt', Date.now());
  await setSetting('driveBackupPending', false);
  await setSetting('driveLastError', '');
  await drive.prune(KEEP).catch(() => {}); // tidying old backups must never fail a backup
}

/**
 * Run from a click (e.g. End game) so Google sign-in can refresh. `prepare` saves the latest state first.
 * Returns 'off' | 'pending' | 'done' | an error message; never throws.
 */
export async function autoBackupOnClick(prepare: () => Promise<void>, drive: () => Uploader): Promise<string> {
  const on = await getSetting('driveAutoBackup', false);
  if (!on) { await prepare(); return 'off'; }
  // Start Google sign-in inside the click (popups are only allowed there), then save the game.
  const d = useNet.getState().online ? drive() : null;
  await prepare();
  if (!d) { await setSetting('driveBackupPending', true); return 'pending'; }
  try {
    await backupNow(d);
    return 'done';
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await setSetting('driveLastError', msg);
    await setSetting('driveBackupPending', true);
    return msg;
  }
}
