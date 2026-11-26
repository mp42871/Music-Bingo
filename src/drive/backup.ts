import { useNet } from '../app/online';
import { exportBackup, getSetting, setSetting } from '../db/repo';
import type { DriveBackups } from './drive';
import { googleConnected } from './google';

type Uploader = Pick<DriveBackups, 'upload' | 'prune'>;
const KEEP = 20;
const TIMEOUT_MS = 120_000;
const pad = (n: number) => String(n).padStart(2, '0');

// Kept in memory so a click can decide synchronously (Google's sign-in popup must open inside the click).
let autoSetting: boolean | null = null;
let pending = false;

/** Auto-backup is on if the host turned it on, or — never set — once Google is connected. */
export const autoBackupEnabled = () => autoSetting ?? googleConnected();

export async function loadAutoBackupSetting() {
  autoSetting = await getSetting<boolean | null>('driveAutoBackup', null);
  pending = await getSetting('driveBackupPending', false);
  return autoBackupEnabled();
}

export async function setAutoBackup(on: boolean) {
  autoSetting = on;
  await setSetting('driveAutoBackup', on);
}

/** First successful use of Drive turns automatic backup on, unless the host already chose. */
export async function noteDriveConnected() {
  if (autoSetting === null) await setAutoBackup(true);
}

async function markPending(on: boolean) {
  pending = on;
  await setSetting('driveBackupPending', on);
}

export function backupFileName(d = new Date()): string {
  return `Music Bingo backup ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}-${pad(d.getMinutes())}.json`;
}

export async function backupNow(drive: Uploader): Promise<void> {
  await drive.upload(backupFileName(), await exportBackup());
  await setSetting('driveLastBackupAt', Date.now());
  await markPending(false);
  await setSetting('driveLastError', '');
  await noteDriveConnected();
  await drive.prune(KEEP).catch(() => {}); // tidying old backups must never fail a backup
}

const withTimeout = <T,>(p: Promise<T>) =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('Google Drive took too long to answer.')), TIMEOUT_MS))]);

/**
 * Run from a click (e.g. End game). `saved` resolves once `prepare` (saving the game) is done — callers
 * can move on then; `result` settles later: 'off' | 'pending' | 'done' | an error message. Never throws.
 */
export function autoBackupOnClick(prepare: () => Promise<void>, drive: () => Uploader): { saved: Promise<void>; result: Promise<string> } {
  const on = autoBackupEnabled();
  // Start Google sign-in now, synchronously inside the click (popups are only allowed there).
  const d = on && useNet.getState().online ? drive() : null;
  const saved = prepare();
  const result = (async () => {
    await saved.catch(() => {});
    if (!on) return 'off';
    if (!d) { await markPending(true); return 'pending'; }
    try {
      await withTimeout(backupNow(d));
      return 'done';
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await setSetting('driveLastError', msg);
      await markPending(true);
      return msg;
    }
  })();
  return { saved, result };
}

/** While a backup is waiting, the next click made online runs it (inside that click). */
export function installPendingRetry(drive: () => Uploader): () => void {
  let running = false;
  const onClick = () => {
    if (!pending || running || !useNet.getState().online) return;
    running = true;
    const d = drive();
    backupNow(d).catch(async (e) => { await setSetting('driveLastError', e instanceof Error ? e.message : String(e)); })
      .finally(() => { running = false; });
  };
  document.addEventListener('click', onClick, true);
  return () => document.removeEventListener('click', onClick, true);
}
