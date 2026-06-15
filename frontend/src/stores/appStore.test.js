/**
 *
 * Verifies the integration contract the rest of the app relies on:
 *   • setCurrentClient + clearCurrentClient round-trip
 *   • setBadgeCounts MERGES partial payloads (doesn't clobber unset keys)
 *   • bumpBadge clamps at 0 (never goes negative)
 *   • clearBadge resets a single counter without touching others
 *   • reset() returns to the initial shape
 *
 * Tests the store directly via `useAppStore.getState()` — no React render
 * needed since selectors and actions are pure.
 */
import { useAppStore } from './appStore';

describe('appStore', () => {
  beforeEach(() => {
    // Each test starts fresh.
    useAppStore.getState().reset();
    localStorage.clear();
  });

  // ── currentClient ─────────────────────────────────────────────────
  test('setCurrentClient sets both id and the denormalised object', () => {
    const client = { id: 42, name: 'acme', company: 'Acme' };
    useAppStore.getState().setCurrentClient(client);

    expect(useAppStore.getState().currentClientId).toBe(42);
    expect(useAppStore.getState().currentClient).toEqual(client);
  });

  test('setCurrentClient(null) clears both fields', () => {
    useAppStore.getState().setCurrentClient({ id: 7, name: 'x' });
    useAppStore.getState().setCurrentClient(null);
    expect(useAppStore.getState().currentClientId).toBeNull();
    expect(useAppStore.getState().currentClient).toBeNull();
  });

  test('clearCurrentClient resets both fields', () => {
    useAppStore.getState().setCurrentClient({ id: 1, name: 'a' });
    useAppStore.getState().clearCurrentClient();
    expect(useAppStore.getState().currentClientId).toBeNull();
    expect(useAppStore.getState().currentClient).toBeNull();
  });

  // ── badgeCounts ───────────────────────────────────────────────────
  test('setBadgeCounts merges with existing counts (does not clobber)', () => {
    useAppStore.getState().setBadgeCounts({
      unread_inbox: 5,
      pending_approvals: 3,
    });
    // A subsequent partial update should NOT zero out the keys it didn't touch.
    useAppStore.getState().setBadgeCounts({ unread_inbox: 7 });

    const counts = useAppStore.getState().badgeCounts;
    expect(counts.unread_inbox).toBe(7);
    expect(counts.pending_approvals).toBe(3);  // preserved
  });

  test('setBadgeCounts updates badgeCountsFetchedAt', () => {
    const before = useAppStore.getState().badgeCountsFetchedAt;
    useAppStore.getState().setBadgeCounts({ unread_inbox: 1 });
    const after = useAppStore.getState().badgeCountsFetchedAt;
    expect(after).toBeGreaterThan(before);
  });

  test('bumpBadge increments and decrements', () => {
    useAppStore.getState().setBadgeCounts({ unread_inbox: 5 });
    useAppStore.getState().bumpBadge('unread_inbox', +1);
    expect(useAppStore.getState().badgeCounts.unread_inbox).toBe(6);

    useAppStore.getState().bumpBadge('unread_inbox', -3);
    expect(useAppStore.getState().badgeCounts.unread_inbox).toBe(3);
  });

  test('bumpBadge never goes below 0', () => {
    // Important: WS events fire after a poll, so a race could try to
    // decrement when the counter is already 0. Must clamp.
    useAppStore.getState().setBadgeCounts({ unread_inbox: 0 });
    useAppStore.getState().bumpBadge('unread_inbox', -5);
    expect(useAppStore.getState().badgeCounts.unread_inbox).toBe(0);
  });

  test('bumpBadge default delta is +1', () => {
    useAppStore.getState().bumpBadge('new_leads');
    expect(useAppStore.getState().badgeCounts.new_leads).toBe(1);
  });

  test('clearBadge zeros one counter without touching others', () => {
    useAppStore.getState().setBadgeCounts({
      unread_inbox: 5,
      pending_approvals: 3,
      new_leads: 7,
    });
    useAppStore.getState().clearBadge('pending_approvals');
    const c = useAppStore.getState().badgeCounts;
    expect(c.pending_approvals).toBe(0);
    expect(c.unread_inbox).toBe(5);
    expect(c.new_leads).toBe(7);
  });

  // ── reset ─────────────────────────────────────────────────────────
  test('reset() restores initial state', () => {
    useAppStore.getState().setCurrentClient({ id: 1, name: 'x' });
    useAppStore.getState().setBadgeCounts({ unread_inbox: 99 });
    useAppStore.getState().reset();

    const s = useAppStore.getState();
    expect(s.currentClientId).toBeNull();
    expect(s.currentClient).toBeNull();
    expect(s.badgeCounts.unread_inbox).toBe(0);
  });
});
