/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { Lock, Eye, TrendingUp, Users, MousePointerClick, Play, Heart, ExternalLink } from 'lucide-react';
import { publicReportAPI } from '../services/api';
import { useLookups } from '../hooks/useData';
import { fmt } from '../services/platforms';
import SocialPlatformIcon from '../components/ui/SocialPlatformIcon';

// ── Inject styles once ────────────────────────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('pub-report-styles')) {
  const s = document.createElement('style');
  s.id = 'pub-report-styles';
  s.textContent = `
    @media print {
      .no-print { display: none !important; }
      body { background: #fff; }
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(s);
}

const KPI_ICON_MAP = {
  impressions: Eye,
  reach: TrendingUp,
  clicks: MousePointerClick,
  likes: Heart,
  followers: Users,
  video_views: Play,
};

const KPI_COLOR_MAP = {
  impressions: '#00d7ff',
  reach: '#00d7ff',
  clicks: '#059669',
  likes: '#ef4444',
  followers: '#d97706',
  video_views: '#ff0000',
};

const PLATFORM_COLOR_MAP = {
  facebook: '#1877f2',
  instagram: '#e1306c',
  youtube: '#ff0000',
  linkedin: '#0077b5',
  google_my_business: '#34a853',
};

const KPI_DEFS = [
  { key: 'impressions', label: 'Impressions' },
  { key: 'reach',       label: 'Reach' },
  { key: 'clicks',      label: 'Clicks' },
  { key: 'likes',       label: 'Likes' },
  { key: 'followers',   label: 'Followers' },
  { key: 'video_views', label: 'Video Views' },
];

function KpiCard({ label, value, icon: Icon, color }) {
  return (
    <div style={{ ...kpiCard, animation: 'fadeIn .4s ease' }}>
      <div style={{ ...kpiIconWrap, background: color + '18' }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div>
        <p style={kpiLabel}>{label}</p>
        <p style={kpiValue}>{fmt(value || 0)}</p>
      </div>
    </div>
  );
}

function PasswordGate({ token, clientName, period, onUnlock }) {
  const [pw, setPw]   = useState('');
  const [fieldError, setFieldError] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!pw.trim()) {
      setFieldError('Password is required.');
      return;
    }
    setBusy(true);
    setErr('');
    setFieldError('');
    try {
      const res = await publicReportAPI.verify(token, pw);
      onUnlock(res.data);
    } catch {
      setErr('Incorrect password. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={gateWrap}>
      <div style={gateCard}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={lockCircle}><Lock size={28} style={{ color: '#00d7ff' }} /></div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: '12px 0 4px' }}>
            {clientName}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
            {period?.from} → {period?.until}
          </p>
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 20 }}>
          This report is password protected.
        </p>
        <form onSubmit={submit}>
          <label style={pwLabel}>Password <span style={requiredAsterisk}>*</span></label>
          <input
            type="password"
            value={pw}
            onChange={e => {
              setPw(e.target.value);
              if (fieldError) setFieldError('');
            }}
            placeholder="Enter password…"
            style={{ ...pwInput, ...(fieldError ? pwInputError : {}) }}
            autoFocus
          />
          {fieldError && <p style={pwErrorText}>{fieldError}</p>}
          {err && <p style={{ color: '#dc2626', fontSize: 13, margin: '8px 0 0' }}>{err}</p>}
          <button type="submit" disabled={busy} style={pwBtn}>
            {busy ? 'Verifying…' : 'View Report'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function PublicReportPage() {
  const { token } = useParams();
  const { lookups } = useLookups();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [meta,    setMeta]    = useState(null); // password gate meta

  useEffect(() => {
    publicReportAPI.get(token)
      .then(res => {
        if (res.data.requires_password) {
          setMeta(res.data);
        } else {
          setData(res.data);
        }
      })
      .catch(err => {
        const msg = err.response?.data?.error;
        setError(msg || 'This report could not be loaded.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div style={centeredMsg}>Loading report…</div>;
  if (error)   return <div style={{ ...centeredMsg, color: '#dc2626' }}>{error}</div>;

  if (meta?.requires_password) {
    return (
      <PasswordGate
        token={token}
        clientName={meta.client_name}
        period={meta.period}
        onUnlock={setData}
      />
    );
  }

  if (!data) return null;

  const platformLabels = (lookups.platforms || []).reduce((acc, item) => {
    acc[item.key] = item.label;
    return acc;
  }, {});

  const kpiDefs = (lookups.kpi_defs || KPI_DEFS.map(item => ({ key: item.key, label: item.label }))).map(def => ({
    ...def,
    icon: KPI_ICON_MAP[def.key] || Eye,
    color: KPI_COLOR_MAP[def.key] || '#00d7ff',
  }));

  const { client, period, totals, by_platform, timeseries, top_posts } = data;

  // Build line chart data: group timeseries by date
  const tsMap = {};
  (timeseries || []).forEach(row => {
    if (!tsMap[row.date]) tsMap[row.date] = { date: row.date };
    tsMap[row.date][row.platform] = row.impressions;
  });
  const tsData = Object.values(tsMap).sort((a, b) => a.date.localeCompare(b.date));

  // Platforms present in by_platform
  const activePlatforms = [...new Set((by_platform || []).map(r => r.platform))];

  return (
    <div style={pageWrap}>
      {/* ── Header ─────────────────────────────────────── */}
      <div style={headerBand}>
        <div style={headerInner}>
          <div>
            <h1 style={companyName}>{client?.name}</h1>
            <p style={periodLabel}>
              Social Media Report · {period?.from} → {period?.until}
            </p>
          </div>
          <button
            className="no-print"
            onClick={() => window.print()}
            style={printBtn}
          >
            Download PDF
          </button>
        </div>
      </div>

      <div style={content}>
        {/* ── KPI Cards ──────────────────────────────────── */}
        <section style={sectionWrap}>
          <h2 style={sectionTitle}>Overview</h2>
          <div style={kpiGrid}>
            {kpiDefs.map(k => (
              <KpiCard key={k.key} label={k.label} value={totals?.[k.key]} icon={k.icon} color={k.color} />
            ))}
          </div>
        </section>

        {/* ── Platform Breakdown ─────────────────────────── */}
        {by_platform?.length > 0 && (
          <section style={sectionWrap}>
            <h2 style={sectionTitle}>By Platform</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {['Platform', 'Impressions', 'Reach', 'Clicks', 'Likes', 'Followers', 'Video Views'].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {by_platform.map(row => {
                    const label = platformLabels[row.platform] || row.platform;
                    return (
                      <tr key={row.platform} style={trStyle}>
                        <td style={tdStyle}>
                          <span style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <SocialPlatformIcon platform={row.platform} size={15} />
                            {label}
                          </span>
                        </td>
                        {['impressions', 'reach', 'clicks', 'likes', 'followers', 'video_views'].map(k => (
                          <td key={k} style={{ ...tdStyle, textAlign: 'right' }}>{fmt(row[k] || 0)}</td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── Platform Bar Chart ─────────────────────────── */}
        {by_platform?.length > 0 && (
          <section style={sectionWrap}>
            <h2 style={sectionTitle}>Impressions by Platform</h2>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={by_platform} margin={{ top: 0, right: 20, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-sunken)" />
                <XAxis dataKey="platform" tick={{ fontSize: 12 }}
                  tickFormatter={p => platformLabels[p] || p} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => fmt(v)} />
                <Tooltip formatter={(v, n) => [fmt(v), platformLabels[n] || n]} />
                <Bar dataKey="impressions" fill="#00d7ff" radius={[4, 4, 0, 0]} name="Impressions" />
              </BarChart>
            </ResponsiveContainer>
          </section>
        )}

        {/* ── Timeseries Line Chart ──────────────────────── */}
        {tsData.length > 1 && (
          <section style={sectionWrap}>
            <h2 style={sectionTitle}>Impressions Over Time</h2>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={tsData} margin={{ top: 0, right: 20, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-sunken)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }}
                  tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => fmt(v)} />
                <Tooltip formatter={(v, n) => [fmt(v), platformLabels[n] || n]} />
                <Legend formatter={n => platformLabels[n] || n} />
                {activePlatforms.map((p, i) => (
                  <Line
                    key={p}
                    type="monotone"
                    dataKey={p}
                    stroke={PLATFORM_COLOR_MAP[p] || `hsl(${i * 60},70%,50%)`}
                    strokeWidth={2}
                    dot={false}
                    name={platformLabels[p] || p}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </section>
        )}

        {/* ── Top Posts ──────────────────────────────────── */}
        {top_posts?.length > 0 && (
          <section style={sectionWrap}>
            <h2 style={sectionTitle}>Top Posts</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {top_posts.map((post, i) => {
                const pl = {
                  label: platformLabels[post.platform] || post.platform,
                  color: PLATFORM_COLOR_MAP[post.platform] || 'var(--text-secondary)',
                };
                return (
                  <div key={i} style={postRow}>
                    {post.thumbnail_url && (
                      <img src={post.thumbnail_url} alt="" style={postThumb} onError={e => { e.target.style.display = 'none'; }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <SocialPlatformIcon platform={post.platform} size={15} />
                          {pl.label || post.platform}
                        </span>
                        {post.published_at && (
                          <span style={{ marginLeft: 8 }}>
                            {new Date(post.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                      {post.caption && (
                        <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {post.caption.length > 120 ? post.caption.slice(0, 120) + '…' : post.caption}
                        </p>
                      )}
                      <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--text-secondary)' }}>
                        {post.likes      > 0 && <span>❤️ {fmt(post.likes)}</span>}
                        {post.comments   > 0 && <span>💬 {fmt(post.comments)}</span>}
                        {post.shares     > 0 && <span>🔁 {fmt(post.shares)}</span>}
                        {post.video_views > 0 && <span><Play size={12} style={{ verticalAlign: 'text-bottom' }} /> {fmt(post.video_views)}</span>}
                      </div>
                    </div>
                    {post.post_url && (
                      <a href={post.post_url} target="_blank" rel="noreferrer" style={viewPostLink}>
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────── */}
      <div style={footer}>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>
          Generated by <strong style={{ color: '#00d7ff' }}>Xper8</strong> · {period?.from} → {period?.until}
        </p>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const pageWrap = { minHeight: '100vh', background: 'var(--surface-page)', fontFamily: 'inherit' };

const headerBand = { background: 'var(--surface-card)', borderBottom: '1px solid var(--border-default)', padding: '20px 0' };
const headerInner = {
  maxWidth: 900, margin: '0 auto', padding: '0 24px',
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
};
const companyName = { margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' };
const periodLabel = { margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' };
const printBtn = {
  padding: '8px 18px', background: '#00d7ff', color: 'var(--text-primary)',
  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
};

const content     = { maxWidth: 900, margin: '0 auto', padding: '28px 24px' };
const sectionWrap = { background: 'var(--surface-card)', borderRadius: 14, padding: 24, marginBottom: 24, boxShadow: '0 1px 6px rgba(0,0,0,.06)' };
const sectionTitle = { margin: '0 0 18px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' };

const kpiGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 14 };
const kpiCard = {
  display: 'flex', alignItems: 'center', gap: 12,
  background: 'var(--surface-page)', borderRadius: 10, padding: '12px 14px',
  border: '1px solid var(--border-default)',
};
const kpiIconWrap = { width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
const kpiLabel = { margin: '0 0 2px', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 };
const kpiValue = { margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' };

const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
const thStyle    = { textAlign: 'left', padding: '8px 12px', background: 'var(--surface-page)', color: 'var(--text-secondary)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid var(--border-default)' };
const trStyle    = { borderBottom: '1px solid var(--surface-sunken)' };
const tdStyle    = { padding: '10px 12px', color: 'var(--text-secondary)' };

const postRow   = { display: 'flex', gap: 14, alignItems: 'flex-start', background: 'var(--surface-page)', borderRadius: 10, padding: 14, border: '1px solid var(--border-default)' };
const postThumb = { width: 72, height: 72, objectFit: 'cover', borderRadius: 8, flexShrink: 0 };
const viewPostLink = { color: 'var(--text-tertiary)', display: 'flex', alignSelf: 'flex-start', padding: 4 };

const footer = { borderTop: '1px solid var(--border-default)', padding: '16px 24px', textAlign: 'center', background: 'var(--surface-card)' };

const centeredMsg = { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontSize: 16, color: 'var(--text-secondary)' };

// Password gate
const gateWrap = { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--surface-page)', padding: 24 };
const gateCard = { background: 'var(--surface-card)', borderRadius: 16, padding: 32, width: '100%', maxWidth: 380, boxShadow: '0 4px 24px rgba(0,0,0,.1)' };
const lockCircle = { width: 60, height: 60, borderRadius: '50%', background: '#e6fbff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' };
const pwLabel = { display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' };
const requiredAsterisk = { color: '#ef4444', marginLeft: 2, fontWeight: 800 };
const pwInput = { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-default)', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const pwInputError = { borderColor: '#ef4444', background: '#fef2f2' };
const pwErrorText = { color: '#dc2626', fontSize: 12, margin: '6px 0 8px' };
const pwBtn   = { width: '100%', marginTop: 16, padding: '11px 0', background: '#00d7ff', color: 'var(--text-primary)', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' };
