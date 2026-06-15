/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useCallback, useEffect, useState } from 'react';
import { composerAPI } from '../services/api';

/* ── Posts ─────────────────────────────────────────────────────── */
export function useComposerPosts(params) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await composerAPI.posts.list(params);
      setData(res.data?.results || res.data || []);
      setError(null);
    } catch (e) { setError(e); }
    finally    { setLoading(false); }
  // eslint-disable-next-line
  }, [JSON.stringify(params || {})]);

  useEffect(() => { refetch(); }, [refetch]);

  return { data, loading, error, refetch };
}

export function useComposerPost(id) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!id) { setData(null); return; }
    try {
      setLoading(true);
      const res = await composerAPI.posts.get(id);
      setData(res.data);
      setError(null);
    } catch (e) { setError(e); }
    finally    { setLoading(false); }
  }, [id]);

  useEffect(() => { refetch(); }, [refetch]);
  return { data, loading, error, refetch };
}

/* ── Media ─────────────────────────────────────────────────────── */
export function useMediaAssets(params) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await composerAPI.media.list(params);
      setData(res.data?.results || res.data || []);
      setError(null);
    } catch (e) { setError(e); }
    finally    { setLoading(false); }
  // eslint-disable-next-line
  }, [JSON.stringify(params || {})]);

  useEffect(() => { refetch(); }, [refetch]);
  return { data, loading, error, refetch };
}

/* ── Queues ────────────────────────────────────────────────────── */
export function usePostQueues() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await composerAPI.queues.list();
      setData(res.data?.results || res.data || []);
      setError(null);
    } catch (e) { setError(e); }
    finally    { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);
  return { data, loading, error, refetch };
}
