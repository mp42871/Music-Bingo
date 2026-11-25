import { decodePhoneDef, encodePhoneDef, phoneCardNumber, phoneDefToPool, poolToPhoneDef } from './phone';
import { generateCard } from './cards';
import { catPool, layout, song } from '../test/fixtures';
import { mulberry32 } from './rng';
import type { Pool } from './types';

test('phone def round-trips', () => {
  const d = poolToPhoneDef(catPool(2), 5, layout(), 'Party');
  expect(decodePhoneDef(encodePhoneDef(d))).toEqual(d);
});

test('garbage throws', () => expect(() => decodePhoneDef('%%%garbage')).toThrow());

test('phone numbers are in 5000-9999', () => {
  const r = mulberry32(1);
  for (let i = 0; i < 1000; i++) {
    const n = phoneCardNumber(r);
    expect(n >= 5000 && n <= 9999).toBe(true);
  }
});

test('phone card shows the same songs in the same squares as the host regenerates', () => {
  const pool = catPool();
  for (const l of [layout(), layout({ headerMode: 'letters', cellContent: 'both' }), layout({ headerMode: 'letters', cellContent: 'artistBingo' })]) {
    const host = generateCard(pool, l, 77, 6001);
    const phonePool = phoneDefToPool(decodePhoneDef(encodePhoneDef(poolToPhoneDef(pool, 77, l, 'x'))));
    const phone = generateCard(phonePool, l, 77, 6001);
    const label = (p: Pool, c: (typeof host.cells)[number]) =>
      c.kind === 'song' ? p.songs.find((s) => s.id === c.songId)!.title : c.kind === 'artist' ? c.artist : 'FREE';
    expect(phone.cells.map((c) => label(phonePool, c))).toEqual(host.cells.map((c) => label(pool, c)));
  }
});

test('a 75-song playlist fits in a scannable QR link', () => {
  const titles = ['Dancing Queen', 'Take On Me', 'Smells Like Teen Spirit', 'Jolene', "Livin' on a Prayer", 'September', 'Africa', 'Wonderwall'];
  const songs = Array.from({ length: 75 }, (_, i) => song(i, {
    id: `${Math.random().toString(36).slice(2, 13)}${Math.random().toString(36).slice(2, 13)}`,
    title: `${titles[i % 8]} ${i}`, artist: `Some Artist ${i}`, categories: [['70s', '80s', '90s', 'Country', 'Rock'][i % 5]],
  }));
  const pool: Pool = { id: 'p', name: 'x', songs, categories: [], createdAt: 0, updatedAt: 0 };
  expect(encodePhoneDef(poolToPhoneDef(pool, 1, layout(), 'Music Bingo')).length).toBeLessThan(2000);
});
