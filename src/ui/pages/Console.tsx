import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { liveWinners } from '../../core/check';
import { patternName } from '../../core/patterns';
import { currentRound, roundMasks, spotifyPort, useGame } from '../../game/store';
import { ClipSettingsPanel } from '../components/ClipSettingsPanel';
import { Deck } from '../console/Deck';
import { DevicePicker } from '../console/DevicePicker';
import { Queue } from '../console/Queue';
import { RoundDialog } from '../console/RoundDialog';
import { Transport } from '../console/Transport';
import { WinnerTracker } from '../console/WinnerTracker';
import { ClaimPanel } from '../console/ClaimPanel';

export default function Console() {
  const { gameId } = useParams();
  const nav = useNavigate();
  const g = useGame();
  const [missing, setMissing] = useState(false);
  const [roundDlg, setRoundDlg] = useState(false);
  const [checking, setChecking] = useState<number | null | 'open'>(null);
  const [settingsOpen, setSettingsOpen] = useState(true);

  useEffect(() => {
    let alive = true;
    useGame.getState().load(gameId!).then((ok) => alive && !ok && setMissing(true));
    return () => { alive = false; void useGame.getState().persist(); };
  }, [gameId]);

  // Drive clip timing.
  useEffect(() => {
    const t = setInterval(() => useGame.getState().ctrl?.tick(), 250);
    return () => clearInterval(t);
  }, []);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const c = useGame.getState().ctrl;
      if (!c) return;
      const k = e.key;
      const map: Record<string, () => unknown> = {
        ' ': () => c.togglePause(), ArrowRight: () => c.next(), ArrowLeft: () => c.previous(),
        r: () => c.replayLast(), R: () => c.replayLast(), m: () => c.toggleMute(), M: () => c.toggleMute(),
        t: () => c.toggleDuck(), T: () => c.toggleDuck(),
        ArrowUp: () => c.setVolume(c.state.volume + 5), ArrowDown: () => c.setVolume(c.state.volume - 5),
      };
      if (map[k]) { e.preventDefault(); void map[k](); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const { game, cs, ctrl, songs, cardSet } = g;
  const size = cardSet?.layout.size ?? 5;
  const masks = useMemo(() => (game ? roundMasks(game, size) : []), [game, size]);
  const live = useMemo(() => (game && cardSet ? liveWinners(cardSet.cards, game.calls, masks, songs) : []), [game, cardSet, masks, songs]);

  if (missing) return <main className="mx-auto max-w-7xl px-4 py-6">Game not found. <Link className="text-deck-a underline" to="/">Back</Link></main>;
  if (!game || !cs || !ctrl) return <main className="mx-auto max-w-7xl px-4 py-6 text-dim">Loading…</main>;

  const round = currentRound(game);
  const cur = cs.currentId ? songs.get(cs.currentId) : undefined;
  const hidden = game.settings.hideTitles && !g.revealed && cs.phase !== 'done';
  const upcoming = ctrl.upcoming();
  const inOrder = new Set(ctrl.fullOrder());
  const removed = game.pool.songs.filter((s) => !s.excluded && !inOrder.has(s.id)).map((s) => s.id);
  const recorded = round?.winners.map((w) => w.cardNumber) ?? [];

  return (
    <main className="mx-auto max-w-7xl px-4 py-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto font-display text-2xl md:text-3xl">{game.name}</h1>
        {g.makePort === spotifyPort && <DevicePicker onError={(m) => useGame.setState((s) => ({ errors: [...s.errors.slice(-3), m] }))} />}
        <button type="button" className="btn" onClick={() => window.open(`${window.location.pathname}#/audience`, 'mb-audience', 'width=1280,height=720')}>Open screen for players</button>
        <button type="button" className="btn btn-b" onClick={() => setChecking('open')}>Check a card</button>
      </div>

      {g.errors.length > 0 && (
        <div className="mb-4 grid gap-2" role="alert">
          {g.errors.map((e, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-deck-b/50 bg-deck-b/10 px-3 py-2 text-sm">
              <span className="flex-1">{e}</span><button type="button" aria-label="Dismiss" onClick={() => g.dismissError(i)}>✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_minmax(0,24rem)]">
        <div className="flex flex-col gap-5">
          <div className="panel flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="font-display text-deck-a">Round {game.rounds.length || 1}</span>
            <span className="text-lg font-semibold">{round ? patternName(round.patternId) : 'Single line'}</span>
            {recorded.length > 0 && <span className="chip text-peak">{recorded.length} winner{recorded.length > 1 ? 's' : ''} recorded</span>}
            <button type="button" className="btn ml-auto" onClick={() => setRoundDlg(true)}>End round</button>
          </div>
          <Deck cs={cs} song={cur} callNumber={game.calls.length} total={game.calls.length + upcoming.length} hidden={hidden}
            onReveal={() => g.setReveal(true)} onSeek={(ms) => ctrl.seekTo(ms)} clipMs={game.settings.clipSec * 1000} />
          <Transport cs={cs} onPrev={() => ctrl.previous()} onReplay={() => ctrl.replayLast()} onToggle={() => ctrl.togglePause()}
            onNext={() => ctrl.next()} onBack={() => ctrl.seekBy(-10_000)} onFwd={() => ctrl.seekBy(10_000)}
            onVolume={(v) => ctrl.setVolume(v)} onMute={() => ctrl.toggleMute()} onDuck={() => ctrl.toggleDuck()} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-dim">
            <span>Space play/pause</span><span>→ next</span><span>← previous</span><span>R replay</span><span>M mute</span><span>T talk over</span><span>↑↓ volume</span>
            <label className="ml-auto flex items-center gap-2"><input type="checkbox" checked={g.revealed} onChange={(e) => g.setReveal(e.target.checked)} /> Show this song on the players’ screen</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={g.showQr} onChange={(e) => g.setShowQr(e.target.checked)} /> Show phone-card QR</label>
          </div>
          <Queue upcoming={upcoming} removed={removed} calls={game.calls} songs={songs}
            onReorder={(ids) => ctrl.reorder(ids)} onPlayNow={(id) => ctrl.jumpTo(id)} onRemove={(id) => ctrl.remove(id)}
            onRestore={(id) => ctrl.insert(id, upcoming.length)} onReplayCalled={(id) => ctrl.jumpTo(id)} />
        </div>
        <div className="flex flex-col gap-5">
          <WinnerTracker live={live} recorded={recorded} onCheck={(n) => setChecking(n)} />
          <div className="panel p-4">
            <button type="button" className="mb-2 flex w-full items-center justify-between font-bold" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(!settingsOpen)}>
              Live settings <span className="text-dim">{settingsOpen ? '−' : '+'}</span>
            </button>
            {settingsOpen && <ClipSettingsPanel compact value={game.settings} onChange={(v) => g.updateSettings(v)} />}
          </div>
        </div>
      </div>

      {roundDlg && (
        <RoundDialog round={game.rounds.length || 1} size={size} onClose={() => setRoundDlg(false)}
          onStart={async (p, m) => { await g.endRound([]); await g.startRound(p, m); setRoundDlg(false); }}
          onFinish={async () => { await g.finish(); setRoundDlg(false); nav(`/history?game=${game.id}`); }} />
      )}
      {checking !== null && <ClaimPanel initial={checking === 'open' ? null : checking} onClose={() => setChecking(null)} />}
    </main>
  );
}
