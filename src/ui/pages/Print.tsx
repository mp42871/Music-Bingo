import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { phoneUrl } from '../../core/phone';
import { setPhoneDef } from '../../game/phoneLink';
import { DEFAULT_STYLE } from '../../core/style';
import { parseCardRange } from '../../core/cardEdit';
import type { CardSet, Game, Song } from '../../core/types';
import { getCardSet, getGame } from '../../db/repo';
import { CardGrid } from '../components/CardGrid';
import { QR } from '../components/QR';

const PAPER = { letter: { w: '8.5in', h: '11in', css: 'letter' }, a4: { w: '210mm', h: '297mm', css: 'A4' } };
const GRID = { 1: [1, 1], 2: [1, 2], 4: [2, 2], 6: [2, 3] } as const;

export const MAX_QR_URL = 2500;

export default function Print() {
  const { setId } = useParams();
  const [q, setQ] = useSearchParams();
  const mode = q.get('mode') ?? 'cards';
  const [set, setSet] = useState<CardSet | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    getCardSet(setId!).then((s) => (s ? setSet(s) : setMissing(true)));
    const g = q.get('game');
    if (g) getGame(g).then((x) => setGame(x ?? null));
  }, [setId, q]);

  const songs: Song[] = useMemo(() => set?.songs ?? game?.pool.songs ?? [], [set, game]);
  const byId = useMemo(() => new Map(songs.map((s) => [s.id, s])), [songs]);

  if (missing) return <p className="p-6">Card set not found. <Link to="/designer" className="text-deck-a underline">Back to cards</Link></p>;
  if (!set) return <p className="p-6 text-dim">Loading…</p>;

  const style = { ...DEFAULT_STYLE, ...set.style };
  const paper = PAPER[style.paper];
  const [cols, rows] = GRID[style.perPage];
  const perPage = cols * rows;
  const only = q.get('cards') ? new Set(parseCardRange(q.get('cards')!)) : null;
  const printCards = only ? set.cards.filter((c) => only.has(c.number)) : set.cards;
  const pages: CardSet['cards'][] = [];
  for (let i = 0; i < printCards.length; i += perPage) pages.push(printCards.slice(i, i + perPage));

  const url = phoneUrl(setPhoneDef(set.songs ? set : { ...set, songs }));

  const tabs = [['cards', 'Cards'], ['master', 'Host call sheet'], ['poster', 'Phone QR poster']] as const;

  return (
    <div className="min-h-screen bg-[#2a2440] print:bg-white">
      <style>{`
        @page { size: ${paper.css}; margin: 0; }
        @media print { body { background: #fff !important; } .no-print { display: none !important; } .sheet { margin: 0 !important; box-shadow: none !important; } }
        .sheet { width: ${paper.w}; height: ${paper.h}; background: #fff; color: #111; box-sizing: border-box; padding: 0.35in; break-after: page; page-break-after: always; overflow: hidden; }
        .sheet:last-child { break-after: auto; page-break-after: auto; }
        .slot { position: relative; padding: 0.12in; box-sizing: border-box; min-height: 0; min-width: 0; display: grid; }
        .cut .slot { outline: 1px dashed #999; outline-offset: -1px; }
      `}</style>
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-rail bg-night px-4 py-3">
        <Link to="/designer" className="btn">Back</Link>
        <span className="mr-auto font-semibold">{set.name} · {only ? `${printCards.length} of ${set.cards.length} cards` : `${set.cards.length} cards`}</span>
        {tabs.map(([id, label]) => (
          <button key={id} type="button" className="chip" aria-pressed={mode === id} onClick={() => { q.set('mode', id); setQ(q); }}>{label}</button>
        ))}
        <button type="button" className="btn btn-b" onClick={() => window.print()}>Print</button>
      </div>
      <p className="no-print px-4 pt-3 text-center text-sm text-dim">In the print dialog, turn on “Background graphics” and set margins to “None” for best results.</p>

      <div className="flex flex-col items-center gap-6 py-6 print:block print:py-0">
        {mode === 'cards' && pages.map((page, pi) => (
          <div key={pi} className={`sheet shadow-2xl ${style.cutLines ? 'cut' : ''}`}
            style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}>
            {page.map((card) => (
              <div key={card.number} className="slot">
                <CardGrid card={card} layout={set.layout} songsById={byId} style={style} showQr />
              </div>
            ))}
          </div>
        ))}

        {mode === 'master' && (
          <MasterSheet set={set} game={game} byId={byId} paperW={paper.w} />
        )}

        {mode === 'poster' && (
          <div className="sheet shadow-2xl flex flex-col items-center justify-center gap-6 text-center">
            <div style={{ fontFamily: "'Bungee', sans-serif", fontSize: '44pt', lineHeight: 1 }}>{style.title || 'Music Bingo'}</div>
            <div style={{ fontSize: '20pt' }}>No paper card? Play on your phone.</div>
            {url.length > MAX_QR_URL
              ? <p className="max-w-md text-red-700">This playlist is too large to fit in one QR code ({url.length} characters). Use fewer songs, or hand out printed cards.</p>
              : <QR text={url} size={900} className="w-[5.5in]" />}
            <div style={{ fontSize: '13pt' }}>Scan with your camera · tap squares as songs play · shout BINGO!</div>
          </div>
        )}
      </div>
    </div>
  );
}

function MasterSheet({ set, game, byId }: { set: CardSet; game: Game | null; byId: Map<string, Song>; paperW: string }) {
  const ids = game ? game.callOrder : [...byId.keys()].sort((a, b) => (byId.get(a)!.title).localeCompare(byId.get(b)!.title));
  const per = 40;
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += per) chunks.push(ids.slice(i, i + per));
  return (
    <>
      {chunks.map((chunk, ci) => (
        <div key={ci} className="sheet shadow-2xl" style={{ fontSize: '10pt' }}>
          <h1 style={{ fontFamily: "'Bungee', sans-serif", fontSize: '18pt' }}>{game ? `Call sheet — ${game.name}` : `Song checklist — ${set.name}`}</h1>
          <p style={{ color: '#555', marginBottom: '8pt' }}>{game ? 'In play order.' : 'Alphabetical. Tick each song as it plays.'} Page {ci + 1} of {chunks.length}</p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {chunk.map((id, i) => {
                const s = byId.get(id);
                return (
                  <tr key={id} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ width: '2.2em', padding: '3pt' }}>{ci * per + i + 1}</td>
                    <td style={{ width: '1.6em' }}>☐</td>
                    <td style={{ padding: '3pt', fontWeight: 600 }}>{s?.displayTitle ?? s?.title}</td>
                    <td style={{ padding: '3pt', color: '#444' }}>{s?.artist}</td>
                    <td style={{ padding: '3pt', color: '#777' }}>{s?.categories.join(', ')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}
