import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DEFAULT_CLIP } from '../../core/clip';
import { makeCallOrder, tuneCallOrder } from '../../core/forecast';
import { masksFor, PATTERNS } from '../../core/patterns';
import { randomSeed, uid } from '../../core/rng';
import type { CardSet, ClipSettings, Game, Song } from '../../core/types';
import { getSetting, listCardSets, listGames, saveGame } from '../../db/repo';
import { liveSongsFor } from '../../game/liveSongs';
import { withLatestFiles } from '../../core/offline';
import { ClipSettingsPanel } from '../components/ClipSettingsPanel';
import { Field } from '../components/Field';
import { daysUntilReconnect } from '../../spotify/auth';
import { useSpotify } from '../../app/spotifyStore';
import { ReconnectNote } from './Settings';
import { NumberInput } from '../components/NumberInput';
import { PatternPicker } from '../components/PatternPicker';
import { Readiness } from '../components/Readiness';
import { QuickGame } from '../components/QuickGame';
import { listAudio } from '../../db/audio';
import { useOnline } from '../../app/online';

export default function Home() {
  const nav = useNavigate();
  const [sets, setSets] = useState<CardSet[] | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [setId, setSetId] = useState('');
  const [name, setName] = useState(`Music Bingo · ${new Date().toLocaleDateString()}`);
  const [pattern, setPattern] = useState('line');
  const [mask, setMask] = useState<number[]>([]);
  const [tune, setTune] = useState(false);
  const [win, setWin] = useState({ min: 12, max: 20 });
  const [clip, setClip] = useState<ClipSettings>(DEFAULT_CLIP);
  const [showClip, setShowClip] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [quick, setQuick] = useState(false);
  const [fileIds, setFileIds] = useState<Set<string>>(new Set());
  const online = useOnline();
  const [liveSongs, setLiveSongs] = useState<Song[] | undefined>();

  useEffect(() => {
    listCardSets().then((s) => { setSets(s); if (s[0]) setSetId(s[0].id); });
    listGames().then((g) => setGames(g.filter((x) => x.status !== 'finished')));
    getSetting('clip', DEFAULT_CLIP).then((c) => setClip({ ...DEFAULT_CLIP, ...c }));
    listAudio().then((fs) => setFileIds(new Set(fs.map((f) => f.id)))).catch(() => {});
  }, []);

  const set = sets?.find((s) => s.id === setId);
  useEffect(() => { if (set) liveSongsFor(set).then(setLiveSongs).catch(() => setLiveSongs(undefined)); }, [set]);
  const songCount = set?.songs?.length ?? 0;
  const size = set?.layout.size ?? 5;
  const byId = useMemo(() => new Map(set?.songs?.map((s) => [s.id, s])), [set]);

  const start = () => {
    if (!set?.songs) return;
    const pool = { id: set.poolId, name: set.name, songs: set.songs, categories: [...new Set(set.songs.flatMap((s) => s.categories))], createdAt: set.createdAt, updatedAt: set.createdAt };
    let order = makeCallOrder(pool, randomSeed());
    if (tune) {
      const t = tuneCallOrder(pool, set.cards, masksFor(pattern, size, pattern === 'custom' ? mask : undefined), byId, win, randomSeed());
      order = t.order;
      if (!t.hit) setNote(`Couldn’t land exactly in that window — closest first bingo is at song ${t.forecast.firstWinCall}.`);
    }
    const game: Game = {
      id: uid(), name, createdAt: Date.now(), pool, cardSetId: set.id, settings: clip, callOrder: order, calls: [],
      rounds: [{ patternId: pattern, customMask: pattern === 'custom' ? mask : undefined, winners: [], startCall: 0 }], status: 'setup',
    };
    void saveGame(game).then(() => nav(`/console/${game.id}`));
  };

  const connected = useSpotify((s) => s.connected);
  const hasClientId = useSpotify((s) => !!s.clientId);
  const reconnectSoon = connected && (daysUntilReconnect() ?? 999) <= 14;
  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      {reconnectSoon && <ReconnectNote />}
      {!connected && !hasClientId && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-deck-a/40 bg-deck-a/10 px-4 py-3">
          <p className="flex-1">To play music, connect your own Spotify Premium account — it takes about 5 minutes the first time, then this browser remembers it.</p>
          <Link to="/settings" className="btn btn-a">Set up Spotify</Link>
        </div>
      )}
      <section className="relative mb-8 overflow-hidden rounded-3xl border border-rail p-8 md:p-12">
        <div className="pointer-events-none absolute -right-20 -top-28 size-96 rounded-full" style={{ background: 'repeating-radial-gradient(circle, #1a1238 0 3px, #120b2a 3px 6px)', boxShadow: '0 0 120px -20px var(--color-deck-b)' }} />
        <h1 className="relative font-display text-5xl leading-none md:text-7xl"><span className="text-deck-a glow-a">Drop</span><br /><span className="text-deck-b glow-b">the beat.</span></h1>
        <p className="relative mt-4 max-w-md text-lg text-dim">Build a playlist, print the cards, and run the game from one screen.</p>
        <button type="button" className="btn btn-b relative mt-6 px-5 py-2.5 text-lg" onClick={() => setQuick(true)}>⚡ Quick game</button>
        <p className="relative mt-1 text-sm text-dim">Crowd request? Pick a theme or artist and play in under a minute.</p>
        <div className="relative mt-6 flex flex-wrap gap-2 text-sm">
          <Link to="/pools" className="chip">1 · Make a playlist</Link>
          <Link to="/designer" className="chip">2 · Print cards</Link>
          <span className="chip border-deck-b text-deck-b">3 · Start a game</span>
        </div>
      </section>

      {games.length > 0 && (
        <section className="mb-8" aria-labelledby="resume-heading">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="resume-heading" className="text-lg font-bold">Pick up where you left off</h2>
            <button type="button" className="btn text-sm"
              onClick={async () => {
                if (!confirm(`End all ${games.length} unfinished games? They stay in History.`)) return;
                await Promise.all(games.map((g) => saveGame({ ...g, status: 'finished' })));
                setGames([]);
              }}>Clear all</button>
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((g) => (
              <li key={g.id} className="relative">
                <Link to={`/console/${g.id}`} className="panel block p-4 pr-12 hover:border-deck-a">
                  <div className="font-semibold">{g.name}</div>
                  <div className="text-sm text-dim">{g.calls.length} of {g.callOrder.length} songs played · round {g.rounds.length}</div>
                </Link>
                <button type="button" aria-label={`Clear ${g.name}`} title="End this game (it stays in History)"
                  className="absolute right-2 top-2 rounded px-2 py-1 text-dim hover:text-deck-b"
                  onClick={async () => { await saveGame({ ...g, status: 'finished' }); setGames((gs) => gs.filter((x) => x.id !== g.id)); }}>✕</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel p-5 md:p-6">
        <h2 className="mb-4 text-xl font-bold">Start a game</h2>
        {sets && sets.length === 0 ? (
          <p className="text-dim">You need printed cards first. <Link to="/designer" className="text-deck-a underline">Make cards</Link></p>
        ) : (
          <div className="grid gap-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Game name"><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label="Card set" hint={set ? `${set.cards.length} cards · ${songCount} songs` : undefined}>
                <select value={setId} onChange={(e) => setSetId(e.target.value)}>
                  {sets?.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.cards.length} cards)</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="First round pattern">
                <select value={pattern} onChange={(e) => setPattern(e.target.value)}>
                  {PATTERNS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <PatternPicker size={size} patternId={pattern} mask={mask} onMask={setMask} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2"><input type="checkbox" checked={tune} onChange={(e) => setTune(e.target.checked)} /> Aim for the first bingo between songs</label>
              <NumberInput aria-label="Earliest first bingo" value={win.min} min={1} max={songCount || 999} onChange={(n) => setWin({ ...win, min: n })} />
              <span className="text-dim">and</span>
              <NumberInput aria-label="Latest first bingo" value={win.max} min={1} max={songCount || 999} onChange={(n) => setWin({ ...win, max: n })} />
            </div>
            <div>
              <button type="button" className="text-sm text-dim underline" onClick={() => setShowClip(!showClip)} aria-expanded={showClip}>Clip and break settings ({clip.clipSec}s clips, {clip.gapSec}s breaks)</button>
              {showClip && <div className="mt-3"><ClipSettingsPanel value={clip} onChange={setClip} /></div>}
            </div>
            {set?.songs && (
              <div className="rounded-xl border border-rail p-3">
                <Readiness songs={withLatestFiles(set.songs, liveSongs)} fileIds={fileIds} online={online} />
                <p className="mt-1 text-xs text-dim">Link music files from the playlist’s “Link music files” button — games pick up new links automatically.</p>
              </div>
            )}
            {note && <p className="text-peak">{note}</p>}
            <div><button type="button" className="btn btn-b px-6 py-3 text-lg" disabled={!set?.songs} onClick={start}>Open the DJ console</button></div>
          </div>
        )}
      </section>
      {quick && <QuickGame onClose={() => setQuick(false)} />}
    </main>
  );
}
