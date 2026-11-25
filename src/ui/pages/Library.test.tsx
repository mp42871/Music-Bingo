import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { db } from '../../db/db';
import * as audio from '../../db/audio';
import { listPools } from '../../db/repo';
import Library from './Library';

vi.mock('../../audio/ingest', () => ({
  readAudioMeta: async (f: File) => ({
    id: `id-${f.name}`, name: f.name, title: f.name.replace('.mp3', ''), artist: 'Band', durationMs: 180000,
    size: f.size, type: 'audio/mpeg', addedAt: Date.now(), blob: f,
  }),
}));

beforeEach(async () => { await Promise.all(db.tables.map((t) => t.clear())); vi.restoreAllMocks(); });

const files = () => [new File(['aaaa'], 'Jolene.mp3', { type: 'audio/mpeg' }), new File(['bb'], 'Africa.mp3', { type: 'audio/mpeg' })];

test('adding files lists them and shows storage used', async () => {
  render(<MemoryRouter><Library /></MemoryRouter>);
  await userEvent.upload(screen.getByLabelText('Add music files'), files());
  expect(await screen.findByText('Jolene')).toBeInTheDocument();
  expect(screen.getByText('Africa')).toBeInTheDocument();
  expect(screen.getByText(/2 files/)).toBeInTheDocument();
});

test('quota error reports which files were not saved', async () => {
  const real = audio.saveAudio;
  vi.spyOn(audio, 'saveAudio').mockImplementation(async (meta, blob) => {
    if (meta.name === 'Africa.mp3') throw new DOMException('full', 'QuotaExceededError');
    return real(meta, blob);
  });
  render(<MemoryRouter><Library /></MemoryRouter>);
  await userEvent.upload(screen.getByLabelText('Add music files'), files());
  expect(await screen.findByRole('alert')).toHaveTextContent(/storage is full.*Africa\.mp3/i);
  expect(await screen.findByText('Jolene')).toBeInTheDocument();
});

test('make a playlist from files', async () => {
  render(<MemoryRouter><Library /></MemoryRouter>);
  await userEvent.upload(screen.getByLabelText('Add music files'), files());
  await screen.findByText('Africa');
  await userEvent.click(screen.getByRole('button', { name: /Make a playlist from these files/ }));
  await waitFor(async () => {
    const pools = await listPools();
    expect(pools).toHaveLength(1);
    expect(pools[0].songs.map((s) => s.id).sort()).toEqual(['file:id-Africa.mp3', 'file:id-Jolene.mp3']);
  });
});

test('storage-full errors wrapped by the database (AbortError) are reported as storage full', async () => {
  const real = audio.saveAudio;
  vi.spyOn(audio, 'saveAudio').mockImplementation(async (meta, blob) => {
    if (meta.name === 'Africa.mp3') throw Object.assign(new Error('Transaction aborted'), { name: 'AbortError', inner: new DOMException('full', 'QuotaExceededError') });
    return real(meta, blob);
  });
  render(<MemoryRouter><Library /></MemoryRouter>);
  await userEvent.upload(screen.getByLabelText('Add music files'), files());
  expect(await screen.findByRole('alert')).toHaveTextContent(/storage is full.*Africa\.mp3/i);
});
