/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import useRealtimeSync   from '../hooks/useRealtimeSync';
import useDashboardCounts from '../hooks/useDashboardCounts';

/**
 *
 *   • `useRealtimeSync` — listens to WebSocket events, invalidates the right
 *     React Query keys, bumps badge counts in the zustand store.
 *
 *   • `useDashboardCounts` — polls /api/dashboard/counts/ every 60s and
 *     mirrors the result into the zustand store so sidebar badges always
 *     show fresh numbers.
 *
 * Renders nothing. Mount once inside <App />, after <QueryClientProvider>
 * and <RealtimeProvider>.
 */
export default function RealtimeBridge() {
  useRealtimeSync();
  useDashboardCounts();
  return null;
}
