import { useState, useEffect, useCallback, useRef } from 'react';
import { clientsAPI, oauthAPI, overviewAPI, syncLogsAPI, goalsAPI, alertsAPI } from '../services/api';
import { format, subDays } from 'date-fns';
import {
  getDemoClientSummary,
  getDemoGoalProgress,
  getDemoOAuthStatus,
  getDemoPosts,
  getDemoTimeseries,
  isDemoClient,
} from '../services/demoData';

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
    if (isDemoClient(clientId)) {
      setData(getDemoClientSummary());
      return;
    }
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
    if (isDemoClient(clientId)) {
      setData(getDemoTimeseries(range));
      return;
    }
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

export function usePosts(clientId, platform, range) {
  const [posts, setPosts]     = useState([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!clientId) return;
    if (isDemoClient(clientId)) {
      setPosts(getDemoPosts(platform, range));
      return;
    }
    try {
      setLoading(true);
      const params = { limit: 20, ...range };
      if (platform && platform !== 'all') params.platform = platform;
      const res = await clientsAPI.posts(clientId, params);
      setPosts(res.data.results || res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [clientId, platform, range]);

  useEffect(() => { fetch(); }, [fetch]);
  return { posts, loading };
}

export function useOAuthStatus(clientId) {
  const [status, setStatus]   = useState({});
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!clientId) return;
    if (isDemoClient(clientId)) {
      setStatus(getDemoOAuthStatus());
      return;
    }
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
    if (isDemoClient(clientId)) {
      setProgress(getDemoGoalProgress(month, year));
      return;
    }
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
