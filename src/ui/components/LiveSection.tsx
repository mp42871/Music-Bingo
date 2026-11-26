import { useEffect, useState } from 'react';
import { getSetting, setSetting } from '../../db/repo';
import { liveBackend } from '../../live/config';
import { SETUP_SQL } from '../../live/sql';
import { Field, Section } from './Field';

export function LiveSection() {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([getSetting('supabaseUrl', ''), getSetting('supabaseKey', '')]).then(([u, k]) => { setUrl(u); setKey(k); setSaved(!!u && !!k); });
  }, []);

  const save = async () => {
    setErr(null); setMsg(null);
    const u = url.trim().replace(/\/+$/, '');
    if (u && !u.startsWith('https://')) return setErr('The Project URL should start with https:// (copy it from Supabase → Project Settings → API).');
    await setSetting('supabaseUrl', u);
    await setSetting('supabaseKey', key.trim());
    setSaved(!!u && !!key.trim());
    setMsg('Saved. New games go live when the DJ console opens.');
  };

  const test = async () => {
    setErr(null); setMsg('Checking…');
    try {
      const b = await liveBackend();
      if (!b) throw new Error('Save the Project URL and key first.');
      await b.getGame('0000');
      setMsg('Connected — live play is ready.');
    } catch (e) { setMsg(null); setErr(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <Section title="Live play (phones)" aside={saved ? <span className="chip text-ok">Set up</span> : <span className="chip text-dim">Not set up</span>}>
      <p className="mb-3 text-sm text-dim">Players join from their phones with a short code, pick or get a card, daub it, and press BINGO — claims pop up on your console already checked. Uses your own free Supabase project.</p>
      <details open={!saved} className="mb-4 rounded-lg border border-rail p-3 text-sm text-dim">
        <summary className="cursor-pointer font-semibold text-ink">One-time setup (about 10 minutes)</summary>
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
      </details>
      <div className="grid gap-3">
        <Field label="Supabase Project URL"><input aria-label="Supabase Project URL" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" className="font-mono text-sm" /></Field>
        <Field label="Supabase publishable key" hint="Safe to share — it only allows what the setup script permits."><input aria-label="Supabase publishable key" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sb_publishable_… or eyJ…" className="font-mono text-sm" /></Field>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-a" onClick={save}>Save live play settings</button>
          <button type="button" className="btn" disabled={!saved} onClick={test}>Test connection</button>
        </div>
        {msg && <p role="status" className="text-sm text-ok">{msg}</p>}
        {err && <p role="alert" className="text-sm text-deck-b">{err}</p>}
      </div>
    </Section>
  );
}
