import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOverview, useDateRange, useClients, useGoals, useAlerts } from '../hooks/useData';
import DateRangePicker from '../components/ui/DateRangePicker';
import StatCard from '../components/ui/StatCard';
import { PLATFORMS, fmt } from '../services/platforms';
import { Users, Eye, MousePointer2, TrendingUp, Target, Plus, Trash2, ChevronDown, ChevronUp, Bell, CheckCheck, AlertCircle, TrendingDown, Zap, Trophy, ExternalLink, Play, Link2, Copy, Lock } from 'lucide-react';
import { goalsAPI, topPostsAPI, sharedReportsAPI, roiAPI } from '../services/api';
import PageHeader from '../components/layout/PageHeader';

const METRICS = [
  { value: 'impressions',    label: 'Impressions' },
  { value: 'reach',          label: 'Reach' },
  { value: 'clicks',         label: 'Clicks' },
  { value: 'likes',          label: 'Likes' },
  { value: 'followers',      label: 'Followers' },
  { value: 'video_views',    label: 'Video Views' },
  { value: 'website_clicks', label: 'Website Clicks' },
  { value: 'phone_calls',    label: 'Phone Calls' },
];

const PLATFORM_OPTIONS = [
  { value: 'all',               label: 'All Platforms' },
  { value: 'facebook',          label: '📘 Facebook' },
  { value: 'instagram',         label: '📸 Instagram' },
  { value: 'youtube',           label: '▶️ YouTube' },
  { value: 'linkedin',          label: '💼 LinkedIn' },
  { value: 'google_my_business',label: '🏢 Google My Business' },
];

const now = new Date();

