import type { AudioFile } from '../core/types';
import { db } from './db';

/** File details and audio bytes live in separate tables so listing never loads audio. */
export async function saveAudio(meta: AudioFile, blob: Blob): Promise<void> {
  const data = await blob.arrayBuffer();
  await db.transaction('rw', db.audio, db.audioData, async () => {
    await db.audioData.put({ id: meta.id, data, type: meta.type || blob.type });
    await db.audio.put(meta);
  });
}

export const listAudio = (): Promise<AudioFile[]> => db.audio.orderBy('addedAt').toArray();

export async function getAudioBlob(id: string): Promise<Blob | undefined> {
  const row = await db.audioData.get(id);
  return row ? new Blob([row.data], { type: row.type }) : undefined;
}

export async function deleteAudio(id: string): Promise<void> {
  await db.transaction('rw', db.audio, db.audioData, async () => {
    await db.audio.delete(id);
    await db.audioData.delete(id);
  });
}

export async function audioUsage(): Promise<{ count: number; bytes: number }> {
  const all = await listAudio();
  return { count: all.length, bytes: all.reduce((a, f) => a + f.size, 0) };
}
