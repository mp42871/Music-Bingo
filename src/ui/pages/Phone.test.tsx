import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Phone from './Phone';
import { encodePhoneDef, poolToPhoneDef } from '../../core/phone';
import { catPool, layout } from '../../test/fixtures';

const d = encodePhoneDef(poolToPhoneDef(catPool(), 9, layout(), 'Party'));
const renderAt = (q: string) => render(<MemoryRouter initialEntries={[`/phone?${q}`]}><Phone /></MemoryRouter>);

beforeEach(() => localStorage.clear());

test('without live play, a player can get a random card and keep it across reloads', async () => {
  const { unmount } = renderAt(`d=${d}`);
  await userEvent.click(await screen.findByRole('button', { name: 'Give me a random card' }));
  const label = (await screen.findByTestId('card-number')).textContent!;
  const n = Number(label.replace(/\D/g, ''));
  expect(n).toBeGreaterThanOrEqual(5000);
  expect(n).toBeLessThanOrEqual(9999);
  unmount();
  renderAt(`d=${d}`);
  expect((await screen.findByTestId('card-number')).textContent).toBe(label);
});

test('pick a number, daub, undo, clear, and add a second card', async () => {
  renderAt(`d=${d}`);
  await userEvent.type(await screen.findByLabelText('Card number'), '12');
  await userEvent.click(screen.getByRole('button', { name: 'Use this card' }));
  expect(await screen.findByTestId('card-number')).toHaveTextContent('#0012');
  const cells = screen.getAllByRole('gridcell');
  await userEvent.click(cells[0]);
  expect(cells[0]).toHaveAttribute('data-marked', 'true');
  await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect(screen.getAllByRole('gridcell')[0]).toHaveAttribute('data-marked', 'false');
  await userEvent.click(screen.getByRole('button', { name: '+ Add a card' }));
  await userEvent.click(screen.getByRole('button', { name: 'Give me a random card' }));
  expect(within(screen.getByRole('tablist', { name: 'Your cards' })).getAllByRole('tab')).toHaveLength(2);
});

test('without live play, BINGO tells the player to shout and show their number', async () => {
  renderAt(`d=${d}`);
  await userEvent.click(await screen.findByRole('button', { name: 'Give me a random card' }));
  await userEvent.click(screen.getByRole('button', { name: 'BINGO!' }));
  expect(await screen.findByText(/Shout BINGO and show the host card #\d{4}/)).toBeInTheDocument();
});

test('broken link shows a clear message', async () => {
  renderAt('d=garbage!!');
  expect(await screen.findByText(/This card link is broken/)).toBeInTheDocument();
});
