import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Settings from './Settings';
import * as repo from '../../db/repo';
import { db } from '../../db/db';

beforeEach(async () => { await Promise.all(db.tables.map((t) => t.clear())); });

test('client id saves, redirect uri shows, connect needs a client id', async () => {
  render(<MemoryRouter><Settings /></MemoryRouter>);
  const input = await screen.findByLabelText('Spotify Client ID');
  await waitFor(() => expect(input).toHaveValue('bbb45131b8a14409ad1cbe8d1c338d44'));
  expect(screen.getByText(window.location.origin + window.location.pathname)).toBeInTheDocument();
  const connect = screen.getByRole('button', { name: 'Connect Spotify' });
  expect(connect).toBeEnabled();
  await userEvent.clear(input);
  expect(connect).toBeDisabled();
  await userEvent.type(input, 'abc123');
  await userEvent.click(screen.getByRole('button', { name: 'Save Client ID' }));
  await waitFor(async () => expect(await repo.getSetting('clientId', '')).toBe('abc123'));
});

test('backup controls exist', async () => {
  render(<MemoryRouter><Settings /></MemoryRouter>);
  expect(await screen.findByRole('button', { name: 'Download backup' })).toBeInTheDocument();
  expect(screen.getByLabelText('Restore from backup file')).toBeInTheDocument();
});

test('clip defaults save', async () => {
  render(<MemoryRouter><Settings /></MemoryRouter>);
  const clip = await screen.findByLabelText('Clip length (seconds)');
  await userEvent.clear(clip);
  await userEvent.type(clip, '20');
  await userEvent.click(screen.getByRole('button', { name: 'Save game defaults' }));
  await waitFor(async () => expect((await repo.getSetting<{ clipSec: number }>('clip', { clipSec: 0 })).clipSec).toBe(20));
});
