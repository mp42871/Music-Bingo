import { act, render, screen } from '@testing-library/react';
import Audience from './Audience';
import type { AudienceMessage } from '../../game/broadcast';

const msg = (over: Partial<AudienceMessage>): AudienceMessage => ({
  type: 'state', title: 'Party', callNumber: 3, total: 40, phase: 'playing', gapRemainingMs: 0, clipElapsedMs: 12000, clipMs: 30000,
  pattern: 'Single line', round: 1, revealed: null, showQr: false, winners: 0, ...over,
});

test('players see how much of the song is left', async () => {
  render(<Audience />);
  const ch = new BroadcastChannel('music-bingo-audience');
  await act(async () => { ch.postMessage(msg({})); await new Promise((r) => setTimeout(r, 30)); });
  expect(await screen.findByTestId('audience-countdown')).toHaveTextContent('0:18');
  ch.close();
});

test('the countdown keeps moving between console updates (console tab in the background)', async () => {
  render(<Audience />);
  const ch = new BroadcastChannel('music-bingo-audience');
  await act(async () => { ch.postMessage(msg({ clipElapsedMs: 10000 })); await new Promise((r) => setTimeout(r, 30)); });
  expect(await screen.findByTestId('audience-countdown')).toHaveTextContent('0:20');
  await act(async () => { await new Promise((r) => setTimeout(r, 1300)); });
  expect(screen.getByTestId('audience-countdown')).toHaveTextContent(/0:1[89]/);
  ch.close();
});
