/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * NotificationPreferencesPage — per-channel-per-event opt-in matrix.
 *
 * Renders a table: rows = event types, columns = channels (in-app / email /
 * WhatsApp / browser push). Each cell is a checkbox that mutates the local
 * draft; "Save changes" PUTs the diff to the server.
 *
 * Channel availability:
 *   - in_app + email are live
 *   - whatsapp + browser push render as "Coming soon" — server still accepts
 *     the preference but doesn't deliver yet (logged TODO).
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Bell, Save, Inbox, Mail, MessageCircle, Globe, Sparkles,
} from 'lucide-react';

import { notificationPrefsAPI } from '../../services/api';
import toast from '../../components/ui/toast';


const CHANNEL_META = [
  { key: 'in_app',   label: 'In-app',   icon: Inbox,         status: 'live' },
  { key: 'email',    label: 'Email',    icon: Mail,          status: 'live' },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, status: 'soon' },
  { key: 'browser',  label: 'Push',     icon: Globe,         status: 'soon' },
];

// Group event types into sections so the matrix is readable.
const SECTIONS = [
  {
    title: 'Marketplace',
    events: [
      'manage_request_received',
      'agency_invite_received',
      'approval_requested',
      'approval_decided',
      'relation_terminated',
      'new_review_received',
      'review_response',
      'marketplace_inquiry',
    ],
  },
  {
    title: 'Engagement & alerts',
    events: [
      'inbox_message',
      'inbox_review',
      'mention',
      'viral_post',
      'engagement_drop',
      'negative_cluster',
      'follower_milestone',
    ],
  },
  {
    title: 'Posting',
    events: [
      'post_published',
      'publish_failed',
      'approval_pending',
      'best_time_window',
    ],
  },
  {
    title: 'Account',
    events: [
      'token_expiring',
    ],
  },
];


export default function NotificationPreferencesPage() {
  const [matrix,  setMatrix]  = useState([]);
  const [draft,   setDraft]   = useState({});  // { event_type: { channel: bool } }
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  function load() {
    setLoading(true);
    notificationPrefsAPI.get()
      .then((r) => {
        const m = r.data?.matrix || [];
        setMatrix(m);
        const d = {};
        m.forEach((row) => { d[row.event_type] = { ...(row.channels || {}) }; });
        setDraft(d);
      })
      .catch(() => toast.error('Could not load notification preferences'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const dirty = useMemo(() => {
    return matrix.some((row) =>
      Object.entries(row.channels || {}).some(([ch, val]) => draft[row.event_type]?.[ch] !== val)
    );
  }, [matrix, draft]);

  const matrixByEvent = useMemo(
    () => Object.fromEntries(matrix.map((m) => [m.event_type, m])),
    [matrix]
  );

  function toggle(eventType, channel) {
    setDraft((prev) => ({
      ...prev,
      [eventType]: { ...prev[eventType], [channel]: !prev[eventType]?.[channel] },
    }));
  }

  async function save() {
    const rows = [];
    matrix.forEach((row) => {
      Object.entries(row.channels || {}).forEach(([ch, val]) => {
        const next = draft[row.event_type]?.[ch];
        if (next !== val) {
          rows.push({ event_type: row.event_type, channel: ch, enabled: !!next });
        }
      });
    });
    if (rows.length === 0) return;
    setSaving(true);
    try {
      const r = await notificationPrefsAPI.update(rows);
      const m = r.data?.matrix || [];
      setMatrix(m);
      const d = {};
      m.forEach((row) => { d[row.event_type] = { ...(row.channels || {}) }; });
      setDraft(d);
      toast.success('Preferences saved');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not save preferences');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ padding: 32, color: 'var(--text-tertiary)' }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={iconWrap}><Bell size={20} strokeWidth={2.2} /></span>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Notifications
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>
            Choose how you want to be told about each thing that happens.
          </p>
        </div>
        <button type="button" onClick={save} disabled={!dirty || saving} style={dirty && !saving ? btnPrimary : btnDisabled}>
          <Save size={13} /> {saving ? 'Saving…' : (dirty ? 'Save changes' : 'No changes')}
        </button>
      </header>

      <p style={hint}>
        <Sparkles size={11} style={{ verticalAlign: '-1px', marginRight: 4, color: 'var(--brand-primary-hover)' }} />
        WhatsApp and Push are <strong>coming soon</strong> — your preferences are saved and will activate the moment those channels go live.
      </p>

      {SECTIONS.map((section) => (
        <section key={section.title} style={card}>
          <h2 style={sectionH}>{section.title}</h2>
          <div style={tableWrap}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: '40%' }}>Event</th>
                  {CHANNEL_META.map((c) => (
                    <th key={c.key} style={{ ...th, textAlign: 'center', width: '15%' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                        <c.icon size={12} /> {c.label}
                      </span>
                      {c.status === 'soon' && (
                        <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
                          coming soon
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.events.map((ev) => {
                  const row = matrixByEvent[ev];
                  if (!row) return null;
                  return (
                    <tr key={ev} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td style={td}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{row.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{ev}</div>
                      </td>
                      {CHANNEL_META.map((c) => (
                        <td key={c.key} style={{ ...td, textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={!!draft[ev]?.[c.key]}
                            onChange={() => toggle(ev, c.key)}
                            aria-label={`${row.label} via ${c.label}`}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}


const iconWrap = {
  width: 40, height: 40,
  background: 'var(--brand-primary-glow)',
  color: 'var(--brand-primary-hover)',
  borderRadius: 'var(--radius-md)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
};

const card = {
  padding: 18,
  background: 'var(--surface-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
};

const sectionH = {
  margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)',
};

const tableWrap = { overflowX: 'auto' };

const th = {
  textAlign: 'left',
  padding: '8px 10px',
  fontSize: 11, fontWeight: 600,
  letterSpacing: '0.04em', textTransform: 'uppercase',
  color: 'var(--text-tertiary)',
};

const td = {
  padding: '10px',
  verticalAlign: 'middle',
};

const hint = {
  margin: 0,
  padding: '10px 14px',
  fontSize: 12, color: 'var(--text-secondary)',
  background: 'var(--surface-sunken)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)',
};

const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '9px 16px',
  background: 'var(--brand-primary)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius-md)',
  fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
};
const btnDisabled = {
  ...btnPrimary,
  background: 'var(--border-default)', color: 'var(--text-tertiary)', cursor: 'default',
};
