import { useState, useEffect, useCallback } from 'react';
import { alertsAPI } from '../services/api';
import { AlertCircle, CheckCircle, RefreshCw, Bell, BellOff, ChevronDown } from 'lucide-react';

const ALERT_TYPE_META = {
  token_expired:      { label: 'Token Expired',        color: '#dc2626', bg: '#fef2f2', icon: '🔑' },
  sync_failed:        { label: 'Sync Failed',           color: '#ea580c', bg: '#fff7ed', icon: '⚠️' },
  reach_drop:         { label: 'Reach Drop',            color: '#d97706', bg: '#fffbeb', icon: '📉' },
  viral_post:         { label: 'Viral Post',            color: '#059669', bg: '#f0fdf4', icon: '🚀' },
  goal_at_risk:       { label: 'Goal At Risk',          color: '#9333ea', bg: '#faf5ff', icon: '🎯' },
  follower_milestone: { label: 'Follower Milestone',    color: '#2563eb', bg: '#eff6ff', icon: '🎉' },
};

const PLATFORM_ICONS = {
  facebook: '📘', instagram: '📸', youtube: '▶️', linkedin: '💼',
  google_my_business: '🏢',
};

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)     return `${diff}s ago`;
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function AlertsPage() {
  const [alerts, setAlerts]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [filterRead, setFilterRead] = useState('unread');
  const [marking, setMarking]       = useState(false);

  const fetchAlerts = useCallback(() => {
    setLoading(true);
    const params = {};
    if (filterRead === 'unread') params.is_read = false;
    if (filterRead === 'read')   params.is_read = true;
    alertsAPI.list(params)
      .then(res => setAlerts(res.data?.results || res.data || []))
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false));
  }, [filterRead]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const filtered = filterType === 'all'
    ? alerts
    : alerts.filter(a => a.alert_type === filterType);

  const unreadCount = alerts.filter(a => !a.is_read).length;

  async function handleMarkRead(id) {
    await alertsAPI.markRead(id);
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a));
  }

  async function handleMarkAllRead() {
    setMarking(true);
    await alertsAPI.markAllRead({});
    setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
    setMarking(false);
  }

  const typeCounts = alerts.reduce((acc, a) => {
    acc[a.alert_type] = (acc[a.alert_type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ padding: '32px 36px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>
            Alerts
          </h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>
            {unreadCount > 0
              ? `${unreadCount} unread alert${unreadCount > 1 ? 's' : ''} across all users`
              : 'All caught up — no unread alerts'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={fetchAlerts} style={btnSecondary}>
            <RefreshCw size={14} />
            Refresh
          </button>
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead} disabled={marking} style={btnPrimary}>
              <CheckCircle size={14} />
              {marking ? 'Marking…' : 'Mark All Read'}
            </button>
          )}
        </div>
      </div>

      {/* Summary chips */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
        {Object.entries(ALERT_TYPE_META).map(([type, meta]) => {
          const count = typeCounts[type] || 0;
          if (!count) return null;
          return (
            <button
              key={type}
              onClick={() => setFilterType(prev => prev === type ? 'all' : type)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 20, border: '1.5px solid',
                cursor: 'pointer', fontSize: 12, fontWeight: 700, transition: 'all 0.15s',
                background:   filterType === type ? meta.color : meta.bg,
                borderColor:  meta.color,
                color:        filterType === type ? '#fff' : meta.color,
              }}
            >
              <span>{meta.icon}</span>
              {meta.label}
              <span style={{
                background: filterType === type ? 'rgba(255,255,255,0.25)' : meta.color,
                color: filterType === type ? '#fff' : '#fff',
                borderRadius: 999, padding: '1px 7px', fontSize: 11,
              }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Read filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['unread', 'read', 'all'].map(f => (
          <button
            key={f}
            onClick={() => setFilterRead(f)}
            style={{
              padding: '6px 16px', borderRadius: 8, border: '1.5px solid',
              cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
              background:  filterRead === f ? '#0f172a' : '#fff',
              borderColor: filterRead === f ? '#0f172a' : '#e2e8f0',
              color:       filterRead === f ? '#fff'    : '#64748b',
            }}
          >
            {f === 'unread' ? <><Bell size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />Unread</> :
             f === 'read'   ? <><BellOff size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />Read</> :
             'All'}
          </button>
        ))}
      </div>

      {/* Alert list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8', fontSize: 15 }}>
          Loading alerts…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 0', background: '#fff',
          borderRadius: 16, border: '1px solid #e2e8f0',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 16 }}>No alerts here</div>
          <div style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>
            {filterRead === 'unread' ? 'All alerts have been read.' : 'Nothing to show.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(alert => {
            const meta = ALERT_TYPE_META[alert.alert_type] || {
              label: alert.alert_type, color: '#6366f1', bg: '#f0f4ff', icon: '📢',
            };
            return (
              <div
                key={alert.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 16,
                  background: alert.is_read ? '#fff' : meta.bg,
                  border: `1.5px solid ${alert.is_read ? '#e2e8f0' : meta.color}22`,
                  borderLeft: `4px solid ${alert.is_read ? '#e2e8f0' : meta.color}`,
                  borderRadius: 12, padding: '16px 20px',
                  transition: 'all 0.2s',
                  opacity: alert.is_read ? 0.72 : 1,
                }}
              >
                {/* Icon */}
                <div style={{
                  fontSize: 22, lineHeight: 1, marginTop: 2, flexShrink: 0,
                }}>
                  {meta.icon}
                </div>

                {/* Body */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 800, padding: '2px 9px', borderRadius: 20,
                      background: meta.bg, color: meta.color, border: `1px solid ${meta.color}44`,
                    }}>
                      {meta.label}
                    </span>
                    {alert.platform && (
                      <span style={{ fontSize: 12, color: '#64748b' }}>
                        {PLATFORM_ICONS[alert.platform] || '📱'} {alert.platform}
                      </span>
                    )}
                    {!alert.is_read && (
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: meta.color, display: 'inline-block',
                      }} />
                    )}
                  </div>

                  <div style={{ fontSize: 14, color: '#0f172a', fontWeight: alert.is_read ? 400 : 600, marginBottom: 6 }}>
                    {alert.message}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: '#94a3b8' }}>
                    <span>🏢 {alert.client_name}</span>
                    <span>🕐 {timeAgo(alert.created_at)}</span>
                  </div>
                </div>

                {/* Mark read */}
                {!alert.is_read && (
                  <button
                    onClick={() => handleMarkRead(alert.id)}
                    title="Mark as read"
                    style={{
                      flexShrink: 0, background: 'none', border: '1.5px solid #e2e8f0',
                      borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
                      fontSize: 12, fontWeight: 600, color: '#64748b',
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}
                  >
                    <CheckCircle size={13} />
                    Read
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const btnSecondary = {
  display: 'flex', alignItems: 'center', gap: 7,
  padding: '8px 16px', borderRadius: 10, border: '1.5px solid #e2e8f0',
  background: '#fff', color: '#334155', fontSize: 13, fontWeight: 700,
  cursor: 'pointer',
};

const btnPrimary = {
  display: 'flex', alignItems: 'center', gap: 7,
  padding: '8px 16px', borderRadius: 10, border: 'none',
  background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 700,
  cursor: 'pointer',
};
