import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { CardSet, Game } from '../../core/types';
import { getCardSet, listGames } from '../../db/repo';
import { ClaimChecker } from '../components/ClaimChecker';
import { PageHeader } from '../components/Field';

export default function Check() {
  const [params] = useSearchParams();
  const [games, setGames] = useState<Game[] | null>(null);
  const [gameId, setGameId] = useState(params.get('game') ?? '');
  const [cardSet, setCardSet] = useState<CardSet | null>(null);

  useEffect(() => {
    listGames().then((gs) => {
      setGames(gs);
      if (!gameId) setGameId((gs.find((g) => g.status !== 'finished') ?? gs[0])?.id ?? '');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const game = games?.find((g) => g.id === gameId);
  useEffect(() => { if (game) getCardSet(game.cardSetId).then((s) => setCardSet(s ?? null)); }, [game]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <PageHeader title="Check a card">
        {games && games.length > 0 && (
          <select aria-label="Game" value={gameId} onChange={(e) => setGameId(e.target.value)}>
            {games.map((g) => <option key={g.id} value={g.id}>{g.name} · {g.calls.length} played</option>)}
          </select>
        )}
      </PageHeader>
      {games && games.length === 0 && <p className="text-dim">No games yet. <Link to="/" className="text-deck-a underline">Start one</Link></p>}
      {game && cardSet && (
        <div className="panel p-5">
          <ClaimChecker key={game.id} game={game} cardSet={cardSet} onGameChange={(g) => setGames((gs) => gs!.map((x) => (x.id === g.id ? g : x)))} />
        </div>
      )}
      {game && !cardSet && <p className="text-deck-b">The card set for this game was deleted, so cards can’t be checked.</p>}
    </main>
  );
}
