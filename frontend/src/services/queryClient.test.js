/**
 *
 * The invalidation logic in useRealtimeSync depends on the QK factory
 * producing stable, predictable keys. Catch any rename / shape regression
 * here so cache invalidation never silently misses.
 */
import { queryClient, QK } from './queryClient';

describe('QueryClient defaults', () => {
  test('has SPA-tuned defaults applied', () => {
    const opts = queryClient.getDefaultOptions();
    expect(opts.queries.staleTime).toBe(30_000);
    expect(opts.queries.gcTime).toBe(5 * 60_000);
    expect(opts.queries.retry).toBe(1);
    expect(opts.queries.refetchOnWindowFocus).toBe(true);
    // Mutations: callers handle retry policy themselves.
    expect(opts.mutations.retry).toBe(0);
  });
});

describe('QK key factory', () => {
  test('keys are stable arrays starting with the feature name', () => {
    expect(QK.posts(42)).toEqual(['posts', 42, {}]);
    expect(QK.leads(42)).toEqual(['leads', 42, {}]);
    expect(QK.conversations(42)).toEqual(['conversations', 42, {}]);
    expect(QK.botFlows(42)).toEqual(['bot-flows', 42]);
  });

  test('detail keys are scoped to a single id without client', () => {
    // Detail queries don't need the client in the key — the id is unique.
    expect(QK.post(7)).toEqual(['post', 7]);
    expect(QK.lead(7)).toEqual(['lead', 7]);
    expect(QK.conversation(7)).toEqual(['conversation', 7]);
  });

  test('list keys with filters round-trip via array equality', () => {
    const a = QK.posts(42, { status: 'scheduled' });
    const b = QK.posts(42, { status: 'scheduled' });
    expect(a).toEqual(b);  // structural equality is what React Query uses
  });

  test('different clients produce different keys', () => {
    expect(QK.posts(1)).not.toEqual(QK.posts(2));
    expect(QK.leads(1)).not.toEqual(QK.leads(2));
  });

  test('dashboardCounts and search are present', () => {
    // Used by useDashboardCounts and the future Cmd+K wiring.
    expect(QK.dashboardCounts(42)).toEqual(['dashboard.counts', 42]);
    expect(QK.search(42, 'mumbai')).toEqual(['search', 42, 'mumbai']);
  });
});
