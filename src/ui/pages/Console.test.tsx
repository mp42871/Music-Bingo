import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Console from './Console';
import { db } from '../../db/db';
import * as repo from '../../db/repo';
import { useGame } from '../../game/store';
import { generateCardSet } from '../../core/cards';
import { DEFAULT_CLIP } from '../../core/clip';
import type { Game } from '../../core/types';
import { catPool, layout } from '../../test/fixtures';
import type { PlaybackPort } from '../../game/controller';

const autoBackup = vi.fn((prepare: () => Promise<void>) => ({ saved: prepare(), result: new Promise<string>(() => {}) }));
vi.mock('../../drive/backup', () => ({ autoBackupOnClick: (p: () => Promise<void>) => autoBackup(p) }));
vi.mock('../../drive/service', () => ({ driveService: () => ({}), preloadGoogle: () => {}, refreshGoogleClientId: async () => '' }));

const pool = catPool();
let port: PlaybackPort & Record<string, ReturnType<typeof vi.fn>>;

async function setup(calls: string[] = []) {
  const { set } = generateCardSet(pool, layout(), { seed: 1, count: 10, startNumber: 1 });
  await repo.saveCardSet({ ...set, id: 'cs1' });
  const order = [...calls, ...pool.songs.map((s) => s.id).filter((id) => !calls.includes(id))];
  const game: Game = {
    id: 'g1', name: 'Friday', createdAt: 1, pool, cardSetId: 'cs1', settings: { ...DEFAULT_CLIP, startMode: 'beginning', fadeSec: 0 },
    callOrder: order, calls: calls.map((songId, i) => ({ songId, at: i })), rounds: [{ patternId: 'line', winners: [], startCall: 0 }], status: 'live',
  };
  await repo.saveGame(game);
  port = {
    play: vi.fn(async () => {}), pause: vi.fn(async () => {}), resume: vi.fn(async () => {}),
    seek: vi.fn(async () => {}), setVolume: vi.fn(async () => {}),
  } as never;
  useGame.setState({ makePort: () => port });
  render(<MemoryRouter initialEntries={['/console/g1']}><Routes><Route path="/console/:gameId" element={<Console />} /></Routes></MemoryRouter>);
  await screen.findByText('Friday');
  return { set, game };
}

beforeEach(async () => { await Promise.all(db.tables.map((t) => t.clear())); });

test('keyboard: space starts/pauses, arrow next, r replay, m mute', async () => {
  await setup();
  await userEvent.keyboard(' ');
  await waitFor(() => expect(port.play).toHaveBeenCalledTimes(1));
  await userEvent.keyboard(' ');
  await waitFor(() => expect(port.pause).toHaveBeenCalled());
  await userEvent.keyboard('{ArrowRight}');
  await waitFor(() => expect(port.play).toHaveBeenCalledTimes(2));
  await userEvent.keyboard('r');
  await waitFor(() => expect(port.play).toHaveBeenCalledTimes(3));
  await userEvent.keyboard('m');
  await waitFor(() => expect(useGame.getState().cs?.muted).toBe(true));
  await waitFor(async () => expect((await repo.getGame('g1'))!.calls).toHaveLength(2));
});

test('changing the break while live updates the game settings', async () => {
  await setup();
  const gap = screen.getByLabelText('Break between songs (seconds)');
  await userEvent.clear(gap);
  await userEvent.type(gap, '12');
  await waitFor(() => expect(useGame.getState().game!.settings.gapSec).toBe(12));
  expect(useGame.getState().ctrl!.clipSettings.gapSec).toBe(12);
});

test('winner tracker lists cards that have bingo', async () => {
  const { set } = generateCardSet(pool, layout(), { seed: 1, count: 10, startNumber: 1 });
  const row = set.cards[0].cells.slice(0, 5).map((c) => (c.kind === 'song' ? c.songId : ''));
  await setup(row);
  const tracker = screen.getByTestId('winner-tracker');
  expect(within(tracker).getByText('#0001')).toBeInTheDocument();
});

