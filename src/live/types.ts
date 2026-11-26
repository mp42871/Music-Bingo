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
  /** Hold a card on this phone. One phone per card number; the same phone may rejoin. */
  join(code: string, cardNumber: number, name: string, device: string): Promise<void>;
  /** Give a card back so another phone can use it. */
  leave(code: string, cardNumber: number, device: string): Promise<void>;
  /** Only the phone holding the card can claim with it. */
  claim(code: string, cardNumber: number, name: string, device: string): Promise<void>;
}

const pad = (n: number) => `#${String(n).padStart(4, '0')}`;

/** What a player sees when the backend refuses (shared by every backend). */
export const LIVE_REFUSALS: Record<string, (n: number) => string> = {
  taken: (n) => `Card ${pad(n)} is already being played on another phone. Pick another number, or tap “Give me a random card”.`,
  closed: () => 'This game has ended.',
  not_printed: (n) => `Card ${pad(n)} isn’t in this game.`,
  not_joined: (n) => `Card ${pad(n)} isn’t on this phone any more — remove it and add it again.`,
};

/** A random id for this phone, kept in the browser, so a player can come back to their cards. */
export function deviceId(): string {
  const key = 'mb.device';
  try {
    let id = localStorage.getItem(key);
    if (!id) { id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`; localStorage.setItem(key, id); }
    return id;
  } catch { return 'no-storage'; }
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
