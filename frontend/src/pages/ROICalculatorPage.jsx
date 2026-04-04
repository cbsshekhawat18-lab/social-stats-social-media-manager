import { useState, useEffect, useRef, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  DollarSign, TrendingUp, TrendingDown, Target,
  Save, RefreshCw, Info,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useROISettings, useROICalculator, useROIReports } from '../hooks/useROI';
import ROIFunnel from '../components/ui/ROIFunnel';
import { PLATFORMS } from '../services/platforms';
import { useClients } from '../hooks/useData';
import PageHeader from '../components/layout/PageHeader';
import SocialPlatformIcon from '../components/ui/SocialPlatformIcon';

// ── Inject styles once ────────────────────────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('roi-styles')) {
  const s = document.createElement('style');
  s.id = 'roi-styles';
  s.textContent = `
    @keyframes countUp {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    input[type=range].roi-slider {
      -webkit-appearance: none;
      appearance: none;
      height: 6px;
      border-radius: 4px;
      background: linear-gradient(to right, #00d7ff var(--val, 50%), #e2e8f0 var(--val, 50%));
      outline: none;
      cursor: pointer;
      width: 100%;
    }
    input[type=range].roi-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 18px; height: 18px;
      border-radius: 50%;
      background: #fff;
      border: 2.5px solid #2563EB;
      cursor: pointer;
      box-shadow: 0 1px 4px rgba(37,99,235,0.3);
    }
    input[type=range].roi-slider::-moz-range-thumb {
      width: 18px; height: 18px;
      border-radius: 50%;
      background: #fff;
      border: 2.5px solid #2563EB;
      cursor: pointer;
    }
  `;
  document.head.appendChild(s);
}

// ── Animated counter hook ─────────────────────────────────────────────────────
function useCountUp(target, duration = 900) {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef(null);
  const startRef = useRef(null);
  const fromRef  = useRef(0);

  useEffect(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    const from = fromRef.current;
    startRef.current = null;

    const step = (timestamp) => {
      if (!startRef.current) startRef.current = timestamp;
      const progress = Math.min((timestamp - startRef.current) / duration, 1);
      const ease     = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (target - from) * ease);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = target;
        setDisplay(target);
      }
    };
    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return display;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtCurrency(n, symbol) {
  const sym = symbol || '$';
  if (!n && n !== 0) return `${sym}0`;
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sym}${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${sym}${(n / 1_000).toFixed(1)}K`;
  return `${sym}${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtNum(n) {
  if (!n && n !== 0) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(Math.round(n));
}

function roiColor(pct) {
  if (pct > 500)  return '#059669';
  if (pct > 200)  return '#10B981';
  if (pct > 0)    return '#F59E0B';
  return '#EF4444';
}

function roiLabel(pct) {
  if (pct > 500)  return { text: 'Excellent', bg: '#D1FAE5', color: '#059669' };
  if (pct > 200)  return { text: 'Good',      bg: '#DBEAFE', color: '#2563EB' };
  if (pct > 0)    return { text: 'Average',   bg: '#FEF3C7', color: '#D97706' };
  return              { text: 'Losing Money', bg: '#FEE2E2', color: '#EF4444' };
}

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

const PLATFORM_CONFIGS = [
  { key: 'facebook_budget',  label: 'Facebook',    platformKey: 'facebook' },
  { key: 'instagram_budget', label: 'Instagram',   platformKey: 'instagram' },
  { key: 'youtube_budget',   label: 'YouTube',     platformKey: 'youtube' },
  { key: 'linkedin_budget',  label: 'LinkedIn',    platformKey: 'linkedin' },
  { key: 'gmb_budget',       label: 'Google My Business', platformKey: 'google_my_business' },
];

// ── Sub-components ────────────────────────────────────────────────────────────
function CurrencyInput({ label, value, onChange, symbol, helper, disabled = false }) {
  const sym = symbol || '$';
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <label style={inputLabel}>{label}</label>}
      <div style={disabled ? disabledInputWrap : inputWrap}>
        <span style={inputPrefix}>{sym}</span>
        <input
          type="number"
          min="0"
          step="50"
          value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          disabled={disabled}
          style={disabled ? disabledInputField : inputField}
        />
      </div>
      {helper && <p style={helperText}>{helper}</p>}
    </div>
  );
}

