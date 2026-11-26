import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Home from './Home';
import { db } from '../../db/db';
import * as repo from '../../db/repo';
import { DEFAULT_CLIP } from '../../core/clip';
import type { Game } from '../../core/types';
import { catPool } from '../../test/fixtures';

const game = (id: string, status: Game['status'] = 'live'): Game => ({
  id, name: `Game ${id}`, createdAt: Number(id.replace(/\D/g, '')) || 1, pool: catPool(1), cardSetId: 'cs', settings: DEFAULT_CLIP,
  callOrder: [], calls: [], rounds: [], status,
});

beforeEach(async () => { await Promise.all(db.tables.map((t) => t.clear())); });

test('a game can be cleared from "Pick up where you left off" and stays in history as finished', async () => {
  await repo.saveGame(game('g1'));
  await repo.saveGame(game('g2'));
  render(<MemoryRouter><Home /></MemoryRouter>);
  const section = await screen.findByRole('region', { name: 'Pick up where you left off' });
  await userEvent.click(within(section).getByRole('button', { name: 'Clear Game g1' }));
  await waitFor(() => expect(within(section).queryByText('Game g1')).toBeNull());
  expect((await repo.getGame('g1'))!.status).toBe('finished');
  expect(within(section).getByText('Game g2')).toBeInTheDocument();
});

test('Clear all ends every unfinished game', async () => {
  await repo.saveGame(game('g1'));
  await repo.saveGame(game('g2'));
  window.confirm = () => true;
  render(<MemoryRouter><Home /></MemoryRouter>);
  const section = await screen.findByRole('region', { name: 'Pick up where you left off' });
  await userEvent.click(within(section).getByRole('button', { name: 'Clear all' }));
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Pick up where you left off' })).toBeNull());
  expect((await repo.listGames()).every((g) => g.status === 'finished')).toBe(true);
});
