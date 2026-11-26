import { act, render, screen } from '@testing-library/react';
import Audience from './Audience';

test('the players’ screen shows the join code and a QR for the short join link', async () => {
  render(<Audience />);
  const ch = new BroadcastChannel('music-bingo-audience');
  await act(async () => {
    ch.postMessage({ type: 'state', title: 'Party', callNumber: 0, total: 40, phase: 'idle', gapRemainingMs: 0, clipElapsedMs: 0, clipMs: 30000, pattern: '', round: 1, revealed: null, showQr: true, winners: 0,
      live: { code: '4821', joinUrl: 'https://example.test/#/join/4821?p=abc', site: 'example.test/Music-Bingo' } });
    await new Promise((r) => setTimeout(r, 30));
  });
  expect(await screen.findByText('4821')).toBeInTheDocument();
  expect(screen.getByText(/example.test\/Music-Bingo/)).toBeInTheDocument();
  ch.close();
});
