import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { decodePhoneDef, type PhoneDef } from '../../core/phone';
import { hashSeed } from '../../core/rng';
import { PlayerCards } from '../components/PlayerCards';

/** Phone cards without live play: everything comes from the link (QR), nothing goes back to the host. */
export default function Phone() {
  const [params] = useSearchParams();
  const raw = params.get('d') ?? '';
  const def = useMemo<PhoneDef | null>(() => { try { return decodePhoneDef(raw); } catch { return null; } }, [raw]);
  if (!def) return (
    <main className="grid min-h-screen place-items-center p-6 text-center">
      <div><div className="font-display text-3xl text-deck-b">Oops</div><p className="mt-2 text-dim">This card link is broken — ask the host to show the QR code again.</p></div>
    </main>
  );
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-3 p-3">
      <h1 className="px-1 pt-2 font-display text-xl">{def.title}</h1>
      <PlayerCards def={def} storageKey={`mb.phone.${hashSeed(def.seed, def.title, def.s.length)}`} />
    </main>
  );
}
