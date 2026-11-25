import { render, screen } from '@testing-library/react';
import { SearchPanel } from './SearchPanel';
import { useNet } from '../../app/online';
import { useSpotify } from '../../app/spotifyStore';

test('offline: search explains and is disabled', () => {
  useNet.setState({ online: false });
  useSpotify.setState({ connected: true });
  render(<SearchPanel inPool={new Set()} onAdd={() => {}} onAddMany={() => {}} onPreset={() => {}} />);
  expect(screen.getByText(/You're offline — Spotify search needs internet/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Search Spotify/ })).toBeDisabled();
  useNet.setState({ online: true });
});
