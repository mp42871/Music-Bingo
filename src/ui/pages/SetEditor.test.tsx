import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SetEditor from './SetEditor';
import Print from './Print';
import { db } from '../../db/db';
import { getCardSet, listCardSets, saveCardSet, saveGame } from '../../db/repo';
import { generateCardSet } from '../../core/cards';
import { DEFAULT_CLIP } from '../../core/clip';
import { DEFAULT_STYLE } from '../../core/style';
import { catPool, layout } from '../../test/fixtures';

const base = () => ({ ...generateCardSet(catPool(), layout(), { seed: 3, count: 10, startNumber: 1 }).set, id: 'cs', name: 'Gala', style: DEFAULT_STYLE });
const open = (path = '/sets/cs') => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes><Route path="/sets/:id" element={<SetEditor />} /><Route path="/print/:setId" element={<Print />} /></Routes>
  </MemoryRouter>,
);

beforeEach(async () => { await Promise.all(db.tables.map((t) => t.clear())); });

test('saving the look renames and restyles without touching the cards', async () => {
  const set = base();
  await saveCardSet(set);
  open();
  const name = await screen.findByLabelText('Set name');
  await userEvent.clear(name);
  await userEvent.type(name, 'Gala Night');
  await userEvent.clear(screen.getByLabelText('Title'));
  await userEvent.type(screen.getByLabelText('Title'), 'Charity Bingo');
  await userEvent.click(screen.getByRole('button', { name: 'Save look' }));
  await waitFor(async () => {
    const s = (await getCardSet('cs'))!;
    expect(s.name).toBe('Gala Night');
    expect(s.style!.title).toBe('Charity Bingo');
    expect(s.cards).toEqual(set.cards);
  });
});

test('adding cards continues numbering and offers to print just those', async () => {
  await saveCardSet(base());
  open();
  const n = await screen.findByLabelText('How many cards to add');
  await userEvent.clear(n);
  await userEvent.type(n, '5');
  await userEvent.click(screen.getByRole('button', { name: 'Add cards' }));
  expect(await screen.findByText(/Added cards #0011–#0015/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Print only the new cards' })).toHaveAttribute('href', '/print/cs?cards=11-15');
  expect((await getCardSet('cs'))!.cards).toHaveLength(15);
});

test('removing a song reports changed cards', async () => {
  const set = base();
  await saveCardSet(set);
  open();
  const id = (set.cards[0].cells[0] as { songId: string }).songId;
  const title = set.songs!.find((s) => s.id === id)!.title;
  await userEvent.selectOptions(await screen.findByLabelText('Song to swap'), id);
  await userEvent.click(screen.getByRole('button', { name: 'Remove from cards' }));
  expect(await screen.findByText(new RegExp(`“${title}” is off the cards — \\d+ cards? changed`))).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Print only changed cards' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Reprint the phone QR poster' })).toHaveAttribute('href', '/print/cs?mode=poster');
});

test('swap buttons wait until it is known whether the set was used in a game', async () => {
  const repo = await import('../../db/repo');
  const spy = vi.spyOn(repo, 'listGames').mockReturnValue(new Promise(() => {}) as never);
  const set = base();
  await saveCardSet(set);
  open();
  await userEvent.selectOptions(await screen.findByLabelText('Song to swap'), (set.cards[0].cells[0] as { songId: string }).songId);
  expect(screen.getByRole('button', { name: 'Remove from cards' })).toBeDisabled();
  spy.mockRestore();
});

test('a set used in a game saves swaps as a new version', async () => {
  const set = base();
  await saveCardSet(set);
  await saveGame({ id: 'g', name: 'G', createdAt: 1, pool: catPool(), cardSetId: 'cs', settings: DEFAULT_CLIP, callOrder: [], calls: [], rounds: [], status: 'finished' });
  open();
  expect(await screen.findByText(/already been used in a game/)).toBeInTheDocument();
  const id = (set.cards[0].cells[0] as { songId: string }).songId;
  await userEvent.selectOptions(screen.getByLabelText('Song to swap'), id);
  await userEvent.click(screen.getByRole('button', { name: 'Remove from cards' }));
  await waitFor(async () => expect((await listCardSets()).map((s) => s.name).sort()).toEqual(['Gala', 'Gala v2']));
  expect((await getCardSet('cs'))!.cards).toEqual(set.cards);
});

test('print can show only some cards', async () => {
  await saveCardSet(base());
  render(<MemoryRouter initialEntries={['/print/cs?cards=2,4']}><Routes><Route path="/print/:setId" element={<Print />} /></Routes></MemoryRouter>);
  await screen.findByText(/Gala/);
  expect(document.querySelectorAll('[data-card]')).toHaveLength(2);
});
