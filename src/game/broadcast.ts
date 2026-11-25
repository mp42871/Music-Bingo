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
  recent: { title: string; artist: string }[];
  phoneUrl?: string;
  showQr: boolean;
  winners: number;
}

const NAME = 'music-bingo-audience';

export function openChannel(): BroadcastChannel | null {
  try { return new BroadcastChannel(NAME); } catch { return null; }
}