test('ending a round and starting the next with a new pattern', async () => {
  await setup();
  await userEvent.click(screen.getByRole('button', { name: 'End round' }));
  const dlg = await screen.findByRole('dialog', { name: 'Next round' });
  await userEvent.selectOptions(within(dlg).getByLabelText('Pattern'), 'blackout');
  await userEvent.click(within(dlg).getByRole('button', { name: 'Start round 2' }));
  await waitFor(() => {
    const g = useGame.getState().game!;
    expect(g.rounds).toHaveLength(2);
    expect(g.rounds[0].endCall).toBe(0);
    expect(g.rounds[1].patternId).toBe('blackout');
  });
  await act(async () => {});
});

test('queue changes are saved right away so a reload resumes correctly', async () => {
  await setup();
  await userEvent.keyboard(' ');
  await waitFor(() => expect(port.play).toHaveBeenCalledTimes(1));
  const target = useGame.getState().ctrl!.upcoming()[10];
  const label = useGame.getState().songs.get(target)!.title;
  await userEvent.click(screen.getByRole('button', { name: `Play ${label} now` }));
  await waitFor(async () => {
    const saved = await repo.getGame('g1');
    expect(saved!.callOrder[1]).toBe(target);
    expect(saved!.calls.map((c) => c.songId)).toContain(target);
  });
});

test('leaving the console pauses playback and detaches the game', async () => {
  await setup();
  await userEvent.keyboard(' ');
  await waitFor(() => expect(port.play).toHaveBeenCalledTimes(1));
  const ctrl = useGame.getState().ctrl!;
  cleanup();
  await waitFor(() => expect(port.pause).toHaveBeenCalled());
  await ctrl.next();
  expect(port.play).toHaveBeenCalledTimes(1);
});

test('manual songs show a play-it-yourself prompt and Played records the call', async () => {
  await setup();
  vi.mocked(port.play).mockImplementation(async () => 'manual');
  await userEvent.keyboard(' ');
  expect(await screen.findByText(/Play now in Spotify/)).toBeInTheDocument();
  const first = useGame.getState().songs.get(useGame.getState().cs!.currentId!)!;
  expect(screen.getAllByText(first.title).length).toBeGreaterThan(0);
  expect(useGame.getState().game!.calls).toHaveLength(0);
  await userEvent.click(screen.getByRole('button', { name: 'Played' }));
  expect(useGame.getState().game!.calls.map((c) => c.songId)).toEqual([first.id]);
});

test('space marks a manual song as played', async () => {
  await setup();
  vi.mocked(port.play).mockImplementation(async () => 'manual');
  await userEvent.keyboard(' ');
  await screen.findByText(/Play now in Spotify/);
  await userEvent.keyboard(' ');
  expect(useGame.getState().game!.calls).toHaveLength(1);
});

test('music source can be switched live', async () => {
  await setup();
  await userEvent.click(screen.getByRole('radio', { name: 'Manual only' }));
  expect(useGame.getState().game!.settings.source).toBe('manual');
});

test('opening a game clears the previous game\'s source badge', async () => {
  useGame.setState({ source: 'spotify' });
  await setup();
  expect(useGame.getState().source).toBeNull();
});

test('opening Check a card pauses the game', async () => {
  await setup();
  await userEvent.keyboard(' ');
  await waitFor(() => expect(useGame.getState().cs?.phase).toBe('playing'));
  await userEvent.click(screen.getByRole('button', { name: 'Check a card' }));
  await waitFor(() => expect(useGame.getState().cs?.phase).toBe('paused'));
  expect(port.pause).toHaveBeenCalled();
  expect(screen.getByRole('dialog', { name: 'Check a card' })).toBeInTheDocument();
});

test('ending the game finishes it and leaves even while the Drive backup is still running', async () => {
  await setup();
  await userEvent.click(screen.getByRole('button', { name: 'End round' }));
  await userEvent.click(within(await screen.findByRole('dialog', { name: 'Next round' })).getByRole('button', { name: 'End game' }));
  await waitFor(() => expect(autoBackup).toHaveBeenCalled());
  await waitFor(async () => expect((await repo.getGame('g1'))!.status).toBe('finished'));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Next round' })).toBeNull());
});

