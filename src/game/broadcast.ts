export interface AudienceMessage {
  type: 'state';
  title: string;
  callNumber: number;
  total: number;
  phase: string;
  gapRemainingMs: number;
  clipElapsedMs: number;
  clipMs: number;
  pattern: string;
  round: number;
  revealed: { title: string; artist: string; art?: string } | null;
  phoneUrl?: string;
  showQr: boolean;
  /** Live play: how phones join. */
  live?: { code: string; joinUrl: string; site: string };
  winners: number;
}

const NAME = 'music-bingo-audience';

export function openChannel(): BroadcastChannel | null {
  try { return new BroadcastChannel(NAME); } catch { return null; }
}
