import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Pools from '../pages/Pools';
import PoolEditor from '../pages/PoolEditor';
import { db } from '../../db/db';
import { listPools, getPool, savePool } from '../../db/repo';
import { useSpotify } from '../../app/spotifyStore';
import { useNet } from '../../app/online';
import { buildPoolFromPlaylists } from '../../core/spotifyImport';
import { song } from '../../test/fixtures';

let api: Record<string, ReturnType<typeof vi.fn>>;
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  useNet.setState({ online: true });
  api = {
    myPlaylists: vi.fn(async () => [{ id: 'A', name: '80s Party', count: 2 }, { id: 'B', name: 'Country Hits', count: 2 }, { id: 'C', name: 'Workout', count: 9 }]),
    playlistSongs: vi.fn(async (id: string) => (id === 'A' ? [song(1), song(2)] : id === 'B' ? [song(2), song(3)] : [song(4)])),
    playlistInfo: vi.fn(async () => ({ id: 'D', name: 'Pasted', count: 1 })),
    searchTracks: vi.fn(async () => ({ songs: [], total: 0 })),
  };
  useSpotify.setState({ api: api as never, connected: true });
});

const app = (path = '/pools') => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes><Route path="/pools" element={<Pools />} /><Route path="/pools/:id" element={<PoolEditor />} /></Routes>
  </MemoryRouter>,
);

test('pick two Spotify playlists → one bingo playlist with a category each', async () => {
  app();
  await userEvent.click(screen.getByRole('button', { name: 'Import from Spotify' }));
  await userEvent.click(await screen.findByRole('checkbox', { name: /80s Party/ }));
  await userEvent.click(screen.getByRole('checkbox', { name: /Country Hits/ }));
  await userEvent.click(screen.getByRole('button', { name: /Import 2 playlists/ }));
  await waitFor(async () => {
    const [p] = await listPools();
    expect(p.name).toBe('80s Party + Country Hits');
    expect(p.categories).toEqual(['80s Party', 'Country Hits']);
    expect(p.songs).toHaveLength(3);
  });
  expect(await screen.findByDisplayValue('80s Party + Country Hits')).toBeInTheDocument();
});

test('search filters the list', async () => {
  app();
  await userEvent.click(screen.getByRole('button', { name: 'Import from Spotify' }));
  await screen.findByRole('checkbox', { name: /Workout/ });
  await userEvent.type(screen.getByLabelText('Search your playlists'), 'coun');
  expect(screen.queryByRole('checkbox', { name: /Workout/ })).toBeNull();
  expect(screen.getByRole('checkbox', { name: /Country Hits/ })).toBeInTheDocument();
});

test('a pasted link is added to the choices', async () => {
  app();
  await userEvent.click(screen.getByRole('button', { name: 'Import from Spotify' }));
  await userEvent.type(await screen.findByLabelText('Spotify playlist link'), 'https://open.spotify.com/playlist/37i9dQZF1DX4UtSsGT1Sbe');
  await userEvent.click(screen.getByRole('button', { name: 'Add link' }));
  expect(await screen.findByRole('checkbox', { name: /Pasted/ })).toBeChecked();
});

test('offline: import explains it needs internet', async () => {
  useNet.setState({ online: false });
  app();
  expect(screen.getByRole('button', { name: 'Import from Spotify' })).toBeDisabled();
  useNet.setState({ online: true });
});

test('Update from Spotify pulls changes and reports them', async () => {
  const p = buildPoolFromPlaylists([{ id: 'A', name: '80s Party', songs: [song(1), song(9)] }]);
  await savePool(p);
  app(`/pools/${p.id}`);
  await userEvent.click(await screen.findByRole('button', { name: 'Update from Spotify' }));
  expect(await screen.findByText(/1 song added, 1 removed/)).toBeInTheDocument();
  expect((await getPool(p.id))!.songs.map((s) => s.id)).toEqual(['s1', 's2']);
});
