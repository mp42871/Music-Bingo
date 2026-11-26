import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DriveSection } from './DriveSection';
import { db } from '../../db/db';
import * as repo from '../../db/repo';

const fake = {
  upload: vi.fn(async () => 'id'), prune: vi.fn(async () => {}),
  list: vi.fn(async () => [{ id: 'b2', name: 'Music Bingo backup 2026-11-26 21-05.json', createdTime: '2026-11-26T21:05:00Z', size: 2048 }]),
  download: vi.fn(async () => '{"format":"music-bingo-backup","pools":[],"cardSets":[],"games":[],"kv":[]}'),
};
vi.mock('../../drive/service', () => ({ driveService: () => fake, refreshGoogleClientId: async () => (await import('../../db/repo')).getSetting('googleClientId', ''), preloadGoogle: () => {} }));
vi.mock('../../drive/google', () => ({ googleConnected: () => true, disconnectGoogle: () => {} }));

beforeEach(async () => { await Promise.all(db.tables.map((t) => t.clear())); await repo.setSetting('googleClientId', 'cid'); vi.clearAllMocks(); });

test('Back up now uploads and shows the time', async () => {
  render(<DriveSection />);
  await userEvent.click(await screen.findByRole('button', { name: 'Back up now' }));
  expect(await screen.findByText(/Last backup:/)).toBeInTheDocument();
  expect(fake.upload).toHaveBeenCalled();
});

test('restore lists backups and merges the chosen one', async () => {
  const spy = vi.spyOn(repo, 'importBackup');
  render(<DriveSection />);
  await userEvent.click(await screen.findByRole('button', { name: 'Restore from Drive' }));
  await userEvent.click(await screen.findByRole('button', { name: /Merge Music Bingo backup 2026-11-26 21-05/ }));
  await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.stringContaining('music-bingo-backup'), 'merge'));
  expect(await screen.findByText(/Restored/)).toBeInTheDocument();
});

test('auto backup toggle saves the setting', async () => {
  render(<DriveSection />);
  const box = await screen.findByRole('checkbox', { name: /Back up automatically when a game ends/ });
  await userEvent.click(box);
  await waitFor(async () => expect(await repo.getSetting('driveAutoBackup', true)).toBe(false));
});

test('setup steps stay available for changing the Client ID', async () => {
  render(<DriveSection />);
  expect(await screen.findByText(/Google Cloud console/)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Back up now' })).toBeEnabled());
});

test('opening Restore also turns automatic backup on the first time', async () => {
  render(<DriveSection />);
  await userEvent.click(await screen.findByRole('button', { name: 'Restore from Drive' }));
  await screen.findByRole('button', { name: /Merge/ });
  expect(await repo.getSetting('driveAutoBackup', null)).toBe(true);
});

test('replacing from Drive refreshes the panel', async () => {
  window.confirm = () => true;
  fake.download.mockResolvedValueOnce(JSON.stringify({ format: 'music-bingo-backup', pools: [], cardSets: [], games: [], kv: [{ key: 'driveLastBackupAt', value: Date.UTC(2026, 0, 2, 12) }, { key: 'googleClientId', value: 'cid' }] }));
  render(<DriveSection />);
  expect(await screen.findByText(/No backups yet/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Restore from Drive' }));
  await userEvent.click(await screen.findByRole('button', { name: /Replace with Music Bingo backup/ }));
  expect(await screen.findByText(/Last backup:/)).toBeInTheDocument();
});

test('disconnecting Google asks first', async () => {
  const ask = vi.fn(() => false);
  window.confirm = ask;
  render(<DriveSection />);
  await userEvent.click(await screen.findByRole('button', { name: 'Disconnect Google' }));
  expect(ask).toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Disconnect Google' })).toBeInTheDocument();
});
