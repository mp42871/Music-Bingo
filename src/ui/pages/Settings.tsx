import { useEffect, useState } from 'react';
import { useSpotify } from '../../app/spotifyStore';
import { DEFAULT_CLIP } from '../../core/clip';
import { download } from '../../core/io';
import type { ClipSettings } from '../../core/types';
import { exportBackup, getSetting, importBackup, setSetting } from '../../db/repo';
import { redirectUri } from '../../spotify/config';
import { ClipSettingsPanel } from '../components/ClipSettingsPanel';
import { Field, PageHeader, Section } from '../components/Field';

export default function Settings() {
  const sp = useSpotify();
  const [clientId, setClientId] = useState(sp.clientId);
  const [clip, setClip] = useState<ClipSettings>(DEFAULT_CLIP);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    getSetting('clientId', sp.clientId).then(setClientId);
    getSetting('clip', DEFAULT_CLIP).then((c) => setClip({ ...DEFAULT_CLIP, ...c }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3000); };

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <PageHeader title="Settings" />
      {msg && <p role="status" className="mb-4 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-ok">{msg}</p>}
      <div className="grid gap-5">
        <Section
          title="Spotify"
          aside={sp.connected
            ? <span className="chip text-ok">Connected{sp.profile ? ` as ${sp.profile.name}` : ''}</span>
            : <span className="chip text-dim">Not connected</span>}
        >
          {sp.profile && sp.profile.product !== 'premium' && (
            <p className="mb-3 text-peak">This account isn’t Premium — Spotify only allows in-app playback for Premium accounts.</p>
          )}
          {sp.error && <p className="mb-3 text-deck-b">{sp.error}</p>}
          <div className="grid gap-4">
            <Field label="Spotify Client ID" hint="From your app at developer.spotify.com/dashboard. It’s not a secret.">
              <div className="flex gap-2">
                <input id="client-id" aria-label="Spotify Client ID" value={clientId} onChange={(e) => setClientId(e.target.value)} className="flex-1 font-mono" />
                <button type="button" className="btn" onClick={async () => { await sp.setClientId(clientId); flash('Client ID saved.'); }}>Save Client ID</button>
              </div>
            </Field>
            <div>
              <span className="label">Redirect URI to add in your Spotify app</span>
              <p className="mt-1 select-all rounded-lg border border-rail bg-night px-3 py-2 font-mono text-sm text-deck-a">{redirectUri()}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {sp.connected
                ? <button type="button" className="btn" onClick={() => sp.logout()}>Disconnect</button>
                : null}
              <button type="button" className="btn btn-a" disabled={!clientId.trim()}
                onClick={async () => { await sp.setClientId(clientId); await sp.login(); }}>
                {sp.connected ? 'Reconnect Spotify' : 'Connect Spotify'}
              </button>
            </div>
            <details className="rounded-lg border border-rail p-3 text-sm text-dim">
              <summary className="cursor-pointer font-semibold text-ink">First-time Spotify setup</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Go to developer.spotify.com/dashboard and sign in with your Premium account.</li>
                <li>Create an app. Tick “Web API” and “Web Playback SDK”.</li>
                <li>Add the redirect URI shown above (and http://127.0.0.1:5173/ if you run it locally).</li>
                <li>Copy the Client ID here, save, then press Connect Spotify.</li>
              </ol>
            </details>
          </div>
        </Section>

        <Section title="Game defaults">
          <ClipSettingsPanel value={clip} onChange={setClip} />
          <div className="mt-4 flex gap-2">
            <button type="button" className="btn btn-a" onClick={async () => { await setSetting('clip', clip); flash('Game defaults saved.'); }}>Save game defaults</button>
            <button type="button" className="btn" onClick={() => setClip(DEFAULT_CLIP)}>Reset</button>
          </div>
        </Section>

        <Section title="Backup">
          <p className="mb-3 text-sm text-dim">Everything (playlists, cards, game history) lives in this browser. Download a backup now and then.</p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn" onClick={async () => download(`music-bingo-backup-${new Date().toISOString().slice(0, 10)}.json`, await exportBackup())}>Download backup</button>
            <label className="btn cursor-pointer">
              Restore…
              <input aria-label="Restore from backup file" type="file" accept="application/json,.json" className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const replace = window.confirm('Replace everything in this browser with the backup? Press Cancel to merge instead.');
                  try { await importBackup(await f.text(), replace ? 'replace' : 'merge'); flash('Backup restored.'); }
                  catch (err) { flash(err instanceof Error ? err.message : 'Restore failed.'); }
                  e.target.value = '';
                }} />
            </label>
          </div>
        </Section>
      </div>
    </main>
  );
}
