import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Phone from './Phone';
import { encodePhoneDef, poolToPhoneDef } from '../../core/phone';
import { catPool, layout } from '../../test/fixtures';

const d = encodePhoneDef(poolToPhoneDef(catPool(), 9, layout(), 'Party'));
const renderAt = (q: string) => render(<MemoryRouter initialEntries={[`/phone?${q}`]}><Phone /></MemoryRouter>);

beforeEach(() => localStorage.clear());

test('renders a phone card numbered 5000-9999 and keeps it across reloads', async () => {
  const { unmount } = renderAt(`d=${d}`);
  const label = (await screen.findByTestId('card-number')).textContent!;
  const n = Number(label.replace(/\D/g, ''));
  expect(n).toBeGreaterThanOrEqual(5000);
  expect(n).toBeLessThanOrEqual(9999);
  unmount();
  renderAt(`d=${d}`);
  expect((await screen.findByTestId('card-number')).textContent).toBe(label);
});

test('tapping a square daubs it and persists', async () => {
  const { unmount } = renderAt(`d=${d}`);
  const cells = await screen.findAllByRole('gridcell');
  await userEvent.click(cells[0]);
  expect(cells[0]).toHaveAttribute('data-marked', 'true');
  unmount();
  renderAt(`d=${d}`);
  expect((await screen.findAllByRole('gridcell'))[0]).toHaveAttribute('data-marked', 'true');
});

test('broken link shows a clear message', async () => {
  renderAt('d=garbage!!');
  expect(await screen.findByText(/This card link is broken/)).toBeInTheDocument();
});
