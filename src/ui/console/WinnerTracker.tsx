import { cardNo } from '../components/CardGrid';

export function WinnerTracker({ live, recorded, onPhone = [], onCheck }: { live: number[]; recorded: number[]; onPhone?: number[]; onCheck(n: number): void }) {
  return (
    <div className="panel p-4" data-testid="winner-tracker">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-bold">Cards with bingo</h2>
        <span className={`chip ${live.length ? 'border-ok text-ok' : ''}`}>{live.length}</span>
      </div>
      {live.length === 0
        ? <p className="text-sm text-dim">No card has this pattern yet. Numbers appear here the moment one does.</p>
        : (
          <ul className="flex flex-wrap gap-1.5">
            {live.slice(0, 60).map((n) => (
              <li key={n}><button type="button" onClick={() => onCheck(n)} className={`chip font-mono ${recorded.includes(n) ? 'border-peak text-peak' : 'border-ok text-ok'}`}
                aria-label={`${cardNo(n)}${onPhone.includes(n) ? ' (on a phone)' : ''}`}>{onPhone.includes(n) && <span aria-hidden>📱 </span>}{cardNo(n)}</button></li>
            ))}
          </ul>
        )}
      <p className="mt-2 text-xs text-dim">Includes printed cards nobody may be holding, and every card on a phone (📱). Wait for a shout, then check the card.</p>
    </div>
  );
}

/** Phone-sized console: a bar pinned to the top so the bingo count is always in view while a song plays. */
export function BingoBar({ live, recorded, onPhone = [], onCheck }: { live: number[]; recorded: number[]; onPhone?: number[]; onCheck(n: number): void }) {
  return (
    <div data-testid="bingo-bar" className={`panel sticky top-0 z-20 flex items-center gap-2 overflow-x-auto px-3 py-2 lg:hidden ${live.length ? 'border-ok' : ''}`}>
      <span className={`chip shrink-0 font-bold ${live.length ? 'border-ok text-ok' : ''}`}>{live.length}</span>
      <span className="shrink-0 text-sm font-semibold">{live.length === 1 ? 'card has bingo' : 'cards have bingo'}</span>
      {live.slice(0, 30).map((n) => (
        <button key={n} type="button" onClick={() => onCheck(n)} aria-label={`Check ${cardNo(n)}${onPhone.includes(n) ? ' (on a phone)' : ''}`}
          className={`chip shrink-0 font-mono ${recorded.includes(n) ? 'border-peak text-peak' : 'border-ok text-ok'}`}>{onPhone.includes(n) && <span aria-hidden>📱 </span>}{cardNo(n)}</button>
      ))}
    </div>
  );
}
