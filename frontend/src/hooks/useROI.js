/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useState, useEffect, useCallback, useRef } from 'react';
import { roiAPI } from '../services/api';

export function useROISettings(clientId) {
  const [settings, setSettings] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [saving,   setSaving]   = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!clientId) { setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const res = await roiAPI.getSettings(clientId);
      setSettings(res.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load ROI settings.');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const saveSettings = useCallback(async (data) => {
    setSaving(true);
    setError('');
    try {
      const res = await roiAPI.saveSettings(clientId, data);
      setSettings(res.data);
      return { success: true };
    } catch (e) {
      const err = e.response?.data?.error || JSON.stringify(e.response?.data) || 'Failed to save.';
      setError(err);
      return { success: false, error: err };
    } finally {
      setSaving(false);
    }
  }, [clientId]);

  return { settings, loading, error, saving, saveSettings, refetch: fetchSettings };
}


export function useROICalculator(clientId) {
  const [result,   setResult]  = useState(null);
  const [loading,  setLoading] = useState(false);
  const [error,    setError]   = useState('');
  const debounceRef = useRef(null);

  // Local input state (mirrors ROISettings fields)
  const now = new Date();
  const [inputs, setInputs] = useState({
    facebook_budget:    0,
    instagram_budget:   0,
    youtube_budget:     0,
    linkedin_budget:    0,
    gmb_budget:         0,
    agency_fee:         0,
    avg_sale_value:     0,
    conversion_rate:    2.5,
    lead_to_sale_rate:  20,
    monthly_revenue_goal: 0,
    monthly_leads_goal:   0,
    currency:           'USD',
    currency_symbol:    '$',
  });
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());
  const inputsRef = useRef(inputs);
  const monthRef = useRef(month);
  const yearRef = useRef(year);

  useEffect(() => {
    inputsRef.current = inputs;
  }, [inputs]);

  useEffect(() => {
    monthRef.current = month;
  }, [month]);

  useEffect(() => {
    yearRef.current = year;
  }, [year]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const loadFromSettings = useCallback((settings) => {
    if (!settings) return;
    setInputs({
      facebook_budget:    parseFloat(settings.facebook_budget)   || 0,
      instagram_budget:   parseFloat(settings.instagram_budget)  || 0,
      youtube_budget:     parseFloat(settings.youtube_budget)    || 0,
      linkedin_budget:    parseFloat(settings.linkedin_budget)   || 0,
      gmb_budget:         parseFloat(settings.gmb_budget)        || 0,
      agency_fee:         parseFloat(settings.agency_fee)        || 0,
      avg_sale_value:     parseFloat(settings.avg_sale_value)    || 0,
      conversion_rate:    parseFloat(settings.conversion_rate)   || 2.5,
      lead_to_sale_rate:  parseFloat(settings.lead_to_sale_rate) || 20,
      monthly_revenue_goal: parseFloat(settings.monthly_revenue_goal) || 0,
      monthly_leads_goal:   parseInt(settings.monthly_leads_goal)     || 0,
      currency:           settings.currency        || 'USD',
      currency_symbol:    settings.currency_symbol || '$',
    });
  }, []);

  const calculate = useCallback(async (overrideInputs, overrideMonth, overrideYear) => {
    if (!clientId) return;
    const inp = overrideInputs || inputsRef.current;
    const m   = overrideMonth  || monthRef.current;
    const y   = overrideYear   || yearRef.current;

    setLoading(true);
    setError('');
    try {
      const params = { client_id: clientId, month: m, year: y, ...inp };
      const res = await roiAPI.getLive(params);
      setResult(res.data);
      return res.data;
    } catch (e) {
      const msg = e.response?.data?.error || 'Calculation failed.';
      setError(msg);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  const recalculate = useCallback((newInputs, newMonth, newYear) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      calculate(newInputs, newMonth, newYear);
    }, 500);
  }, [calculate]);

  const updateInput = useCallback((field, value) => {
    const newInputs = { ...inputsRef.current, [field]: value };
    inputsRef.current = newInputs;
    setInputs(newInputs);
    recalculate(newInputs, monthRef.current, yearRef.current);
  }, [recalculate]);

  const setMonthYear = useCallback((m, y) => {
    monthRef.current = m;
    yearRef.current = y;
    setMonth(m);
    setYear(y);
    recalculate(inputsRef.current, m, y);
  }, [recalculate]);

  const saveReport = useCallback(async () => {
    if (!clientId) return;
    try {
      const res = await roiAPI.calculate({ client_id: clientId, month: monthRef.current, year: yearRef.current });
      setResult(res.data);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.response?.data?.error || 'Failed to save.' };
    }
  }, [clientId]);

  return {
    result, loading, error,
    inputs, month, year,
    updateInput, setMonthYear, loadFromSettings,
    calculate, saveReport,
  };
}


export function useROIReports(clientId) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    setLoading(true);
    roiAPI.getReports({ client_id: clientId })
      .then(res => setReports(res.data.results || res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clientId]);

  return { reports, loading };
}
