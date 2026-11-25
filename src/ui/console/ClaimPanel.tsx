import { useGame } from '../../game/store';
import { ClaimChecker } from '../components/ClaimChecker';

export function ClaimPanel({ initial, onClose }: { initial: number | null; onClose(): void }) {
  const { game, cardSet } = useGame();
  return (
    <div role="dialog" aria-modal="true" aria-label="Check a card" className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <div className="h-full w-full max-w-3xl overflow-auto border-l border-rail bg-night p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl">Check a card</h2>
          <button type="button" className="btn" onClick={onClose}>Close</button>
        </div>
        {game && cardSet
          ? <ClaimChecker game={game} cardSet={cardSet} initial={initial} onGameChange={(g) => useGame.setState({ game: g })} />
          : <p className="text-deck-b">This game’s card set is missing.</p>}
      </div>
    </div>
  );
}
