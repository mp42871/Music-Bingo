import { useEffect, useState } from 'react';
import { openChannel, type AudienceMessage } from '../../game/broadcast';
import { QR } from '../components/QR';
import { formatTime } from '../../core/io';

export default function Audience() {
  const [m, setM] = useState<AudienceMessage | null>(null);
  useEffect(() => {
    const ch = openChannel();
    if (!ch) return;
    ch.onmessage = (e) => e.data?.type === 'state' && setM(e.data);
    return () => ch.close();
  }, []);

  const playing = m?.phase === 'playing';
  const gap = m?.phase === 'gap' && m.gapRemainingMs > 0;
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden p-8 text-center">
      <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: 'radial-gradient(60% 50% at 50% 110%, rgb(255 62 165 / .35), transparent), radial-gradient(50% 40% at 50% -10%, rgb(45 226 255 / .25), transparent)' }} />
      {!m ? (
        <div className="relative">
          <div className="font-display text-6xl"><span className="text-deck-a glow-a">Music</span> <span className="text-deck-b glow-b">Bingo</span></div>
          <p className="mt-4 text-xl text-dim">Waiting for the DJ…</p>
        </div>
      ) : (
        <div className="relative flex w-full max-w-6xl flex-col items-center gap-8">
          <div className="font-display text-4xl md:text-5xl">{m.title}</div>
          {m.pattern && <div className="chip px-5 py-2 text-xl">Round {m.round || 1} · Playing for: <strong className="ml-1 text-deck-a">{m.pattern}</strong></div>}
          <div className="flex items-end justify-center gap-2" aria-hidden style={{ height: '7rem' }}>
            {Array.from({ length: 24 }, (_, i) => (
              <span key={i} className="w-3 rounded-t bg-gradient-to-t from-deck-b to-deck-a"
                style={{ height: playing ? undefined : '0.5rem', animation: playing ? `eq 0.${5 + (i % 5)}s ease-in-out ${(i % 7) / 10}s infinite alternate` : 'none' }} />
            ))}
          </div>
          <div className="font-display text-[9rem] leading-none tabular-nums md:text-[12rem]">{m.callNumber || '–'}</div>
          <div className="text-2xl text-dim">song {m.callNumber} of {m.total}</div>
          {playing && (
            <div data-testid="audience-countdown" className="flex items-baseline gap-3">
              <span className="font-display text-6xl tabular-nums text-deck-a">{formatTime(Math.max(0, m.clipMs - m.clipElapsedMs))}</span>
              <span className="text-2xl text-dim">left in this song</span>
            </div>
          )}
          {gap && <div className="font-display text-4xl text-peak">Next song in {Math.ceil(m.gapRemainingMs / 1000)}</div>}
          {m.revealed && (
            <div className="flex items-center gap-6 rounded-2xl border border-rail bg-booth/80 px-8 py-5">
              {m.revealed.art && <img src={m.revealed.art} alt="" className="size-28 rounded-xl" />}
              <div className="text-left"><div className="text-4xl font-bold">{m.revealed.title}</div><div className="text-2xl text-dim">{m.revealed.artist}</div></div>
            </div>
          )}
          {m.showQr && m.phoneUrl && (
            <div className="flex items-center gap-6 rounded-2xl bg-white p-5 text-night">
              {m.phoneUrl.length > 2500
                ? <div className="max-w-xs text-left text-lg">This playlist is too large for one QR code — use printed cards.</div>
                : <QR text={m.phoneUrl} size={600} className="size-56" />}
              <div className="max-w-xs text-left text-2xl font-bold">No card? Scan to play on your phone.</div>
            </div>
          )}
        </div>
      )}
      <style>{'@keyframes eq { from { height: .6rem } to { height: 7rem } }'}</style>
    </main>
  );
}
