import { getSetting } from '../db/repo';
import { DEFAULT_GOOGLE_CLIENT_ID } from './config';
import { DriveBackups } from './drive';
import { getDriveToken, loadGoogle } from './google';

let clientId = DEFAULT_GOOGLE_CLIENT_ID;
export async function refreshGoogleClientId() { clientId = (await getSetting('googleClientId', '')) || DEFAULT_GOOGLE_CLIENT_ID; return clientId; }

/** Starts Google sign-in right away (keep this inside a click) and returns a Drive backups client. */
export function driveService(): DriveBackups {
  const first = getDriveToken(clientId);
  first.catch(() => {});
  let used = false;
  return new DriveBackups(() => { if (!used) { used = true; return first; } return getDriveToken(clientId); });
}

export function preloadGoogle() { if (clientId) void loadGoogle().catch(() => {}); }
