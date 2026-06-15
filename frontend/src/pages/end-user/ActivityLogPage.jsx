/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * ActivityLogPage — end-user trust feed.
 *
 * Timeline of every meaningful action on the workspace. Filterable by actor
 * (me / agency / AI / system), severity, and flagged-only. Each row exposes
 * a "flag this" button so the user can mark suspicious actions for review.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck, Filter, RefreshCw, Flag, AlertTriangle, Sparkles,
  Activity as ActivityIcon, Clock, Undo2, Download,
} from 'lucide-react';

import { activityAPI } from '../../services/api';
import toast from '../../components/ui/toast';

const ACTOR_PILL = {
  end_user: { label: 'You',     bg: 'var(--brand-primary-soft)',     fg: 'var(--brand-primary-hover)' },
  agency:   { label: 'Agency',  bg: 'var(--info-bg)',                fg: 'var(--info)' },
  ai:       { label: 'AI',      bg: 'var(--surface-sunken)',         fg: 'var(--module-ai, var(--text-secondary))' },
  system:   { label: 'System',  bg: 'var(--surface-sunken)',         fg: 'var(--text-tertiary)' },
};

const SEVERITY_COLOR = {
  info:     'var(--text-tertiary)',
  notice:   'var(--brand-primary)',
  warning:  'var(--warning)',
  critical: 'var(--danger)',
};

