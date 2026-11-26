import { useEffect, useState } from 'react';
import { getSetting, setSetting } from '../../db/repo';
import { hostProject, liveBackend } from '../../live/config';
import { SETUP_SQL } from '../../live/sql';
import { Field, Section } from './Field';

type Mode = 'site' | 'own' | 'none';

export function LiveSection() {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);

  const refresh = async () => {
    const [u, k, proj] = await Promise.all([getSetting('supabaseUrl', ''), getSetting('supabaseKey', ''), hostProject()]);
    setUrl(u); setKey(k);
    setMode(!proj ? 'none' : proj.fromSite ? 'site' : 'own');
  };
  useEffect(() => { void refresh(); }, []);

  const save = async () => {
    setErr(null); setMsg(null);
    const u = url.trim().replace(/\/+$/, '');
    if (u && !u.startsWith('https://')) return setErr('The Project URL should start with https:// (copy it from Supabase → Project Settings → API).');
    await setSetting('supabaseUrl', u);
    await setSetting('supabaseKey', key.trim());
    await refresh();
    setMsg(u && key.trim() ? 'Saved. New games use your own project.' : 'Using this site’s live play.');
  };

  const test = async () => {
    setErr(null); setMsg('Checking…');
    try {
      const b = await liveBackend();
      if (!b) throw new Error('Live play isn’t set up yet — see Advanced below.');
      await b.getGame('0000');
      setMsg('Connected — live play is ready.');
    } catch (e) { setMsg(null); setErr(e instanceof Error ? e.message : String(e)); }
  };

  const status = mode === 'own' ? <span className="chip text-ok">Your own project</span>
    : mode === 'site' ? <span className="chip text-ok">Ready</span>
      : mode === 'none' ? <span className="chip text-dim">Not set up</span> : null;

  return (
    <Section title="Live play (phones)" aside={status}>
      <p className="mb-3 text-sm text-dim">Players join from their phones with a short code, pick or get a card, daub it, and press BINGO — claims pop up on your console already checked.</p>
      {mode === 'site' && <p className="mb-3 text-sm">Built in — nothing to set up. Games go live when the DJ console opens, on any device.</p>}
      <div className="mb-3 flex flex-wrap gap-2">
        <button type="button" className="btn" disabled={mode === 'none'} onClick={test}>Test connection</button>
      </div>
      <details open={mode === 'none'} className="rounded-lg border border-rail p-3 text-sm text-dim">
        <summary className="cursor-pointer font-semibold text-ink">Advanced: use your own Supabase project</summary>
        <p className="mt-2">Not needed{mode === 'none' ? ' on the main site' : ''} — leave the boxes empty to use the site’s live play. The setup script is also here if an update asks you to run it again.</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Sign up free at supabase.com and create a project (any name, e.g. “Music Bingo”; pick a region near you).</li>
          <li>Open <strong>SQL Editor</strong> → New query, paste the setup script below, and press <strong>Run</strong>.</li>
          <li><strong>Authentication → Sign In / Providers</strong>: turn on <strong>Allow anonymous sign-ins</strong> and save.</li>
          <li><strong>Project Settings → API</strong> (or the Connect button): copy the <strong>Project URL</strong> and the <strong>publishable key</strong> (or “anon public” key) into the boxes below.</li>
          <li>Press Save, then Test connection.</li>
        </ol>
        <div className="mt-3 flex items-center gap-2">
          <button type="button" className="btn text-xs" onClick={() => navigator.clipboard?.writeText(SETUP_SQL).then(() => setMsg('Setup script copied.'), () => {})}>Copy setup script</button>
        </div>
        <pre className="mt-2 max-h-40 overflow-auto rounded bg-night p-2 text-xs">{SETUP_SQL}</pre>
        <div className="mt-3 grid gap-3">
          <Field label="Supabase Project URL"><input aria-label="Supabase Project URL" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Built in (leave empty)" className="font-mono text-sm" /></Field>
          <Field label="Supabase publishable key" hint="Safe to share — it only allows what the setup script permits. Never paste the secret / service_role key."><input aria-label="Supabase publishable key" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sb_publishable_… or eyJ…" className="font-mono text-sm" /></Field>
          <div><button type="button" className="btn btn-a" onClick={save}>Save live play settings</button></div>
        </div>
      </details>
      {msg && <p role="status" className="mt-3 text-sm text-ok">{msg}</p>}
      {err && <p role="alert" className="mt-3 text-sm text-deck-b">{err}</p>}
    </Section>
  );
}
