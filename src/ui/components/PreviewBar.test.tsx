import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PreviewBar } from './PreviewBar';
import { PreviewButton } from './PreviewButton';
import { usePreview } from '../../app/preview';
import { song } from '../../test/fixtures';

test('preview button starts a preview; the bar can save the current spot as the start point', async () => {
  const play = vi.fn(async (s: ReturnType<typeof song>) => { usePreview.setState({ current: s, positionMs: 72_000 }); });
  usePreview.setState({ play, current: null, positionMs: 0, toggle: async (s: ReturnType<typeof song>) => play(s) } as never);
  const onSetStart = vi.fn();
  render(<><PreviewButton song={song(1, { title: 'Jolene' })} /><PreviewBar onSetStart={onSetStart} /></>);
  await userEvent.click(screen.getByRole('button', { name: 'Preview Jolene' }));
  expect(play).toHaveBeenCalled();
  expect(await screen.findByText('Jolene')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Set 1:12 as start point' }));
  expect(onSetStart).toHaveBeenCalledWith('s1', 72_000);
  act(() => usePreview.setState({ current: null }));
});

test('song rows offer preview and play-from-start-point', async () => {
  const { SongRow } = await import('./SongRow');
  render(<ul><SongRow song={song(1, { title: 'Jolene', startMs: 30_000 })} categories={[]} onChange={() => {}} onRemove={() => {}} /></ul>);
  expect(screen.getByRole('button', { name: 'Preview Jolene' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Play Jolene from its start point' })).toBeInTheDocument();
});
