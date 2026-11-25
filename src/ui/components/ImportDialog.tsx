import { useEffect, useState } from 'react';
import { useOnline } from '../../app/online';
import { useSpotify } from '../../app/spotifyStore';
import { importPoolJson, parseSongLines } from '../../core/io';
import type { Pool, Song } from '../../core/types';
import { listPools } from '../../db/repo';
import { matchLines, type MatchResult } from '../../spotify/match';

type Mode = 'skip' | 'keepBoth' | 'replace';
type Tab = 'file' | 'text' | 'spotify' | 'pool';

const plural = (n: number) => `${n} song${n === 1 ? '' : 's'}`;

export function ImportDialog({ currentPoolId, onImport, onClose }: {
  currentPoolId: string;
  onImport: (songs: Song[], mode: Mode) => void;
  onClose: () => void;
}) {
  const { api, connected } = useSpotify();
  const online = useOnline();
  const [tab, setTab] = useState<Tab>('file');
  const [mode, setMode] = useState<Mode>('skip');
  const [ready, setReady] = useState<{ songs: Song[]; source: string } | null>(null);
  const [review, setReview] = useState<MatchResult[] | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [mine, setMine] = useState<{ id: string; name: string; count: number }[] | null>(null);
  const [pools, setPools] = useState<Pool[]>([]);

  useEffect(() => { listPools().then((ps) => setPools(ps.filter((p) => p.id !== currentPoolId))); }, [currentPoolId]);

  const reset = () => { setReady(null); setReview(null); setErr(null); setProgress(null); };

  const runMatch = async (lines: ReturnType<typeof parseSongLines>) => {
    if (!lines.length) return setErr('No songs found in that text.');
    if (!online) return setErr('You’re offline — looking up songs on Spotify needs internet. Bingo playlist (.json) files still import.');
    if (!connected) return setErr('Connect Spotify in Settings to look up songs.');
    setProgress({ done: 0, total: lines.length });
    const r = await matchLines(api, lines, (done) => setProgress({ done, total: lines.length }));
    setProgress(null);
    setReview(r);
  };

  const onFile = async (f: File) => {
    reset();
    const body = await f.text();
    if (f.name.toLowerCase().endsWith('.json') || body.trim().startsWith('{')) {
      try {
        const p = importPoolJson(body);
        setReady({ songs: p.songs, source: `“${p.name}”` });
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    } else await runMatch(parseSongLines(body));
  };

  const loadSpotify = async (idOrUrl: string, name: string) => {
    reset();
    try {
      const songs = await api.playlistSongs(idOrUrl);
      setReady({ songs, source: name });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const reviewSongs = review?.flatMap((r) => (r.chosen ? [r.chosen] : [])) ?? [];
  const finalSongs = ready?.songs ?? reviewSongs;

  const TABS: { id: Tab; label: string }[] = [
    { id: 'file', label: 'File' },
    { id: 'text', label: 'Paste a list' },
    { id: 'spotify', label: 'Spotify playlist' },
    { id: 'pool', label: 'Another playlist' },
  ];

  return (
    <div role="dialog" aria-modal="true" aria-label="Import songs" className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/70 p-4">
      <div className="panel mt-10 w-full max-w-2xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Import songs</h2>
          <button type="button" className="btn px-3" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <div role="tablist" className="mb-4 flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} className="chip" aria-pressed={tab === t.id}
              onClick={() => { setTab(t.id); reset(); if (t.id === 'spotify' && !mine && connected) api.myPlaylists().then(setMine).catch((e) => setErr(String(e.message ?? e))); }}>{t.label}</button>
          ))}
        </div>

        {tab === 'file' && (
          <label className="flex flex-col gap-2">
            <span className="label">A Music Bingo playlist (.json) or a spreadsheet saved as CSV with title and artist columns.</span>
            <input type="file" aria-label="Playlist file (.json or .csv)" accept=".json,.csv,.txt,application/json,text/csv"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
        )}
        {tab === 'text' && (
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              <span className="label">One song per line, like “Queen - Bohemian Rhapsody”.</span>
              <textarea aria-label="Song list" rows={8} value={text} onChange={(e) => setText(e.target.value)} />
            </label>
            <button type="button" className="btn btn-a self-start" disabled={!text.trim() || !!progress} onClick={() => { reset(); void runMatch(parseSongLines(text)); }}>Find songs</button>
          </div>
        )}
        {tab === 'spotify' && !online && <p className="text-peak">You’re offline — importing from Spotify needs internet.</p>}
        {tab === 'spotify' && online && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <input aria-label="Spotify playlist link" placeholder="Paste a Spotify playlist link" value={link} onChange={(e) => setLink(e.target.value)} className="flex-1" />
              <button type="button" className="btn btn-a" disabled={!link.trim()} onClick={() => loadSpotify(link, 'the pasted playlist')}>Load</button>
            </div>
            <p className="text-xs text-dim">Spotify’s own editorial playlists may be blocked for apps — your own and friends’ playlists work.</p>
            {mine && (
              <ul className="grid max-h-64 gap-1 overflow-auto">
                {mine.map((p) => (
                  <li key={p.id}><button type="button" className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-booth-2" onClick={() => loadSpotify(p.id, `“${p.name}”`)}>
                    {p.name} <span className="text-dim">· {p.count}</span></button></li>
                ))}
              </ul>
            )}
          </div>
        )}
        {tab === 'pool' && (
          <ul className="grid max-h-64 gap-1 overflow-auto">
            {pools.length === 0 && <li className="text-dim">No other playlists yet.</li>}
            {pools.map((p) => (
              <li key={p.id}><button type="button" className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-booth-2" onClick={() => { reset(); setReady({ songs: p.songs, source: `“${p.name}”` }); }}>
                {p.name} <span className="text-dim">· {p.songs.length}</span></button></li>
            ))}
          </ul>
        )}

        {err && <p role="alert" className="mt-3 text-deck-b">{err}</p>}
        {progress && <p className="mt-3 text-dim" role="status">Looking up songs… {progress.done} / {progress.total}</p>}

        {review && (
          <div data-testid="match-review" className="mt-4 grid gap-3">
            {(['matched', 'choose', 'none'] as const).map((st) => {
              const rows = review.map((r, i) => ({ r, i })).filter(({ r }) => r.status === st);
              const title = st === 'matched' ? 'Matched' : st === 'choose' ? 'Pick one' : 'Not found';
              return (
                <details key={st} open={st !== 'matched'} className="rounded-lg border border-rail p-3">
                  <summary className="cursor-pointer font-semibold">{title} ({rows.length})</summary>
                  <ul className="mt-2 grid gap-1.5 text-sm">
                    {rows.map(({ r, i }) => (
                      <li key={i} className="flex flex-wrap items-center gap-2">
                        <span className="min-w-[10rem] flex-1 text-dim">{r.line.artist ? `${r.line.artist} – ` : ''}{r.line.title}</span>
                        {st !== 'none' && (
                          <select aria-label={`Match for ${r.line.title}`} value={r.chosen?.id ?? ''}
                            onChange={(e) => setReview(review.map((x, j) => (j === i ? { ...x, chosen: x.candidates.find((c) => c.id === e.target.value) } : x)))}>
                            <option value="">Skip</option>
                            {r.candidates.map((c) => <option key={c.id} value={c.id}>{c.title} — {c.artist}{c.year ? ` (${c.year})` : ''}</option>)}
                          </select>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              );
            })}
          </div>
        )}

        {ready && <p className="mt-4">{plural(ready.songs.length)} from {ready.source}.</p>}

        {(ready || review) && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <span className="label">If a song is already here</span>
              <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} aria-label="Duplicate handling">
                <option value="skip">Skip it</option>
                <option value="keepBoth">Keep both</option>
                <option value="replace">Replace it</option>
              </select>
            </label>
            <button type="button" className="btn btn-b ml-auto" disabled={!finalSongs.length} onClick={() => { onImport(finalSongs, mode); onClose(); }}>
              Add {plural(finalSongs.length)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
