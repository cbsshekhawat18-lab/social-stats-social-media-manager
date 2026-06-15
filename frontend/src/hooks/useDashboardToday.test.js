/**
 *
 * Verifies:
 *   • Stays disabled (no fetch) until a client is selected.
 *   • Fetches /api/dashboard/today/ with the right client_id when a client
 *     is set in the app store.
 *   • Switching client invalidates the query (different cache key).
 *   • Returns the categorized payload from the backend untouched.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import useDashboardToday from './useDashboardToday';
import { useAppStore } from '../stores/appStore';

jest.mock('../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

import api from '../services/api';

function makeWrapper(qc) {
  return ({ children }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('useDashboardToday', () => {
  let qc;

  beforeEach(() => {
    api.get.mockReset();
    useAppStore.getState().reset();
    qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
  });

  afterEach(() => qc.clear());

  test('does not fetch until a client is selected', async () => {
    // No client set in the store yet.
    renderHook(() => useDashboardToday(), { wrapper: makeWrapper(qc) });
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(api.get).not.toHaveBeenCalled();
  });

  test('fetches with client_id once the active client is set', async () => {
    api.get.mockResolvedValue({ data: {
      client_id: 42, client_name: 'Acme', as_of: '2026-05-09T07:30:00Z',
      briefing: '• alpha\n• beta',
      posts: { published_today: 1 },
      inbox: {}, leads: {}, campaigns: {},
      recent_activity: [], pending_approvals: [], engagement_chart: [],
    }});

    useAppStore.getState().setCurrentClient({ id: 42, name: 'Acme' });
    const { result } = renderHook(() => useDashboardToday(),
      { wrapper: makeWrapper(qc) });

    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
    const [url, opts] = api.get.mock.calls[0];
    expect(url).toBe('/dashboard/today/');
    expect(opts.params.client_id).toBe(42);

    await waitFor(() => expect(result.current.data?.briefing).toContain('alpha'));
  });

  test('switching clients re-fetches with the new id', async () => {
    api.get.mockResolvedValue({ data: { client_id: 0, posts: {}, inbox: {},
      leads: {}, campaigns: {}, recent_activity: [], pending_approvals: [],
      engagement_chart: [], briefing: '', as_of: '', client_name: '' }});

    useAppStore.getState().setCurrentClient({ id: 1, name: 'A' });
    renderHook(() => useDashboardToday(), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));

    act(() => { useAppStore.getState().setCurrentClient({ id: 99, name: 'B' }); });
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));

    const [, optsSecond] = api.get.mock.calls[1];
    expect(optsSecond.params.client_id).toBe(99);
  });
});
