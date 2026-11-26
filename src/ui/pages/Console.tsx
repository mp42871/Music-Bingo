import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { QuickGame } from '../components/QuickGame';
import { JoinQr } from '../components/JoinQr';
import { phoneUrl } from '../../core/phone';
import { setPhoneDef } from '../../game/phoneLink';
import { liveWinners } from '../../core/check';
import { findCard } from '../../core/claim';
import { patternName } from '../../core/patterns';
import { currentRound, hybridPort, roundMasks, useGame } from '../../game/store';
import { ClipSettingsPanel } from '../components/ClipSettingsPanel';
import { Deck } from '../console/Deck';
import { DevicePicker } from '../console/DevicePicker';
import { Queue } from '../console/Queue';
import { RoundDialog } from '../console/RoundDialog';
import { Transport } from '../console/Transport';
import { WinnerTracker } from '../console/WinnerTracker';
import { ClaimPanel } from '../console/ClaimPanel';
import { cardNo } from '../components/CardGrid';
import { autoBackupOnClick } from '../../drive/backup';
import { driveService } from '../../drive/service';
import { Readiness } from '../components/Readiness';
import { useOnline } from '../../app/online';
import { useSpotify } from '../../app/spotifyStore';
import { listAudio } from '../../db/audio';

export default function Console() {
  const { gameId } = useParams();
  const nav = useNavigate();
  const g = useGame();
  const [missing, setMissing] = useState(false);
  const [roundDlg, setRoundDlg] = useState(false);
  const [checking, setChecking] = useState<number | null | 'open'>(null);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [params] = useSearchParams();
  const fresh = params.get('new') === '1';
  const [quick, setQuick] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [fileIds, setFileIds] = useState<Set<string>>(new Set());
  const online = useOnline();
  useEffect(() => { listAudio().then((fs) => setFileIds(new Set(fs.map((f) => f.id)))).catch(() => {}); }, []);

  useEffect(() => {
    let alive = true;
    useGame.getState().load(gameId!).then((ok) => {
      if (!alive) return;
      if (!ok) return setMissing(true);
      if (fresh) useGame.getState().setShowQr(true); // quick game: phone cards straight away
    });
    return () => {
      alive = false;
      // Save, stop the music and drop this controller — but only if a newer console hasn't loaded one already.
      const st = useGame.getState();
      const mine = st.ctrl;
      void st.persist();
      if (mine && useGame.getState().ctrl === mine) useGame.getState().unload();
    };
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
        ' ': () => (c.state.phase === 'manual' ? c.markPlayed() : c.togglePause()), ArrowRight: () => c.next(), ArrowLeft: () => c.previous(),
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
  const phoneCards = g.live.phoneCards;
  // Printed cards plus every phone card in play (live play tells us which numbers phones hold).
  const live = useMemo(() => {
    if (!game || !cardSet) return [];
    const printed = new Set(cardSet.cards.map((c) => c.number));
    const extra = phoneCards.filter((n) => !printed.has(n)).map((n) => findCard(cardSet, n)?.card).filter((c) => !!c);
    return liveWinners([...cardSet.cards, ...extra], game.calls, masks, songs).sort((a, b) => a - b);
  }, [game, cardSet, masks, songs, phoneCards]);

  if (missing) return <main className="mx-auto max-w-7xl px-4 py-6">Game not found. <Link className="text-deck-a underline" to="/">Back</Link></main>;
  if (!game || !cs || !ctrl) return <main className="mx-auto max-w-7xl px-4 py-6 text-dim">Loading…</main>;

  // Checking a claim pauses the music (and the break countdown); press play to carry on.
  const openCheck = (n: number | 'open') => {
    if (cs.phase === 'playing' || cs.phase === 'gap') void ctrl.togglePause();
    setChecking(n);
  };
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
        {g.makePort === hybridPort && <DevicePicker onError={(m) => useGame.setState((s) => ({ errors: [...s.errors.slice(-3), m] }))} />}
        <button type="button" className="btn" onClick={() => window.open(`${window.location.pathname}#/audience`, 'mb-audience', 'width=1280,height=720')}>Open screen for players</button>
        {g.live.code && (
          <span className="chip border-ok text-ok" title="Phones join with this code">
            Live: {g.live.code} · {g.live.players} phone{g.live.players === 1 ? '' : 's'}
            <button type="button" className="ml-1 text-dim underline" onClick={() => { if (confirm('Stop live play? Phones can no longer join or call BINGO.')) void g.stopLive(); }}>Stop</button>
          </span>
        )}
        <button type="button" className="btn" onClick={() => setShowJoin(true)} title="Show the join code full screen on this computer">Phone QR</button>
        <button type="button" className="btn" onClick={() => { if (cs.phase === 'playing' || cs.phase === 'gap') void ctrl.togglePause(); setQuick(true); }}>⚡ Quick game</button>
        <button type="button" className="btn btn-b" onClick={() => openCheck('open')}>Check a card</button>
      </div>
      {!g.live.code && g.live.error && (
        <div role="alert" aria-label="Live play problem" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-peak/60 bg-peak/10 px-4 py-3">
          <p className="flex-1"><strong>Phones can’t join yet.</strong> {g.live.error}</p>
          <button type="button" className="btn btn-a" onClick={() => void g.goLive()}>Try again</button>
        </div>
      )}
      {g.live.claims.length > 0 && (
        <div className="mb-4 grid gap-2">
          {g.live.claims.map((c) => (
            <div key={c.id} role="alert" aria-label="BINGO claim" className={`flex flex-wrap items-center gap-3 rounded-xl border-2 px-4 py-3 ${c.valid ? 'border-ok bg-ok/10' : 'border-deck-b bg-deck-b/10'}`}>
              <span className="font-display text-xl">BINGO!</span>
              <span className="flex-1">
                {`${c.name || 'A player'} · card ${cardNo(c.cardNumber)} — `}
                <strong className={c.valid ? 'text-ok' : 'text-deck-b'}>{c.valid ? 'VALID ✓' : 'NOT YET'}</strong>
                <span className="text-dim">{c.valid ? ` (on song ${c.atCall})` : c.missing !== null ? ` (needs ${c.missing} more)` : ' (card not found)'}</span>
              </span>
              <button type="button" className="btn text-sm" onClick={() => openCheck(c.cardNumber)}>Check card</button>
              {c.valid && <button type="button" className="btn btn-a text-sm" onClick={async () => { await g.recordWinner({ cardNumber: c.cardNumber, name: c.name || undefined, atCall: c.atCall ?? game.calls.length }); g.dismissClaim(c.id); }}>Record winner</button>}
              <button type="button" className="btn text-sm" aria-label="Dismiss claim" onClick={() => g.dismissClaim(c.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
      {fresh && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-ok/40 bg-ok/10 px-4 py-3">
          <p className="flex-1">Cards are ready. Phone-card QR is on the players’ screen — or print a stack.</p>
          <a href={`#/print/${game.cardSetId}`} target="_blank" rel="noreferrer" className="btn btn-a">Print cards</a>
        </div>
      )}

      {g.errors.length > 0 && (
        <div className="mb-4 grid gap-2" role="alert">
          {g.errors.map((e, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-deck-b/50 bg-deck-b/10 px-3 py-2 text-sm">
              <span className="flex-1">{e}</span><button type="button" aria-label="Dismiss" onClick={() => g.dismissError(i)}>✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="flex flex-col gap-5">
          <div className="panel flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="font-display text-deck-a">Round {game.rounds.length || 1}</span>
            <span className="text-lg font-semibold">{round ? patternName(round.patternId) : 'Single line'}</span>
            {recorded.length > 0 && <span className="chip text-peak">{recorded.length} winner{recorded.length > 1 ? 's' : ''} recorded</span>}
            <button type="button" className="btn ml-auto" onClick={() => setRoundDlg(true)}>End round</button>
          </div>
          <Deck cs={cs} song={cur} callNumber={game.calls.length} total={game.calls.length + upcoming.length} hidden={hidden}
            onReveal={() => g.setReveal(true)} onSeek={(ms) => ctrl.seekTo(ms)} clipMs={game.settings.clipSec * 1000}
            onPlayed={() => ctrl.markPlayed()} source={g.source} />
          <Transport cs={cs} onPrev={() => ctrl.previous()} onReplay={() => ctrl.replayLast()} onToggle={() => ctrl.togglePause()}
            onNext={() => ctrl.next()} onBack={() => ctrl.seekBy(-10_000)} onFwd={() => ctrl.seekBy(10_000)}
            onVolume={(v) => ctrl.setVolume(v)} onMute={() => ctrl.toggleMute()} onDuck={() => ctrl.toggleDuck()} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-dim">
            <span>Space play/pause</span><span>→ next</span><span>← previous</span><span>R replay</span><span>M mute</span><span>T talk over</span><span>↑↓ volume</span>
            <label className="ml-auto flex items-center gap-2"><input type="checkbox" checked={g.revealed} onChange={(e) => g.setReveal(e.target.checked)} /> Show this song on the players’ screen</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={g.showQr} onChange={(e) => g.setShowQr(e.target.checked)} /> Show how to join on the players’ screen</label>
          </div>
          <Queue upcoming={upcoming} removed={removed} calls={game.calls} songs={songs}
            onReorder={(ids) => ctrl.reorder(ids)} onPlayNow={(id) => ctrl.jumpTo(id)} onRemove={(id) => ctrl.remove(id)}
            onRestore={(id) => ctrl.insert(id, upcoming.length)} onReplayCalled={(id) => ctrl.jumpTo(id)} />
        </div>
        <div className="flex flex-col gap-5">
          <WinnerTracker live={live} recorded={recorded} onPhone={phoneCards} onCheck={(n) => openCheck(n)} />
          <div className="panel p-4">
            <h2 className="mb-2 font-bold">Offline</h2>
            <Readiness compact songs={[...(cur && cs.phase !== 'done' ? [cur] : []), ...upcoming.map((id) => songs.get(id)!).filter(Boolean)]}
              fileIds={fileIds} online={online}
              appCached={typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller}
              orderSaved={!!game.orderSavedAt}
              onSaveOrder={async (uris) => {
                const url = await useSpotify.getState().api.createPlaylist(`${game.name} — call order`, uris);
                await g.markOrderSaved();
                return url;
              }} />
          </div>
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
          onFinish={async () => {
            // Save the finished game; the Google Drive backup (if on) starts inside this click and finishes in the background.
            const { saved } = autoBackupOnClick(() => g.finish(), driveService);
            await saved;
            setRoundDlg(false);
            nav(`/history?game=${game.id}`);
          }} />
      )}
      {quick && <QuickGame onClose={() => setQuick(false)} />}
      {showJoin && (
        <JoinQr onClose={() => setShowJoin(false)}
          live={g.live.code ? { code: g.live.code, joinUrl: g.live.joinUrl!, site: g.live.typed ? g.live.site : '' } : null}
          phoneUrl={g.cardSet ? phoneUrl(setPhoneDef(g.cardSet)) : null} />
      )}
      {checking !== null && <ClaimPanel initial={checking === 'open' ? null : checking} onClose={() => setChecking(null)} />}
    </main>
  );
}