export default function ActivityLogPage() {
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    actor_type: '',
    severity:   '',
    flagged:    false,
  });

  function reload() {
    setLoading(true);
    const params = { limit: 200 };
    if (filters.actor_type) params.actor_type = filters.actor_type;
    if (filters.severity)   params.severity   = filters.severity;
    if (filters.flagged)    params.flagged    = '1';
    activityAPI.list(params)
      .then((r) => setRows(r.data?.rows || []))
      .catch(() => toast.error('Could not load activity'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [filters]);

  async function flag(id) {
    const reason = window.prompt('What\'s wrong with this action? (optional)');
    if (reason === null) return;
    try {
      await activityAPI.flag(id, reason);
      setRows((list) => list.map((r) => r.id === id ? { ...r, flagged_by_user: true } : r));
      toast.success('Flagged for review');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not flag');
    }
  }

  async function revert(id) {
    if (!window.confirm('Revert this action? Where supported, the post will be removed from connected platforms.')) return;
    try {
      const r = await activityAPI.revert(id);
      toast.success(r.data?.message || 'Reverted');
      reload();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not revert');
    }
  }

  function exportCsv() {
    const params = {};
    if (filters.actor_type) params.actor_type = filters.actor_type;
    if (filters.severity)   params.severity   = filters.severity;
    if (filters.flagged)    params.flagged    = '1';
    // Browsers don't carry the JWT to a plain <a download>; we fetch with axios + force-save instead.
    activityAPI.list({ ...params, limit: 1 })  // touch the API to ensure token is fresh
      .then(() => {
        const url = activityAPI.exportCsvUrl(params);
        const tok = localStorage.getItem('access_token');
        // Use fetch so the Authorization header travels with the download
        fetch(url, { headers: tok ? { Authorization: `Bearer ${tok}` } : {} })
          .then((res) => res.blob())
          .then((blob) => {
            const a = document.createElement('a');
            const dl = window.URL.createObjectURL(blob);
            a.href = dl;
            a.download = `socialstats-activity-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(dl);
          })
          .catch(() => toast.error('Could not download CSV'));
      })
      .catch(() => toast.error('Could not download CSV'));
  }

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todayRows = rows.filter((r) => r.created_at && new Date(r.created_at).toDateString() === today);
    const byAgency = todayRows.filter((r) => r.actor_type === 'agency').length;
    const byMe     = todayRows.filter((r) => r.actor_type === 'end_user').length;
    return { total: todayRows.length, byAgency, byMe };
  }, [rows]);

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{
          width: 40, height: 40,
          background: 'var(--brand-primary-glow)',
          color: 'var(--brand-primary-hover)',
          borderRadius: 'var(--radius-md)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <ShieldCheck size={20} strokeWidth={2.2} />
        </span>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Activity log
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>
            Today: <strong>{stats.total}</strong> action{stats.total === 1 ? '' : 's'} · Agency: <strong>{stats.byAgency}</strong> · You: <strong>{stats.byMe}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={exportCsv} style={btnGhost}>
            <Download size={13} /> Export CSV
          </button>
          <button type="button" onClick={reload} style={btnGhost} aria-label="Refresh">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </header>

      {/* Filters */}
      <div style={filterBar}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-tertiary)', fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          <Filter size={11} /> Filter
        </span>
        <ChipGroup
          value={filters.actor_type}
          onChange={(v) => setFilters((f) => ({ ...f, actor_type: v }))}
          options={[
            { value: '', label: 'All actors' },
            { value: 'end_user', label: 'You' },
            { value: 'agency',   label: 'Agency' },
            { value: 'ai',       label: 'AI' },
            { value: 'system',   label: 'System' },
          ]}
        />
        <ChipGroup
          value={filters.severity}
          onChange={(v) => setFilters((f) => ({ ...f, severity: v }))}
          options={[
            { value: '',         label: 'Any severity' },
            { value: 'info',     label: 'Info' },
            { value: 'notice',   label: 'Notice' },
            { value: 'warning',  label: 'Warning' },
            { value: 'critical', label: 'Critical' },
          ]}
        />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={filters.flagged} onChange={(e) => setFilters((f) => ({ ...f, flagged: e.target.checked }))} />
          Flagged only
        </label>
      </div>

      {/* Timeline */}
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)', background: 'var(--surface-card)', border: '1px dashed var(--border-default)', borderRadius: 'var(--radius-md)' }}>
          <ActivityIcon size={28} strokeWidth={1.6} style={{ opacity: 0.4 }} />
          <div style={{ marginTop: 8 }}>No activity matches your filters.</div>
        </div>
      ) : (
        <ol style={timelineStyle}>
          {rows.map((row) => (
            <ActivityRow
              key={row.id}
              row={row}
              onFlag={() => flag(row.id)}
              onRevert={row.is_reversible && !row.reverted_at ? () => revert(row.id) : null}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function ChipGroup({ value, onChange, options }) {
  return (
    <div style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            type="button"
            key={opt.value || '__all__'}
            onClick={() => onChange(opt.value)}
            style={{
              padding: '4px 10px',
              fontSize: 11, fontWeight: active ? 600 : 500,
              color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: active ? 'var(--brand-primary-soft)' : 'var(--surface-card)',
              border: `1px solid ${active ? 'var(--brand-primary)' : 'var(--border-default)'}`,
              borderRadius: 'var(--radius-pill)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function ActivityRow({ row, onFlag, onRevert }) {
  const actor = ACTOR_PILL[row.actor_type] || ACTOR_PILL.system;
  const severityColor = SEVERITY_COLOR[row.severity] || SEVERITY_COLOR.info;
  const Icon = row.actor_type === 'ai' ? Sparkles : ActivityIcon;
  return (
    <li style={rowStyle}>
      <span style={{
        width: 28, height: 28,
        background: 'var(--surface-sunken)',
        color: severityColor,
        borderRadius: '50%',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={14} strokeWidth={2.2} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ ...actorPill, background: actor.bg, color: actor.fg }}>{actor.label}</span>
          {row.actor_user_name && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>· {row.actor_user_name}</span>}
          {row.actor_agency_name && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>· {row.actor_agency_name}</span>}
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: severityColor }}>
            {row.severity}
          </span>
          {row.flagged_by_user && <span style={flagChip}><Flag size={9} /> Flagged</span>}
          {row.reverted_at && <span style={revertedChip}><Undo2 size={9} /> Reverted</span>}
        </div>
        <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
          {row.description}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <Clock size={10} />
          {new Date(row.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
        {onRevert && (
          <button type="button" onClick={onRevert} style={{ ...miniBtn, color: 'var(--warning)', borderColor: 'var(--warning)' }} aria-label="Revert this action">
            <Undo2 size={11} /> Revert
          </button>
        )}
        {!row.flagged_by_user && (
          <button type="button" onClick={onFlag} style={miniBtn} aria-label="Flag this action">
            <Flag size={11} /> Flag
          </button>
        )}
      </div>
    </li>
  );
}

const filterBar = {
  display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10,
  padding: '12px 14px',
  background: 'var(--surface-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
};

const timelineStyle = {
  listStyle: 'none', padding: 0, margin: 0,
  display: 'flex', flexDirection: 'column', gap: 8,
};

const rowStyle = {
  display: 'flex', alignItems: 'flex-start', gap: 12,
  padding: '12px 14px',
  background: 'var(--surface-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
};

const actorPill = {
  padding: '2px 8px',
  fontSize: 10, fontWeight: 600,
  letterSpacing: '0.04em', textTransform: 'uppercase',
  borderRadius: 'var(--radius-pill)',
};

const flagChip = {
  display: 'inline-flex', alignItems: 'center', gap: 3,
  padding: '2px 7px',
  background: 'var(--danger-bg)', color: 'var(--danger)',
  border: '1px solid var(--danger)',
  borderRadius: 'var(--radius-pill)',
  fontSize: 10, fontWeight: 600,
};

const revertedChip = {
  display: 'inline-flex', alignItems: 'center', gap: 3,
  padding: '2px 7px',
  background: 'var(--warning-bg)', color: 'var(--warning)',
  border: '1px solid var(--warning)',
  borderRadius: 'var(--radius-pill)',
  fontSize: 10, fontWeight: 600,
};

const miniBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '4px 8px',
  background: 'transparent', color: 'var(--text-tertiary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 11, fontWeight: 500,
  fontFamily: 'inherit', cursor: 'pointer',
};

const btnGhost = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 12px',
  background: 'var(--surface-card)', color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  fontSize: 12, fontWeight: 600,
  fontFamily: 'inherit', cursor: 'pointer',
};
