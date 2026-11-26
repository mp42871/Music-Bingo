import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { gameToCsv } from '../../core/claim';
import { cleanTitle, download } from '../../core/io';
import { patternName } from '../../core/patterns';
import type { Game } from '../../core/types';
import { clearGames, deleteGame, getSetting, listGames } from '../../db/repo';
import { cardNo } from '../components/CardGrid';
import { PageHeader } from '../components/Field';

export default function History() {
  const [params] = useSearchParams();
  const [games, setGames] = useState<Game[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(params.get('game'));
  const [q, setQ] = useState('');
  const [backupErr, setBackupErr] = useState('');
  useEffect(() => {
    listGames().then(setGames);
    // The End game backup finishes in the background; check shortly after arriving.
    const check = () => Promise.all([getSetting('driveBackupPending', false), getSetting('driveLastError', '')]).then(([p, e]) => setBackupErr(p && e ? e : ''));
    void check();
    const t = setTimeout(check, 8000);
    return () => clearTimeout(t);
  }, []);

  const shown = games?.filter((g) => !q || g.name.toLowerCase().includes(q.toLowerCase())) ?? [];
  const open = games?.find((g) => g.id === openId) ?? null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <PageHeader title="History">
        <input aria-label="Search games" placeholder="Search games" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="btn" disabled={!games?.length}
          onClick={async () => {
            if (!confirm(`Delete all ${games!.length} games from history? Called songs, winners and in-progress games are removed for good. Playlists and cards are kept.`)) return;
            await clearGames();
            setGames([]);
            setOpenId(null);
          }}>Clear history</button>
      </PageHeader>
      {backupErr && (
        <p role="alert" className="mb-4 rounded-lg border border-deck-b/50 bg-deck-b/10 px-3 py-2">Your games are saved here, but the last Google Drive backup didn’t finish ({backupErr}). It will try again on your next click while online, or open Settings → Google Drive and press Back up now.</p>
      )}
      {games?.length === 0 && <p className="text-dim">Games you run show up here with every song that was called.</p>}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <ul className="grid h-fit gap-2">
          {shown.map((g) => (
            <li key={g.id}>
              <button type="button" onClick={() => setOpenId(g.id)}
                className={`panel w-full p-3 text-left ${openId === g.id ? 'border-deck-b' : 'hover:border-dim'}`}>
                <div className="font-semibold">{g.name}</div>
                <div className="text-sm text-dim">{new Date(g.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} · {g.calls.length} songs · {g.rounds.reduce((a, r) => a + r.winners.length, 0)} winners{g.status !== 'finished' ? ' · in progress' : ''}</div>
              </button>
            </li>
          ))}
        </ul>
        {open && <GameDetail game={open} onDelete={async () => { if (confirm(`Delete “${open.name}” from history?`)) { await deleteGame(open.id); setGames(await listGames()); setOpenId(null); } }} />}
      </div>
    </main>
  );
}

function GameDetail({ game, onDelete }: { game: Game; onDelete(): void }) {
  const songs = new Map(game.pool.songs.map((s) => [s.id, s]));
  return (
    <section className="panel p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-xl font-bold">{game.name}</h2>
        {game.status !== 'finished' && <Link to={`/console/${game.id}`} className="btn btn-b">Resume</Link>}
        <Link to={`/print/${game.cardSetId}`} className="btn">Reprint cards</Link>
        <Link to={`/print/${game.cardSetId}?mode=master&game=${game.id}`} className="btn">Call sheet</Link>
        <button type="button" className="btn" onClick={() => download(`${game.name}-calls.csv`, gameToCsv(game), 'text/csv')}>Export CSV</button>
        <button type="button" className="btn" onClick={() => download(`${game.name}.json`, JSON.stringify(game, null, 2))}>Export JSON</button>
        <button type="button" className="btn text-dim" onClick={onDelete}>Delete</button>
      </div>
      <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {game.rounds.map((r, i) => (
          <div key={i} className="rounded-xl border border-rail p-3">
            <div className="font-semibold">Round {i + 1} · {patternName(r.patternId)}</div>
            <div className="text-xs text-dim">Songs {r.startCall + 1}–{r.endCall ?? game.calls.length}</div>
            {r.winners.length === 0
              ? <p className="mt-1 text-sm text-dim">No winners recorded.</p>
              : (
                <ul className="mt-1 text-sm">
                  {r.winners.map((w) => <li key={w.cardNumber}><span className="font-mono text-ok">{cardNo(w.cardNumber)}</span> {w.name ?? ''}{w.prize ? ` — ${w.prize}` : ''} <span className="text-dim">(song {w.atCall})</span></li>)}
                </ul>
              )}
          </div>
        ))}
      </div>
      <h3 className="mb-2 font-semibold">Songs called</h3>
      <ol className="grid gap-x-6 gap-y-1 text-sm md:grid-cols-2">
        {game.calls.map((c, i) => {
          const s = songs.get(c.songId);
          return (
            <li key={c.songId} aria-label={`Call ${i + 1}`} className="flex gap-2">
              <span className="w-7 shrink-0 text-right text-dim tabular-nums">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate"><span className="font-semibold">{s ? s.displayTitle ?? cleanTitle(s.title) : '?'}</span> <span className="text-dim">· {s?.artist}</span></span>
              <span className="text-xs text-dim tabular-nums">{new Date(c.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
