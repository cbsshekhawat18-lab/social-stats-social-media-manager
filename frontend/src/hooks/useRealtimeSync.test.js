/**
 *
 * Verifies that WebSocket events fan out to:
 *   1. The right React Query cache invalidations (via QK keys)
 *   2. The right zustand badge bumps (via appStore)
 *
 * Approach: stub out `useRealtime` so we can inject events directly,
 * mount the hook inside a test QueryClientProvider, and assert on the
 * QueryClient's invalidate calls + the appStore's badge count after.
 */
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import useRealtimeSync from './useRealtimeSync';
import { useAppStore } from '../stores/appStore';

// Stub the realtime hook before importing useRealtimeSync's module graph.
// We capture the callback so the test can fire synthetic events.
let registeredCallback = null;
jest.mock('./useRealtime', () => ({
  useRealtime: (cb) => {
    registeredCallback = cb;
  },
}));


function makeWrapper(qc) {
  return ({ children }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('useRealtimeSync', () => {
  let qc;
  let invalidateSpy;

  beforeEach(() => {
    useAppStore.getState().reset();
    useAppStore.getState().setCurrentClient({ id: 42, name: 'test' });
    useAppStore.getState().setBadgeCounts({
      unread_inbox: 0,
      pending_approvals: 0,
      new_leads: 0,
      scheduled_posts: 5,
    });
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    invalidateSpy = jest.spyOn(qc, 'invalidateQueries');
    registeredCallback = null;
  });

  afterEach(() => {
    invalidateSpy?.mockRestore();
    qc.clear();
  });

  function fire(event) {
    act(() => { registeredCallback?.(event); });
  }

  test('inbox.new_message invalidates conversations + dashboard.counts and bumps unread_inbox', () => {
    renderHook(() => useRealtimeSync(), { wrapper: makeWrapper(qc) });

    fire({ type: 'inbox.new_message', client_id: 42, data: { message_id: 1 } });

    // Two invalidate calls — one for dashboard.counts (always), one for the
    // conversations(client) key.
    const calls = invalidateSpy.mock.calls.map((c) => c[0].queryKey);
    expect(calls).toEqual(expect.arrayContaining([
      ['dashboard.counts'],
      ['conversations', 42, {}],
    ]));

    expect(useAppStore.getState().badgeCounts.unread_inbox).toBe(1);
  });

  test('lead.captured invalidates leads + bumps new_leads', () => {
    renderHook(() => useRealtimeSync(), { wrapper: makeWrapper(qc) });

    fire({ type: 'lead.captured', client_id: 42, data: { lead_id: 1 } });

    const calls = invalidateSpy.mock.calls.map((c) => c[0].queryKey);
    expect(calls).toEqual(expect.arrayContaining([['leads', 42, {}]]));
    expect(useAppStore.getState().badgeCounts.new_leads).toBe(1);
  });

  test('approval.granted invalidates approvals + decrements pending_approvals', () => {
    useAppStore.getState().setBadgeCounts({ pending_approvals: 3 });
    renderHook(() => useRealtimeSync(), { wrapper: makeWrapper(qc) });

    fire({ type: 'approval.granted', client_id: 42, data: { approval_id: 9 } });

    const calls = invalidateSpy.mock.calls.map((c) => c[0].queryKey);
    expect(calls).toEqual(expect.arrayContaining([['approvals', 42]]));
    expect(useAppStore.getState().badgeCounts.pending_approvals).toBe(2);
  });

  test('composer.post_published invalidates posts + calendar and decrements scheduled_posts', () => {
    renderHook(() => useRealtimeSync(), { wrapper: makeWrapper(qc) });

    fire({ type: 'composer.post_published', client_id: 42, data: { post_id: 5 } });

    const calls = invalidateSpy.mock.calls.map((c) => c[0].queryKey);
    expect(calls).toEqual(expect.arrayContaining([
      ['posts', 42, {}],
      ['calendar', 42, {}],
    ]));
    expect(useAppStore.getState().badgeCounts.scheduled_posts).toBe(4);
  });

  test('events for a different client invalidate dashboard.counts but skip per-feature keys', () => {
    renderHook(() => useRealtimeSync(), { wrapper: makeWrapper(qc) });

    fire({ type: 'lead.captured', client_id: 999, data: { lead_id: 1 } });

    const calls = invalidateSpy.mock.calls.map((c) => c[0].queryKey);
    // Counts always invalidate
    expect(calls).toEqual(expect.arrayContaining([['dashboard.counts']]));
    // But not the leads key for a foreign client
    expect(calls).not.toEqual(expect.arrayContaining([['leads', 42, {}]]));
    // And no badge bump for foreign client
    expect(useAppStore.getState().badgeCounts.new_leads).toBe(0);
  });

  test('lead.status_changed invalidates both list and detail by id', () => {
    renderHook(() => useRealtimeSync(), { wrapper: makeWrapper(qc) });

    fire({
      type: 'lead.status_changed',
      client_id: 42,
      data: { lead_id: 17, from_status: 'new', to_status: 'qualified' },
    });

    const calls = invalidateSpy.mock.calls.map((c) => c[0].queryKey);
    expect(calls).toEqual(expect.arrayContaining([
      ['leads', 42, {}],
      ['lead', 17],
    ]));
    // No badge bump on status change — only on initial capture
    expect(useAppStore.getState().badgeCounts.new_leads).toBe(0);
  });

  test('unmapped event type invalidates only dashboard.counts', () => {
    renderHook(() => useRealtimeSync(), { wrapper: makeWrapper(qc) });

    fire({ type: 'something.we.havent.mapped.yet', client_id: 42 });

    const calls = invalidateSpy.mock.calls.map((c) => c[0].queryKey);
    expect(calls).toEqual([['dashboard.counts']]);
  });

  test('event without a type is ignored', () => {
    renderHook(() => useRealtimeSync(), { wrapper: makeWrapper(qc) });

    fire({ data: 'malformed' });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
