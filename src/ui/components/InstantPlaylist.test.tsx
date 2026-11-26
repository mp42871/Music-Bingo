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
  await waitFor(() => expect(onDone).toHaveBeenCalled(), { timeout: 12000 });
  const pool = onDone.mock.calls[0][0];
  expect(pool.songs.length).toBeGreaterThanOrEqual(30);
  const { PRESETS } = await import('../../core/presets');
  const { parseCurated } = await import('../../spotify/curated');
  const listed = new Set(parseCurated(PRESETS.find((p) => p.id === 'anthems')!.songs!).map((l) => l.title));
  expect(pool.songs.length).toBe(50);
  pool.songs.forEach((s: { title: string }) => expect(listed.has(s.title)).toBe(true));
  expect(api.searchTracks.mock.calls.every(([q]) => /^track:".+" artist:".+"$/.test(q))).toBe(true);
}, 15000);

test('the picker shows how many songs each hand-picked category holds, and warns before building too few', async () => {
  const { PRESETS } = await import('../../core/presets');
  const { parseCurated } = await import('../../spotify/curated');
  const n = parseCurated(PRESETS.find((p) => p.id === 'tv')!.songs!).length;
  useSpotify.setState({ api: { searchTracks: vi.fn() } as never, connected: true });
  render(<InstantPlaylist onDone={() => {}} onClose={() => {}} />);
  await userEvent.click(screen.getByRole('tab', { name: 'Themes' }));
  expect(screen.getByText(`TV Theme Songs · ${n}`)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('checkbox', { name: 'TV Theme Songs' }));
  await userEvent.selectOptions(screen.getByLabelText('How many songs'), '150');
  expect(screen.getByText(new RegExp(`Your picks hold ${n} songs`))).toBeInTheDocument();
  expect(screen.getByRole('button', { name: `Build playlist (${n} songs)` })).toBeInTheDocument();
});

test('when one category runs short, the others make up the difference', async () => {
  let n = 0;
  const api = { searchTracks: vi.fn(async (q: string) => {
    const m = q.match(/^track:"(.+)" artist:"(.+)"$/);
    if (m) return { total: 1, songs: [song(900000 + n++, { title: m[1], artist: m[2] })] };
    return { total: 1000, songs: Array.from({ length: 10 }, () => song(n++, { title: `Hit ${n}`, artist: `Band ${n}` })) };
  }) };
  useSpotify.setState({ api: api as never, connected: true });
  const onDone = vi.fn();
  render(<InstantPlaylist onDone={onDone} onClose={() => {}} />);
  await userEvent.click(screen.getByRole('checkbox', { name: '80s' }));
  await userEvent.click(screen.getByRole('tab', { name: 'Themes' }));
  await userEvent.click(screen.getByRole('checkbox', { name: 'TV Theme Songs' }));
  await userEvent.selectOptions(screen.getByLabelText('How many songs'), '150');
  await userEvent.click(screen.getByRole('button', { name: /Build playlist/ }));
  await waitFor(() => expect(onDone).toHaveBeenCalled(), { timeout: 8000 });
  const pool = onDone.mock.calls[0][0];
  expect(pool.songs).toHaveLength(150);
}, 15000);
