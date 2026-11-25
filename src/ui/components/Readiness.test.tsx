import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Readiness } from './Readiness';
import { song } from '../../test/fixtures';

const songs = [song(1, { fileId: 'a' }), song(2, { fileId: 'b' }), song(3, { fileId: 'c' }), song(4), song(5)];

test('summarizes what plays automatically offline', () => {
  render(<Readiness songs={songs} fileIds={new Set(['a', 'b', 'c'])} online onSaveOrder={async () => ''} />);
  expect(screen.getByText(/Offline ready: 3 songs play automatically, 2 will prompt you to play them in the Spotify app/)).toBeInTheDocument();
});

test('save order calls back with uris in order and is disabled offline', async () => {
  const onSave = vi.fn(async () => 'https://open.spotify.com/playlist/x');
  const { rerender } = render(<Readiness songs={songs} fileIds={new Set()} online onSaveOrder={onSave} />);
  await userEvent.click(screen.getByRole('button', { name: 'Save call order to Spotify' }));
  expect(onSave).toHaveBeenCalledWith(songs.map((s) => s.uri));
  expect(await screen.findByText(/Saved/)).toBeInTheDocument();
  rerender(<Readiness songs={songs} fileIds={new Set()} online={false} onSaveOrder={onSave} />);
  expect(screen.getByRole('button', { name: 'Save call order to Spotify' })).toBeDisabled();
});

test('all files present', () => {
  render(<Readiness songs={songs.slice(0, 3)} fileIds={new Set(['a', 'b', 'c'])} online onSaveOrder={async () => ''} />);
  expect(screen.getByText(/Offline ready: all 3 songs play automatically/)).toBeInTheDocument();
});

test('shows whether the app is saved for offline and whether the call order was saved', () => {
  const { rerender } = render(<Readiness songs={songs} fileIds={new Set()} online appCached={false} orderSaved={false} onSaveOrder={async () => ''} />);
  expect(screen.getByText(/App saved for offline: not yet/)).toBeInTheDocument();
  expect(screen.getByText(/Call order saved to Spotify: not yet/)).toBeInTheDocument();
  rerender(<Readiness songs={songs} fileIds={new Set()} online appCached orderSaved onSaveOrder={async () => ''} />);
  expect(screen.getByText(/App saved for offline: ✓/)).toBeInTheDocument();
  expect(screen.getByText(/Call order saved to Spotify: ✓/)).toBeInTheDocument();
});
