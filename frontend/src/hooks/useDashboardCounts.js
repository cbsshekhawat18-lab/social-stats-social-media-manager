/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAppStore, useCurrentClientId } from '../stores/appStore';
import { QK } from '../services/queryClient';
import api from '../services/api';

/**
 *
 * Fetches `/api/dashboard/counts/` for the active client every 60 seconds
 * and writes the result into the global app store so the sidebar's
 * NavItem badges read live values without prop-drilling.
 *
 * The 60s interval is the slow-path baseline. WebSocket events
 * (useRealtimeSync.js) bump individual counters between polls so the
 * UI feels instant; each poll then reconciles against the authoritative
 * server count.
 *
 * Mount once near the root (inside <App />, after <RealtimeProvider> +
 * <QueryClientProvider>). Renders nothing.
 *
 * Stays a no-op until a client is selected. Refetches automatically
 * when the user switches clients via the ClientSwitcher.
 */

const POLL_INTERVAL_MS = 60_000;

async function fetchCounts(clientId) {
  // api.js uses axios with a configured baseURL. We rely on it to attach
  // the auth header; fall back to fetch only as a last resort.
  const params = clientId ? { client_id: clientId } : undefined;
  const res = await api.get('/dashboard/counts/', { params });
  return res.data;
}

export default function useDashboardCounts() {
  const clientId      = useCurrentClientId();
  const setBadgeCounts = useAppStore((s) => s.setBadgeCounts);

  const query = useQuery({
    queryKey:           QK.dashboardCounts(clientId),
    queryFn:            () => fetchCounts(clientId),
    enabled:            true,  // backend returns zeros when no client — safe
    refetchInterval:    POLL_INTERVAL_MS,
    refetchOnMount:     true,
    refetchOnWindowFocus: true,
    staleTime:          30_000,
  });

  // Mirror server response into zustand for cheap selector reads in NavItem.
  useEffect(() => {
    if (query.data) {
      setBadgeCounts(query.data);
    }
  }, [query.data, setBadgeCounts]);

  return query;
}
