import type { PhoneDef } from '../core/phone';
import { randomCode, type LiveBackend, type LiveClaim } from './types';

/** In-memory live backend shared by host and players (tests, and a single-browser demo). */
export function createFakeBackend(): LiveBackend & { claims: LiveClaim[]; players: { code: string; cardNumber: number; name: string }[] } {
  const games = new Map<string, { title: string; def: PhoneDef; status: 'open' | 'closed' }>();
  const players: { code: string; cardNumber: number; name: string }[] = [];
  const claims: LiveClaim[] = [];
  const watchers = new Set<{ code: string; on: { players(n: number): void; claim(c: LiveClaim): void } }>();
  let id = 0;
  return {
    claims, players,
    async publish(title, def, reuse) {
      const code = reuse && games.has(reuse) ? reuse : (() => { let c; do c = randomCode(); while (games.has(c)); return c; })();
      games.set(code, { title, def, status: 'open' });
      return code;
    },
    async close(code) { const g = games.get(code); if (g) g.status = 'closed'; },
    watch(code, on) {
      const w = { code, on };
      watchers.add(w);
      on.players(players.filter((p) => p.code === code).length);
      return () => watchers.delete(w);
    },
    async getGame(code) { const g = games.get(code); return g ? { code, ...g } : null; },
    async takenNumbers(code) { return players.filter((p) => p.code === code).map((p) => p.cardNumber); },
    async join(code, cardNumber, name) {
      if (games.get(code)?.status !== 'open') throw new Error('This game has ended.');
      players.push({ code, cardNumber, name });
      for (const w of watchers) if (w.code === code) w.on.players(players.filter((p) => p.code === code).length);
    },
    async claim(code, cardNumber, name) {
      if (games.get(code)?.status !== 'open') throw new Error('This game has ended.');
      const c = { id: String(++id), code, cardNumber, name, at: Date.now() };
      claims.push(c);
      for (const w of watchers) if (w.code === code) w.on.claim(c);
    },
  };
}
