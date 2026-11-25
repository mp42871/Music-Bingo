import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { readAudioMeta } from '../../audio/ingest';
import { formatTime } from '../../core/io';
import { fileSong } from '../../core/offline';
import { uid } from '../../core/rng';
import type { AudioFile } from '../../core/types';
import * as audio from '../../db/audio';
import { listPools, savePool } from '../../db/repo';
import { PageHeader } from '../components/Field';

const mb = (b: number) => `${(b / 1024 / 1024).toFixed(b > 100 * 1024 * 1024 ? 0 : 1)} MB`;

export default function Library() {
  const nav = useNavigate();
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [quota, setQuota] = useState<{ usage: number; quota: number } | null>(null);

  const refresh = async () => {
    setFiles(await audio.listAudio());
    try { const e = await navigator.storage?.estimate?.(); if (e?.quota) setQuota({ usage: e.usage ?? 0, quota: e.quota }); } catch { /* not supported */ }
  };
  useEffect(() => { void refresh(); }, []);

  const add = async (list: FileList | null) => {
    if (!list?.length) return;
    const picked = [...list].filter((f) => f.type.startsWith('audio/') || /\.(mp3|m4a|aac|wav|ogg|oga|flac|opus|webm)$/i.test(f.name));
    setErr(null);
    const full: string[] = [];
    const unreadable: string[] = [];
    setBusy({ done: 0, total: picked.length });
    for (let i = 0; i < picked.length; i++) {
      try {
        const { blob, ...meta } = await readAudioMeta(picked[i]);
        await audio.saveAudio(meta, blob);
      } catch (e) {
        const err = e as { name?: string; inner?: { name?: string } };
        // The database may wrap the quota error in an AbortError.
        if (err?.name === 'QuotaExceededError' || err?.inner?.name === 'QuotaExceededError') full.push(picked[i].name);
        else unreadable.push(picked[i].name);
      }
      setBusy({ done: i + 1, total: picked.length });
    }
    setBusy(null);
    const msgs = [];
    if (full.length) msgs.push(`This browser’s storage is full. These files weren’t saved: ${full.join(', ')}. Delete some files or use a computer with more free space.`);
    if (unreadable.length) msgs.push(`Couldn’t read: ${unreadable.join(', ')}.`);
    if (msgs.length) setErr(msgs.join(' '));
    await refresh();
  };

  const remove = async (f: AudioFile) => {
    if (!confirm(`Remove “${f.title}” from this computer? Songs linked to it will use Spotify or manual play instead.`)) return;
    await audio.deleteAudio(f.id);
    for (const p of await listPools()) {
      if (p.songs.some((s) => s.fileId === f.id))
        await savePool({ ...p, songs: p.songs.map((s) => (s.fileId === f.id ? (({ fileId: _x, ...rest }) => (void _x, rest))(s) : s)), updatedAt: Date.now() });
    }
    await refresh();
  };

  const makePlaylist = async () => {
    const chosen = files.filter((f) => selected.size === 0 || selected.has(f.id));
    const p = { id: uid(), name: 'My music files', songs: chosen.map(fileSong), categories: [], createdAt: Date.now(), updatedAt: Date.now() };
    await savePool(p);
    nav(`/pools/${p.id}`);
  };

  const shown = files.filter((f) => !q || `${f.title} ${f.artist} ${f.name}`.toLowerCase().includes(q.toLowerCase()));
  const total = files.reduce((a, f) => a + f.size, 0);
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <PageHeader title="Music files">
        <label className="btn cursor-pointer">
          Add folder
          <input type="file" aria-label="Add music folder" className="sr-only" multiple
            {...({ webkitdirectory: '', directory: '' } as Record<string, string>)} onChange={(e) => { void add(e.target.files); e.target.value = ''; }} />
        </label>
        <label className="btn btn-a cursor-pointer">
          Add files
          <input type="file" aria-label="Add music files" className="sr-only" multiple accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac,.opus"
            onChange={(e) => { void add(e.target.files); e.target.value = ''; }} />
        </label>
      </PageHeader>
      <p className="mb-5 max-w-2xl text-dim">Music you own, saved inside this browser so games play with no internet. Link files to playlist songs from a playlist’s <em>Link music files</em> button, or make a playlist straight from them.</p>
      {busy && <p role="status" className="mb-4 text-deck-a">Saving files… {busy.done} / {busy.total}</p>}
      {err && <p role="alert" className="mb-4 rounded-lg border border-deck-b/50 bg-deck-b/10 px-3 py-2">{err}</p>}

      <div className="panel p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <span className="font-semibold">{files.length} files · {mb(total)}</span>
          {quota && <span className="text-sm text-dim">{mb(quota.quota - quota.usage)} free in this browser</span>}
          <input aria-label="Search files" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} className="ml-auto w-48" />
          <button type="button" className="btn btn-b" disabled={!files.length} onClick={makePlaylist}>
            Make a playlist from these files{selected.size ? ` (${selected.size})` : ''}
          </button>
        </div>
        {files.length === 0
          ? <p className="py-10 text-center text-dim">No files yet. Add MP3, M4A, WAV, OGG or FLAC files you own.</p>
          : (
            <ul className="grid grid-cols-1 gap-1 text-sm">
              {shown.map((f) => (
                <li key={f.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-booth-2">
                  <input type="checkbox" aria-label={`Select ${f.title}`} checked={selected.has(f.id)} onChange={() => toggle(f.id)} />
                  <span className="min-w-0 flex-1 truncate"><span className="font-semibold">{f.title}</span> <span className="text-dim">· {f.artist || 'Unknown artist'}</span></span>
                  <span className="hidden truncate text-xs text-dim md:inline md:max-w-56">{f.name}</span>
                  <span className="tabular-nums text-dim">{formatTime(f.durationMs)}</span>
                  <span className="w-16 text-right tabular-nums text-dim">{mb(f.size)}</span>
                  <button type="button" className="px-1.5 text-dim hover:text-deck-b" aria-label={`Remove ${f.title}`} onClick={() => remove(f)}>✕</button>
                </li>
              ))}
            </ul>
          )}
      </div>
    </main>
  );
}