function GoalManager() {
  const { clients }           = useClients();
  const [open, setOpen]       = useState(false);
  const [form, setForm]       = useState({
    client: '', platform: 'all', metric: 'impressions',
    target_value: '', month: now.getMonth() + 1, year: now.getFullYear(),
  });
  const [errors, setErrors]   = useState({});
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState('');

  // List goals for the selected month/year + client
  const goalParams = {
    month: form.month,
    year:  form.year,
    ...(form.client ? { client: form.client } : {}),
  };
  const { goals, refetch } = useGoals(goalParams);

  const handleFieldChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validateGoalForm = () => {
    const nextErrors = {};
    if (!form.client) nextErrors.client = 'Select a user.';
    if (!String(form.target_value).trim()) nextErrors.target_value = 'Target value is required.';
    else if (Number(form.target_value) < 1) nextErrors.target_value = 'Target value must be at least 1.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!validateGoalForm()) {
      setMsg('❌ Please fix the highlighted fields.');
      return;
    }
    setSaving(true); setMsg('');
    try {
      await goalsAPI.create({
        client:       parseInt(form.client),
        platform:     form.platform,
        metric:       form.metric,
        target_value: parseInt(form.target_value),
        month:        parseInt(form.month),
        year:         parseInt(form.year),
      });
      setMsg('✅ Goal saved.');
      setForm(f => ({ ...f, target_value: '' }));
      setErrors({});
      refetch();
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.non_field_errors?.[0] || err.response?.data?.error || 'Failed to save goal'));
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this goal?')) return;
    try {
      await goalsAPI.delete(id);
      refetch();
    } catch { /* ignore */ }
  };

  return (
    <div style={styles.tableWrap}>
      <div style={styles.goalHeader} onClick={() => setOpen(o => !o)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Target size={16} style={{ color: '#00d7ff' }} />
          <h3 style={styles.tableTitle}>Set Monthly Goals</h3>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>

      {open && (
        <>
          <form onSubmit={handleCreate} style={styles.goalForm}>
            <div style={styles.goalField}>
              <label style={styles.goalLabel}>User <span style={styles.requiredAsterisk}>*</span></label>
              <select value={form.client} onChange={e => handleFieldChange('client', e.target.value)} style={{ ...styles.sel, ...(errors.client ? styles.inputError : {}) }}>
                <option value="">Select user</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
              </select>
              {errors.client && <div style={styles.goalError}>{errors.client}</div>}
            </div>

            <div style={styles.goalField}>
              <label style={styles.goalLabel}>Platform</label>
              <select value={form.platform} onChange={e => handleFieldChange('platform', e.target.value)} style={styles.sel}>
                {PLATFORM_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>

            <div style={styles.goalField}>
              <label style={styles.goalLabel}>Metric</label>
              <select value={form.metric} onChange={e => handleFieldChange('metric', e.target.value)} style={styles.sel}>
                {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>

            <div style={styles.goalField}>
              <label style={styles.goalLabel}>Target Value <span style={styles.requiredAsterisk}>*</span></label>
              <input
                type="number" min="1" placeholder="Enter target"
                value={form.target_value}
                onChange={e => handleFieldChange('target_value', e.target.value)}
                style={{ ...styles.inp, ...(errors.target_value ? styles.inputError : {}) }}
              />
              {errors.target_value && <div style={styles.goalError}>{errors.target_value}</div>}
            </div>

            <div style={styles.goalField}>
              <label style={styles.goalLabel}>Month</label>
              <select value={form.month} onChange={e => handleFieldChange('month', e.target.value)} style={styles.sel}>
                {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                  <option key={i+1} value={i+1}>{m}</option>
                ))}
              </select>
            </div>

            <div style={{ ...styles.goalField, maxWidth: 100 }}>
              <label style={styles.goalLabel}>Year</label>
              <input
                type="number" min="2024" max="2030"
                value={form.year}
                onChange={e => handleFieldChange('year', e.target.value)}
                style={styles.inp}
              />
            </div>

            <button type="submit" disabled={saving} style={styles.addGoalBtn}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Plus size={14} />{saving ? 'Saving…' : 'Add Goal'}
              </span>
            </button>
          </form>

          {msg && <div style={msg.startsWith('✅') ? styles.inlineSuccess : styles.inlineError}>{msg}</div>}

          {goals.length > 0 && (
            <table style={styles.table}>
              <thead>
                <tr>
                  {['User','Platform','Metric','Target','Month/Year',''].map(h => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {goals.map(g => (
                  <tr key={g.id} style={styles.tr}>
                    <td style={styles.td}>{g.client_name}</td>
                    <td style={styles.td}>{PLATFORM_OPTIONS.find(p => p.value === g.platform)?.label || g.platform}</td>
                    <td style={styles.td}>{METRICS.find(m => m.value === g.metric)?.label || g.metric}</td>
                    <td style={{ ...styles.td, fontWeight: 600 }}>{g.target_value.toLocaleString()}</td>
                    <td style={styles.td}>{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][g.month-1]} {g.year}</td>
                    <td style={styles.td}>
                      <button onClick={() => handleDelete(g.id)} style={styles.delBtn}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {goals.length === 0 && (
            <p style={{ color: '#94a3b8', fontSize: 13, margin: '8px 0 0' }}>
              No goals set for this period{form.client ? '' : ' — select a user to filter'}.
            </p>
          )}
        </>
      )}
    </div>
  );
}

const ALERT_ICONS = {
  token_expired:      { icon: AlertCircle,  color: '#dc2626' },
  sync_failed:        { icon: AlertCircle,  color: '#ea580c' },
  reach_drop:         { icon: TrendingDown, color: '#d97706' },
  viral_post:         { icon: Zap,          color: '#00d7ff' },
  goal_at_risk:       { icon: Target,       color: '#c2410c' },
  follower_milestone: { icon: Users,         color: '#16a34a' },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function AlertsPanel() {
  const [open, setOpen] = useState(true);
  const { alerts, unreadCount, markRead, markAllRead } = useAlerts();

  return (
    <div style={styles.tableWrap}>
      <div style={styles.goalHeader} onClick={() => setOpen(o => !o)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bell size={16} style={{ color: '#00d7ff' }} />
          <h3 style={styles.tableTitle}>Smart Alerts</h3>
          {unreadCount > 0 && (
            <span style={alertBadgeStyle}>{unreadCount} unread</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {unreadCount > 0 && open && (
            <button
              onClick={e => { e.stopPropagation(); markAllRead(); }}
              style={styles.markAllBtn}
            >
              <CheckCheck size={13} /> Mark all read
            </button>
          )}
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {open && (
        <div>
          {alerts.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: 13, margin: '12px 0 0' }}>No alerts yet.</p>
          ) : (
            <div style={{ marginTop: 12 }}>
              {alerts.slice(0, 30).map(alert => {
                const cfg  = ALERT_ICONS[alert.alert_type] || ALERT_ICONS.sync_failed;
                const Icon = cfg.icon;
                return (
                  <div
                    key={alert.id}
                    style={{ ...alertItemStyle, background: alert.is_read ? '#fff' : '#e6fbff' }}
                    onClick={() => !alert.is_read && markRead(alert.id)}
                  >
                    <div style={{ ...alertIconWrap, background: cfg.color + '20' }}>
                      <Icon size={14} style={{ color: cfg.color }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: '#1e293b', marginBottom: 3 }}>
                        {alert.message}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {alert.client_name && (
                          <span style={alertClientTag}>{alert.client_name}</span>
                        )}
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>
                          {timeAgo(alert.created_at)}
                        </span>
                      </div>
                    </div>
                    {!alert.is_read && (
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00d7ff', flexShrink: 0, marginTop: 4 }} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const alertBadgeStyle = {
  fontSize: 11, background: '#fee2e2', color: '#dc2626',
  borderRadius: 20, padding: '2px 8px', fontWeight: 700,
};
const alertItemStyle = {
  display: 'flex', alignItems: 'flex-start', gap: 10,
  padding: '10px 4px', borderBottom: '1px solid #f8fafc', cursor: 'pointer',
};
const alertIconWrap = {
  flexShrink: 0, width: 28, height: 28, borderRadius: 8,
  display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2,
};
const alertClientTag = {
  fontSize: 11, background: '#e6fbff', color: '#6d28d9',
  borderRadius: 20, padding: '1px 7px', fontWeight: 600,
};

function TopPostsPanel() {
  const [posts, setPosts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen]     = useState(true);

  useEffect(() => {
    topPostsAPI.list({})
      .then(res => setPosts(res.data.results || res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleRun = async () => {
    setLoading(true);
    try {
      await topPostsAPI.run();
      const res = await topPostsAPI.list({});
      setPosts(res.data.results || res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  return (
    <div style={styles.tableWrap}>
      <div style={styles.goalHeader} onClick={() => setOpen(o => !o)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Trophy size={16} style={{ color: '#d97706' }} />
          <h3 style={styles.tableTitle}>Best Post of the Week — All Users</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={e => { e.stopPropagation(); handleRun(); }}
            style={styles.markAllBtn}
          >
            Re-score now
          </button>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {open && (
        loading ? (
          <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 12 }}>Loading…</p>
        ) : posts.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 12 }}>
            No top posts yet — posts are scored every Monday at 8am, or click "Re-score now".
          </p>
        ) : (
          <table style={{ ...styles.table, marginTop: 12 }}>
            <thead>
              <tr>
                {['User','Platform','Post','Score','vs Avg','Date',''].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {posts.map(entry => {
                const post = entry.post;
                const p    = PLATFORMS[entry.platform] || {};
                const vsPct = entry.avg_score > 0
                  ? Math.round(((entry.score - entry.avg_score) / entry.avg_score) * 100)
                  : null;
                const caption = post?.caption?.slice(0, 55) || post?.post_type || '—';
                const hasThumbnail = !!post?.thumbnail_url;
                const isVideo = post?.video_views > 0 || post?.post_type?.includes('video');
                return (
                  <tr key={entry.id} style={styles.tr}>
                    <td style={{ ...styles.td, fontWeight: 600 }}>{entry.client_name}</td>
                    <td style={{ ...styles.td, color: p.color }}>
                      {p.icon} {p.label || entry.platform}
                    </td>
                    <td style={{ ...styles.td, maxWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {hasThumbnail ? (
                          <img src={post.thumbnail_url} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 36, height: 36, borderRadius: 6, background: p.bg || '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {isVideo ? <Play size={14} style={{ color: p.color }} /> : <span>{p.icon || '📄'}</span>}
                          </div>
                        )}
                        <span style={{ fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {caption}{caption.length >= 55 ? '…' : ''}
                        </span>
                      </div>
                    </td>
                    <td style={{ ...styles.td, fontWeight: 700, color: '#d97706' }}>
                      {fmt(Math.round(entry.score))}
                    </td>
                    <td style={styles.td}>
                      {vsPct !== null && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                          background: vsPct >= 0 ? '#dcfce7' : '#fee2e2',
                          color:      vsPct >= 0 ? '#16a34a' : '#dc2626',
                        }}>
                          {vsPct >= 0 ? '+' : ''}{vsPct}%
                        </span>
                      )}
                    </td>
                    <td style={styles.td}>
                      {post?.published_at ? new Date(post.published_at).toLocaleDateString() : '—'}
                    </td>
                    <td style={styles.td}>
                      {post?.post_url && (
                        <a href={post.post_url} target="_blank" rel="noreferrer" style={{ color: '#00d7ff', display: 'flex', alignItems: 'center', gap: 3, fontSize: 12 }}>
                          <ExternalLink size={12} /> View
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )
      )}
    </div>
  );
}

function SharedLinksPanel() {
  const [open,    setOpen]    = useState(false);
  const [links,   setLinks]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [copied,  setCopied]  = useState(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    sharedReportsAPI.list()
      .then(res => setLinks(res.data.results || res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  function copyUrl(url, id) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  async function deactivate(id) {
    await sharedReportsAPI.delete(id);
    setLinks(prev => prev.filter(l => l.id !== id));
  }

  return (
    <div style={panelWrap}>
      <button onClick={() => setOpen(o => !o)} style={panelToggle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link2 size={16} style={{ color: '#00d7ff' }} />
          <span>Shared Report Links</span>
          {links.length > 0 && !open && (
            <span style={{ ...countBadge, background: '#e6fbff', color: '#00d7ff' }}>{links.length}</span>
          )}
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div style={panelBody}>
          {loading && <p style={emptyMsg}>Loading…</p>}
          {!loading && links.length === 0 && <p style={emptyMsg}>No shared links yet.</p>}
          {!loading && links.length > 0 && (
            <table style={styles.table}>
              <thead>
                <tr>
                  {['User', 'Period', 'Views', 'Expires', 'Protected', 'Actions'].map(h => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {links.map(link => (
                  <tr key={link.id} style={styles.tr}>
                    <td style={styles.td}>{link.client_name || link.client}</td>
                    <td style={styles.td}>{link.date_from} → {link.date_until}</td>
                    <td style={styles.td}>{link.view_count}</td>
                    <td style={styles.td}>
                      {link.expires_at
                        ? new Date(link.expires_at).toLocaleDateString()
                        : <span style={{ color: '#94a3b8' }}>Never</span>}
                      {link.is_expired && <span style={{ color: '#dc2626', fontWeight: 700, marginLeft: 6 }}>EXPIRED</span>}
                    </td>
                    <td style={styles.td}>
                      {link.is_password_protected
                        ? <Lock size={13} style={{ color: '#00d7ff' }} />
                        : <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>
                    <td style={{ ...styles.td, display: 'flex', gap: 8 }}>
                      <button onClick={() => copyUrl(link.share_url, link.id)} style={iconActionBtn} title="Copy link">
                        {copied === link.id
                          ? <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>Copied!</span>
                          : <Copy size={14} />}
                      </button>
                      <a href={link.share_url} target="_blank" rel="noreferrer" style={iconActionBtn} title="Open">
                        <ExternalLink size={14} />
                      </a>
                      <button onClick={() => deactivate(link.id)} style={{ ...iconActionBtn, color: '#ef4444' }} title="Deactivate">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function roiStatusLabel(pct) {
  if (pct > 500)  return { text: 'Excellent', bg: '#D1FAE5', color: '#059669' };
  if (pct > 200)  return { text: 'Good',      bg: '#DBEAFE', color: '#2563EB' };
  if (pct >= 0)   return { text: 'Average',   bg: '#FEF3C7', color: '#D97706' };
  return              { text: 'Review',    bg: '#FEE2E2', color: '#EF4444' };
}

function ROIOverviewPanel() {
  const navigate = useNavigate();
  const [open, setOpen]       = useState(true);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [month] = useState(now.getMonth() + 1);
  const [year]  = useState(now.getFullYear());

  useEffect(() => {
    setLoading(true);
    roiAPI.getReports({ month, year })
      .then(res => setReports(res.data.results || res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [month, year]);

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div style={styles.tableWrap}>
      <div style={styles.goalHeader} onClick={() => setOpen(o => !o)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={16} style={{ color: '#00d7ff' }} />
          <h3 style={styles.tableTitle}>ROI Summary — {MONTH_NAMES[month - 1]} {year}</h3>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>

      {open && (
        loading ? (
          <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 12 }}>Loading…</p>
        ) : reports.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 12 }}>
            No ROI reports saved for this month yet.
          </p>
        ) : (
          <table style={{ ...styles.table, marginTop: 12 }}>
            <thead>
              <tr>
                {['User', 'ROI %', 'Est. Revenue', 'Investment', 'Status', ''].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.map(r => {
                const pct   = parseFloat(r.roi_percentage) || 0;
                const label = roiStatusLabel(pct);
                const sym   = r.currency_symbol || '$';
                return (
                  <tr key={r.id || r.client_id} style={styles.tr}>
                    <td style={{ ...styles.td, fontWeight: 600 }}>{r.client_name || r.client}</td>
                    <td style={{ ...styles.td, fontWeight: 700, color: pct > 0 ? '#059669' : '#EF4444' }}>
                      {pct.toFixed(0)}%
                    </td>
                    <td style={styles.td}>
                      {sym}{(r.estimated_revenue || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </td>
                    <td style={styles.td}>
                      {sym}{(r.total_investment || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        display: 'inline-block', padding: '2px 10px', borderRadius: 20,
                        fontSize: 11, fontWeight: 700,
                        background: label.bg, color: label.color,
                      }}>
                        {label.text}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {r.client_id && (
                        <button
                          onClick={() => navigate(`/admin/client/${r.client_id}/roi`)}
                          style={{
                            background: 'none', border: '1px solid #e2e8f0', borderRadius: 6,
                            padding: '4px 10px', cursor: 'pointer', fontSize: 12, color: '#00d7ff',
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          <ExternalLink size={12} /> View
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )
      )}
    </div>
  );
}

export default function AdminOverview() {
  const [range, setRange] = useDateRange(30);
  const { data: overview } = useOverview(range);

  const totalImpressions = overview?.by_platform?.reduce((s, p) => s + (p.impressions||0), 0) || 0;
  const totalClicks      = overview?.by_platform?.reduce((s, p) => s + (p.clicks||0), 0) || 0;
  const totalFollowers   = overview?.by_platform?.reduce((s, p) => s + (p.followers||0), 0) || 0;
  const topPlatform      = [...(overview?.by_platform || [])].sort((a, b) => (b.impressions || 0) - (a.impressions || 0))[0];
  const latestSync       = overview?.recent_syncs?.[0];

  return (
    <div style={styles.page}>
      <PageHeader
        title="Agency Overview"
        subtitle={`${overview?.total_clients || 0} active users`}
        actions={<DateRangePicker range={range} onChange={setRange} />}
      />

      <div style={styles.summaryBar}>
        <div style={styles.summaryItem}>
          <span style={styles.summaryItemLabel}>Top Platform</span>
          <strong style={styles.summaryItemValue}>
            {topPlatform ? `${PLATFORMS[topPlatform.platform]?.icon} ${PLATFORMS[topPlatform.platform]?.label || topPlatform.platform}` : 'No data'}
          </strong>
        </div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryItemLabel}>Best Reach</span>
          <strong style={styles.summaryItemValue}>{topPlatform ? fmt(topPlatform.reach) : '0'}</strong>
        </div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryItemLabel}>Latest Sync</span>
          <strong style={styles.summaryItemValue}>{latestSync ? `${latestSync.client_name} · ${latestSync.status}` : 'No recent syncs'}</strong>
        </div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryItemLabel}>Date Window</span>
          <strong style={styles.summaryItemValue}>{overview?.period ? `${overview.period.since} to ${overview.period.until}` : 'Current period'}</strong>
        </div>
      </div>

      <div style={styles.cards}>
        <StatCard label="Total Users"        value={overview?.total_clients || 0} icon={Users}         color="#00d7ff" />
        <StatCard label="Total Impressions" value={totalImpressions}             icon={Eye}           color="#00d7ff" />
        <StatCard label="Total Clicks"      value={totalClicks}                  icon={MousePointer2} color="#22c55e" />
        <StatCard label="Total Followers"   value={totalFollowers}               icon={TrendingUp}    color="#f59e0b" />
      </div>

      <div style={styles.dashboardGrid}>
        <div style={styles.mainColumn}>
          {overview?.by_platform?.length > 0 && (
            <div style={styles.tableWrap}>
              <h3 style={styles.tableTitle}>Platform Performance</h3>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {['Platform','Impressions','Reach','Clicks','Video Views','Followers'].map(h => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {overview.by_platform.map(p => (
                    <tr key={p.platform} style={styles.tr}>
                      <td style={styles.td}>
                        <span style={{ color: PLATFORMS[p.platform]?.color }}>
                          {PLATFORMS[p.platform]?.icon} {PLATFORMS[p.platform]?.label || p.platform}
                        </span>
                      </td>
                      <td style={styles.td}>{fmt(p.impressions)}</td>
                      <td style={styles.td}>{fmt(p.reach)}</td>
                      <td style={styles.td}>{fmt(p.clicks)}</td>
                      <td style={styles.td}>{fmt(p.video_views)}</td>
                      <td style={styles.td}>{fmt(p.followers)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <ROIOverviewPanel />
          <TopPostsPanel />
          <GoalManager />
          <AlertsPanel />
          <SharedLinksPanel />
        </div>

        <div style={styles.sideColumn}>
          {overview?.recent_syncs?.length > 0 && (
            <div style={styles.tableWrap}>
              <h3 style={styles.tableTitle}>Recent Sync Activity</h3>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {['User','Platform','Status','Records','Started'].map(h => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {overview.recent_syncs.map(l => (
                    <tr key={l.id} style={styles.tr}>
                      <td style={styles.td}>{l.client_name || '—'}</td>
                      <td style={styles.td}>
                        {PLATFORMS[l.platform]?.icon} {PLATFORMS[l.platform]?.label || l.platform}
                      </td>
                      <td style={styles.td}>
                        <span style={statusBadge(l.status)}>{l.status}</span>
                      </td>
                      <td style={styles.td}>{l.records_synced ?? 0}</td>
                      <td style={styles.td}>{new Date(l.started_at).toLocaleString()}</td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

const statusColors = {
  success: { background: '#dcfce7', color: '#16a34a' },
  failed:  { background: '#fee2e2', color: '#dc2626' },
  running: { background: '#e6fbff', color: '#00d7ff' },
  pending: { background: '#f0f4f9', color: '#64748b' },
};

function statusBadge(status) {
  return {
    display: 'inline-block', padding: '2px 10px', borderRadius: 20,
    fontSize: 11, fontWeight: 600,
    ...(statusColors[status] || statusColors.pending),
  };
}

const styles = {
  page:      { padding: '28px 32px', maxWidth: 1400, margin: '0 auto' },
  summaryBar: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 12,
    marginBottom: 22,
  },
  summaryItem: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 16,
    padding: '14px 16px',
    boxShadow: '0 1px 6px rgba(15,23,42,.05)',
  },
  summaryItemLabel: {
    display: 'block',
    marginBottom: 6,
    fontSize: 11,
    fontWeight: 800,
    color: '#94a3b8',
    letterSpacing: '.08em',
    textTransform: 'uppercase',
  },
  summaryItemValue: {
    fontSize: 15,
    lineHeight: 1.4,
    color: '#0f172a',
  },
  cards: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))',
    gap: 14, marginBottom: 28,
  },
  dashboardGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.25fr) minmax(360px, .75fr)',
    gap: 20,
    marginBottom: 8,
    alignItems: 'start',
  },
  mainColumn: { minWidth: 0 },
  sideColumn: { minWidth: 0 },
  tableWrap: {
    background: '#fff', borderRadius: 14, padding: 24,
    boxShadow: '0 1px 6px rgba(0,0,0,.07)', marginBottom: 24, overflowX: 'auto',
  },
  goalHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    cursor: 'pointer', marginBottom: 0,
  },
  tableTitle: { margin: 0, fontSize: 15, fontWeight: 700, color: '#1e293b' },
  goalForm: {
    display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
    marginTop: 16, marginBottom: 12,
  },
  goalField: { flex: '1 1 180px', minWidth: 0 },
  goalLabel: { display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#374151' },
  requiredAsterisk: { color: '#ef4444', marginLeft: 2, fontWeight: 800 },
  goalError: { marginTop: 6, fontSize: 12, color: '#dc2626' },
  sel: {
    padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb',
    fontSize: 13, background: '#fff', cursor: 'pointer', outline: 'none',
  },
  inp: {
    padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb',
    fontSize: 13, outline: 'none', width: 130,
  },
  inputError: { borderColor: '#ef4444', background: '#fef2f2' },
  addGoalBtn: {
    padding: '8px 16px', borderRadius: 8, border: 'none',
    background: '#00d7ff', color: '#fff', cursor: 'pointer',
    fontWeight: 700, fontSize: 13,
  },
  delBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#dc2626', padding: 4,
  },
  markAllBtn: {
    display: 'flex', alignItems: 'center', gap: 4,
    background: 'none', border: '1px solid #e5e7eb', borderRadius: 8,
    cursor: 'pointer', color: '#64748b', fontSize: 12, padding: '4px 10px',
  },
  table:      { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left', padding: '10px 12px', background: '#f0f4f9',
    color: '#64748b', fontWeight: 600, fontSize: 12, borderBottom: '1px solid #e5e7eb',
    whiteSpace: 'nowrap',
  },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '12px 12px', color: '#374151' },
  inlineSuccess: { fontSize: 13, marginBottom: 12, padding: '10px 14px', borderRadius: 8, background: '#dcfce7', color: '#16a34a' },
  inlineError: { fontSize: 13, marginBottom: 12, padding: '10px 14px', borderRadius: 8, background: '#fee2e2', color: '#dc2626' },
};

const panelWrap   = { background: '#fff', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,.07)', marginBottom: 24, overflow: 'hidden' };
const panelToggle = {
  width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 14, fontWeight: 700, color: '#1e293b',
};
const panelBody   = { padding: '0 20px 20px', overflowX: 'auto' };
const countBadge  = { fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 };
const emptyMsg    = { color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '16px 0', margin: 0 };
const iconActionBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: '#64748b', padding: 4, display: 'inline-flex', alignItems: 'center',
};
