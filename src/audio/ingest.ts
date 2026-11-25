import { parseFileName } from '../core/offline';
import { uid } from '../core/rng';
import type { AudioFile } from '../core/types';

function durationFromElement(file: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    const done = (ms: number) => { URL.revokeObjectURL(url); resolve(ms); };
    a.preload = 'metadata';
    a.onloadedmetadata = () => done(Number.isFinite(a.duration) ? Math.round(a.duration * 1000) : 0);
    a.onerror = () => done(0);
    a.src = url;
    setTimeout(() => done(0), 8000);
  });
}

/** Reads title/artist/duration from the file's tags, falling back to its name. */
export async function readAudioMeta(file: File): Promise<AudioFile & { blob: Blob }> {
  const fromName = parseFileName(file.name);
  let title = '', artist = '', album: string | undefined, durationMs = 0;
  try {
    const { parseBlob } = await import('music-metadata');
    const meta = await parseBlob(file, { duration: true, skipCovers: true });
    title = meta.common.title ?? '';
    artist = meta.common.artist ?? meta.common.albumartist ?? '';
    album = meta.common.album;
    durationMs = Math.round((meta.format.duration ?? 0) * 1000);
  } catch { /* unreadable tags — use the file name */ }
  if (!durationMs) durationMs = await durationFromElement(file);
  return {
    id: uid(), name: file.name, title: title || fromName.title, artist: artist || fromName.artist,
    ...(album ? { album } : {}), durationMs, size: file.size, type: file.type || 'audio/mpeg', addedAt: Date.now(), blob: file,
  };
}
