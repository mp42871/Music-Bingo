import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CardGrid } from './CardGrid';
import { generateCard } from '../../core/cards';
import { DEFAULT_STYLE } from '../../core/style';
import { catPool, CATS, layout } from '../../test/fixtures';

const pool = catPool();
const byId = new Map(pool.songs.map((s) => [s.id, s]));
const card = { ...generateCard(pool, layout(), 1, 42) };

test('category headers, free cell, zero-padded number', () => {
  render(<CardGrid card={card} layout={layout()} songsById={byId} style={DEFAULT_STYLE} />);
  const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
  expect(headers).toEqual(CATS);
  expect(screen.getByText('FREE')).toBeInTheDocument();
  expect(screen.getByText('#0042')).toBeInTheDocument();
});

test('artist cell content shows artist names', () => {
  render(<CardGrid card={card} layout={layout({ cellContent: 'artist' })} songsById={byId} style={DEFAULT_STYLE} />);
  const first = card.cells[0];
  expect(screen.getByText(byId.get((first as { songId: string }).songId)!.artist)).toBeInTheDocument();
});

test('marked cells carry data-marked and toggle calls back', async () => {
  const marked = card.cells.map((_, i) => i === 0);
  const onToggle = vi.fn();
  render(<CardGrid card={card} layout={layout()} songsById={byId} style={DEFAULT_STYLE} marked={marked} onToggle={onToggle} />);
  const cells = screen.getAllByRole('gridcell');
  expect(cells[0]).toHaveAttribute('data-marked', 'true');
  expect(cells[1]).toHaveAttribute('data-marked', 'false');
  await userEvent.click(cells[1]);
  expect(onToggle).toHaveBeenCalledWith(1);
});

test('mystery column prints a question mark header', () => {
  render(<CardGrid card={card} layout={layout()} songsById={byId} style={{ ...DEFAULT_STYLE, mysteryColumn: 2 }} />);
  const headers = screen.getAllByRole('columnheader');
  expect(within(headers[2]).getByText('?')).toBeInTheDocument();
});

test('letters mode shows letters', () => {
  render(<CardGrid card={card} layout={layout({ headerMode: 'letters', letters: 'MUSIC' })} songsById={byId} style={DEFAULT_STYLE} />);
  expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['M', 'U', 'S', 'I', 'C']);
});

test('whole-playlist theme shows the playlist name across the top', () => {
  render(<CardGrid card={card} layout={layout({ headerMode: 'theme', themeCategory: undefined, themeLabel: 'Classic Rock' })} songsById={byId} style={DEFAULT_STYLE} />);
  expect(screen.getByRole('columnheader')).toHaveTextContent('Classic Rock');
});

describe('shrinkToFit', () => {
  it('shrinks the text of a tile whose words spill out, and leaves fitting tiles alone', async () => {
    const { shrinkToFit } = await import('./CardGrid');
    const root = document.createElement('div');
    root.innerHTML = '<div class="bc-cell" id="big"><span style="font-size: 4cqmin">Achy Breaky Heart</span></div><div class="bc-cell" id="ok"><span style="font-size: 4cqmin">Jolene</span></div>';
    const big = root.querySelector<HTMLElement>('#big')!;
    const span = big.querySelector('span')!;
    // the big tile overflows until its text is under 70% of the planned size
    Object.defineProperty(big, 'clientHeight', { value: 100 });
    Object.defineProperty(big, 'scrollHeight', { get: () => (parseFloat(span.style.fontSize) < 2.8 ? 100 : 130) });
    shrinkToFit(root);
    expect(span.style.fontSize).toBe('2.62cqmin');
    expect(root.querySelector<HTMLElement>('#ok span')!.style.fontSize).toBe('4cqmin');
    shrinkToFit(root); // running again starts from the planned size, not the shrunk one
    expect(span.style.fontSize).toBe('2.62cqmin');
  });
});
