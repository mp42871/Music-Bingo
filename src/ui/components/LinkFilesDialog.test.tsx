import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LinkFilesDialog } from './LinkFilesDialog';
import type { AudioFile } from '../../core/types';
import { song } from '../../test/fixtures';

const af = (id: string, title: string, artist: string): AudioFile => ({ id, name: `${id}.mp3`, title, artist, durationMs: 1, size: 1, type: 'audio/mpeg', addedAt: 0 });

test('groups songs and applies links', async () => {
  const songs = [song(1, { title: 'Jolene', artist: 'Dolly Parton' }), song(2, { title: 'Hello', artist: 'Adele' }), song(3, { title: 'Africa', artist: 'Toto' })];
  const files = [af('a', 'Jolene', 'Dolly Parton'), af('b', 'Hello', 'Adele'), af('c', 'Hello', 'Adele')];
  const onApply = vi.fn();
  render(<LinkFilesDialog songs={songs} files={files} onApply={onApply} onClose={() => {}} />);
  expect(screen.getByText(/Matched \(1\)/)).toBeInTheDocument();
  expect(screen.getByText(/Pick one \(1\)/)).toBeInTheDocument();
  expect(screen.getByText(/No file \(1\)/)).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText('File for Hello'), 'c');
  await userEvent.click(screen.getByRole('button', { name: /Link 2 songs/ }));
  expect(onApply).toHaveBeenCalledWith({ s1: 'a', s2: 'c', s3: null });
  void within;
});

test('song row shows a File badge when linked', async () => {
  const { SongRow } = await import('./SongRow');
  render(<ul><SongRow song={song(1, { fileId: 'a' })} categories={[]} onChange={() => {}} onRemove={() => {}} /></ul>);
  expect(screen.getByText('File')).toBeInTheDocument();
});
