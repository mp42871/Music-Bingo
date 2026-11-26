import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Check from './Check';
import History from './History';
import { db } from '../../db/db';
import * as repo from '../../db/repo';
import { generateCardSet } from '../../core/cards';
import { DEFAULT_CLIP } from '../../core/clip';
import type { Game } from '../../core/types';
import { catPool, layout } from '../../test/fixtures';

const pool = catPool();
const { set } = generateCardSet(pool, layout(), { seed: 3, count: 50, startNumber: 1 });
const card42 = set.cards.find((c) => c.number === 42)!;
const row = card42.cells.slice(0, 5).map((c) => (c.kind === 'song' ? c.songId : ''));
const others = pool.songs.map((s) => s.id).filter((id) => !row.includes(id));
const order = [...others.slice(0, 12), ...row, ...others.slice(12)];

function game(id: string, calls: number, createdAt: number, extra: Partial<Game> = {}): Game {
  return {
    id, name: `Game ${id}`, createdAt, pool: { ...pool, songs: set.songs! }, cardSetId: 'cs', settings: DEFAULT_CLIP,
    callOrder: order, calls: order.slice(0, calls).map((songId, i) => ({ songId, at: createdAt + i * 60000 })),
    rounds: [{ patternId: 'line', winners: [], startCall: 0 }], status: 'live', ...extra,
  };
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await repo.saveCardSet({ ...set, id: 'cs' });
});

test('valid claim shows VALID and the call number', async () => {
  await repo.saveGame(game('a', 20, 1000));
  render(<MemoryRouter><Check /></MemoryRouter>);
  await userEvent.type(await screen.findByLabelText('Card number'), '42{enter}');
  expect(await screen.findByText('VALID')).toBeInTheDocument();
  expect(screen.getByText(/Bingo on song 17/)).toBeInTheDocument();
});

test('incomplete claim shows NOT YET with squares needed', async () => {
  await repo.saveGame(game('a', 15, 1000));
  render(<MemoryRouter><Check /></MemoryRouter>);
  await userEvent.type(await screen.findByLabelText('Card number'), '42{enter}');
  expect(await screen.findByText('NOT YET')).toBeInTheDocument();
  expect(screen.getByText(/2 more squares/)).toBeInTheDocument();
});

test('phone card numbers are checked too', async () => {
  await repo.saveGame(game('a', 15, 1000));
  render(<MemoryRouter><Check /></MemoryRouter>);
  await userEvent.type(await screen.findByLabelText('Card number'), '6123{enter}');
  expect(await screen.findByText(/Phone card/)).toBeInTheDocument();
});

test('recording a winner saves it to the round', async () => {
  await repo.saveGame(game('a', 20, 1000));
  render(<MemoryRouter><Check /></MemoryRouter>);
  await userEvent.type(await screen.findByLabelText('Card number'), '42{enter}');
  await userEvent.type(await screen.findByLabelText('Winner name'), 'Pat');
  await userEvent.click(screen.getByRole('button', { name: 'Record winner' }));
  await screen.findByText(/Recorded/);
  expect((await repo.getGame('a'))!.rounds[0].winners).toEqual([{ cardNumber: 42, name: 'Pat', atCall: 17 }]);
});

test('history lists newest first and shows calls and winners', async () => {
  await repo.saveGame(game('old', 3, 1000, { status: 'finished' }));
  await repo.saveGame(game('new', 4, 5000, { status: 'finished', rounds: [{ patternId: 'line', winners: [{ cardNumber: 7, name: 'Sam', atCall: 4 }], startCall: 0, endCall: 4 }] }));
  render(<MemoryRouter><History /></MemoryRouter>);
  const items = await screen.findAllByRole('button', { name: /Game (old|new)/ });
  expect(items[0]).toHaveTextContent('Game new');
  await userEvent.click(items[0]);
  expect(await screen.findAllByRole('listitem', { name: /Call \d+/ })).toHaveLength(4);
  expect(screen.getByText(/Sam/)).toBeInTheDocument();
});

test('clear history deletes all games after confirming', async () => {
  await repo.saveGame(game('a', 3, 1000, { status: 'finished' }));
  await repo.saveGame(game('b', 3, 2000, { status: 'finished' }));
  const ask = vi.fn(() => true);
  window.confirm = ask;
  render(<MemoryRouter><History /></MemoryRouter>);
  await screen.findAllByRole('button', { name: /Game (a|b)/ });
  await userEvent.click(screen.getByRole('button', { name: 'Clear history' }));
  expect(ask).toHaveBeenCalled();
  await waitFor(async () => expect(await repo.listGames()).toHaveLength(0));
  expect(screen.queryByRole('button', { name: /Game (a|b)/ })).toBeNull();
});

test('clear history does nothing if you cancel', async () => {
  await repo.saveGame(game('a', 3, 1000, { status: 'finished' }));
  window.confirm = () => false;
  render(<MemoryRouter><History /></MemoryRouter>);
  await screen.findByRole('button', { name: /Game a/ });
  await userEvent.click(screen.getByRole('button', { name: 'Clear history' }));
  expect(await repo.listGames()).toHaveLength(1);
});
