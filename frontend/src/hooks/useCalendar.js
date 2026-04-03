import { useState, useEffect, useCallback, useRef } from 'react';
import { calendarAPI } from '../services/api';

// ── useCalendarPosts ───────────────────────────────────────────────────────────
export function useCalendarPosts(clientId, month, year, platform) {
  const [postsByDate, setPostsByDate] = useState({});
  const [loading,    setLoading]     = useState(false);
  const [error,      setError]       = useState('');

  const fetch = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError('');
    try {
      const params = { client_id: clientId, month, year };
      if (platform && platform !== 'all') params.platform = platform;
      const res = await calendarAPI.getPosts(params);
      setPostsByDate(res.data || {});
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load calendar posts.');
    } finally {
      setLoading(false);
    }
  }, [clientId, month, year, platform]);

  useEffect(() => { fetch(); }, [fetch]);

  const getPostsForDate = useCallback(
    (dateStr) => postsByDate[dateStr] || [],
    [postsByDate]
  );

  return { postsByDate, loading, error, refetch: fetch, getPostsForDate };
}

// ── useCalendarStats ───────────────────────────────────────────────────────────
export function useCalendarStats(clientId, month, year) {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    setLoading(true);
    calendarAPI.getStats({ client_id: clientId, month, year })
      .then(res => setStats(res.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [clientId, month, year]);

  return { stats, loading };
}

// ── useUpcomingPosts ───────────────────────────────────────────────────────────
export function useUpcomingPosts(clientId) {
  const [upcoming, setUpcoming] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const intervalRef = useRef(null);

  const fetch = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const params = clientId ? { client_id: clientId } : {};
      const res = await calendarAPI.getUpcoming(params);
      setUpcoming(res.data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetch();
    intervalRef.current = setInterval(fetch, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(intervalRef.current);
  }, [fetch]);

  return { upcoming, loading, refetch: fetch };
}

// ── useCreatePost ──────────────────────────────────────────────────────────────
export function useCreatePost() {
  const [creating, setCreating] = useState(false);
  const [error,    setError]    = useState('');

  const create = useCallback(async (data) => {
    setCreating(true);
    setError('');
    try {
      const res = await calendarAPI.createPost(data);
      return { success: true, post: res.data };
    } catch (e) {
      const msg = e.response?.data
        ? Object.values(e.response.data).flat().join(' ')
        : 'Failed to create post.';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setCreating(false);
    }
  }, []);

  const update = useCallback(async (id, data) => {
    setCreating(true);
    setError('');
    try {
      const res = await calendarAPI.updatePost(id, data);
      return { success: true, post: res.data };
    } catch (e) {
      const msg = e.response?.data
        ? Object.values(e.response.data).flat().join(' ')
        : 'Failed to update post.';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setCreating(false);
    }
  }, []);

  const remove = useCallback(async (id) => {
    setCreating(true);
    setError('');
    try {
      await calendarAPI.deletePost(id);
      return { success: true };
    } catch (e) {
      const msg = e.response?.data?.error || 'Failed to delete post.';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setCreating(false);
    }
  }, []);

  const reschedule = useCallback(async (id, datetime) => {
    setCreating(true);
    setError('');
    try {
      const res = await calendarAPI.reschedule(id, { scheduled_at: datetime });
      return { success: true, post: res.data };
    } catch (e) {
      const msg = e.response?.data?.error || 'Failed to reschedule.';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setCreating(false);
    }
  }, []);

  return { creating, error, create, update, remove, reschedule };
}

// ── useCalendarNotes ───────────────────────────────────────────────────────────
export function useCalendarNotes(clientId, month, year) {
  const [notes,       setNotes]       = useState([]);
  const [notesByDate, setNotesByDate] = useState({});
  const [loading,     setLoading]     = useState(false);

  const fetch = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const res = await calendarAPI.getNotes({ client_id: clientId, month, year });
      const data = res.data || [];
      setNotes(data);
      const byDate = {};
      data.forEach(note => {
        const key = note.date;
        if (!byDate[key]) byDate[key] = [];
        byDate[key].push(note);
      });
      setNotesByDate(byDate);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [clientId, month, year]);

  useEffect(() => { fetch(); }, [fetch]);

  const createNote = useCallback(async (data) => {
    try {
      const res = await calendarAPI.createNote(data);
      await fetch();
      return { success: true, note: res.data };
    } catch (e) {
      const msg = e.response?.data?.error || 'Failed to create note.';
      return { success: false, error: msg };
    }
  }, [fetch]);

  const deleteNote = useCallback(async (id) => {
    try {
      await calendarAPI.deleteNote(id);
      await fetch();
      return { success: true };
    } catch (e) {
      return { success: false, error: e.response?.data?.error || 'Failed to delete note.' };
    }
  }, [fetch]);

  return { notes, notesByDate, loading, createNote, deleteNote, refetch: fetch };
}

// ── useSuggestedTimes ──────────────────────────────────────────────────────────
export function useSuggestedTimes(clientId, platform) {
  const [suggestions, setSuggestions] = useState([]);
  const [source,      setSource]      = useState('industry');
  const [loading,     setLoading]     = useState(false);

  useEffect(() => {
    if (!clientId || !platform) return;
    setLoading(true);
    calendarAPI.suggestTimes({ client_id: clientId, platform })
      .then(res => {
        setSuggestions(res.data.suggestions || []);
        setSource(res.data.source || 'industry');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clientId, platform]);

  return { suggestions, source, loading };
}
