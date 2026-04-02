import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { PLATFORMS } from '../../services/platforms';

// Aggregate timeseries by date across platforms
function aggregateByDate(data, platform) {
  const map = {};
  const filtered = platform && platform !== 'all'
    ? data.filter(d => d.platform === platform)
    : data;

  filtered.forEach(d => {
    if (!map[d.date]) map[d.date] = { date: d.date };
    ['impressions','reach','clicks','likes','video_views','followers'].forEach(k => {
      map[d.date][k] = (map[d.date][k] || 0) + (d[k] || 0);
    });
  });

  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
}

function fmtDate(str) {
  try { return format(parseISO(str), 'MMM d'); } catch { return str; }
}

// ── Impressions + Reach Line Chart ──────────────────────────────────────────
export function ImpressionsChart({ data, platform }) {
  const rows = aggregateByDate(data, platform);
  return (
    <ChartCard title="Impressions & Reach" accent="#6366f1">
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={rows} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            labelFormatter={fmtDate}
            formatter={(v) => v.toLocaleString()}
          />
          <Legend />
          <Line type="monotone" dataKey="impressions" stroke="#6366f1" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="reach"       stroke="#22c55e" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ── Engagement Bar Chart ─────────────────────────────────────────────────────
export function EngagementChart({ data, platform }) {
  const rows = aggregateByDate(data, platform);
  return (
    <ChartCard title="Clicks & Likes" accent="#2563eb">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={rows} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip labelFormatter={fmtDate} formatter={(v) => v.toLocaleString()} />
          <Legend />
          <Bar dataKey="clicks" fill="#2563eb" radius={[3,3,0,0]} />
          <Bar dataKey="likes"  fill="#f59e0b" radius={[3,3,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ── Video Views Line Chart ───────────────────────────────────────────────────
export function VideoViewsChart({ data, platform }) {
  const rows = aggregateByDate(data, platform);
  return (
    <ChartCard title="Video Views" accent="#ef4444">
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={rows} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip labelFormatter={fmtDate} formatter={(v) => v.toLocaleString()} />
          <Line type="monotone" dataKey="video_views" stroke="#ef4444" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ── Platform comparison Bar Chart ────────────────────────────────────────────
export function PlatformCompareChart({ byPlatform }) {
  const data = byPlatform.map(p => ({
    name:        PLATFORMS[p.platform]?.label || p.platform,
    impressions: p.impressions || 0,
    clicks:      p.clicks      || 0,
    likes:       p.likes       || 0,
  }));

  return (
    <ChartCard title="Platform Comparison" accent="#f59e0b">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => v.toLocaleString()} />
          <Legend />
          <Bar dataKey="impressions" fill="#6366f1" radius={[3,3,0,0]} />
          <Bar dataKey="clicks"      fill="#2563eb" radius={[3,3,0,0]} />
          <Bar dataKey="likes"       fill="#f59e0b" radius={[3,3,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ── Wrapper ──────────────────────────────────────────────────────────────────
function ChartCard({ title, accent = '#6366f1', children }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <span style={{ ...styles.accentBar, background: accent }} />
        <h3 style={styles.title}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

const styles = {
  card: {
    background: '#fff',
    borderRadius: 16,
    padding: '20px 18px 18px',
    boxShadow: '0 1px 4px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)',
    border: '1px solid #f1f5f9',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  accentBar: {
    width: 4,
    height: 18,
    borderRadius: 999,
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: 14,
    fontWeight: 700,
    color: '#0f172a',
    letterSpacing: '-0.01em',
  },
};
