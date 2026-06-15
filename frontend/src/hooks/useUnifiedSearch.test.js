/**
 *
 * Verifies the contract the Cmd+K palette depends on:
 *   • Sub-2-char queries return the empty-results object WITHOUT triggering
 *     a network call (`api.get` is never invoked).
 *   • Long-enough queries trigger a fetch after the 200ms debounce settles.
 *   • Switching `currentClientId` invalidates the query (different cache key).
 *   • The hook always returns the categorized shape — consumers don't have
 *     to null-check before mapping.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import useUnifiedSearch from './useUnifiedSearch';
import { useAppStore } from '../stores/appStore';

// Stub the api module — we want to assert on call count without touching a server.
jest.mock('../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

import api from '../services/api';

function makeWrapper(qc) {
  return ({ children }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('useUnifiedSearch', () => {
  let qc;

  beforeEach(() => {
    api.get.mockReset();
    useAppStore.getState().reset();
    useAppStore.getState().setCurrentClient({ id: 42, name: 'test' });
    qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
  });

  afterEach(() => {
    qc.clear();
  });

  test('sub-2-char query returns empty results and never fires the request', async () => {
    api.get.mockResolvedValue({ data: { posts: [{ id: 1 }], leads: [], conversations: [], contacts: [], total: 1 }});

    const { result } = renderHook(() => useUnifiedSearch('m'),
      { wrapper: makeWrapper(qc) });

    // Even after the debounce settles, sub-2-char query must not call the API.
    await act(async () => { await new Promise((r) => setTimeout(r, 250)); });

    expect(api.get).not.toHaveBeenCalled();
    expect(result.current.results.total).toBe(0);
    expect(result.current.results.posts).toEqual([]);
  });

  test('valid query fires after debounce and returns categorized results', async () => {
    api.get.mockResolvedValue({ data: {
      posts:         [{ id: 1, title: 'Mumbai property', preview: '', status: 'draft', deep_link: '/admin/composer/1' }],
      leads:         [{ id: 5, name: 'Mumbai buyer', phone: '+919', email: '', status: 'new', deep_link: '/admin/leads/5' }],
      conversations: [],
      contacts:      [],
      total:         2,
    }});

    // Mirror the palette's real flow: mount with empty input, then user
    // types and the hook re-renders with the new query. This exercises the
    // debounce path; mounting straight with a non-empty query would skip it
    // because useState's initialiser captures the first value as-is.
    const { result, rerender } = renderHook(({ q }) => useUnifiedSearch(q),
      { initialProps: { q: '' }, wrapper: makeWrapper(qc) });

    // Empty initial query: no call.
    expect(api.get).not.toHaveBeenCalled();

    rerender({ q: 'mumbai' });
    // Right after typing, the debounce hasn't settled yet.
    expect(api.get).not.toHaveBeenCalled();

    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1), { timeout: 500 });
    await waitFor(() => expect(result.current.results.total).toBe(2));

    // Verify it hit the right endpoint with the right params.
    const [url, opts] = api.get.mock.calls[0];
    expect(url).toBe('/search/unified/');
    expect(opts.params.q).toBe('mumbai');
    expect(opts.params.client_id).toBe(42);

    // Consumer can map without null checks — shape is always categorized.
    expect(result.current.results.posts.length).toBe(1);
    expect(result.current.results.posts[0].deep_link).toBe('/admin/composer/1');
    expect(result.current.results.leads.length).toBe(1);
  });

  test('always returns the empty shape when no fetch has fired', () => {
    const { result } = renderHook(() => useUnifiedSearch(''),
      { wrapper: makeWrapper(qc) });

    expect(result.current.results).toEqual({
      posts: [], leads: [], conversations: [], contacts: [], total: 0,
    });
    expect(result.current.isFetching).toBe(false);
  });

  test('clientId is included in query key — switching clients re-fetches', async () => {
    api.get.mockResolvedValue({ data: {
      posts: [], leads: [], conversations: [], contacts: [], total: 0,
    }});

    const { rerender } = renderHook(
      ({ q }) => useUnifiedSearch(q),
      { initialProps: { q: '' }, wrapper: makeWrapper(qc) },
    );

    rerender({ q: 'something' });
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1), { timeout: 500 });

    // Switch tenant — same query string but different scope.
    act(() => { useAppStore.getState().setCurrentClient({ id: 99, name: 'other' }); });
    rerender({ q: 'something' });

    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2), { timeout: 500 });
    const [, optsSecond] = api.get.mock.calls[1];
    expect(optsSecond.params.client_id).toBe(99);
  });
});
