import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Join from './Join';
import { createFakeBackend } from '../../live/fake';
import { setLiveBackend } from '../../live/config';
import { liveDef } from '../../game/phoneLink';
import { generateCardSet } from '../../core/cards';
import { catPool, layout } from '../../test/fixtures';

let fake: ReturnType<typeof createFakeBackend>;
let code: string;

beforeEach(async () => {
  localStorage.clear();
  fake = createFakeBackend();
  setLiveBackend(fake);
  const set = generateCardSet(catPool(), layout(), { seed: 4, count: 10, startNumber: 1 }).set;
  code = await fake.publish('Party Bingo', liveDef({ ...set, style: undefined }));
});
afterEach(() => setLiveBackend(undefined));

const open = (path: string) => render(
  <MemoryRouter initialEntries={[path]}><Routes><Route path="/join" element={<Join />} /><Route path="/join/:code" element={<Join />} /></Routes></MemoryRouter>,
);

test('typing the code opens the game', async () => {
  open('/join');
  await userEvent.type(screen.getByLabelText('Game code'), code);
  await userEvent.click(screen.getByRole('button', { name: 'Join' }));
  expect(await screen.findByText('Party Bingo')).toBeInTheDocument();
});

test('a random card gets an unused phone number and is registered', async () => {
  open(`/join/${code}`);
  await userEvent.click(await screen.findByRole('button', { name: 'Give me a random card' }));
  const n = Number((await screen.findByTestId('card-number')).textContent!.replace(/\D/g, ''));
  expect(n).toBeGreaterThanOrEqual(5000);
  expect(fake.players).toEqual([expect.objectContaining({ code, cardNumber: n })]);
});

test('picking a paper card number shows that card', async () => {
  open(`/join/${code}`);
  await userEvent.type(await screen.findByLabelText('Card number'), '7');
  await userEvent.click(screen.getByRole('button', { name: 'Use this card' }));
  expect(await screen.findByTestId('card-number')).toHaveTextContent('#0007');
});

test('daub, undo and clear', async () => {
  open(`/join/${code}`);
  await userEvent.click(await screen.findByRole('button', { name: 'Give me a random card' }));
  const cells = await screen.findAllByRole('gridcell');
  await userEvent.click(cells[0]);
  await userEvent.click(cells[1]);
  expect(cells[0]).toHaveAttribute('data-marked', 'true');
  expect(cells[1]).toHaveAttribute('data-marked', 'true');
  await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect(screen.getAllByRole('gridcell')[1]).toHaveAttribute('data-marked', 'false');
  expect(screen.getAllByRole('gridcell')[0]).toHaveAttribute('data-marked', 'true');
  window.confirm = () => true;
  await userEvent.click(screen.getByRole('button', { name: 'Clear card' }));
  expect(screen.getAllByRole('gridcell')[0]).toHaveAttribute('data-marked', 'false');
  expect(screen.getAllByRole('gridcell')[12]).toHaveAttribute('data-marked', 'true'); // free square stays
});

test('several cards in tabs, and daubs survive a reload', async () => {
  const { unmount } = open(`/join/${code}`);
  await userEvent.click(await screen.findByRole('button', { name: 'Give me a random card' }));
  await userEvent.click((await screen.findAllByRole('gridcell'))[0]);
  await userEvent.click(screen.getByRole('button', { name: '+ Add a card' }));
  await userEvent.type(await screen.findByLabelText('Card number'), '3');
  await userEvent.click(screen.getByRole('button', { name: 'Use this card' }));
  const tabs = within(screen.getByRole('tablist', { name: 'Your cards' })).getAllByRole('tab');
  expect(tabs).toHaveLength(2);
  unmount();
  open(`/join/${code}`);
  const again = within(await screen.findByRole('tablist', { name: 'Your cards' })).getAllByRole('tab');
  await userEvent.click(again[0]);
  expect((await screen.findAllByRole('gridcell'))[0]).toHaveAttribute('data-marked', 'true');
});

test('BINGO sends a claim for the shown card', async () => {
  open(`/join/${code}`);
  await userEvent.type(await screen.findByLabelText('Your first name (optional)'), 'Sam');
  await userEvent.click(screen.getByRole('button', { name: 'Give me a random card' }));
  const n = Number((await screen.findByTestId('card-number')).textContent!.replace(/\D/g, ''));
  await userEvent.click(screen.getByRole('button', { name: 'BINGO!' }));
  await waitFor(() => expect(fake.claims).toEqual([expect.objectContaining({ cardNumber: n, name: 'Sam' })]));
  expect(screen.getByText(/the host is checking card/i)).toBeInTheDocument();
});

test('an unknown code says so', async () => {
  open('/join/0000');
  expect(await screen.findByText(/No game with code 0000/)).toBeInTheDocument();
});
