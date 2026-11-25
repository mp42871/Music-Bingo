import { db } from './db';
import { audioUsage, deleteAudio, getAudioBlob, listAudio, saveAudio } from './audio';
import { exportBackup } from './repo';
import type { AudioFile } from '../core/types';

const meta = (id: string, size: number): AudioFile => ({ id, name: `${id}.mp3`, title: id, artist: 'A', durationMs: 1000, size, type: 'audio/mpeg', addedAt: Date.now() });

beforeEach(async () => { await Promise.all(db.tables.map((t) => t.clear())); });

test('save, list without blobs, get blob, delete', async () => {
  await saveAudio(meta('a', 3), new Blob(['abc'], { type: 'audio/mpeg' }));
  const list = await listAudio();
  expect(list).toHaveLength(1);
  expect('blob' in list[0]).toBe(false);
  expect((await getAudioBlob('a'))!.size).toBe(3);
  await deleteAudio('a');
  expect(await listAudio()).toHaveLength(0);
});

test('usage sums sizes', async () => {
  await saveAudio(meta('a', 3), new Blob(['abc']));
  await saveAudio(meta('b', 5), new Blob(['abcde']));
  expect(await audioUsage()).toEqual({ count: 2, bytes: 8 });
});

test('backups exclude audio', async () => {
  await saveAudio(meta('a', 3), new Blob(['abc']));
  expect(JSON.parse(await exportBackup())).not.toHaveProperty('audio');
});
