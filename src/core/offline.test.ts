import { fileSong, matchFiles, parseFileName, pickSource, readiness } from './offline';
import { DEFAULT_CLIP } from './clip';
import type { AudioFile } from './types';
import { song } from '../test/fixtures';

const af = (id: string, title: string, artist: string): AudioFile => ({ id, name: `${id}.mp3`, title, artist, durationMs: 1000, size: 10, type: 'audio/mpeg', addedAt: 0 });

test('parseFileName', () => {
  expect(parseFileName('01 Queen - Bohemian Rhapsody.mp3')).toEqual({ artist: 'Queen', title: 'Bohemian Rhapsody' });
  expect(parseFileName('Jolene.m4a')).toEqual({ artist: '', title: 'Jolene' });
  expect(parseFileName('07. Toto – Africa.flac')).toEqual({ artist: 'Toto', title: 'Africa' });
});

test('matchFiles matches, flags ties, lists leftovers', () => {
  const songs = [
    song(1, { title: 'Go Your Own Way - 2004 Remaster', artist: 'Fleetwood Mac' }),
    song(2, { title: 'Hello', artist: 'Adele' }),
    song(3, { title: 'Jolene', artist: 'Dolly Parton' }),
  ];
  const files = [af('a', 'Go Your Own Way', 'Fleetwood Mac'), af('b', 'Hello', 'Adele'), af('c', 'Hello', 'Adele'), af('d', 'Other', 'X')];
  const m = matchFiles(songs, files);
  expect(m.matched).toEqual([{ songId: 's1', fileId: 'a' }]);
  expect(m.ambiguous).toEqual([{ songId: 's2', fileIds: ['b', 'c'] }]);
  expect(m.unmatchedSongs).toEqual(['s3']);
  expect(m.unusedFiles).toEqual(['d']);
});

test('matchFiles uses title alone when a file has no artist and the title is unique', () => {
  const m = matchFiles([song(1, { title: 'Jolene', artist: 'Dolly Parton' })], [af('a', 'Jolene', '')]);
  expect(m.matched).toEqual([{ songId: 's1', fileId: 'a' }]);
});

test('pickSource policy table', () => {
  const withFile = song(1, { fileId: 'f' });
  const noFile = song(2);
  const on = { online: true, spotifyReady: true };
  const off = { online: false, spotifyReady: true };
  expect(pickSource(withFile, 'auto', on)).toBe('spotify');
  expect(pickSource(withFile, 'auto', off)).toBe('file');
  expect(pickSource(noFile, 'auto', off)).toBe('manual');
  expect(pickSource(noFile, 'auto', { online: true, spotifyReady: false })).toBe('manual');
  expect(pickSource(withFile, 'files', on)).toBe('file');
  expect(pickSource(noFile, 'files', on)).toBe('spotify');
  expect(pickSource(withFile, 'manual', on)).toBe('manual');
  expect(pickSource(fileSong(af('x', 'T', 'A')), 'auto', on)).toBe('file');
});

test('readiness counts', () => {
  const songs = [song(1, { fileId: 'a' }), song(2, { fileId: 'gone' }), song(3)];
  const r = readiness(songs, new Set(['a']));
  expect(r).toMatchObject({ total: 3, withFile: 1, manual: 2 });
  expect(r.missing.map((s) => s.id)).toEqual(['s2', 's3']);
});

test('fileSong ids and default source', () => {
  const s = fileSong(af('x', 'Jolene', 'Dolly'));
  expect(s).toMatchObject({ id: 'file:x', uri: 'file:x', fileId: 'x', title: 'Jolene', artist: 'Dolly', durationMs: 1000 });
  expect(DEFAULT_CLIP.source).toBe('auto');
});
