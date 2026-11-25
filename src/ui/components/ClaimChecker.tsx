import { useEffect, useMemo, useRef, useState } from 'react';
import { checkClaim, missingCount } from '../../core/claim';
import { DEFAULT_STYLE } from '../../core/style';
import type { CardSet, Game } from '../../core/types';
import { saveGame } from '../../db/repo';
import { CardGrid, cardNo } from './CardGrid';

declare global {
  interface Window { BarcodeDetector?: new (o: { formats: string[] }) => { detect(src: CanvasImageSource): Promise<{ rawValue: string }[]> } }
}

export function ClaimChecker({ game, cardSet, initial, onGameChange }: {
  game: Game; cardSet: CardSet; initial?: number | null; onGameChange?: (g: Game) => void;
}) {
  const [text, setText] = useState(initial ? String(initial) : '');
  const [num, setNum] = useState<number | null>(initial ?? null);
  const [name, setName] = useState('');
  const [prize, setPrize] = useState('');
  const [saved, setSaved] = useState(false);
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!initial) inputRef.current?.focus(); }, [initial]);

  const res = useMemo(() => (num !== null ? checkClaim(cardSet, game, num) : null), [num, cardSet, game]);
  const songs = useMemo(() => new Map(game.pool.songs.map((s) => [s.id, s])), [game]);
  const round = game.rounds.at(-1);
  const already = round?.winners.some((w) => w.cardNumber === num);

  const submit = (v: string) => { const n = parseInt(v.replace(/\D/g, ''), 10); setNum(Number.isNaN(n) ? null : n); setSaved(false); };

  const record = async () => {
    if (!res || !round) return;
    const w = { cardNumber: num!, ...(name ? { name } : {}), ...(prize ? { prize } : {}), atCall: res.result.firstValidAtCall ?? game.calls.length };
    const rounds = game.rounds.map((r, i) => (i === game.rounds.length - 1 ? { ...r, winners: [...r.winners.filter((x) => x.cardNumber !== num), w] } : r));
    const next = { ...game, rounds };
    await saveGame(next);
    onGameChange?.(next);
    setSaved(true);
  };

  const scan = async () => {
    if (!window.BarcodeDetector) return;
    setScanning(true);
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();
      const det = new window.BarcodeDetector({ formats: ['qr_code'] });
      for (let i = 0; i < 100; i++) {
        const codes = await det.detect(video);
        if (codes[0]) { setText(codes[0].rawValue); submit(codes[0].rawValue); break; }
        await new Promise((r) => setTimeout(r, 150));
      }
    } catch { /* camera unavailable */ }
    stream?.getTracks().forEach((t) => t.stop());
    setScanning(false);
  };

  const uncalled = res ? res.card.cells.map((c, i) => !res.result.marked[i] && c.kind !== 'free') : undefined;

  return (
    <div className="grid gap-4">
      <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); submit(text); }}>
        <label className="flex flex-col gap-1">
          <span className="label">Card number</span>
          <input ref={inputRef} aria-label="Card number" inputMode="numeric" value={text} onChange={(e) => setText(e.target.value)}
            className="w-40 font-display text-3xl tracking-widest" placeholder="0042" />
        </label>
        <button className="btn btn-a h-12">Check</button>
        {window.BarcodeDetector && <button type="button" className="btn h-12" onClick={scan} disabled={scanning}>{scanning ? 'Scanning…' : 'Scan card QR'}</button>}
      </form>

      {num !== null && !res && <p className="text-deck-b">No card {cardNo(num)} in this game’s card set.</p>}
      {res && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="aspect-square w-full max-w-xl">
            <CardGrid card={res.card} layout={cardSet.layout} songsById={songs} style={{ ...DEFAULT_STYLE, ...cardSet.style, inkSaver: false, showArt: false, theme: 'neon', accent: '', background: '' }}
              marked={res.result.marked} highlightMask={res.result.winningMask} uncalled={uncalled} />
          </div>
          <div className="flex flex-col gap-3">
            <div className={`rounded-2xl border-2 p-4 text-center ${res.result.valid ? 'border-ok bg-ok/10' : 'border-deck-b bg-deck-b/10'}`}>
              <div className={`font-display text-4xl ${res.result.valid ? 'text-ok' : 'text-deck-b'}`}>{res.result.valid ? 'VALID' : 'NOT YET'}</div>
              <div className="mt-1 text-sm">
                {res.result.valid
                  ? <>Bingo on song {res.result.firstValidAtCall} of {game.calls.length}</>
                  : <>Needs {missingCount(res.result.marked, res.masks)} more squares</>}
              </div>
              <div className="mt-1 text-xs text-dim">{res.source === 'phone' ? 'Phone card' : 'Printed card'} {cardNo(num!)}</div>
            </div>
            {res.result.valid && (
              <div className="panel grid gap-2 p-3">
                <input aria-label="Winner name" placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
                <input aria-label="Prize" placeholder="Prize (optional)" value={prize} onChange={(e) => setPrize(e.target.value)} />
                <button type="button" className="btn btn-b" onClick={record}>Record winner</button>
                {(saved || already) && <p className="text-sm text-ok" role="status">Recorded for round {game.rounds.length}.</p>}
              </div>
            )}
            <p className="text-xs text-dim">Glowing squares were called. Faded squares haven’t played yet.</p>
          </div>
        </div>
      )}
    </div>
  );
}
