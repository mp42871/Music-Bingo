import { act } from '@testing-library/react';
import { reportNetworkFailure, useNet } from './online';

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
