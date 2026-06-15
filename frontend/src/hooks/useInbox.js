/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useCallback, useEffect, useState } from 'react';
import { inboxAPI } from '../services/api';

export function useConversations(params) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await inboxAPI.conversations.list(params);
      setData(res.data?.results || res.data || []);
      setError(null);
    } catch (e) { setError(e); }
    finally    { setLoading(false); }
  // eslint-disable-next-line
  }, [JSON.stringify(params || {})]);

  useEffect(() => { refetch(); }, [refetch]);
  return { data, loading, error, refetch };
}

export function useConversation(id) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!id) { setData(null); return; }
    try {
      setLoading(true);
      const res = await inboxAPI.conversations.get(id);
      setData(res.data);
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { refetch(); }, [refetch]);
  return { data, loading, refetch };
}

export function useReviews(params) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await inboxAPI.reviews.list(params);
      setData(res.data?.results || res.data || []);
    } finally { setLoading(false); }
  // eslint-disable-next-line
  }, [JSON.stringify(params || {})]);

  useEffect(() => { refetch(); }, [refetch]);
  return { data, loading, refetch };
}

export function useInboxStats() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await inboxAPI.stats();
      setData(res.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);
  return { data, loading, refetch };
}
