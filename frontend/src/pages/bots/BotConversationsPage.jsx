/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * BotConversationsPage — list of every BotConversation (active + ended).
 *
 * Filters: status, flow, has-lead. Click a row → detail page.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageSquare, Search, RefreshCw, ChevronRight, Bot, Sparkles,
  CheckCircle2, AlertTriangle, UserCheck, Clock,
} from 'lucide-react';

import { botConversationAPI, botAPI } from '../../services/api';
import toast from '../../components/ui/toast';

const STATUS_META = {
  active:     { label: 'Active',     color: 'var(--success)',     icon: Sparkles },
  completed:  { label: 'Completed',  color: 'var(--success)',     icon: CheckCircle2 },
  abandoned:  { label: 'Abandoned',  color: 'var(--text-tertiary)', icon: Clock },
  handed_off: { label: 'Handed off', color: 'var(--info)',        icon: UserCheck },
  failed:     { label: 'Failed',     color: 'var(--danger)',      icon: AlertTriangle },
  exited:     { label: 'Exited',     color: 'var(--text-tertiary)', icon: Clock },
};

export default function BotConversationsPage() {
  const [convs,    setConvs]    = useState([]);
  const [flows,    setFlows]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filters,  setFilters]  = useState({ status: '', flow: '', q: '', lead_captured: false });

  function load() {
    setLoading(true);
    const params = {};
    if (filters.status)        params.status = filters.status;
    if (filters.flow)          params.flow = filters.flow;
    if (filters.q)             params.q = filters.q;
    if (filters.lead_captured) params.lead_captured = '1';
    botConversationAPI.list(params)
      .then((r) => setConvs(r.data?.results || r.data || []))
      .catch(() => toast.error('Could not load conversations'))
      .finally(() => setLoading(false));
  }
  useEffect(load, [filters.status, filters.flow, filters.lead_captured]); // eslint-disable-line
  useEffect(() => {
    botAPI.list({}).then((r) => setFlows(r.data?.results || r.data || [])).catch(() => {});
  }, []);
  // Search debounce
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [filters.q]); // eslint-disable-line

  const stats = useMemo(() => {
    const out = { active: 0, completed: 0, abandoned: 0, handed_off: 0, leads: 0 };
    for (const c of convs) {
      out[c.status] = (out[c.status] || 0) + 1;
      if (c.lead_captured) out.leads += 1;
    }
    return out;
  }, [convs]);

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{
          width: 40, height: 40,
          background: 'var(--brand-primary-glow)', color: 'var(--brand-primary-hover)',
          borderRadius: 'var(--radius-md)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <MessageSquare size={20} strokeWidth={2.2} />
        </span>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Bot conversations
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            Every session that's run through your bot flows.
          </p>
        </div>
      </header>

      {/* Stats strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
        <Stat label="Active"     n={stats.active}     color="var(--success)" />
        <Stat label="Completed"  n={stats.completed}  color="var(--success)" />
        <Stat label="Abandoned"  n={stats.abandoned}  color="var(--text-tertiary)" />
        <Stat label="Handed off" n={stats.handed_off} color="var(--info)" />
        <Stat label="With lead"  n={stats.leads}      color="var(--brand-primary-hover)" />
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        padding: 10,
        background: 'var(--surface-card)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
      }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={13} style={{ position: 'absolute', top: 10, left: 10, color: 'var(--text-tertiary)' }} />
          <input value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                 placeholder="Search by contact name…"
                 style={{ ...inputStyle, paddingLeft: 30 }} />
        </div>
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                style={inputStyle}>
          <option value="">All statuses</option>
          {Object.keys(STATUS_META).map((k) => (
            <option key={k} value={k}>{STATUS_META[k].label}</option>
          ))}
        </select>
        <select value={filters.flow} onChange={(e) => setFilters({ ...filters, flow: e.target.value })}
                style={inputStyle}>
          <option value="">All flows</option>
          {flows.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
          <input type="checkbox" checked={filters.lead_captured}
                 onChange={(e) => setFilters({ ...filters, lead_captured: e.target.checked })} />
          Lead captured
        </label>
        <button type="button" onClick={load} aria-label="Refresh" style={iconBtn}>
          <RefreshCw size={13} />
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading…</div>
      ) : convs.length === 0 ? (
        <Empty />
      ) : (
        <div style={{
          background: 'var(--surface-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={th}>Contact</th>
                <th style={th}>Flow</th>
                <th style={th}>Triggered</th>
                <th style={th}>Status</th>
                <th style={th}>Lead</th>
                <th style={th}>Started</th>
                <th style={{ ...th, width: 32 }}></th>
              </tr>
            </thead>
            <tbody>
              {convs.map((c) => {
                const meta = STATUS_META[c.status] || STATUS_META.active;
                const Icon = meta.icon;
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={td}>
                      <Link to={`/admin/conversations/${c.id}`}
                            style={{ fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none' }}>
                        {c.contact_name || c.contact_phone || `#${c.contact}`}
                      </Link>
                      {c.contact_phone && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}><code>{c.contact_phone}</code></div>}
                    </td>
                    <td style={td}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.flow_name || <em style={{ color: 'var(--text-tertiary)' }}>(deleted flow)</em>}</span>
                    </td>
                    <td style={td}>
                      <span style={pill}>{c.triggered_via.replace(/_/g, ' ')}</span>
                    </td>
                    <td style={td}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '2px 8px', fontSize: 10, fontWeight: 600,
                        letterSpacing: '0.04em', textTransform: 'uppercase',
                        color: meta.color, border: `1px solid ${meta.color}`,
                        borderRadius: 'var(--radius-pill)', background: 'transparent',
                      }}>
                        <Icon size={10} /> {meta.label}
                      </span>
                      {c.ai_takeover_active && (
                        <span style={{
                          marginLeft: 4, padding: '2px 6px',
                          background: 'var(--brand-primary-soft)', color: 'var(--brand-primary-hover)',
                          border: '1px solid var(--brand-primary)',
                          borderRadius: 'var(--radius-pill)', fontSize: 9, fontWeight: 600,
                        }}>AI</span>
                      )}
                    </td>
                    <td style={td}>
                      {c.lead_captured ? (
                        <Link to={`/admin/leads/${c.lead}`} style={{ color: 'var(--success)', textDecoration: 'none', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <Bot size={11} /> Captured
                        </Link>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>—</span>
                      )}
                    </td>
                    <td style={td}>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        {c.started_at ? new Date(c.started_at).toLocaleString() : '—'}
                      </span>
                    </td>
                    <td style={td}>
                      <Link to={`/admin/conversations/${c.id}`} aria-label="View" style={iconBtn}>
                        <ChevronRight size={13} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, n, color }) {
  return (
    <div style={{
      padding: 12,
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{n}</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    </div>
  );
}

function Empty() {
  return (
    <div style={{
      padding: 36, textAlign: 'center',
      background: 'var(--surface-card)',
      border: '1px dashed var(--border-default)',
      borderRadius: 'var(--radius-md)',
      color: 'var(--text-tertiary)',
    }}>
      <MessageSquare size={28} strokeWidth={1.5} style={{ opacity: 0.4 }} />
      <div style={{ marginTop: 8, fontSize: 14, color: 'var(--text-secondary)' }}>No conversations yet.</div>
      <p style={{ margin: '6px 0 0', fontSize: 12 }}>
        Once your bot flows trigger, every session shows up here.
      </p>
    </div>
  );
}

const inputStyle = { padding: '8px 10px', background: 'var(--surface-sunken)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' };
const th = { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-tertiary)' };
const td = { padding: '10px 12px', verticalAlign: 'top' };
const pill = { padding: '2px 8px', fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-tertiary)', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-pill)' };
const iconBtn = { width: 30, height: 30, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', textDecoration: 'none' };
