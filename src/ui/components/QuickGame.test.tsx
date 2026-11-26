import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QuickGame } from './QuickGame';
import { useSpotify } from '../../app/spotifyStore';
import { db } from '../../db/db';
import { song } from '../../test/fixtures';

function Where() { const l = useLocation(); return <p>at {l.pathname}{l.search}</p>; }

beforeEach(async () => { await Promise.all(db.tables.map((t) => t.clear())); });

test('pick a category, start, and land in the console with cards ready', async () => {
  let i = 0;
  useSpotify.setState({ connected: true, api: { searchTracks: vi.fn(async () => ({ total: 500, songs: Array.from({ length: 10 }, () => song(i++, { title: `Hit ${i}`, artist: `Band ${i}` })) })) } as never });
  render(<MemoryRouter initialEntries={['/']}><Routes>
    <Route path="/" element={<QuickGame onClose={() => {}} />} />
    <Route path="/console/:id" element={<Where />} />
  </Routes></MemoryRouter>);
  await userEvent.click(screen.getByRole('button', { name: '80s' }));
  await userEvent.click(screen.getByRole('button', { name: /Start the game/ }));
  expect(await screen.findByText(/at \/console\/.+\?new=1/, {}, { timeout: 5000 })).toBeInTheDocument();
});

test('an artist can be typed instead', async () => {
  const searchTracks = vi.fn(async () => ({ total: 500, songs: Array.from({ length: 10 }, (_, k) => song(Math.random() * 1e9 | 0, { title: `T${k}${Math.random()}` })) }));
  useSpotify.setState({ connected: true, api: { searchTracks } as never });
  render(<MemoryRouter><Routes><Route path="/" element={<QuickGame onClose={() => {}} />} /><Route path="/console/:id" element={<Where />} /></Routes></MemoryRouter>);
  await userEvent.click(screen.getByRole('tab', { name: 'An artist' }));
  await userEvent.type(screen.getByLabelText('Artist'), 'Prince');
  await userEvent.click(screen.getByRole('button', { name: /Start the game/ }));
  await waitFor(() => expect(searchTracks).toHaveBeenCalledWith('artist:"Prince"', 0, 10));
});
