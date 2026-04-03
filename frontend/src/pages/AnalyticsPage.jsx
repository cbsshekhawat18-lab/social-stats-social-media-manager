import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts';
import { overviewAPI, clientsAPI } from '../services/api';
import { useClients, useDateRange } from '../hooks/useData';
import { TrendingUp, TrendingDown, Minus, RefreshCw, Users, Eye, MousePointer, Play, UserPlus } from 'lucide-react';
import DateRangePicker from '../components/ui/DateRangePicker';

// ── Constants ─────────────────────────────────────────────────────────────────
const PLATFORM_META = {
  facebook:           { label: 'Facebook',           color: '#1877F2', icon: '📘', lightBg: '#EBF5FF' },
  instagram:          { label: 'Instagram',          color: '#E1306C', icon: '📸', lightBg: '#FFF0F5' },
  youtube:            { label: 'YouTube',            color: '#FF0000', icon: '▶️',  lightBg: '#FFF5F5' },
  linkedin:           { label: 'LinkedIn',           color: '#0A66C2', icon: '💼', lightBg: '#EEF4FF' },
  google_my_business: { label: 'Google My Business', color: '#34A853', icon: '🏢', lightBg: '#F0FFF4' },
};

const METRIC_META = {
  impressions:  { label: 'Impressions',  icon: Eye,         color: '#00d7ff' },
  reach:        { label: 'Reach',        icon: Users,       color: '#00d7ff' },
  clicks:       { label: 'Clicks',       icon: MousePointer,color: '#0891b2' },
  video_views:  { label: 'Video Views',  icon: Play,        color: '#00d7ff' },
  followers:    { label: 'Followers',    icon: UserPlus,    color: '#059669' },
};

function fmt(n) {
  if (!n && n !== 0) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return Number(n).toLocaleString();
}

