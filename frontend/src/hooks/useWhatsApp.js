/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useState, useEffect, useCallback } from 'react';
import { whatsappAPI } from '../services/api';

function unwrap(res) {
  return res?.data?.results ?? res?.data ?? null;
}

// ── Dashboard ──────────────────────────────────────────────────────
export function useWhatsAppDashboard(params) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await whatsappAPI.dashboard(params);
      setData(res.data);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line
  }, [JSON.stringify(params || {})]);

  useEffect(() => { refetch(); }, [refetch]);

  return { data, loading, error, refetch };
}

// ── Account ────────────────────────────────────────────────────────
export function useWhatsAppAccount() {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await whatsappAPI.account.list();
      const list = res.data?.results || res.data || [];
      setAccount(Array.isArray(list) ? list[0] || null : list);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { account, loading, error, refetch };
}

// ── Contacts ───────────────────────────────────────────────────────
export function useWhatsAppContacts(params) {
  const [data, setData] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await whatsappAPI.contacts.list(params);
      setData(res.data?.results || res.data || []);
      setCount(res.data?.count ?? (res.data?.results || res.data || []).length ?? 0);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line
  }, [JSON.stringify(params || {})]);

  useEffect(() => { refetch(); }, [refetch]);

  return { data, count, loading, error, refetch };
}

// ── Lists ──────────────────────────────────────────────────────────
export function useWhatsAppLists() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await whatsappAPI.lists.list();
      setData(res.data?.results || res.data || []);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { data, loading, error, refetch };
}

// ── Templates ──────────────────────────────────────────────────────
export function useWhatsAppTemplates(params) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await whatsappAPI.templates.list(params);
      setData(res.data?.results || res.data || []);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line
  }, [JSON.stringify(params || {})]);

  useEffect(() => { refetch(); }, [refetch]);

  return { data, loading, error, refetch };
}

// ── Campaigns ──────────────────────────────────────────────────────
export function useWhatsAppCampaigns(params) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await whatsappAPI.campaigns.list(params);
      setData(res.data?.results || res.data || []);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line
  }, [JSON.stringify(params || {})]);

  useEffect(() => { refetch(); }, [refetch]);

  return { data, loading, error, refetch };
}

// ── Inbox ──────────────────────────────────────────────────────────
export function useWhatsAppInbox() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await whatsappAPI.inbox.list();
      setData(res.data?.results || res.data || []);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { data, loading, error, refetch };
}

export function useWhatsAppThread(contactId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!contactId) {
      setData(null);
      return;
    }
    try {
      setLoading(true);
      const res = await whatsappAPI.inbox.thread(contactId);
      setData(res.data);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => { refetch(); }, [refetch]);

  return { data, loading, error, refetch };
}
