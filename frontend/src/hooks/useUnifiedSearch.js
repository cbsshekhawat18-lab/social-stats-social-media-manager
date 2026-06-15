/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import api from '../services/api';
import { QK } from '../services/queryClient';
import { useCurrentClientId } from '../stores/appStore';

/**
 *
 * Wraps `/api/search/unified/` (built in ) with:
 * • Debounce — settles 200ms after the user stops typing so we don't
 * spam the backend on every keystroke. Cmd+K input updates feel
 * instant without a network round-trip on every char.
 * • Min length — sub-2-char queries short-circuit. The backend already
 * enforces this; we replicate client-side to avoid the round-trip.
 * • Tenant-scoped — query key includes `currentClientId` so switching
 * workspaces invalidates cleanly.
 * • React Query cache — repeat queries within `staleTime` (30s, the app
 * default) come from cache; switching tabs and back is instant.
 *
 * Returns:
 * { query, debouncedQuery, results, isFetching }
 *
 * `results` always has the categorized shape `{posts, leads, conversations,
 * contacts, total}` — empty arrays before the first fetch and during
 * sub-min queries — so consumers don't need null checks before mapping.
 */

const DEBOUNCE_MS = 200;
const MIN_QUERY_LEN = 2;

const EMPTY_RESULTS = Object.freeze({
  posts: [], leads: [], conversations: [], contacts: [], total: 0,
});


export default function useUnifiedSearch(query) {
  const clientId       = useCurrentClientId();
  const debouncedQuery = useDebounced(query, DEBOUNCE_MS);
  const enabled        = (debouncedQuery || '').trim().length >= MIN_QUERY_LEN;

  const { data, isFetching } = useQuery({
    queryKey: QK.search(clientId, debouncedQuery || ''),
    queryFn:  () => fetchSearch(clientId, debouncedQuery),
    enabled,
    // The user's input changes faster than the data does — preserving
    // last-good results between debounced fetches removes the "results
    // disappear, then reappear" flicker.
    placeholderData: (prev) => prev,
  });

  return {
    query,
    debouncedQuery,
    results: enabled ? (data || EMPTY_RESULTS) : EMPTY_RESULTS,
    isFetching: enabled && isFetching,
  };
}


/** Settle `value` after `ms` of stillness. Pure utility — no side effects. */
function useDebounced(value, ms) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}


async function fetchSearch(clientId, q) {
  const params = { q };
  if (clientId) params.client_id = clientId;
  const res = await api.get('/search/unified/', { params });
  return res.data;
}
