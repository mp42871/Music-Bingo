import { useEffect, useState } from 'react';
import { useOnline } from '../../app/online';
import { autoBackupEnabled, backupNow, loadAutoBackupSetting, noteDriveConnected, setAutoBackup } from '../../drive/backup';
import type { BackupFile } from '../../drive/drive';
import { disconnectGoogle, googleConnected } from '../../drive/google';
import { driveService, preloadGoogle, refreshGoogleClientId } from '../../drive/service';
import { getSetting, importBackup, setSetting } from '../../db/repo';
import { DEFAULT_GOOGLE_CLIENT_ID } from '../../drive/config';
import { Field, Section } from './Field';

const when = (t: number) => new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function DriveSection() {
  const online = useOnline();
  const [clientId, setClientId] = useState('');
  const [savedId, setSavedId] = useState('');
  const [auto, setAuto] = useState(false);
  const [last, setLast] = useState(0);
  const [pending, setPending] = useState(false);
  const [lastErr, setLastErr] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [backups, setBackups] = useState<BackupFile[] | null>(null);
  const [connected, setConnected] = useState(googleConnected());

  const refresh = async () => {
    const own = (await getSetting('googleClientId', '')).trim();
    setClientId(own);
    setSavedId((await refreshGoogleClientId()) || DEFAULT_GOOGLE_CLIENT_ID);
    setAuto(await loadAutoBackupSetting());
    setLast(await getSetting('driveLastBackupAt', 0));
    setPending(await getSetting('driveBackupPending', false));
    setLastErr(await getSetting('driveLastError', ''));
    preloadGoogle();
  };
  useEffect(() => { void refresh(); }, []);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setErr(null); setMsg(null);
    try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(null); }
  };

  const ready = !!savedId && online;

  return (
    <Section title="Google Drive backup" aside={connected ? <span className="chip text-ok">Connected</span> : <span className="chip text-dim">Not connected</span>}>
      <p className="mb-3 text-sm text-dim">Saves your playlists, cards, game history and settings to a “Music Bingo Backups” folder in your Drive (not music files). The app can only see the files it creates.</p>
      <div className="grid gap-4">
        <p className="text-sm">Press <strong>Back up now</strong> and sign in with Google — backups go to the Drive of whoever signs in.</p>
        <details className="rounded-lg border border-rail p-3 text-sm text-dim">
          <summary className="cursor-pointer font-semibold text-ink">Advanced: use your own Google Cloud project</summary>
          <p className="mt-2">Not needed — the app has its own. Leave empty to use it.</p>
          <div className="mt-2">
            <Field label="Google Client ID">
              <div className="flex gap-2">
                <input aria-label="Google Client ID" value={clientId} onChange={(e) => setClientId(e.target.value)} className="flex-1 font-mono text-sm" placeholder="Built in (leave empty)" />
                <button type="button" className="btn" onClick={async () => { await setSetting('googleClientId', clientId.trim()); await refresh(); setMsg(clientId.trim() ? 'Your Client ID is saved.' : 'Using the built-in Google connection.'); }}>Save</button>
              </div>
            </Field>
          </div>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Open the Google Cloud console (console.cloud.google.com) and create a project, e.g. “Music Bingo”.</li>
            <li>APIs &amp; Services → Library → enable <strong>Google Drive API</strong>.</li>
            <li>OAuth consent screen → External → app name and your email → add the scope <code>…/auth/drive.file</code> → Publish app (this scope needs no Google review).</li>
            <li>Credentials → Create credentials → OAuth client ID → Web application. Authorized JavaScript origins: <code>{window.location.origin}</code> (and <code>http://127.0.0.1:5173</code> if you run it locally). No redirect URI needed.</li>
            <li>Copy the Client ID into the box above and press Save.</li>
          </ol>
        </details>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-a" disabled={!ready || !!busy}
            onClick={() => run('Backing up…', async () => {
              const d = driveService();
              await backupNow(d);
              setConnected(true);
              await refresh();
              setMsg('Backed up to Google Drive.');
            })}>Back up now</button>
          <button type="button" className="btn" disabled={!ready || !!busy}
            onClick={() => run('Loading backups…', async () => { setBackups(await driveService().list()); setConnected(true); await noteDriveConnected(); setAuto(autoBackupEnabled()); })}>Restore from Drive</button>
          {connected && <button type="button" className="btn text-dim" onClick={() => {
            if (!confirm('Disconnect Google Drive? Automatic backups stop until you connect again. Your backups stay in Drive.')) return;
            disconnectGoogle(); setConnected(false); setBackups(null);
          }}>Disconnect Google</button>}
        </div>
        {!online && <p className="text-sm text-peak">You’re offline — Drive backups need internet.</p>}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={auto} onChange={async (e) => { setAuto(e.target.checked); await setAutoBackup(e.target.checked); }} />
          Back up automatically when a game ends
        </label>
        <div className="text-sm text-dim">
          {last ? <p>Last backup: {when(last)}</p> : <p>No backups yet.</p>}
          {pending && <p className="text-peak">A backup is waiting — it runs at the next game end or when you press Back up now.</p>}
          {lastErr && <p className="text-deck-b">Last automatic backup failed: {lastErr}</p>}
        </div>
        {busy && <p role="status" className="text-deck-a">{busy}</p>}
        {msg && <p role="status" className="text-ok">{msg}</p>}
        {err && <p role="alert" className="text-deck-b">{err}</p>}
        {backups && (
          <div className="rounded-lg border border-rail p-3">
            {backups.length === 0 ? <p className="text-dim">No backups in your Drive yet.</p> : (
              <ul className="grid gap-1.5 text-sm">
                {backups.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1 truncate">{b.name} <span className="text-dim">· {(b.size / 1024).toFixed(0)} KB</span></span>
                    <button type="button" className="btn px-2 py-1 text-xs" aria-label={`Merge ${b.name}`}
                      onClick={() => run('Restoring…', async () => { await importBackup(await driveService().download(b.id), 'merge'); await refresh(); setMsg(`Restored “${b.name}” (merged with what’s here).`); })}>Merge</button>
                    <button type="button" className="btn px-2 py-1 text-xs" aria-label={`Replace with ${b.name}`}
                      onClick={() => run('Restoring…', async () => {
                        if (!confirm('Replace everything in this browser with this backup?')) return;
                        await importBackup(await driveService().download(b.id), 'replace');
                        await refresh();
                        setMsg(`Restored “${b.name}” (replaced everything).`);
                      })}>Replace</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Section>
  );
}
