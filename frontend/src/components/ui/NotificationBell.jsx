/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * NotificationBell — merged Alerts + Notifications in one dropdown.
 * Two tabs: Alerts (from useAlerts) and Notifications (from notificationAPI).
 * Badge shows total unread across both.
 * Notifications tab handles inline Accept/Reject for invitation_received.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, CheckCheck, X,
  AlertCircle, TrendingDown, Zap, Target, Users,
  Building2, CheckCircle, XCircle, Info, Loader2,
} from 'lucide-react';
import { useAlerts } from '../../hooks/useData';
import { notificationAPI, invitationAPI } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { formatTimeAgo } from '../../services/formatters';

const CYAN = '#00d7ff';
const DROPDOWN_WIDTH = 576;
const VIEWPORT_GUTTER = 12;

const ALERT_ICONS = {
  token_expired:      { icon: AlertCircle,  color: '#dc2626' },
  sync_failed:        { icon: AlertCircle,  color: '#ea580c' },
  reach_drop:         { icon: TrendingDown, color: '#d97706' },
  viral_post:         { icon: Zap,          color: '#7c3aed' },
  goal_at_risk:       { icon: Target,       color: '#c2410c' },
  follower_milestone: { icon: Users,        color: '#16a34a' },
};

const NOTIF_ICONS = {
  invitation_received:  { icon: Building2,   color: '#7c3aed' },
  invitation_accepted:  { icon: CheckCircle, color: '#16a34a' },
  invitation_rejected:  { icon: XCircle,     color: '#dc2626' },
  invitation_cancelled: { icon: XCircle,     color: '#94a3b8' },
  system:               { icon: Info,        color: '#3b82f6' },
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationBell({ clientId }) {
  const { refreshAuth } = useAuth();
  const navigate        = useNavigate();
  const dropRef         = useRef(null);
  const btnRef          = useRef(null);

  const [open, setOpen]   = useState(false);
  const [tab, setTab]     = useState('notifs'); // 'alerts' | 'notifs'
  const [dropPos, setDropPos] = useState({ top: 0, left: VIEWPORT_GUTTER, width: DROPDOWN_WIDTH });

  // ── Alerts ──────────────────────────────────────────────────────────────────
  const { alerts, unreadCount: alertUnread, markRead: markAlertRead, markAllRead: markAllAlerts } = useAlerts(clientId);

  // ── Notifications ────────────────────────────────────────────────────────────
  const [notifs, setNotifs]         = useState([]);
  const [responding, setResponding] = useState(null);

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await notificationAPI.list();
      setNotifs(res.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchNotifs();
    const id = setInterval(fetchNotifs, 30000);
    return () => clearInterval(id);
  }, [fetchNotifs]);

  const notifUnread  = notifs.filter(n => !n.is_read).length;
  const totalUnread  = alertUnread + notifUnread;

  // ── Close on outside click ───────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    function handle(e) {
      const inBtn  = btnRef.current  && btnRef.current.contains(e.target);
      const inDrop = dropRef.current && dropRef.current.contains(e.target);
      if (!inBtn && !inDrop) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  // ── Notification actions ─────────────────────────────────────────────────────
  const markNotifRead = async (id) => {
    await notificationAPI.markRead(id);
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllNotifs = async () => {
    await notificationAPI.markAll();
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleRespond = async (notif, action) => {
    const token = notif.data?.token;
    if (!token) return;
    setResponding(notif.id + action);
    try {
      const res = await invitationAPI.respond(token, action);
      if (action === 'accept') {
        await refreshAuth(res.data.access, res.data.refresh);
        setOpen(false);
        navigate('/dashboard', { replace: true });
      }
      markNotifRead(notif.id);
      fetchNotifs();
    } catch { /* ignore */ }
    finally { setResponding(null); }
  };

  const recentAlerts = alerts.slice(0, 20);
  const recentNotifs = notifs.slice(0, 20);

  const positionDropdown = useCallback(() => {
    if (!btnRef.current) return;

    const rect = btnRef.current.getBoundingClientRect();
    const width = Math.min(DROPDOWN_WIDTH, window.innerWidth - (VIEWPORT_GUTTER * 2));
    const preferredLeft = rect.right - width + 8;
    const left = Math.max(VIEWPORT_GUTTER, Math.min(preferredLeft, window.innerWidth - width - VIEWPORT_GUTTER));

    setDropPos({
      top: rect.bottom + 14,
      left,
      width,
    });
  }, []);

  const handleToggle = () => {
    if (!open) positionDropdown();
    setOpen(o => !o);
  };

  useEffect(() => {
    if (!open) return undefined;

    const handleResize = () => positionDropdown();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, [open, positionDropdown]);

  return (
    <div ref={dropRef} style={s.wrap}>
      <button ref={btnRef} onClick={handleToggle} style={s.btn} title="Notifications & Alerts">
        <Bell size={20} />
        {totalUnread > 0 && (
          <span style={s.badge}>{totalUnread > 99 ? '99+' : totalUnread}</span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown" style={{ ...s.dropdown, position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width }}>
          {/* Header */}
          <div style={s.dropHead}>
            <span style={s.dropTitle}>Notifications</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {tab === 'alerts' && alertUnread > 0 && (
                <button onClick={markAllAlerts} style={s.iconBtn} title="Mark all read">
                  <CheckCheck size={15} />
                </button>
              )}
              {tab === 'notifs' && notifUnread > 0 && (
                <button onClick={markAllNotifs} style={s.iconBtn} title="Mark all read">
                  <CheckCheck size={15} />
                </button>
              )}
              <button onClick={() => setOpen(false)} style={s.iconBtn}>
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={s.tabs}>
            <button
              style={{ ...s.tabBtn, ...(tab === 'alerts' ? s.tabActive : {}) }}
              onClick={() => setTab('alerts')}
            >
              Alerts
              {alertUnread > 0 && <span style={s.tabBadge}>{alertUnread}</span>}
            </button>
            <button
              style={{ ...s.tabBtn, ...(tab === 'notifs' ? s.tabActive : {}) }}
              onClick={() => setTab('notifs')}
            >
              Notifications
              {notifUnread > 0 && <span style={s.tabBadge}>{notifUnread}</span>}
            </button>
          </div>

          {/* Content */}
          <div style={s.list}>
            {tab === 'alerts' && (
              recentAlerts.length === 0
                ? <div style={s.empty}>No alerts yet.</div>
                : recentAlerts.map(alert => {
                    const cfg  = ALERT_ICONS[alert.alert_type] || ALERT_ICONS.sync_failed;
                    const Icon = cfg.icon;
                    return (
                  <div
                        key={alert.id}
                        style={{ ...s.item, ...(alert.is_read ? {} : s.itemUnread) }}
                        onClick={() => !alert.is_read && markAlertRead(alert.id)}
                      >
                        <div style={{ ...s.iconWrap, background: cfg.color + '20' }}>
                          <Icon size={14} style={{ color: cfg.color }} />
                        </div>
                        <div style={s.itemBody}>
                          <div style={s.itemMsg}>{alert.message}</div>
                          <div style={s.itemMeta}>
                            {alert.client_name && (
                              <span style={s.clientTag}>{alert.client_name}</span>
                            )}
                            <span style={s.time}>{formatTimeAgo(alert.created_at, { includeSeconds: false })}</span>
                          </div>
                        </div>
                        {!alert.is_read && <div style={s.dot} />}
                      </div>
                    );
                  })
            )}

            {tab === 'notifs' && (
              recentNotifs.length === 0
                ? <div style={s.empty}>No notifications yet.</div>
                : recentNotifs.map(n => {
                    const cfg  = NOTIF_ICONS[n.notif_type] || NOTIF_ICONS.system;
                    const Icon = cfg.icon;
                    const isInvite = n.notif_type === 'invitation_received';
                    return (
                      <div
                        key={n.id}
                        style={{ ...s.item, ...(n.is_read ? {} : s.itemUnread) }}
                        onClick={() => !n.is_read && markNotifRead(n.id)}
                      >
                        <div style={{ ...s.iconWrap, background: cfg.color + '18' }}>
                          <Icon size={14} style={{ color: cfg.color }} />
                        </div>
                        <div style={s.itemBody}>
                          <div style={s.itemTitle}>{n.title}</div>
                          {n.body && <div style={s.itemBodyText}>{n.body}</div>}
                          <div style={s.itemMeta}>
                            <span style={s.time}>{timeAgo(n.created_at)}</span>
                          </div>
                          {isInvite && n.data?.token && !n.is_read && (
                            <div style={s.invActions}>
                              <button
                                style={s.acceptBtn}
                                disabled={!!responding}
                                onClick={e => { e.stopPropagation(); handleRespond(n, 'accept'); }}
                              >
                                {responding === n.id + 'accept'
                                  ? <Loader2 size={11} style={{ animation: 'spin .8s linear infinite' }} />
                                  : <CheckCircle size={11} />
                                }
                                Accept
                              </button>
                              <button
                                style={s.rejectBtn}
                                disabled={!!responding}
                                onClick={e => { e.stopPropagation(); handleRespond(n, 'reject'); }}
                              >
                                {responding === n.id + 'reject'
                                  ? <Loader2 size={11} style={{ animation: 'spin .8s linear infinite' }} />
                                  : <XCircle size={11} />
                                }
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                        {!n.is_read && <div style={{ ...s.dot, background: CYAN }} />}
                      </div>
                    );
                  })
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const s = {
  wrap:  { position: 'relative' },
  btn: {
    position: 'relative',
    background: 'rgba(255,255,255,.76)',
    border: '1px solid rgba(203,213,225,.82)',
    borderRadius: 18,
    width: 70,
    height: 58,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#374151',
    boxShadow: '0 10px 24px rgba(148,163,184,.12)',
    backdropFilter: 'blur(10px)',
  },
  badge: {
    position: 'absolute', top: -8, right: -8,
    background: '#dc2626', color: '#fff', borderRadius: 20,
    fontSize: 11, fontWeight: 800, padding: '2px 7px', lineHeight: 1.35,
    minWidth: 28, textAlign: 'center', border: '3px solid #f8fafc',
  },
  dropdown: {
    maxHeight: 'min(620px, calc(100vh - 100px))',
    background: 'rgba(255,255,255,.96)',
    borderRadius: 24,
    boxShadow: '0 28px 60px rgba(15,23,42,.18)',
    border: '1px solid rgba(226,232,240,.95)',
    zIndex: 99999,
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  dropHead: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '24px 26px 16px', borderBottom: '1px solid #e8eef5',
  },
  dropTitle: { fontWeight: 800, fontSize: 22, color: '#0f172a', letterSpacing: '-0.03em' },
  iconBtn: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: '#64748b', padding: 8, borderRadius: 12,
    display: 'flex', alignItems: 'center',
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #e8eef5',
    padding: '0 22px',
    gap: 8,
  },
  tabBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '16px 10px 15px',
    fontSize: 17,
    fontWeight: 700,
    color: '#64748b',
    background: 'none',
    border: 'none',
    borderBottom: '3px solid transparent',
    cursor: 'pointer',
    marginBottom: -1, transition: 'color .15s',
  },
  tabActive: {
    color: '#0f172a', borderBottomColor: CYAN,
  },
  tabBadge: {
    background: '#ef4444', color: '#fff',
    fontSize: 12, fontWeight: 800, borderRadius: 999,
    padding: '2px 7px', lineHeight: 1.4,
  },
  list:    { overflowY: 'auto', flex: 1 },
  empty:   { padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 },
  item: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
    padding: '18px 26px',
    cursor: 'pointer',
    borderBottom: '1px solid #eef4f8',
    transition: 'background .15s',
  },
  itemUnread: {
    background: 'linear-gradient(180deg, #eff7ff 0%, #f7fbff 100%)',
  },
  iconWrap: {
    flexShrink: 0, width: 44, height: 44, borderRadius: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  itemBody: { flex: 1, minWidth: 0 },
  itemMsg:  { fontSize: 15, color: '#1e293b', lineHeight: 1.4, marginBottom: 4 },
  itemTitle: {
    fontSize: 16,
    color: '#334155',
    lineHeight: 1.35,
    fontWeight: 500,
    marginBottom: 6,
  },
  itemBodyText: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 1.45,
    marginBottom: 6,
  },
  itemMeta: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  clientTag: {
    fontSize: 11, background: '#ede9fe', color: '#6d28d9',
    borderRadius: 20, padding: '3px 9px', fontWeight: 700,
  },
  time: { fontSize: 13, color: '#94a3b8' },
  dot: {
    flexShrink: 0, width: 12, height: 12, borderRadius: '50%',
    background: '#6366f1', marginTop: 10,
  },
  invActions: { display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  acceptBtn: {
    display: 'flex', alignItems: 'center', gap: 4,
    background: '#dcfce7', color: '#166534', border: '1px solid #86efac',
    borderRadius: 10, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
  },
  rejectBtn: {
    display: 'flex', alignItems: 'center', gap: 4,
    background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5',
    borderRadius: 10, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
  },
};
