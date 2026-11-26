import type { PhoneDef } from '../core/phone';

export interface LiveGame { code: string; title: string; def: PhoneDef; status: 'open' | 'closed' }
export interface LiveClaim { id: string; code: string; cardNumber: number; name: string; at: number }

/** Everything live play needs from a shared backend (Supabase in the app, in-memory in tests). */
export interface LiveBackend {
  // host
  publish(title: string, def: PhoneDef, reuseCode?: string): Promise<string>;
  close(code: string): Promise<void>;
  watch(code: string, on: { players(count: number): void; claim(c: LiveClaim): void }): () => void;
  // players
  getGame(code: string): Promise<LiveGame | null>;
  takenNumbers(code: string): Promise<number[]>;
  join(code: string, cardNumber: number, name: string): Promise<void>;
  claim(code: string, cardNumber: number, name: string): Promise<void>;
}

export const PHONE_MIN = 5000;
export const PHONE_MAX = 9999;

/** A random phone card number nobody in this game has yet. */
export function pickFreeNumber(taken: Iterable<number>, rand: () => number = Math.random): number {
  const used = new Set(taken);
  for (let i = 0; i < 200; i++) {
    const n = PHONE_MIN + Math.floor(rand() * (PHONE_MAX - PHONE_MIN + 1));
    if (!used.has(n)) return n;
  }
  for (let n = PHONE_MIN; n <= PHONE_MAX; n++) if (!used.has(n)) return n;
  throw new Error('All phone card numbers are taken.');
}

export const randomCode = (rand: () => number = Math.random) => String(1000 + Math.floor(rand() * 9000));
