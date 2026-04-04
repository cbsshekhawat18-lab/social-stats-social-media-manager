import { useState, useRef, useEffect } from 'react';
import { Bell, CheckCheck, AlertCircle, TrendingDown, Zap, Target, Users, X } from 'lucide-react';
import { useAlerts } from '../../hooks/useData';
import { formatTimeAgo } from '../../services/formatters';

const ALERT_ICONS = {
  token_expired:      { icon: AlertCircle,  color: '#dc2626' },
  sync_failed:        { icon: AlertCircle,  color: '#ea580c' },
  reach_drop:         { icon: TrendingDown, color: '#d97706' },
  viral_post:         { icon: Zap,          color: '#7c3aed' },
  goal_at_risk:       { icon: Target,       color: '#c2410c' },
  follower_milestone: { icon: Users,         color: '#16a34a' },
};

export default function AlertBell({ clientId }) {
  const [open, setOpen] = useState(false);
  const dropRef         = useRef(null);
  const { alerts, unreadCount, markRead, markAllRead } = useAlerts(clientId);

  useEffect(() => {
    if (!open) return;
    function handle(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const recent = alerts.slice(0, 20);

  return (
    <div ref={dropRef} style={styles.wrap}>
      <button onClick={() => setOpen(o => !o)} style={styles.btn} title="Alerts">
        <Bell size={20} />
        {unreadCount > 0 && (
          <span style={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div style={styles.dropdown}>
          <div style={styles.dropHead}>
            <span style={styles.dropTitle}>Alerts</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {unreadCount > 0 && (
                <button onClick={markAllRead} style={styles.iconBtn} title="Mark all read">
                  <CheckCheck size={15} />
                </button>
              )}
              <button onClick={() => setOpen(false)} style={styles.iconBtn}>
                <X size={15} />
              </button>
            </div>
          </div>

          <div style={styles.list}>
            {recent.length === 0 ? (
              <div style={styles.empty}>No alerts yet.</div>
            ) : (
              recent.map(alert => {
                const cfg  = ALERT_ICONS[alert.alert_type] || ALERT_ICONS.sync_failed;
                const Icon = cfg.icon;
                return (
                  <div
                    key={alert.id}
                    style={{ ...styles.item, background: alert.is_read ? '#fff' : '#f0f4ff' }}
                    onClick={() => !alert.is_read && markRead(alert.id)}
                  >
                    <div style={{ ...styles.iconWrap, background: cfg.color + '20' }}>
                      <Icon size={14} style={{ color: cfg.color }} />
                    </div>
                    <div style={styles.itemBody}>
                      <div style={styles.itemMsg}>{alert.message}</div>
                      <div style={styles.itemMeta}>
                        {alert.client_name && (
                          <span style={styles.clientTag}>{alert.client_name}</span>
                        )}
                        <span style={styles.time}>{formatTimeAgo(alert.created_at, { includeSeconds: false })}</span>
                      </div>
                    </div>
                    {!alert.is_read && <div style={styles.dot} />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: { position: 'relative' },

  btn: {
    position: 'relative', background: 'none', border: '1.5px solid #e5e7eb',
    borderRadius: 10, padding: '8px 10px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', color: '#374151',
  },
  badge: {
    position: 'absolute', top: -6, right: -6,
    background: '#dc2626', color: '#fff', borderRadius: 20,
    fontSize: 10, fontWeight: 700, padding: '1px 5px', lineHeight: 1.4,
    minWidth: 18, textAlign: 'center',
  },

  dropdown: {
    position: 'absolute', top: 'calc(100% + 8px)', right: 0,
    width: 360, maxHeight: 480, background: '#fff',
    borderRadius: 14, boxShadow: '0 8px 30px rgba(0,0,0,.15)',
    border: '1px solid #e5e7eb', zIndex: 1000,
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  dropHead: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 16px', borderBottom: '1px solid #f1f5f9',
  },
  dropTitle: { fontWeight: 700, fontSize: 14, color: '#0f172a' },
  iconBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#64748b', padding: 4, borderRadius: 6,
    display: 'flex', alignItems: 'center',
  },

  list:  { overflowY: 'auto', flex: 1 },
  empty: { padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 },

  item: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    padding: '12px 16px', cursor: 'pointer',
    borderBottom: '1px solid #f8fafc', transition: 'background .15s',
  },
  iconWrap: {
    flexShrink: 0, width: 28, height: 28, borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  itemBody: { flex: 1, minWidth: 0 },
  itemMsg:  { fontSize: 13, color: '#1e293b', lineHeight: 1.4, marginBottom: 4 },
  itemMeta: { display: 'flex', alignItems: 'center', gap: 6 },
  clientTag: {
    fontSize: 11, background: '#ede9fe', color: '#6d28d9',
    borderRadius: 20, padding: '1px 7px', fontWeight: 600,
  },
  time: { fontSize: 11, color: '#94a3b8' },
  dot: {
    flexShrink: 0, width: 8, height: 8, borderRadius: '50%',
    background: '#6366f1', marginTop: 6,
  },
};
