import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { joinBackendFor } from '../../live/config';
import type { LiveBackend, LiveGame } from '../../live/types';
import { PlayerCards } from '../components/PlayerCards';

export default function Join() {
  const { code } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [backend, setBackend] = useState<LiveBackend | null | undefined>(undefined);
  const [game, setGame] = useState<LiveGame | null | undefined>(undefined);
  const [typed, setTyped] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { void joinBackendFor(params.get('p')).then(setBackend); }, [params]);
  useEffect(() => {
    if (!code || backend === undefined) return;
    if (!backend) { setGame(null); return; }
    backend.getGame(code).then((g) => setGame(g)).catch((e) => { setErr(e instanceof Error ? e.message : String(e)); setGame(null); });
  }, [code, backend]);


  if (!code) return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="font-display text-4xl"><span className="text-deck-a">Music</span> <span className="text-deck-b">Bingo</span></h1>
      <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); if (typed.trim()) nav(`/join/${typed.trim()}${params.get('p') ? `?p=${params.get('p')}` : ''}`); }}>
        <label className="grid gap-1"><span className="label">Game code</span>
          <input aria-label="Game code" inputMode="numeric" autoFocus value={typed} onChange={(e) => setTyped(e.target.value.replace(/\D/g, '').slice(0, 6))} className="font-display text-4xl tracking-widest" placeholder="4821" />
        </label>
        <button className="btn btn-b py-3 text-lg" disabled={!typed}>Join</button>
      </form>
    </main>
  );

  if (game === undefined) return <main className="p-6 text-dim">Finding game {code}…</main>;
  if (!game) return (
    <main className="mx-auto max-w-md p-6">
      <p className="text-lg">{err ?? (backend ? `No game with code ${code}. Check the code on the big screen.` : `No game with code ${code} on this site. Scan the QR code on the big screen instead.`)}</p>
      <button type="button" className="btn mt-4" onClick={() => nav('/join')}>Try another code</button>
    </main>
  );
  if (game.status !== 'open') return <main className="mx-auto max-w-md p-6 text-lg">This game has ended. Thanks for playing!</main>;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-3 p-3">
      <div className="flex items-center justify-between px-1 pt-2">
        <h1 className="font-display text-xl">{game.title}</h1>
        <span className="chip text-xs">Game {code}</span>
      </div>
      <PlayerCards def={game.def} storageKey={`mb.join.${code}`} live={{
        taken: () => backend!.takenNumbers(code),
        join: (n, name) => backend!.join(code, n, name),
        claim: (n, name) => backend!.claim(code, n, name),
      }} />
    </main>
  );
}
