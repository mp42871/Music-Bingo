import { act } from '@testing-library/react';
import { RECHECK_MS, reportNetworkFailure, reportNetworkSuccess, useNet } from './online';

test('net store follows browser online/offline events', () => {
  act(() => { window.dispatchEvent(new Event('offline')); });
  expect(useNet.getState().online).toBe(false);
  act(() => { window.dispatchEvent(new Event('online')); });
  expect(useNet.getState().online).toBe(true);
});

test('a network failure marks the app offline until the browser says online', () => {
  act(() => { reportNetworkFailure(); });
  expect(useNet.getState().online).toBe(false);
  act(() => { window.dispatchEvent(new Event('online')); });
  expect(useNet.getState().online).toBe(true);
});

test('a successful request clears a reported failure', () => {
  act(() => { reportNetworkFailure(); });
  act(() => { reportNetworkSuccess(); });
  expect(useNet.getState().online).toBe(true);
});

test('while flagged offline, the app rechecks the connection and recovers', async () => {
  vi.useFakeTimers();
  const f = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', f);
  act(() => { reportNetworkFailure(); });
  await act(async () => { await vi.advanceTimersByTimeAsync(RECHECK_MS); });
  expect(useNet.getState().online).toBe(false);
  await act(async () => { await vi.advanceTimersByTimeAsync(RECHECK_MS); });
  expect(useNet.getState().online).toBe(true);
  await act(async () => { await vi.advanceTimersByTimeAsync(RECHECK_MS * 3); });
  expect(f).toHaveBeenCalledTimes(2);
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