function SliderInput({ label, value, onChange, min, max, step, unit, helper, disabled = false }) {
  const u = unit || '%';
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <label style={inputLabel}>{label}</label>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#2563EB', minWidth: 48, textAlign: 'right' }}>
          {value}{u}
        </span>
      </div>
      <input
        type="range"
        className="roi-slider"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        style={{ '--val': `${pct}%` }}
      />
      {helper && <p style={helperText}>{helper}</p>}
    </div>
  );
}

function PlatformRow({ row, symbol }) {
  if (!row) return null;
  const pl = PLATFORMS[row.platform] || {};
  const roi = row.roi_percentage || 0;
  const roiStyle = {
    display: 'inline-block', padding: '2px 10px', borderRadius: 20,
    fontSize: 11, fontWeight: 700,
    background: roi > 0 ? '#D1FAE5' : '#FEE2E2',
    color:      roi > 0 ? '#059669' : '#EF4444',
  };
  return (
    <tr style={trStyle}>
      <td style={tdStyle}>
        <span style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <SocialPlatformIcon platform={row.platform} size={15} />
          {pl.label || row.platform}
        </span>
      </td>
      <td style={{ ...tdStyle, textAlign: 'right' }}>{symbol}{(row.budget || 0).toLocaleString()}</td>
      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtNum(row.clicks)}</td>
      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtNum(row.leads)}</td>
      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtNum(row.sales)}</td>
      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtCurrency(row.revenue, symbol)}</td>
      <td style={{ ...tdStyle, textAlign: 'right' }}><span style={roiStyle}>{roi.toFixed(0)}%</span></td>
    </tr>
  );
}