function pctChange(curr, prev) {
  if (!prev || prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

// ── Sub-components ────────────────────────────────────────────────────────────
function KPICard({ label, value, prev, icon: Icon, color, loading }) {
  const change = prev != null ? pctChange(value, prev) : null;
  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: '20px 22px',
      border: '1px solid #e2e8f0', flex: 1, minWidth: 160,
      boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: color + '18',
        }}>
          <Icon size={16} color={color} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </span>
      </div>
      {loading ? (
        <div style={{ height: 32, background: '#f0f4f9', borderRadius: 6, animation: 'pulse 1.5s infinite' }} />
      ) : (
        <>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>
            {fmt(value || 0)}
          </div>
          {change != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 12, fontWeight: 700,
              color: change > 0 ? '#059669' : change < 0 ? '#dc2626' : '#64748b' }}>
              {change > 0 ? <TrendingUp size={12} /> : change < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
              {change > 0 ? '+' : ''}{change.toFixed(1)}% vs prev period
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SectionCard({ title, subtitle, children, style }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0',
      boxShadow: '0 1px 8px rgba(0,0,0,0.04)', padding: '22px 26px',
      ...style,
    }}>
      {(title || subtitle) && (
        <div style={{ marginBottom: 18 }}>
          {title && <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{title}</div>}
          {subtitle && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>{subtitle}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
      padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', fontSize: 12,
    }}>
      <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, color: p.color, marginBottom: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
          <span style={{ color: '#64748b' }}>{p.name}:</span>
          <span style={{ fontWeight: 700, color: '#0f172a' }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { clients } = useClients();
  const [selectedClientId, setSelectedClientId] = useState('all');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [range, setRange]               = useDateRange(30);
  const [activeMetric, setActiveMetric] = useState('impressions');

  // Overview data (all clients, all platforms, date range)
  const [overview, setOverview]           = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  // Per-client data
  const [summary, setSummary]           = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [timeseries, setTimeseries]     = useState([]);
  const [timeseriesLoading, setTimeseriesLoading] = useState(false);
  const [prevSummary, setPrevSummary]   = useState(null);

  // Compute previous period of same duration for comparison
  const daysDiff = Math.max(1, Math.round(
    (new Date(range.until) - new Date(range.since)) / 86400000
  ));
  const prevRange = {
    since: new Date(new Date(range.since) - daysDiff * 86400000).toISOString().slice(0, 10),
    until: range.since,
  };

  // ── Fetch overview ──────────────────────────────────────────────────────────
  const fetchOverview = useCallback(() => {
    setOverviewLoading(true);
    overviewAPI.get(range)
      .then(res => setOverview(res.data))
      .catch(() => setOverview(null))
      .finally(() => setOverviewLoading(false));
  }, [range.since, range.until]);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  // ── Fetch per-client summary + timeseries ───────────────────────────────────
  useEffect(() => {
    if (!selectedClientId || selectedClientId === 'all') {
      setSummary(null);
      setTimeseries([]);
      return;
    }
    const id = selectedClientId;
    const platform = selectedPlatform !== 'all' ? selectedPlatform : undefined;

    // Current period
    setSummaryLoading(true);
    clientsAPI.summary(id, { ...range, ...(platform ? { platform } : {}) })
      .then(res => setSummary(res.data))
      .catch(() => setSummary(null))
      .finally(() => setSummaryLoading(false));

    // Previous period for comparison
    clientsAPI.summary(id, {
      since: prevRange.since, until: prevRange.until,
      ...(platform ? { platform } : {}),
    })
      .then(res => setPrevSummary(res.data))
      .catch(() => setPrevSummary(null));

    // Timeseries
    setTimeseriesLoading(true);
    clientsAPI.timeseries(id, { ...range, ...(platform ? { platform } : {}) })
      .then(res => setTimeseries(res.data?.results || res.data || []))
      .catch(() => setTimeseries([]))
      .finally(() => setTimeseriesLoading(false));
  }, [selectedClientId, selectedPlatform, range.since, range.until]);

  // ── Derived data ────────────────────────────────────────────────────────────
  const platformData = (overview?.by_platform || []).map(p => ({
    ...p,
    label: PLATFORM_META[p.platform]?.label || p.platform,
    color: PLATFORM_META[p.platform]?.color || '#00d7ff',
    icon:  PLATFORM_META[p.platform]?.icon  || '📱',
  }));

  // Aggregate totals from overview platform data
  const totals = platformData.reduce((acc, p) => {
    acc.impressions  = (acc.impressions  || 0) + (p.impressions  || 0);
    acc.reach        = (acc.reach        || 0) + (p.reach        || 0);
    acc.clicks       = (acc.clicks       || 0) + (p.clicks       || 0);
    acc.video_views  = (acc.video_views  || 0) + (p.video_views  || 0);
    acc.followers    = (acc.followers    || 0) + (p.followers    || 0);
    return acc;
  }, {});

  // Use per-client summary when one is selected
  const kpiSource = summary || totals;

  // Format timeseries for recharts
  const chartData = timeseries.map(d => ({
    date:        d.date ? d.date.slice(5) : d.date,
    impressions: d.impressions || 0,
    reach:       d.reach       || 0,
    clicks:      d.clicks      || 0,
    video_views: d.video_views || 0,
    likes:       d.likes       || 0,
    followers:   d.followers   || 0,
  }));

  // Pie chart data from platforms
  const pieData = platformData
    .filter(p => (p[activeMetric] || 0) > 0)
    .map(p => ({ name: p.label, value: p[activeMetric] || 0, color: p.color }));

  // Platform radar data
  const radarData = Object.keys(METRIC_META).map(metric => {
    const entry = { metric: METRIC_META[metric].label };
    platformData.forEach(p => {
      entry[p.label] = p[metric] || 0;
    });
    return entry;
  });

  // Top clients table (per platform, sorted by impressions)
  const topClients = clients.slice(0, 10).map(c => ({ ...c }));

  const isClientSelected = selectedClientId && selectedClientId !== 'all';
  const selectedClientName = clients.find(c => String(c.id) === String(selectedClientId))?.company;

  return (
    <div style={{ padding: '32px 36px', background: '#f0f4f9', minHeight: '100vh' }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>Analytics</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>
            {isClientSelected
              ? `Viewing ${selectedClientName} — ${range.since} to ${range.until}`
              : `All clients overview — ${range.since} to ${range.until}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Date range */}
          <DateRangePicker range={range} onChange={setRange} />

          {/* Client filter */}
          <select
            value={selectedClientId}
            onChange={e => setSelectedClientId(e.target.value)}
            style={selectStyle}
          >
            <option value="all">All Users</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
          </select>

          {/* Platform filter (only when client selected) */}
          {isClientSelected && (
            <select
              value={selectedPlatform}
              onChange={e => setSelectedPlatform(e.target.value)}
              style={selectStyle}
            >
              <option value="all">All Platforms</option>
              {Object.entries(PLATFORM_META).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>
          )}

          <button
            onClick={fetchOverview}
            style={{ ...btnSecondary, padding: '8px 12px' }}
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        {Object.entries(METRIC_META).map(([key, meta]) => (
          <KPICard
            key={key}
            label={meta.label}
            value={kpiSource?.[key]}
            prev={prevSummary?.[key]}
            icon={meta.icon}
            color={meta.color}
            loading={isClientSelected ? summaryLoading : overviewLoading}
          />
        ))}
      </div>

      {/* ── Row 1: Timeseries (client) or Platform Bars (all) ─────────────── */}
      {isClientSelected ? (
        <SectionCard
          title={`Performance Over Time — ${selectedClientName}`}
          subtitle="Daily metrics for the selected period and platform"
          style={{ marginBottom: 24 }}
        >
          {/* Metric selector */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
            {Object.entries(METRIC_META).map(([key, meta]) => (
              <button
                key={key}
                onClick={() => setActiveMetric(key)}
                style={{
                  padding: '5px 14px', borderRadius: 20, border: '1.5px solid',
                  cursor: 'pointer', fontSize: 12, fontWeight: 700, transition: 'all 0.15s',
                  background:  activeMetric === key ? meta.color : '#f8fafc',
                  borderColor: activeMetric === key ? meta.color : '#e2e8f0',
                  color:       activeMetric === key ? '#fff' : '#64748b',
                }}
              >
                {meta.label}
              </button>
            ))}
          </div>

          {timeseriesLoading ? (
            <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              Loading chart…
            </div>
          ) : chartData.length === 0 ? (
            <EmptyChart message="No data for this period. Try syncing the user first." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={METRIC_META[activeMetric].color} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={METRIC_META[activeMetric].color} stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 11, fill: '#94a3b8' }} width={52} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey={activeMetric}
                  name={METRIC_META[activeMetric].label}
                  stroke={METRIC_META[activeMetric].color}
                  strokeWidth={2.5}
                  fill="url(#areaGrad)"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      ) : (
        <SectionCard
          title="Performance by Platform"
          subtitle={`Aggregated across all clients — ${range.since} to ${range.until}`}
          style={{ marginBottom: 24 }}
        >
          {overviewLoading ? (
            <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              Loading chart…
            </div>
          ) : platformData.length === 0 ? (
            <EmptyChart message="No data yet. Sync your users to see platform analytics." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={platformData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 11, fill: '#94a3b8' }} width={52} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="impressions" name="Impressions" radius={[4,4,0,0]}>
                  {platformData.map((p, i) => <Cell key={i} fill={p.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      )}

      {/* ── Row 2: Two-column ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>

        {/* Platform distribution pie */}
        <SectionCard
          title="Platform Distribution"
          subtitle={`Share of ${METRIC_META[activeMetric]?.label || 'impressions'}`}
        >
          {/* Metric pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {Object.entries(METRIC_META).map(([key, meta]) => (
              <button
                key={key}
                onClick={() => setActiveMetric(key)}
                style={{
                  padding: '3px 10px', borderRadius: 20, border: '1px solid',
                  cursor: 'pointer', fontSize: 11, fontWeight: 700,
                  background:  activeMetric === key ? meta.color : '#f8fafc',
                  borderColor: activeMetric === key ? meta.color : '#e2e8f0',
                  color:       activeMetric === key ? '#fff' : '#94a3b8',
                }}
              >
                {meta.label}
              </button>
            ))}
          </div>

          {overviewLoading || pieData.length === 0 ? (
            <EmptyChart height={200} message={overviewLoading ? 'Loading…' : 'No platform data yet.'} />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmt(v)} />
                <Legend
                  iconType="circle"
                  iconSize={9}
                  wrapperStyle={{ fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        {/* Multi-metric bar comparison */}
        <SectionCard
          title="Platform Metrics Comparison"
          subtitle="Side-by-side reach vs clicks vs video views"
        >
          {overviewLoading || platformData.length === 0 ? (
            <EmptyChart height={240} message={overviewLoading ? 'Loading…' : 'No data yet.'} />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={platformData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} width={48} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="reach"       name="Reach"       fill="#00d7ff" radius={[3,3,0,0]} />
                <Bar dataKey="clicks"      name="Clicks"      fill="#0891b2" radius={[3,3,0,0]} />
                <Bar dataKey="video_views" name="Video Views" fill="#00d7ff" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      {/* ── Row 3: Multi-metric timeseries (client) or Radar (all) ────────── */}
      {isClientSelected ? (
        <SectionCard
          title="All Metrics Over Time"
          subtitle="Impressions, reach, clicks, and video views together"
          style={{ marginBottom: 24 }}
        >
          {timeseriesLoading || chartData.length === 0 ? (
            <EmptyChart height={260} message={timeseriesLoading ? 'Loading…' : 'No timeseries data.'} />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 11, fill: '#94a3b8' }} width={52} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="impressions"  name="Impressions"  stroke="#00d7ff" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="reach"        name="Reach"        stroke="#00d7ff" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="clicks"       name="Clicks"       stroke="#0891b2" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="video_views"  name="Video Views"  stroke="#00d7ff" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      ) : (
        <SectionCard
          title="Platform Balance Radar"
          subtitle="Relative strength across all metrics per platform"
          style={{ marginBottom: 24 }}
        >
          {overviewLoading || platformData.length === 0 ? (
            <EmptyChart height={260} message={overviewLoading ? 'Loading…' : 'No data yet.'} />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart cx="50%" cy="50%" outerRadius={90} data={radarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip formatter={(v) => fmt(v)} />
                {platformData.map((p, i) => (
                  <Radar
                    key={p.platform}
                    name={p.label}
                    dataKey={p.label}
                    stroke={p.color}
                    fill={p.color}
                    fillOpacity={0.1}
                    strokeWidth={2}
                  />
                ))}
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      )}

      {/* ── Row 4: Platform breakdown table ───────────────────────────────── */}
      <SectionCard
        title="Platform Breakdown"
        subtitle="Detailed metrics per platform"
        style={{ marginBottom: 24 }}
      >
        {overviewLoading ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>Loading…</div>
        ) : platformData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>
            No platform data. Sync clients to populate analytics.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f0f4f9' }}>
                  {['Platform', 'Impressions', 'Reach', 'Clicks', 'Video Views', 'Followers', 'CTR'].map(h => (
                    <th key={h} style={{
                      padding: '10px 16px', textAlign: 'left', fontWeight: 700,
                      color: '#64748b', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {platformData.map((p, i) => {
                  const ctr = p.impressions > 0 ? ((p.clicks / p.impressions) * 100).toFixed(2) : '0.00';
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 8, display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            background: PLATFORM_META[p.platform]?.lightBg || '#e6fbff',
                            fontSize: 16,
                          }}>
                            {p.icon}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{p.label}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '13px 16px', fontWeight: 700, color: '#00d7ff' }}>{fmt(p.impressions)}</td>
                      <td style={{ padding: '13px 16px', color: '#00d7ff', fontWeight: 600 }}>{fmt(p.reach)}</td>
                      <td style={{ padding: '13px 16px' }}>{fmt(p.clicks)}</td>
                      <td style={{ padding: '13px 16px' }}>{fmt(p.video_views)}</td>
                      <td style={{ padding: '13px 16px' }}>{fmt(p.followers)}</td>
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            height: 6, width: 80, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden',
                          }}>
                            <div style={{
                              height: '100%', borderRadius: 3,
                              width: `${Math.min(parseFloat(ctr) * 20, 100)}%`,
                              background: p.color,
                            }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{ctr}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ── Row 5: Users overview table (only when "All Users") ───────── */}
      {!isClientSelected && (
        <SectionCard
          title="User Overview"
          subtitle="All active users — click a user for detailed analytics"
        >
          {clients.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>
              No clients yet. Add a client to get started.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f0f4f9' }}>
                    {['Client', 'Status', 'Created', 'Website', ''].map(h => (
                      <th key={h} style={{
                        padding: '10px 16px', textAlign: 'left', fontWeight: 700,
                        color: '#64748b', borderBottom: '1px solid #e2e8f0',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c, i) => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: 10, background: '#e6fbff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 13, fontWeight: 800, color: '#00d7ff',
                          }}>
                            {(c.company || 'C')[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{c.company}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>{c.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{
                          display: 'inline-flex', padding: '3px 10px', borderRadius: 20,
                          fontSize: 11, fontWeight: 700,
                          background: c.is_active ? '#d1fae5' : '#fee2e2',
                          color:      c.is_active ? '#059669' : '#dc2626',
                        }}>
                          {c.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '13px 16px', color: '#64748b' }}>
                        {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        {c.website ? (
                          <a href={c.website} target="_blank" rel="noreferrer"
                            style={{ color: '#00d7ff', fontSize: 12, textDecoration: 'none' }}>
                            {c.website.replace(/^https?:\/\//, '')}
                          </a>
                        ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <button
                          onClick={() => setSelectedClientId(String(c.id))}
                          style={{
                            padding: '5px 14px', borderRadius: 8, border: '1.5px solid #00d7ff',
                            background: '#fff', color: '#00d7ff', fontSize: 12, fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          View Analytics →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}

function EmptyChart({ height = 200, message }) {
  return (
    <div style={{
      height, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      color: '#94a3b8', fontSize: 13, gap: 8,
    }}>
      <div style={{ fontSize: 32 }}>📊</div>
      <div>{message}</div>
    </div>
  );
}

const selectStyle = {
  padding: '8px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0',
  background: '#fff', fontSize: 13, fontWeight: 600, color: '#0f172a',
  cursor: 'pointer', outline: 'none',
};

const btnSecondary = {
  display: 'flex', alignItems: 'center', gap: 6,
  borderRadius: 10, border: '1.5px solid #e2e8f0',
  background: '#fff', color: '#334155', fontSize: 13, fontWeight: 700,
  cursor: 'pointer',
};