test('a quick game opens with the phone QR on and a print link ready', async () => {
  const { set } = generateCardSet(pool, layout(), { seed: 1, count: 10, startNumber: 1 });
  await repo.saveCardSet({ ...set, id: 'cs' });
  await repo.saveGame({ id: 'gq', name: 'Quick', createdAt: 1, pool, cardSetId: 'cs', settings: { ...DEFAULT_CLIP, startMode: 'beginning', fadeSec: 0 }, callOrder: pool.songs.map((s) => s.id), calls: [], rounds: [{ patternId: 'line', winners: [], startCall: 0 }], status: 'setup' });
  useGame.setState({ makePort: () => ({ play: vi.fn(async () => {}), pause: vi.fn(async () => {}), resume: vi.fn(async () => {}), seek: vi.fn(async () => {}), setVolume: vi.fn(async () => {}) }) });
  render(<MemoryRouter initialEntries={['/console/gq?new=1']}><Routes><Route path="/console/:gameId" element={<Console />} /></Routes></MemoryRouter>);
  expect(await screen.findByRole('link', { name: 'Print cards' })).toHaveAttribute('target', '_blank');
  await waitFor(() => expect(useGame.getState().showQr).toBe(true));
});

describe('live play', () => {
  afterEach(async () => { (await import('../../live/config')).setLiveBackend(undefined); });

  test('the game goes live, counts phones, and shows checked BINGO claims', async () => {
    const { createFakeBackend } = await import('../../live/fake');
    const { setLiveBackend } = await import('../../live/config');
    const fake = createFakeBackend();
    setLiveBackend(fake);
    const { set } = generateCardSet(pool, layout(), { seed: 1, count: 10, startNumber: 1 });
    const row = set.cards[0].cells.slice(0, 5).map((c) => (c.kind === 'song' ? c.songId : ''));
    await setup(row); // card #0001 already has a full top row
    const chip = await screen.findByText(/Live: \d{4}/);
    const code = chip.textContent!.match(/\d{4}/)![0];
    await act(async () => { await fake.join(code, 5001, 'Ann', 'phoneA'); });
    expect(await screen.findByText(/1 phone/)).toBeInTheDocument();
    await act(async () => { await fake.join(code, 1, 'Sam', 'phoneS'); await fake.join(code, 2, 'Lee', 'phoneL'); await fake.claim(code, 1, 'Sam', 'phoneS'); });
    const pop = await screen.findByRole('alert', { name: /BINGO claim/ });
    expect(pop).toHaveTextContent(/Sam · card #0001/);
    expect(pop).toHaveTextContent(/VALID/);
    await act(async () => { await fake.claim(code, 2, 'Lee', 'phoneL'); });
    expect(await screen.findByText(/Lee · card #0002/)).toBeInTheDocument();
    expect(screen.getAllByText(/NOT YET/).length).toBeGreaterThan(0);
  });

  test('phone cards with bingo show in "Cards with bingo", marked as on a phone', async () => {
    const { createFakeBackend } = await import('../../live/fake');
    const { setLiveBackend } = await import('../../live/config');
    const { findCard } = await import('../../core/claim');
    const fake = createFakeBackend();
    setLiveBackend(fake);
    const { set } = generateCardSet(pool, layout(), { seed: 1, count: 10, startNumber: 1 });
    const phone = findCard(set, 7777)!.card;
    const row = phone.cells.slice(0, 5).map((c) => (c.kind === 'song' ? c.songId : ''));
    await setup(row); // phone card #7777 has a full top row
    const code = (await screen.findByText(/Live: \d{4}/)).textContent!.match(/\d{4}/)![0];
    const tracker = screen.getByTestId('winner-tracker');
    expect(within(tracker).queryByText('#7777')).toBeNull();
    await act(async () => { await fake.join(code, 7777, 'Ann', 'phoneA'); });
    expect(await within(tracker).findByRole('button', { name: '#7777 (on a phone)' })).toBeInTheDocument();
  });

  test('ending the game closes it for phones', async () => {
    const { createFakeBackend } = await import('../../live/fake');
    const { setLiveBackend } = await import('../../live/config');
    const fake = createFakeBackend();
    setLiveBackend(fake);
    await setup();
    const code = (await screen.findByText(/Live: \d{4}/)).textContent!.match(/\d{4}/)![0];
    await userEvent.click(screen.getByRole('button', { name: 'End round' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Next round' })).getByRole('button', { name: 'End game' }));
    await waitFor(async () => expect((await fake.getGame(code))!.status).toBe('closed'));
  });
});

test('when live play fails, the console explains why and can try again', async () => {
  const { createFakeBackend } = await import('../../live/fake');
  const { setLiveBackend } = await import('../../live/config');
  const fake = createFakeBackend();
  const realPublish = fake.publish;
  let fail = true;
  fake.publish = async (...a) => { if (fail) throw new Error('Supabase is blocking access — run the latest setup script'); return realPublish(...a); };
  setLiveBackend(fake);
  await setup();
  const banner = await screen.findByRole('alert', { name: 'Live play problem' });
  expect(banner).toHaveTextContent(/Supabase is blocking access/);
  fail = false;
  await userEvent.click(within(banner).getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText(/Live: \d{4}/)).toBeInTheDocument();
  setLiveBackend(undefined);
});

test('without live play, the console can show the phone QR full screen', async () => {
  await setup();
  await userEvent.click(screen.getByRole('button', { name: 'Phone QR' }));
  const dlg = await screen.findByRole('dialog', { name: 'Join on your phone' });
  expect(within(dlg).getByText(/Scan to get your card/)).toBeInTheDocument();
});

test('with live play, the full-screen QR also shows the address to type', async () => {
  const { createFakeBackend } = await import('../../live/fake');
  const { setLiveBackend } = await import('../../live/config');
  setLiveBackend(createFakeBackend());
  await setup();
  await screen.findByText(/Live: \d{4}/);
  useGame.setState((st) => ({ live: { ...st.live, typed: true, site: 'example.test/Music-Bingo' } }));
  await userEvent.click(screen.getByRole('button', { name: 'Phone QR' }));
  const dlg = await screen.findByRole('dialog', { name: 'Join on your phone' });
  expect(within(dlg).getByText('example.test/Music-Bingo/join')).toBeInTheDocument();
  setLiveBackend(undefined);
});

test('the players’ screen shows the join QR before the game starts, even if opened after the console', async () => {
  const Audience = (await import('./Audience')).default;
  await setup();
  expect(useGame.getState().showQr).toBe(true);
  render(<Audience />);
  expect(await screen.findByText(/Scan to get your card|Play on your phone/)).toBeInTheDocument();
});

test('leaving the console mid-song and coming back picks up that song where it was', async () => {
  await setup();
  await userEvent.keyboard(' '); // start the first song
  await waitFor(() => expect(port.play).toHaveBeenCalledTimes(1));
  const [uri] = (port.play as ReturnType<typeof vi.fn>).mock.calls[0];
  await new Promise((r) => setTimeout(r, 800));
  cleanup(); // leave the DJ screen
  await waitFor(async () => expect((await repo.getGame('g1'))!.resumeAt?.songId).toBeTruthy());
  render(<MemoryRouter initialEntries={['/console/g1']}><Routes><Route path="/console/:gameId" element={<Console />} /></Routes></MemoryRouter>);
  await screen.findByText('Friday');
  (port.play as ReturnType<typeof vi.fn>).mockClear();
  await userEvent.keyboard(' '); // play again
  await waitFor(() => expect(port.play).toHaveBeenCalledTimes(1));
  const [again, pos] = (port.play as ReturnType<typeof vi.fn>).mock.calls[0];
  expect(again).toBe(uri);
  expect(pos).toBeGreaterThanOrEqual(500);
  expect((await repo.getGame('g1'))!.calls).toHaveLength(1);
});

test('phones: the bingo count sits in a bar at the top of the console', async () => {
  const { set } = generateCardSet(pool, layout(), { seed: 1, count: 10, startNumber: 1 });
  const row = set.cards[0].cells.slice(0, 5).map((c) => (c.kind === 'song' ? c.songId : ''));
  await setup(row);
  const bar = screen.getByTestId('bingo-bar');
  expect(bar).toHaveTextContent(/card(s)? ha(s|ve) bingo/);
  expect(within(bar).getByRole('button', { name: 'Check #0001' })).toBeInTheDocument();
  // it comes before the song deck in the page
  expect(bar.compareDocumentPosition(screen.getByRole('button', { name: 'End round' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
