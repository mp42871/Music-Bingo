import { render, screen } from '@testing-library/react';
import { Deck } from './Deck';
import type { ControllerState } from '../../game/controller';
import { song } from '../../test/fixtures';

const cs: ControllerState = { phase: 'manual', index: 0, currentId: 'file:a', clipStartMs: 0, positionMs: 0, clipElapsedMs: 0, gapRemainingMs: 0, volume: 70, muted: false, ducked: false };

test('a music-file-only song with a missing file is not sent to Spotify', () => {
  render(<Deck cs={cs} song={song(1, { id: 'file:a', uri: 'file:a', title: 'Home Video' })} callNumber={1} total={5} hidden={false}
    onReveal={() => {}} onSeek={() => {}} clipMs={30000} onPlayed={() => {}} source="manual" />);
  expect(screen.queryByText(/Play now in Spotify/)).toBeNull();
  expect(screen.getByText(/music file is missing/i)).toBeInTheDocument();
});
