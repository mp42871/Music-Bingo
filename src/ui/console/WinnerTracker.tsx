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
