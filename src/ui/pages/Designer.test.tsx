import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Designer from './Designer';
import { db } from '../../db/db';
import { listCardSets, savePool } from '../../db/repo';
import { catPool } from '../../test/fixtures';

beforeEach(async () => { await Promise.all(db.tables.map((t) => t.clear())); });

test('Save cards stores the set without going to print', async () => {
  await savePool(catPool());
  render(<MemoryRouter initialEntries={['/designer?pool=p1']}><Designer /></MemoryRouter>);
  const save = await screen.findByRole('button', { name: 'Save cards' });
  await waitFor(() => expect(save).toBeEnabled());
  await userEvent.click(save);
  await waitFor(async () => expect(await listCardSets()).toHaveLength(1));
  expect(await screen.findByText(/Saved 40 cards/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save cards' })).toBeInTheDocument();
});
