import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PoolEditor from './PoolEditor';
import { db } from '../../db/db';
import * as repo from '../../db/repo';
import { useSpotify } from '../../app/spotifyStore';
import { exportPoolJson } from '../../core/io';
import type { Pool } from '../../core/types';
import { song } from '../../test/fixtures';

const results = [song(1, { title: 'Take On Me', artist: 'a-ha', year: 1985 }), song(2, { title: 'Africa', artist: 'Toto', year: 1982 })];
let api: Record<string, ReturnType<typeof vi.fn>>;

function emptyPool(): Pool {
  return { id: 'p1', name: 'Party', songs: [], categories: [], createdAt: 1, updatedAt: 1 };
}

async function renderEditor(p: Pool = emptyPool()) {
  await repo.savePool(p);
  render(
    <MemoryRouter initialEntries={[`/pools/${p.id}`]}>
      <Routes><Route path="/pools/:id" element={<PoolEditor />} /></Routes>
    </MemoryRouter>,
  );
  await screen.findByDisplayValue(p.name);
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  api = {
    searchTracks: vi.fn(async (q: string) => {
      if (q.includes('Bohemian')) return { songs: [song(9, { title: 'Bohemian Rhapsody', artist: 'Queen' })], total: 1 };
      if (q.includes('Zzz')) return { songs: [], total: 0 };
      if (q.includes('Hello')) return { songs: [song(10, { title: 'Hello', artist: 'Adele' }), song(11, { title: 'Hello', artist: 'Lionel Richie' })], total: 2 };
      return { songs: results, total: 2 };
    }),
    myPlaylists: vi.fn(async () => []),
    playlistSongs: vi.fn(async () => []),
    createPlaylist: vi.fn(async () => 'url'),
  };
  useSpotify.setState({ api: api as never, connected: true });
});

test('preset 80s searches with the year filter and adds tagged songs', async () => {
  await renderEditor();
  await userEvent.click(screen.getByRole('button', { name: '80s' }));
  await waitFor(() => expect(api.searchTracks).toHaveBeenCalled());
  expect(api.searchTracks.mock.calls[0][0]).toContain('year:1980-1989');
  await userEvent.click(await screen.findByRole('button', { name: 'Add Take On Me' }));
  await waitFor(async () => {
    const p = await repo.getPool('p1');
    expect(p!.songs.map((s) => s.title)).toEqual(['Take On Me']);
    expect(p!.songs[0].categories).toEqual(['80s']);
    expect(p!.categories).toContain('80s');
  });
});

test('editing a start point stores milliseconds', async () => {
  const p = emptyPool();
  p.songs = [song(1, { title: 'Take On Me' })];
  await renderEditor(p);
  const input = screen.getByLabelText('Start point for Take On Me');
  await userEvent.type(input, '1:05');
  input.blur();
  await waitFor(async () => expect((await repo.getPool('p1'))!.songs[0].startMs).toBe(65000));
});

test('health meter flags short categories', async () => {
  const p = emptyPool();
  p.categories = ['Country'];
  p.songs = [song(1, { categories: ['Country'] })];
  await renderEditor(p);
  expect(screen.getByText(/needs 4 more/)).toBeInTheDocument();
});

test('JSON import merges songs', async () => {
  await renderEditor();
  const other: Pool = { ...emptyPool(), id: 'x', songs: [song(5, { title: 'Imported' })] };
  await userEvent.click(screen.getByRole('button', { name: 'Import' }));
  const file = new File([exportPoolJson(other)], 'p.json', { type: 'application/json' });
  await userEvent.upload(screen.getByLabelText('Playlist file (.json or .csv)'), file);
  await userEvent.click(await screen.findByRole('button', { name: /Add 1 song/ }));
  await waitFor(async () => expect((await repo.getPool('p1'))!.songs.map((s) => s.title)).toEqual(['Imported']));
});

test('text import shows review groups before saving', async () => {
  await renderEditor();
  await userEvent.click(screen.getByRole('button', { name: 'Import' }));
  await userEvent.click(screen.getByRole('tab', { name: 'Paste a list' }));
  await userEvent.type(screen.getByLabelText('Song list'), 'Queen - Bohemian Rhapsody{enter}Nobody - Zzz{enter}Hello');
  await userEvent.click(screen.getByRole('button', { name: 'Find songs' }));
  const review = await screen.findByTestId('match-review');
  await waitFor(() => expect(within(review).getByText(/Matched \(1\)/)).toBeInTheDocument());
  expect(within(review).getByText(/Pick one \(1\)/)).toBeInTheDocument();
  expect(within(review).getByText(/Not found \(1\)/)).toBeInTheDocument();
  expect((await repo.getPool('p1'))!.songs).toHaveLength(0);
});
