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

test('several playlists: each becomes a column with one click and the set remembers them', async () => {
  const { song } = await import('../../test/fixtures');
  const mk = (id: string, name: string, base: number) => ({ id, name, songs: Array.from({ length: 6 }, (_, i) => song(base + i)), categories: [], createdAt: 0, updatedAt: 0 });
  for (const [i, n] of ['Rock', 'Pop', 'Country', 'Soul', 'Disco'].entries()) await savePool(mk(`p${i}`, n, i * 100));
  render(<MemoryRouter initialEntries={['/designer?pool=p0']}><Designer /></MemoryRouter>);
  for (const n of ['Pop', 'Country', 'Soul', 'Disco']) await userEvent.click(await screen.findByRole('checkbox', { name: new RegExp(`^${n}`) }));
  await userEvent.click(screen.getByRole('button', { name: 'One playlist per column' }));
  expect(screen.getByLabelText('Column 1 category')).toHaveValue('Rock');
  expect(screen.getByLabelText('Column 5 category')).toHaveValue('Disco');
  const save = screen.getByRole('button', { name: 'Save cards' });
  await waitFor(() => expect(save).toBeEnabled());
  await userEvent.click(save);
  await waitFor(async () => {
    const [set] = await listCardSets();
    expect(set.poolIds).toEqual(['p0', 'p1', 'p2', 'p3', 'p4']);
    expect(set.layout.columnCategories).toEqual(['Rock', 'Pop', 'Country', 'Soul', 'Disco']);
  });
});

test('whole-card theme defaults to the whole playlist even if an empty category exists', async () => {
  const { flatPool } = await import('../../test/fixtures');
  await savePool({ ...flatPool(75), id: 'cr', name: 'Classic Rock', categories: ['Classic Rock'] });
  render(<MemoryRouter initialEntries={['/designer?pool=cr']}><Designer /></MemoryRouter>);
  await userEvent.click(await screen.findByRole('button', { name: /Whole-card theme/ }));
  const theme = screen.getByLabelText('Theme');
  expect(theme).toHaveDisplayValue('Whole playlist (75 songs)');
  expect(screen.getByRole('option', { name: 'Classic Rock (0 songs)' })).toBeInTheDocument();
  expect(screen.queryByText(/needs at least/)).toBeNull();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save cards' })).toBeEnabled());
});

test('change layout: designer opens filled in and rebuilds the same set', async () => {
  const { generateCardSet } = await import('../../core/cards');
  const { saveCardSet, getCardSet } = await import('../../db/repo');
  const { layout } = await import('../../test/fixtures');
  await savePool(catPool());
  const set = { ...generateCardSet(catPool(), layout(), { seed: 3, count: 12, startNumber: 1 }).set, id: 'cs', name: 'Gala' };
  await saveCardSet(set);
  render(<MemoryRouter initialEntries={['/designer?edit=cs']}><Designer /></MemoryRouter>);
  expect(await screen.findByText(/Changing the layout of “Gala”/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '3×3' }));
  const rebuild = screen.getByRole('button', { name: 'Rebuild cards' });
  await waitFor(() => expect(rebuild).toBeEnabled());
  window.confirm = () => true;
  await userEvent.click(rebuild);
  await waitFor(async () => {
    const s = (await getCardSet('cs'))!;
    expect(s.layout.size).toBe(3);
    expect(s.cards).toHaveLength(12);
    expect(s.name).toBe('Gala');
  });
  expect(await listCardSets()).toHaveLength(1);
});
