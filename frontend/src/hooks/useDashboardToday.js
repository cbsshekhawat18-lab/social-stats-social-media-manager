/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useQuery } from '@tanstack/react-query';

import api from '../services/api';
import { QK } from '../services/queryClient';
import { useCurrentClientId } from '../stores/appStore';

/**
 *
 * Wraps `/api/dashboard/today/` ( endpoint) with React Query so:
 * • Re-mounting the dashboard component is instant (cached result shows
 * immediately, then revalidates in background).
 * • Switching workspaces re-fetches with a different cache key.
 * • The same WebSocket events that bump sidebar badges also invalidate
 * this query — the dashboard refreshes when someone in another tab
 * publishes a post or captures a lead.
 *
 * Returns the React Query result directly so consumers can read
 * `data`, `isLoading`, `isError`, `refetch` etc. as needed. The data
 * shape mirrors the backend payload (see 's docstring).
 *
 * Stays a no-op until a client is selected — `enabled` defers fetching
 * until `useCurrentClientId` returns non-null.
 */

const REFETCH_INTERVAL_MS = 60_000;  // backstop for stale data

async function fetchToday(clientId) {
  const params = clientId ? { client_id: clientId } : undefined;
  const res = await api.get('/dashboard/today/', { params });
  return res.data;
}

export default function useDashboardToday() {
  const clientId = useCurrentClientId();

  return useQuery({
    queryKey:           QK.dashboardToday(clientId),
    queryFn:            () => fetchToday(clientId),
    enabled:            !!clientId,
    refetchInterval:    REFETCH_INTERVAL_MS,
    refetchOnWindowFocus: true,
    staleTime:          30_000,
  });
}
