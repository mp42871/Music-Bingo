import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Console from './Console';
import { db } from '../../db/db';
import * as repo from '../../db/repo';
import { useGame } from '../../game/store';
import { generateCardSet } from '../../core/cards';
import { DEFAULT_CLIP } from '../../core/clip';
import type { Game } from '../../core/types';
import { catPool, layout } from '../../test/fixtures';
import type { PlaybackPort } from '../../game/controller';

const pool = catPool();
let port: PlaybackPort & Record<string, ReturnType<typeof vi.fn>>;

async function setup(calls: string[] = []) {
  const { set } = generateCardSet(pool, layout(), { seed: 1, count: 10, startNumber: 1 });
  await repo.saveCardSet({ ...set, id: 'cs1' });
  const order = [...calls, ...pool.songs.map((s) => s.id).filter((id) => !calls.includes(id))];
  const game: Game = {
    id: 'g1', name: 'Friday', createdAt: 1, pool, cardSetId: 'cs1', settings: { ...DEFAULT_CLIP, startMode: 'beginning', fadeSec: 0 },
    callOrder: order, calls: calls.map((songId, i) => ({ songId, at: i })), rounds: [{ patternId: 'line', winners: [], startCall: 0 }], status: 'live',
  };
  await repo.saveGame(game);
  port = {
    play: vi.fn(async () => {}), pause: vi.fn(async () => {}), resume: vi.fn(async () => {}),
    seek: vi.fn(async () => {}), setVolume: vi.fn(async () => {}),
  } as never;
  useGame.setState({ makePort: () => port });
  render(<MemoryRouter initialEntries={['/console/g1']}><Routes><Route path="/console/:gameId" element={<Console />} /></Routes></MemoryRouter>);
  await screen.findByText('Friday');
  return { set, game };
}

beforeEach(async () => { await Promise.all(db.tables.map((t) => t.clear())); });

test('keyboard: space starts/pauses, arrow next, r replay, m mute', async () => {
  await setup();
  await userEvent.keyboard(' ');
  await waitFor(() => expect(port.play).toHaveBeenCalledTimes(1));
  await userEvent.keyboard(' ');
  await waitFor(() => expect(port.pause).toHaveBeenCalled());
  await userEvent.keyboard('{ArrowRight}');
  await waitFor(() => expect(port.play).toHaveBeenCalledTimes(2));
  await userEvent.keyboard('r');
  await waitFor(() => expect(port.play).toHaveBeenCalledTimes(3));
  await userEvent.keyboard('m');
  await waitFor(() => expect(useGame.getState().cs?.muted).toBe(true));
  await waitFor(async () => expect((await repo.getGame('g1'))!.calls).toHaveLength(2));
});

test('changing the break while live updates the game settings', async () => {
  await setup();
  const gap = screen.getByLabelText('Break between songs (seconds)');
  await userEvent.clear(gap);
  await userEvent.type(gap, '12');
  await waitFor(() => expect(useGame.getState().game!.settings.gapSec).toBe(12));
  expect(useGame.getState().ctrl!.clipSettings.gapSec).toBe(12);
});

test('winner tracker lists cards that have bingo', async () => {
  const { set } = generateCardSet(pool, layout(), { seed: 1, count: 10, startNumber: 1 });
  const row = set.cards[0].cells.slice(0, 5).map((c) => (c.kind === 'song' ? c.songId : ''));
  await setup(row);
  const tracker = screen.getByTestId('winner-tracker');
  expect(within(tracker).getByText('#0001')).toBeInTheDocument();
});

test('ending a round and starting the next with a new pattern', async () => {
  await setup();
  await userEvent.click(screen.getByRole('button', { name: 'End round' }));
  const dlg = await screen.findByRole('dialog', { name: 'Next round' });
  await userEvent.selectOptions(within(dlg).getByLabelText('Pattern'), 'blackout');
  await userEvent.click(within(dlg).getByRole('button', { name: 'Start round 2' }));
  await waitFor(() => {
    const g = useGame.getState().game!;
    expect(g.rounds).toHaveLength(2);
    expect(g.rounds[0].endCall).toBe(0);
    expect(g.rounds[1].patternId).toBe('blackout');
  });
  await act(async () => {});
});
