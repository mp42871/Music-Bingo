import { cleanTitle, exportPoolCsv, exportPoolJson, ImportError, importPoolJson, mergeSongs, parseSongLines, parseTime, formatTime } from './io';
import { catPool, song } from '../test/fixtures';

test('pool JSON round-trips', () => {
  const p = catPool(3);
  p.songs[0].startMs = 61000;
  expect(importPoolJson(exportPoolJson(p))).toEqual(p);
});
test('wrong JSON format throws ImportError', () => {
  expect(() => importPoolJson('{"hello":1}')).toThrow(ImportError);
  expect(() => importPoolJson('not json')).toThrow(ImportError);
});
test('CSV quotes commas and quotes', () => {
  const p = catPool(1);
  p.songs[0] = song(1, { title: 'Hello, "World"', categories: ['80s', 'Rock'] });
  const csv = exportPoolCsv(p);
  expect(csv.split('\n')[0]).toBe('title,artist,album,year,spotify_url,categories,start');
  expect(csv).toContain('"Hello, ""World"""');
  expect(csv).toContain('80s|Rock');
});
test('parseSongLines reads title/artist CSV in any column order', () => {
  expect(parseSongLines('Artist,Title\nQueen,Bohemian Rhapsody\n"Earth, Wind & Fire",September')).toEqual([
    { title: 'Bohemian Rhapsody', artist: 'Queen' },
    { title: 'September', artist: 'Earth, Wind & Fire' },
  ]);
  expect(parseSongLines('title,artist,year\nJolene,Dolly Parton,1973')).toEqual([{ title: 'Jolene', artist: 'Dolly Parton' }]);
});
test('parseSongLines reads dash lines including en dash', () => {
  expect(parseSongLines('Queen - Bohemian Rhapsody\n\nDolly Parton – Jolene\nJust A Title')).toEqual([
    { artist: 'Queen', title: 'Bohemian Rhapsody' },
    { artist: 'Dolly Parton', title: 'Jolene' },
    { artist: '', title: 'Just A Title' },
  ]);
});
test('mergeSongs handles remaster duplicates per mode', () => {
  const a = song(1, { title: 'Go Your Own Way', artist: 'Fleetwood Mac', categories: ['70s'] });
  const b = song(2, { title: 'Go Your Own Way - 2004 Remaster', artist: 'Fleetwood Mac' });
  const c = song(3);
  expect(mergeSongs([a], [b, c], 'skip').map((s) => s.id)).toEqual(['s1', 's3']);
  expect(mergeSongs([a], [b, c], 'keepBoth').map((s) => s.id)).toEqual(['s1', 's2', 's3']);
  expect(mergeSongs([a], [b, c], 'replace').map((s) => s.id)).toEqual(['s2', 's3']);
});
test('time parse/format', () => {
  expect(parseTime('1:05')).toBe(65000);
  expect(parseTime('45')).toBe(45000);
  expect(parseTime('x')).toBeNull();
  expect(formatTime(65000)).toBe('1:05');
});

test('cleanTitle strips remaster/version noise but keeps real parentheses', () => {
  expect(cleanTitle('Go Your Own Way - 2004 Remaster')).toBe('Go Your Own Way');
  expect(cleanTitle('Dancing Queen (Remastered Extended Version)')).toBe('Dancing Queen');
  expect(cleanTitle('Hotel California - Live')).toBe('Hotel California');
  expect(cleanTitle('(I Can\'t Get No) Satisfaction')).toBe('(I Can\'t Get No) Satisfaction');
  expect(cleanTitle('Lose Yourself - From "8 Mile" Soundtrack')).toBe('Lose Yourself');
});