function GoalBar({ label, current, target, progress, fmt }) {
  const pct    = Math.min(Number(progress) || 0, 100);
  const onTrack = pct >= 50;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{label}</span>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
          background: onTrack ? '#D1FAE5' : '#FEE2E2',
          color:      onTrack ? '#059669' : '#EF4444',
        }}>
          {onTrack ? 'On Track' : 'Behind'}
        </span>
      </div>
      <div style={{ height: 8, background: '#E2E8F0', borderRadius: 4, overflow: 'hidden', marginBottom: 4 }}>
        <div style={{
          height: '100%', borderRadius: 4,
          width: `${pct}%`,
          background: onTrack ? '#10B981' : '#F59E0B',
          transition: 'width 0.8s ease',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94A3B8' }}>
        <span>{fmt(current)} achieved</span>
        <span>{pct.toFixed(0)}% of {fmt(target)}</span>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ROICalculatorPage({ clientId: propClientId }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { clients } = useClients();
  const showClientSelector = !propClientId;
  const queryClientId = searchParams.get('client');
  const parsedClientId = queryClientId ? parseInt(queryClientId, 10) : null;
  const [selectedClientId, setSelectedClientId] = useState(propClientId || parsedClientId || null);
  const clientId = selectedClientId;

  const updateSearch = useCallback((updates) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (parsedClientId && parsedClientId !== clientId) {
      setSelectedClientId(parsedClientId);
    }
  }, [parsedClientId, clientId]);

  const { settings, loading: settingsLoading, saving, saveSettings } = useROISettings(clientId);
  const {
    result, loading: calcLoading, error,
    inputs, month, year,
    updateInput, setMonthYear, loadFromSettings, saveReport, calculate,
  } = useROICalculator(clientId);
  const { reports } = useROIReports(clientId);

  const [saveMsg, setSaveMsg] = useState('');
  const [isEditingSettings, setIsEditingSettings] = useState(false);

  // Load settings into calculator inputs when settings arrive
  useEffect(() => {
    if (settings) {
      loadFromSettings(settings);
      calculate(settings, month, year);
      setIsEditingSettings(false);
    } else {
      setIsEditingSettings(true);
    }
  }, [settings, loadFromSettings, calculate, month, year]);

  const symbol = inputs.currency_symbol || '$';

  const totalInvestment = (
    (inputs.facebook_budget || 0) + (inputs.instagram_budget || 0) +
    (inputs.youtube_budget  || 0) + (inputs.linkedin_budget  || 0) +
    (inputs.gmb_budget      || 0) + (inputs.agency_fee       || 0)
  );

  const animatedROI     = useCountUp(result?.roi_percentage    || 0);
  const animatedRevenue = useCountUp(result?.estimated_revenue || 0);

  const handleSaveSettings = async () => {
    const res = await saveSettings(inputs);
    if (res.success) {
      setIsEditingSettings(false);
    }
    setSaveMsg(res.success ? '✓ Settings saved' : '✗ Save failed');
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const handleEditSettings = () => {
    setIsEditingSettings(true);
    setSaveMsg('');
  };

  const handleCancelEdit = () => {
    if (settings) {
      loadFromSettings(settings);
      calculate(settings, month, year);
      setIsEditingSettings(false);
      setSaveMsg('Changes discarded');
      setTimeout(() => setSaveMsg(''), 3000);
    }
  };

  const handleSaveReport = async () => {
    const res = await saveReport();
    setSaveMsg(res.success ? '✓ Report saved' : '✗ ' + res.error);
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const roi    = result?.roi_percentage || 0;
  const rLabel = roiLabel(roi);
  const hasSavedSettings = Boolean(settings);
  const fieldsDisabled = hasSavedSettings && !isEditingSettings;

  const yearOptions = [];
  const thisYear = new Date().getFullYear();
  for (let y = thisYear - 2; y <= thisYear; y++) yearOptions.push(y);

  // No client selected (admin-level page with no clientId prop)
  if (!clientId) {
    return (
      <div style={pageWrap}>
        <PageHeader
          title="ROI Calculator"
          subtitle="Measure the return on your social media investment"
          actions={(
            <select
              value=""
              onChange={e => {
                const nextClientId = e.target.value ? parseInt(e.target.value, 10) : null;
                setSelectedClientId(nextClientId);
                updateSearch({ client: nextClientId });
              }}
              style={clientSelectStyle}
            >
              <option value="">All Users</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.company}</option>
              ))}
            </select>
          )}
        />
        <div style={{ padding: 40, maxWidth: 500, margin: '60px auto', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>📈</div>
          <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: '#0F172A' }}>ROI Calculator</h2>
          <p style={{ color: '#64748B', fontSize: 14, marginBottom: 0 }}>
            Select a user from the top-right dropdown to view and calculate their return on investment.
          </p>
          {clients.length === 0 && (
            <p style={{ color: '#94A3B8', fontSize: 13, marginTop: 12 }}>No users found.</p>
          )}
        </div>
      </div>
    );
  }

  if (settingsLoading) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#64748B' }}>
        Loading ROI Calculator…
      </div>
    );
  }

  return (
    <div style={pageWrap}>
      <PageHeader
        title="ROI Calculator"
        subtitle="Measure the return on your social media investment"
        actions={(
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {saveMsg && <span style={{ fontSize: 13, color: saveMsg.startsWith('✓') ? '#059669' : '#EF4444', fontWeight: 600 }}>{saveMsg}</span>}
            <div style={{ display: 'flex', gap: 8 }}>
              {showClientSelector && (
                <select
                  value={clientId || ''}
                  onChange={e => {
                    const nextClientId = e.target.value ? parseInt(e.target.value, 10) : null;
                    setSelectedClientId(nextClientId);
                    updateSearch({ client: nextClientId });
                  }}
                  style={clientSelectStyle}
                >
                  <option value="">All Users</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
                </select>
              )}
              <select value={month} onChange={e => setMonthYear(parseInt(e.target.value), year)} style={selectStyle}>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <select value={year} onChange={e => setMonthYear(month, parseInt(e.target.value))} style={selectStyle}>
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        )}
      />

      <div style={twoCol}>
        {/* ── LEFT PANEL ─────────────────────────────────────────── */}
        <div style={leftPanel}>

          {/* Monthly Investment */}
          <div style={card}>
            <h3 style={cardTitle}><DollarSign size={16} style={{ color: '#2563EB' }} /> Monthly Investment</h3>
            {hasSavedSettings && (
              <div style={settingsBanner}>
                <span style={{ color: '#0F172A', fontWeight: 700 }}>Settings saved</span>
                <span style={{ color: '#64748B' }}>
                  {fieldsDisabled ? 'Click Edit Settings to change budgets and business numbers.' : 'You are editing the saved ROI settings.'}
                </span>
              </div>
            )}

            {PLATFORM_CONFIGS.map(pc => {
              const pl = PLATFORMS[pc.platformKey] || {};
              return (
                <div key={pc.key} style={{ marginBottom: 10 }}>
                  <label style={{ ...inputLabel, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <SocialPlatformIcon platform={pc.platformKey} size={14} />
                    {pl.label || pc.label}
                  </label>
                  <div style={fieldsDisabled ? disabledInputWrap : inputWrap}>
                    <span style={inputPrefix}>{symbol}</span>
                    <input
                      type="number" min="0" step="50"
                      value={inputs[pc.key]}
                      onChange={e => updateInput(pc.key, parseFloat(e.target.value) || 0)}
                      disabled={fieldsDisabled}
                      style={fieldsDisabled ? disabledInputField : inputField}
                    />
                  </div>
                </div>
              );
            })}

            <div style={{ marginBottom: 10 }}>
              <label style={inputLabel}>Agency Management Fee</label>
              <div style={fieldsDisabled ? disabledInputWrap : inputWrap}>
                <span style={inputPrefix}>{symbol}</span>
                <input
                  type="number" min="0" step="50"
                  value={inputs.agency_fee}
                  onChange={e => updateInput('agency_fee', parseFloat(e.target.value) || 0)}
                  disabled={fieldsDisabled}
                  style={fieldsDisabled ? disabledInputField : inputField}
                />
              </div>
            </div>

            <div style={{ ...totalDisplay, marginTop: 12 }}>
              <span style={{ fontSize: 13, color: '#64748B' }}>Total Monthly Investment</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', fontFamily: 'monospace' }}>
                {fmtCurrency(totalInvestment, symbol)}
              </span>
            </div>
          </div>

          {/* Business Settings */}
          <div style={{ ...card, marginTop: 16 }}>
            <h3 style={cardTitle}><Target size={16} style={{ color: '#059669' }} /> Your Business Numbers</h3>

            <CurrencyInput
              label="How much is one sale worth?"
              value={inputs.avg_sale_value}
              onChange={v => updateInput('avg_sale_value', v)}
              symbol={symbol}
              helper="Average revenue per customer / sale"
              disabled={fieldsDisabled}
            />

            <SliderInput
              label="Website visitor → Lead rate"
              value={inputs.conversion_rate}
              onChange={v => updateInput('conversion_rate', v)}
              min={0.1} max={20} step={0.1}
              helper="Industry average: 2–3%"
              disabled={fieldsDisabled}
            />

            <SliderInput
              label="Lead → Customer rate"
              value={inputs.lead_to_sale_rate}
              onChange={v => updateInput('lead_to_sale_rate', v)}
              min={1} max={100} step={1}
              helper="How many leads become paying customers"
              disabled={fieldsDisabled}
            />
          </div>

          {/* Goals */}
          <div style={{ ...card, marginTop: 16 }}>
            <h3 style={cardTitle}><TrendingUp size={16} style={{ color: '#D97706' }} /> Monthly Goals</h3>

            <CurrencyInput
              label="Revenue Goal"
              value={inputs.monthly_revenue_goal}
              onChange={v => updateInput('monthly_revenue_goal', v)}
              symbol={symbol}
              helper="Target revenue for this month"
              disabled={fieldsDisabled}
            />

            <div style={{ marginBottom: 12 }}>
              <label style={inputLabel}>Leads Goal</label>
              <div style={fieldsDisabled ? disabledInputWrap : inputWrap}>
                <span style={inputPrefix}>#</span>
                <input
                  type="number" min="0" step="10"
                  value={inputs.monthly_leads_goal}
                  onChange={e => updateInput('monthly_leads_goal', parseInt(e.target.value) || 0)}
                  disabled={fieldsDisabled}
                  style={fieldsDisabled ? disabledInputField : inputField}
                />
              </div>
              <p style={helperText}>Target number of leads this month</p>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            {fieldsDisabled ? (
              <button onClick={handleEditSettings} style={secondaryBtn}>
                <Save size={14} /> Edit Settings
              </button>
            ) : (
              <>
                <button onClick={handleSaveSettings} disabled={saving} style={secondaryBtn}>
                  <Save size={14} /> {saving ? 'Saving…' : 'Save Settings'}
                </button>
                {hasSavedSettings && (
                  <button onClick={handleCancelEdit} disabled={saving} style={ghostBtn}>
                    Cancel
                  </button>
                )}
              </>
            )}
            <button onClick={handleSaveReport} style={primaryBtn}>
              <RefreshCw size={14} /> Save Report
            </button>
          </div>
        </div>

        {/* ── RIGHT PANEL ────────────────────────────────────────── */}
        <div style={rightPanel}>

          {/* Loading state */}
          {calcLoading && (
            <div style={loadingSkeleton}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ height: 100, background: '#f0f4f9', borderRadius: 12, marginBottom: 16 }} />
              ))}
            </div>
          )}

          {/* Error / not configured */}
          {error && !calcLoading && (
            <div style={{ ...card, borderLeft: '4px solid #EF4444', textAlign: 'center', padding: 32 }}>
              <Info size={32} style={{ color: '#EF4444', margin: '0 auto 12px', display: 'block' }} />
              <p style={{ color: '#374151', fontSize: 14, margin: 0 }}>{error}</p>
              <p style={{ color: '#94A3B8', fontSize: 12, marginTop: 8 }}>
                Enter your budget and business numbers on the left to see your ROI.
              </p>
            </div>
          )}

          {result && !calcLoading && (
            <div style={{ animation: 'slideUp 0.4s ease' }}>

              {/* Card 1: Main ROI */}
              <div style={{ ...card, textAlign: 'center', padding: 32, marginBottom: 16, border: `2px solid ${roiColor(roi)}20` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                  Return on Investment
                </div>
                <div style={{
                  fontSize: 72, fontWeight: 900, fontFamily: 'monospace',
                  color: roiColor(roi), lineHeight: 1, animation: 'countUp 0.6s ease',
                }}>
                  {animatedROI.toFixed(0)}%
                </div>
                <div style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, margin: '12px 0', background: rLabel.bg, color: rLabel.color }}>
                  {rLabel.text}
                </div>
                <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>
                  For every {symbol}1 spent you earn{' '}
                  <strong style={{ color: '#0F172A' }}>{symbol}{(result.per_dollar_earned || 0).toFixed(2)}</strong> back
                </p>
              </div>

              {/* Card 2: Investment vs Revenue */}
              <div style={{ ...card, marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                  <div style={{ flex: 1, textAlign: 'center', padding: 16, background: '#FEF3C7', borderRadius: 12 }}>
                    <div style={{ fontSize: 11, color: '#D97706', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>💰 Total Invested</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: '#0F172A', fontFamily: 'monospace' }}>
                      {fmtCurrency(result.total_investment, symbol)}
                    </div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', padding: 16, background: '#D1FAE5', borderRadius: 12 }}>
                    <div style={{ fontSize: 11, color: '#059669', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>📈 Est. Revenue</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: '#0F172A', fontFamily: 'monospace' }}>
                      {fmtCurrency(animatedRevenue, symbol)}
                    </div>
                  </div>
                </div>
                {/* Bar visualization */}
                {result.total_investment > 0 && (
                  <div>
                    <div style={{ height: 12, background: '#f0f4f9', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                      <div style={{
                        position: 'absolute', left: 0, top: 0, height: '100%',
                        width: `${Math.min((result.total_investment / Math.max(result.estimated_revenue, result.total_investment)) * 100, 100)}%`,
                        background: '#F59E0B', borderRadius: 6, transition: 'width 0.8s ease',
                      }} />
                      <div style={{
                        position: 'absolute', left: 0, top: 0, height: '100%',
                        width: `${Math.min((result.estimated_revenue / Math.max(result.estimated_revenue, result.total_investment)) * 100, 100)}%`,
                        background: '#10B981', borderRadius: 6, opacity: 0.6, transition: 'width 0.8s ease',
                      }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: '#94A3B8' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} /> Investment
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} /> Revenue
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 3: Conversion Funnel */}
              <div style={{ ...card, marginBottom: 16 }}>
                <h4 style={cardTitle}>Conversion Funnel</h4>
                <ROIFunnel
                  clicks={result.total_clicks}
                  website_clicks={result.total_website_clicks}
                  leads={result.estimated_leads}
                  sales={result.estimated_sales}
                />
              </div>

              {/* Card 4: Cost Efficiency */}
              <div style={{ ...card, marginBottom: 16 }}>
                <h4 style={cardTitle}>Cost Efficiency</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {[
                    { label: 'Cost / Click', value: result.cost_per_click, industry: 1.00,   fmt: v => `${symbol}${(+v).toFixed(2)}`, better: 'lower' },
                    { label: 'Cost / Lead',  value: result.cost_per_lead,  industry: 50.00,  fmt: v => `${symbol}${(+v).toFixed(2)}`, better: 'lower' },
                    { label: 'Cost / Sale',  value: result.cost_per_sale,  industry: 200.00, fmt: v => `${symbol}${(+v).toFixed(0)}`, better: 'lower' },
                  ].map(m => {
                    const isGood = m.value > 0 && m.value <= m.industry;
                    return (
                      <div key={m.label} style={{
                        background: isGood ? '#D1FAE5' : (m.value > 0 ? '#FEE2E2' : '#F8FAFC'),
                        borderRadius: 10, padding: '12px 14px', textAlign: 'center',
                        border: `1px solid ${isGood ? '#A7F3D0' : (m.value > 0 ? '#FECACA' : '#E2E8F0')}`,
                      }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{m.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'monospace', color: isGood ? '#059669' : (m.value > 0 ? '#EF4444' : '#94A3B8') }}>
                          {m.value > 0 ? m.fmt(m.value) : '—'}
                        </div>
                        <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>
                          avg {m.fmt(m.industry)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Card 5: Platform Breakdown */}
              {result.platform_breakdown?.length > 0 && (
                <div style={{ ...card, marginBottom: 16, overflowX: 'auto' }}>
                  <h4 style={cardTitle}>Platform Breakdown</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr>
                        {['Platform', 'Budget', 'Clicks', 'Leads', 'Sales', 'Revenue', 'ROI%'].map(h => (
                          <th key={h} style={thStyle}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.platform_breakdown.map(row => (
                        <PlatformRow key={row.platform} row={row} symbol={symbol} />
                      ))}
                      <tr style={{ ...trStyle, fontWeight: 700, background: '#f0f4f9' }}>
                        <td style={tdStyle}><strong>Total</strong></td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}><strong>{fmtCurrency(result.total_investment, symbol)}</strong></td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}><strong>{fmtNum(result.total_clicks)}</strong></td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}><strong>{fmtNum(result.estimated_leads)}</strong></td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}><strong>{fmtNum(result.estimated_sales)}</strong></td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}><strong>{fmtCurrency(result.estimated_revenue, symbol)}</strong></td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          <span style={{ fontWeight: 700, color: roiColor(roi) }}>{roi.toFixed(0)}%</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Card 6: Goal Progress */}
              {result.goals && (result.goals.revenue_progress !== null || result.goals.leads_progress !== null) && (
                <div style={{ ...card, marginBottom: 16 }}>
                  <h4 style={cardTitle}>Goal Progress</h4>
                  {result.goals.revenue_progress !== null && (
                    <GoalBar
                      label="Revenue Goal"
                      current={result.estimated_revenue}
                      target={result.goals.revenue_goal}
                      progress={result.goals.revenue_progress}
                      fmt={v => fmtCurrency(v, symbol)}
                    />
                  )}
                  {result.goals.leads_progress !== null && (
                    <GoalBar
                      label="Leads Goal"
                      current={result.estimated_leads}
                      target={result.goals.leads_goal}
                      progress={result.goals.leads_progress}
                      fmt={v => fmtNum(v)}
                    />
                  )}
                </div>
              )}

              {/* Card 7: Historical Trend Chart */}
              {reports.length > 1 && (
                <div style={{ ...card, marginBottom: 16 }}>
                  <h4 style={cardTitle}>Historical ROI Trend</h4>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={reports} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="left"  tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={v => fmtCurrency(v, symbol)} />
                      <Tooltip
                        formatter={(v, name) => [
                          name === 'roi_percentage' ? `${v.toFixed(0)}%` : fmtCurrency(v, symbol),
                          name === 'roi_percentage' ? 'ROI %' : 'Revenue',
                        ]}
                      />
                      <Legend formatter={n => n === 'roi_percentage' ? 'ROI %' : 'Est. Revenue'} />
                      <Line yAxisId="left"  type="monotone" dataKey="roi_percentage"    stroke="#2563EB" strokeWidth={2} dot={{ r: 4 }} name="roi_percentage" />
                      <Line yAxisId="right" type="monotone" dataKey="estimated_revenue" stroke="#10B981" strokeWidth={2} dot={{ r: 4 }} name="estimated_revenue" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* No data message */}
              {!result.has_data && (
                <div style={{ ...card, textAlign: 'center', padding: 24, color: '#94A3B8', marginBottom: 16 }}>
                  <TrendingDown size={28} style={{ margin: '0 auto 8px', display: 'block' }} />
                  <p style={{ margin: 0, fontSize: 13 }}>No social media data found for {MONTHS[month - 1]} {year}.</p>
                  <p style={{ margin: '6px 0 0', fontSize: 12 }}>The projection above is based on your configured budgets and rates.</p>
                </div>
              )}

            </div>
          )}

          {/* Empty state — no result yet */}
          {!result && !calcLoading && !error && (
            <div style={{ ...card, textAlign: 'center', padding: 48 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
              <h3 style={{ color: '#0F172A', marginBottom: 8 }}>Your ROI Will Appear Here</h3>
              <p style={{ color: '#64748B', fontSize: 14 }}>
                Enter your monthly budgets and business numbers on the left to calculate your return on investment.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const pageWrap     = { padding: '24px 28px', maxWidth: 1400, margin: '0 auto' };
const clientSelectStyle = { padding: '8px 14px', borderRadius: 10, border: '1.5px solid #dbe5f3', fontSize: 13, background: '#fff', color: '#1e293b', fontWeight: 600, outline: 'none', minWidth: 200 };
const twoCol       = { display: 'grid', gridTemplateColumns: '40% 1fr', gap: 24, alignItems: 'flex-start' };
const leftPanel    = { position: 'sticky', top: 24 };
const rightPanel   = {};
const card         = {
  background: '#FFFFFF', borderRadius: 16, padding: 24,
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 0,
};
const cardTitle    = {
  display: 'flex', alignItems: 'center', gap: 8,
  margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: '#1E293B',
};
const inputLabel   = { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 };
const inputWrap    = { display: 'flex', alignItems: 'center', border: '1.5px solid #E2E8F0', borderRadius: 10, background: '#f0f4f9', overflow: 'hidden' };
const disabledInputWrap = { ...inputWrap, background: '#F8FAFC', border: '1.5px solid #E5E7EB' };
const inputPrefix  = { padding: '8px 12px', fontSize: 14, fontWeight: 600, color: '#64748B', background: '#f0f4f9', borderRight: '1px solid #E2E8F0' };
const inputField   = { flex: 1, padding: '8px 12px', fontSize: 14, border: 'none', background: 'transparent', outline: 'none', color: '#0F172A' };
const disabledInputField = { ...inputField, color: '#94A3B8', cursor: 'not-allowed' };
const helperText   = { margin: '4px 0 0', fontSize: 11, color: '#94A3B8' };
const totalDisplay = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#e6fbff', borderRadius: 10 };
const selectStyle  = { padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, background: '#fff', outline: 'none', cursor: 'pointer', color: '#0F172A' };
const primaryBtn   = { display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center', padding: '11px 16px', background: '#00d7ff', color: '#0f172a', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const secondaryBtn = { display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center', padding: '11px 16px', background: '#fff', color: '#374151', border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const ghostBtn     = { display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', padding: '11px 16px', background: '#F8FAFC', color: '#64748B', border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const settingsBanner = { display: 'grid', gap: 4, marginBottom: 16, padding: '12px 14px', borderRadius: 12, background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 12 };
const loadingSkeleton = { padding: 0 };
const thStyle = { textAlign: 'left', padding: '8px 10px', background: '#f0f4f9', color: '#64748B', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' };
const trStyle = { borderBottom: '1px solid #F1F5F9' };
const tdStyle = { padding: '10px 10px', color: '#374151', fontSize: 12 };
