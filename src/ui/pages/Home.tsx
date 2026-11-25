import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DEFAULT_CLIP } from '../../core/clip';
import { makeCallOrder, tuneCallOrder } from '../../core/forecast';
import { masksFor, PATTERNS } from '../../core/patterns';
import { randomSeed, uid } from '../../core/rng';
import type { CardSet, ClipSettings, Game, Pool } from '../../core/types';
import { getPool, getSetting, listCardSets, listGames, saveGame } from '../../db/repo';
import { withLatestFiles } from '../../core/offline';
import { ClipSettingsPanel } from '../components/ClipSettingsPanel';
import { Field } from '../components/Field';
import { NumberInput } from '../components/NumberInput';
import { PatternPicker } from '../components/PatternPicker';
import { Readiness } from '../components/Readiness';
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
  const [fileIds, setFileIds] = useState<Set<string>>(new Set());
  const online = useOnline();
  const [livePool, setLivePool] = useState<Pool | undefined>();

  useEffect(() => {
    listCardSets().then((s) => { setSets(s); if (s[0]) setSetId(s[0].id); });
    listGames().then((g) => setGames(g.filter((x) => x.status !== 'finished')));
    getSetting('clip', DEFAULT_CLIP).then((c) => setClip({ ...DEFAULT_CLIP, ...c }));
    listAudio().then((fs) => setFileIds(new Set(fs.map((f) => f.id)))).catch(() => {});
  }, []);

  const set = sets?.find((s) => s.id === setId);
  useEffect(() => { if (set) getPool(set.poolId).then(setLivePool).catch(() => setLivePool(undefined)); }, [set]);
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

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <section className="relative mb-8 overflow-hidden rounded-3xl border border-rail p-8 md:p-12">
        <div className="pointer-events-none absolute -right-20 -top-28 size-96 rounded-full" style={{ background: 'repeating-radial-gradient(circle, #1a1238 0 3px, #120b2a 3px 6px)', boxShadow: '0 0 120px -20px var(--color-deck-b)' }} />
        <h1 className="relative font-display text-5xl leading-none md:text-7xl"><span className="text-deck-a glow-a">Drop</span><br /><span className="text-deck-b glow-b">the beat.</span></h1>
        <p className="relative mt-4 max-w-md text-lg text-dim">Build a playlist, print the cards, and run the game from one screen.</p>
        <div className="relative mt-6 flex flex-wrap gap-2 text-sm">
          <Link to="/pools" className="chip">1 · Make a playlist</Link>
          <Link to="/designer" className="chip">2 · Print cards</Link>
          <span className="chip border-deck-b text-deck-b">3 · Start a game</span>
        </div>
      </section>

      {games.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold">Pick up where you left off</h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((g) => (
              <li key={g.id}><Link to={`/console/${g.id}`} className="panel block p-4 hover:border-deck-a">
                <div className="font-semibold">{g.name}</div>
                <div className="text-sm text-dim">{g.calls.length} of {g.callOrder.length} songs played · round {g.rounds.length}</div>
              </Link></li>
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
                <Readiness songs={withLatestFiles(set.songs, livePool?.songs)} fileIds={fileIds} online={online} />
                <p className="mt-1 text-xs text-dim">Link music files from the playlist’s “Link music files” button — games pick up new links automatically.</p>
              </div>
            )}
            {note && <p className="text-peak">{note}</p>}
            <div><button type="button" className="btn btn-b px-6 py-3 text-lg" disabled={!set?.songs} onClick={start}>Open the DJ console</button></div>
          </div>
        )}
      </section>
    </main>
  );
}
