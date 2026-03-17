import { useState, useEffect, useCallback, useRef } from 'react';
import { roiAPI } from '../services/api';
import {
  calculateDemoROI,
  getDemoROIReports,
  getDemoROISettings,
  isDemoClient,
} from '../services/demoData';

export function useROISettings(clientId) {
  const [settings, setSettings] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [saving,   setSaving]   = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!clientId) { setLoading(false); return; }
    if (isDemoClient(clientId)) {
      setSettings(getDemoROISettings());
      setLoading(false);
      return;
    }
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
    if (isDemoClient(clientId)) {
      setSettings(data);
      return { success: true };
    }
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
    const inp = overrideInputs || inputs;
    const m   = overrideMonth  || month;
    const y   = overrideYear   || year;

    if (isDemoClient(clientId)) {
      const result = calculateDemoROI(inp, m, y);
      setResult(result);
      setError('');
      setLoading(false);
      return result;
    }

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
  }, [clientId, inputs, month, year]);

  const recalculate = useCallback((newInputs, newMonth, newYear) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      calculate(newInputs, newMonth, newYear);
    }, 500);
  }, [calculate]);

  const updateInput = useCallback((field, value) => {
    const newInputs = { ...inputs, [field]: value };
    setInputs(newInputs);
    recalculate(newInputs, month, year);
  }, [inputs, month, year, recalculate]);

  const setMonthYear = useCallback((m, y) => {
    setMonth(m);
    setYear(y);
    recalculate(inputs, m, y);
  }, [inputs, recalculate]);

  const saveReport = useCallback(async () => {
    if (!clientId) return;
    if (isDemoClient(clientId)) {
      setResult(calculateDemoROI(inputs, month, year));
      return { success: true };
    }
    try {
      const res = await roiAPI.calculate({ client_id: clientId, month, year });
      setResult(res.data);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.response?.data?.error || 'Failed to save.' };
    }
  }, [clientId, month, year]);

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
    if (isDemoClient(clientId)) {
      setReports(getDemoROIReports());
      setLoading(false);
      return;
    }
    setLoading(true);
    roiAPI.getReports({ client_id: clientId })
      .then(res => setReports(res.data.results || res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clientId]);

  return { reports, loading };
}
