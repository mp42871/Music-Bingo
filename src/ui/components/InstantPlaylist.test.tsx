import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InstantPlaylist } from './InstantPlaylist';
import { useSpotify } from '../../app/spotifyStore';
import { song } from '../../test/fixtures';

test('picking categories builds a playlist with each one as a column, about 75 songs', async () => {
  let n = 0;
  const api = { searchTracks: vi.fn(async (_q: string, offset = 0) => ({ total: 200, songs: Array.from({ length: 10 }, () => song(n++, { title: `T${n}`, artist: `A${n}` })).map((s) => ({ ...s, id: `${s.id}-${offset}` })) })) };
  useSpotify.setState({ api: api as never, connected: true });
  const onDone = vi.fn();
  render(<InstantPlaylist onDone={onDone} onClose={() => {}} />);
  await userEvent.click(screen.getByRole('checkbox', { name: '80s' }));
  await userEvent.click(screen.getByRole('tab', { name: 'Genres' }));
  await userEvent.click(screen.getByRole('checkbox', { name: 'Top Country' }));
  await userEvent.click(screen.getByRole('checkbox', { name: 'Disco' }));
  await userEvent.click(screen.getByRole('button', { name: /Build playlist/ }));
  await waitFor(() => expect(onDone).toHaveBeenCalled());
  const pool = onDone.mock.calls[0][0];
  expect(pool.name).toBe('80s + Top Country + Disco');
  expect(pool.categories).toEqual(['80s', 'Top Country', 'Disco']);
  expect(pool.songs).toHaveLength(75);
  for (const c of ['80s', 'Top Country', 'Disco']) expect(pool.songs.filter((s: { categories: string[] }) => s.categories.includes(c))).toHaveLength(25);
});
