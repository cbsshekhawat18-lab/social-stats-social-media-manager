/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useState, useEffect, useCallback, useRef } from 'react';
import { clientsAPI, oauthAPI, overviewAPI, syncLogsAPI, goalsAPI, alertsAPI, lookupsAPI } from '../services/api';
import { PLATFORM_LIST } from '../services/platforms';
import { format, subDays } from 'date-fns';

export function useDateRange(defaultDays = 30) {
  const [range, setRange] = useState({
    since: format(subDays(new Date(), defaultDays), 'yyyy-MM-dd'),
    until: format(new Date(), 'yyyy-MM-dd'),
  });
  return [range, setRange];
}

export function useClients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await clientsAPI.list();
      setClients(res.data.results || res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  return { clients, loading, refetch: fetch };
}

export function useClientSummary(clientId, range, platform) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!clientId) return;
    try {
      setLoading(true);
      const params = { ...range };
      if (platform && platform !== 'all') params.platform = platform;
      const res = await clientsAPI.summary(clientId, params);
      setData(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [clientId, range, platform]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, refetch: fetch };
}

export function useTimeseries(clientId, range, platform) {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!clientId) return;
    try {
      setLoading(true);
      const params = { ...range };
      if (platform && platform !== 'all') params.platform = platform;
      const res = await clientsAPI.timeseries(clientId, params);
      setData(res.data.results || res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [clientId, range, platform]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, refetch: fetch };
}

export function usePosts(clientId, platform, range, pageSize = 20) {
  const [posts, setPosts]         = useState([]);
  const [total, setTotal]         = useState(0);
  const [hasMore, setHasMore]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetch = useCallback(async () => {
    if (!clientId) return;
    try {
      setLoading(true);
      const params = { limit: pageSize, offset: 0, ...range };
      if (platform && platform !== 'all') params.platform = platform;
      const res = await clientsAPI.posts(clientId, params);
      const data = res.data;
      if (data.results) {
        setPosts(data.results);
        setTotal(data.total || 0);
        setHasMore(data.has_more || false);
      } else {
        setPosts(Array.isArray(data) ? data : []);
        setTotal(Array.isArray(data) ? data.length : 0);
        setHasMore(false);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [clientId, platform, range, pageSize]);

  const loadMore = useCallback(async () => {
    if (!clientId || !hasMore || loadingMore) return;
    try {
      setLoadingMore(true);
      const params = { limit: pageSize, offset: posts.length, ...range };
      if (platform && platform !== 'all') params.platform = platform;
      const res = await clientsAPI.posts(clientId, params);
      const data = res.data;
      if (data.results) {
        setPosts(prev => [...prev, ...data.results]);
        setTotal(data.total || 0);
        setHasMore(data.has_more || false);
      }
    } catch (e) { console.error(e); }
    finally { setLoadingMore(false); }
  }, [clientId, platform, range, pageSize, posts.length, hasMore, loadingMore]);

  useEffect(() => { fetch(); }, [fetch]);
  return { posts, total, hasMore, loading, loadingMore, loadMore };
}

export function useOAuthStatus(clientId) {
  const [status, setStatus]   = useState({});
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!clientId) return;
    try {
      setLoading(true);
      const res = await oauthAPI.status(clientId);
      setStatus(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [clientId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { status, loading, refetch: fetch };
}

export function useOverview(range) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await overviewAPI.get(range);
      setData(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [range]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, refetch: fetch };
}

export function useSyncLogs(clientId) {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const params = clientId ? { client: clientId } : {};
      const res = await syncLogsAPI.list(params);
      setLogs(res.data.results || res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [clientId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { logs, loading, refetch: fetch };
}

export function useGoalProgress(clientId, month, year) {
  const [progress, setProgress] = useState([]);
  const [loading, setLoading]   = useState(false);

  const fetch = useCallback(async () => {
    if (!clientId) return;
    try {
      setLoading(true);
      const res = await goalsAPI.progress({ client: clientId, month, year });
      setProgress(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [clientId, month, year]);

  useEffect(() => { fetch(); }, [fetch]);
  return { progress, loading, refetch: fetch };
}

export function useGoals(params) {
  const [goals, setGoals]     = useState([]);
  const [loading, setLoading] = useState(false);
  // Serialize to avoid infinite loop from new object reference on every render
  const paramsKey = JSON.stringify(params);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await goalsAPI.list(JSON.parse(paramsKey));
      setGoals(res.data.results || res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [paramsKey]);

  useEffect(() => { fetch(); }, [fetch]);
  return { goals, loading, refetch: fetch };
}

export function useAlerts(clientId) {
  const [alerts, setAlerts]   = useState([]);
  const [loading, setLoading] = useState(false);
  const timerRef              = useRef(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const params = clientId ? { client: clientId } : {};
      const res = await alertsAPI.list(params);
      setAlerts(res.data.results || res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [clientId]);

  useEffect(() => {
    fetch();
    timerRef.current = setInterval(fetch, 60000);
    return () => clearInterval(timerRef.current);
  }, [fetch]);

  const markRead = useCallback(async (id) => {
    await alertsAPI.markRead(id);
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a));
  }, []);

  const markAllRead = useCallback(async () => {
    const params = clientId ? { client: clientId } : {};
    await alertsAPI.markAllRead(params);
    setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
  }, [clientId]);

  const unreadCount = alerts.filter(a => !a.is_read).length;

  return { alerts, loading, unreadCount, markRead, markAllRead, refetch: fetch };
}

export function useLookups() {
  const [lookups, setLookups] = useState({});
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await lookupsAPI.get();
      const data = res.data || {};

      if (Array.isArray(data.platforms)) {
        data.platforms = data.platforms
          .filter(item => PLATFORM_LIST.includes(item.key))
          .sort((a, b) => PLATFORM_LIST.indexOf(a.key) - PLATFORM_LIST.indexOf(b.key));
      }

      setLookups(data);
    } catch (e) {
      console.error('Failed to load lookups:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  return { lookups, loading, refetch: fetch };
}
