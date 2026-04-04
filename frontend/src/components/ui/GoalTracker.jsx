import { useGoalProgress } from '../../hooks/useData';
import { PLATFORMS } from '../../services/platforms';
import { Target } from 'lucide-react';
import SocialPlatformIcon from './SocialPlatformIcon';

const METRIC_LABELS = {
  impressions:    'Impressions',
  reach:          'Reach',
  clicks:         'Clicks',
  likes:          'Likes',
  followers:      'Followers',
  video_views:    'Video Views',
  website_clicks: 'Website Clicks',
  phone_calls:    'Phone Calls',
};

const STATUS_STYLES = {
  completed: { bg: '#dcfce7', color: '#16a34a', label: 'Completed' },
  on_track:  { bg: '#dbeafe', color: '#2563eb', label: 'On Track'  },
  at_risk:   { bg: '#fef3c7', color: '#d97706', label: 'At Risk'   },
  missed:    { bg: '#fee2e2', color: '#dc2626', label: 'Missed'    },
};

function barColor(pct, status) {
  if (status === 'completed') return '#16a34a';
  if (pct >= 80) return '#22c55e';
  if (pct >= 50) return '#f59e0b';
  return '#ef4444';
}

function fmt(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function GoalTracker({ clientId, month, year }) {
  const { progress, loading } = useGoalProgress(clientId, month, year);

  if (loading) return null;
  if (!progress.length) return null;

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <Target size={18} style={{ color: '#6366f1' }} />
        <h3 style={styles.title}>
          Monthly Goals — {MONTH_NAMES[month - 1]} {year}
        </h3>
      </div>

      <div style={styles.grid}>
        {progress.map(g => {
          const pct      = Math.min(g.percentage, 100);
          const st       = STATUS_STYLES[g.status] || STATUS_STYLES.at_risk;
          const platform = PLATFORMS[g.platform];

          return (
            <div key={g.id} style={styles.card}>
              <div style={styles.cardTop}>
                <div style={styles.meta}>
                  <span style={styles.platformLabel}>
                    {platform ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <SocialPlatformIcon platform={g.platform} size={14} />
                        {platform.label}
                      </span>
                    ) : 'All Platforms'}
                  </span>
                  <span style={styles.metricLabel}>{METRIC_LABELS[g.metric] || g.metric}</span>
                </div>
                <span style={{ ...styles.badge, background: st.bg, color: st.color }}>
                  {st.label}
                </span>
              </div>

              <div style={styles.barTrack}>
                <div
                  style={{
                    ...styles.barFill,
                    width: `${pct}%`,
                    background: barColor(pct, g.status),
                  }}
                />
              </div>

              <div style={styles.values}>
                <span style={styles.current}>{fmt(g.current_value)}</span>
                <span style={styles.pct}>{g.percentage}%</span>
                <span style={styles.target}>of {fmt(g.target_value)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    background: '#fff', borderRadius: 14, padding: 24,
    boxShadow: '0 1px 6px rgba(0,0,0,.07)', marginBottom: 24,
  },
  header: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 },
  title:  { margin: 0, fontSize: 15, fontWeight: 700, color: '#1e293b' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: 14,
  },
  card: {
    background: '#f8fafc', borderRadius: 10, padding: '14px 16px',
    border: '1px solid #e5e7eb',
  },
  cardTop: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 10,
  },
  meta:          { display: 'flex', flexDirection: 'column', gap: 2 },
  platformLabel: { fontSize: 12, color: '#64748b', fontWeight: 500 },
  metricLabel:   { fontSize: 14, fontWeight: 700, color: '#0f172a' },
  badge: {
    fontSize: 10, fontWeight: 700, padding: '2px 8px',
    borderRadius: 20, whiteSpace: 'nowrap',
  },
  barTrack: {
    height: 8, background: '#e5e7eb', borderRadius: 4,
    overflow: 'hidden', marginBottom: 8,
  },
  barFill: {
    height: '100%', borderRadius: 4,
    transition: 'width 0.4s ease',
  },
  values: {
    display: 'flex', alignItems: 'baseline', gap: 4, fontSize: 12,
  },
  current: { fontWeight: 700, fontSize: 15, color: '#0f172a' },
  pct:     { color: '#64748b', fontSize: 11 },
  target:  { color: '#94a3b8', fontSize: 11, marginLeft: 'auto' },
};
