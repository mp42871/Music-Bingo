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

test('hand-picked categories look up each listed song exactly', async () => {
  const api = { searchTracks: vi.fn(async (q: string) => {
    const m = q.match(/^track:"(.+)" artist:"(.+)"$/);
    return m ? { total: 1, songs: [song(Math.abs([...q].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) % 1e6, { title: m[1], artist: m[2] })] } : { total: 0, songs: [] };
  }) };
  useSpotify.setState({ api: api as never, connected: true });
  const onDone = vi.fn();
  render(<InstantPlaylist onDone={onDone} onClose={() => {}} />);
  await userEvent.click(screen.getByRole('tab', { name: 'Themes' }));
  await userEvent.click(screen.getByRole('checkbox', { name: 'Stadium Anthems' }));
  await userEvent.selectOptions(screen.getByLabelText('How many songs'), '50');
  await userEvent.click(screen.getByRole('button', { name: /Build playlist/ }));
  await waitFor(() => expect(onDone).toHaveBeenCalled(), { timeout: 5000 });
  const pool = onDone.mock.calls[0][0];
  expect(pool.songs.length).toBeGreaterThanOrEqual(30);
  expect(pool.songs.map((s: { title: string }) => s.title)).toContain('We Will Rock You');
  expect(api.searchTracks.mock.calls.every(([q]) => /^track:".+" artist:".+"$/.test(q))).toBe(true);
});
