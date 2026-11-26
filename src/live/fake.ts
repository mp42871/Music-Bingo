import type { PhoneDef } from '../core/phone';
import { LIVE_REFUSALS, randomCode, type LiveBackend, type LiveClaim } from './types';

/** In-memory live backend shared by host and players (tests, and a single-browser demo). */
export function createFakeBackend(): LiveBackend & { claims: LiveClaim[]; players: { code: string; cardNumber: number; name: string; device: string }[] } {
  const games = new Map<string, { title: string; def: PhoneDef; status: 'open' | 'closed' }>();
  const players: { code: string; cardNumber: number; name: string; device: string }[] = [];
  const count = (code: string) => { for (const w of watchers) if (w.code === code) w.on.players(players.filter((p) => p.code === code).map((p) => p.cardNumber)); };
  const claims: LiveClaim[] = [];
  const watchers = new Set<{ code: string; on: { players(cards: number[]): void; claim(c: LiveClaim): void } }>();
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
      on.players(players.filter((p) => p.code === code).map((p) => p.cardNumber));
      return () => watchers.delete(w);
    },
    async getGame(code) { const g = games.get(code); return g ? { code, ...g } : null; },
    async takenNumbers(code) { return players.filter((p) => p.code === code).map((p) => p.cardNumber); },
    async join(code, cardNumber, name, device) {
      const g = games.get(code);
      if (g?.status !== 'open') throw new Error(LIVE_REFUSALS.closed(cardNumber));
      if (cardNumber < 5000 && g.def.printed && !g.def.printed.some(([n]) => n === cardNumber)) throw new Error(LIVE_REFUSALS.not_printed(cardNumber));
      const held = players.find((p) => p.code === code && p.cardNumber === cardNumber);
      if (held && held.device !== device) throw new Error(LIVE_REFUSALS.taken(cardNumber));
      if (held) { held.name = name; return; }
      players.push({ code, cardNumber, name, device });
      count(code);
    },
    async leave(code, cardNumber, device) {
      const i = players.findIndex((p) => p.code === code && p.cardNumber === cardNumber && p.device === device);
      if (i >= 0) { players.splice(i, 1); count(code); }
    },
    async claim(code, cardNumber, name, device) {
      if (games.get(code)?.status !== 'open') throw new Error(LIVE_REFUSALS.closed(cardNumber));
      if (!players.some((p) => p.code === code && p.cardNumber === cardNumber && p.device === device)) throw new Error(LIVE_REFUSALS.not_joined(cardNumber));
      const c = { id: String(++id), code, cardNumber, name, at: Date.now() };
      claims.push(c);
      for (const w of watchers) if (w.code === code) w.on.claim(c);
    },
  };
}
