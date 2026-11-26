/** Target average level for music files (RMS dBFS, roughly −14 LUFS for typical pop). */
export const TARGET_DBFS = -16;
const MAX_DB = 9;
const BLOCK = 4800;
const SILENCE_DBFS = -80; // absolute gate: true silence
const RELATIVE_GATE_DB = 20; // ignore passages far quieter than the song's average (fades, intros)

const db = (x: number) => 20 * Math.log10(Math.max(x, 1e-9));

/** Gain (dB) that brings audio to the target level; quiet passages are ignored, capped at ±9 dB. */
export function gainForSamples(channels: Float32Array[]): number {
  if (!channels.length) return 0;
  const n = channels[0].length;
  const blocks: { energy: number; count: number }[] = [];
  for (let start = 0; start < n; start += BLOCK) {
    let energy = 0, count = 0;
    for (const ch of channels) for (let i = start; i < Math.min(n, start + BLOCK); i++) { energy += ch[i] * ch[i]; count++; }
    if (count && db(Math.sqrt(energy / count)) >= SILENCE_DBFS) blocks.push({ energy, count });
  }
  if (!blocks.length) return 0;
  const level = (bs: typeof blocks) => db(Math.sqrt(bs.reduce((a, b) => a + b.energy, 0) / bs.reduce((a, b) => a + b.count, 0)));
  const average = level(blocks);
  const loud = blocks.filter((b) => db(Math.sqrt(b.energy / b.count)) >= average - RELATIVE_GATE_DB);
  const gain = TARGET_DBFS - level(loud.length ? loud : blocks);
  return Math.round(Math.max(-MAX_DB, Math.min(MAX_DB, gain)) * 10) / 10;
}

/** Volume multiplier for a dB adjustment. */
export const trimFactor = (dbAdjust: number | undefined) => (dbAdjust ? Math.pow(10, dbAdjust / 20) : 1);

/** Decodes a music file and measures the levelling gain (browser only). */
export async function measureGainDb(blob: Blob): Promise<number> {
  const Ctx = (window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext);
  if (!Ctx) return 0;
  const ctx = new Ctx(1, 44100, 44100);
  const audio = await ctx.decodeAudioData(await blob.arrayBuffer());
  const chans: Float32Array[] = [];
  for (let c = 0; c < audio.numberOfChannels; c++) chans.push(audio.getChannelData(c));
  return gainForSamples(chans);
}
