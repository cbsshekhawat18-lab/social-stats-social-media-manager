/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * LeadsPage — pipeline of every captured lead.
 *
 * Two views toggleable via the topbar:
 *   - Table   : dense, filterable, multi-select for bulk actions
 *   - Kanban  : 5 status columns (New / Contacted / Qualified / Converted / Lost),
 *               drag-and-drop to change status
 *
 * Topbar: search, filters, view toggle, bulk-actions menu when rows are
 * selected, Import CSV / Export CSV buttons.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users2, Search, Filter, Layers, Table as TableIcon, Download, Upload,
  Sparkles, ChevronRight, Star, Trash2, RefreshCw, X,
} from 'lucide-react';

import { leadAPI } from '../../services/api';
import toast from '../../components/ui/toast';

const STATUSES = [
  { key: 'new',       label: 'New',       color: 'var(--brand-primary)' },
  { key: 'contacted', label: 'Contacted', color: 'var(--info)' },
  { key: 'qualified', label: 'Qualified', color: 'var(--warning)' },
  { key: 'converted', label: 'Converted', color: 'var(--success)' },
  { key: 'lost',      label: 'Lost',      color: 'var(--text-tertiary)' },
];

export default function LeadsPage() {
  const [leads,    setLeads]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [view,     setView]     = useState(localStorage.getItem('leads_view') || 'table');
  const [filters,  setFilters]  = useState({ status: '', q: '', source_flow: '' });
  const [selected, setSelected] = useState(new Set());
  const [importOpen, setImportOpen] = useState(false);

  function load() {
    setLoading(true);
    const params = {};
    if (filters.status) params.status = filters.status;
    if (filters.q)      params.q      = filters.q;
    if (filters.source_flow) params.source_flow = filters.source_flow;
    leadAPI.list(params)
      .then((r) => setLeads(r.data?.results || r.data || []))
      .catch(() => toast.error('Could not load leads'))
      .finally(() => setLoading(false));
  }
  useEffect(load, [filters.status, filters.source_flow]); // eslint-disable-line

  // Search debounce
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [filters.q]); // eslint-disable-line

  function setView2(v) { setView(v); localStorage.setItem('leads_view', v); }

  function toggleRow(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    if (selected.size === leads.length) setSelected(new Set());
    else setSelected(new Set(leads.map((l) => l.id)));
  }

  async function bulkStatus(status) {
    if (selected.size === 0) return;
    try {
      await Promise.all(Array.from(selected).map((id) => leadAPI.status(id, { status })));
      toast.success(`Updated ${selected.size} leads`);
      setSelected(new Set());
      load();
    } catch { toast.error('Could not update leads'); }
  }

  async function changeStatus(leadId, newStatus) {
    // optimistic
    setLeads((ls) => ls.map((l) => l.id === leadId ? { ...l, status: newStatus } : l));
    try { await leadAPI.status(leadId, { status: newStatus }); }
    catch { toast.error('Could not change status'); load(); }
  }

  function downloadCsv() {
    const params = {};
    if (filters.status) params.status = filters.status;
    if (filters.q)      params.q = filters.q;
    const tok = localStorage.getItem('access_token');
    fetch(leadAPI.exportCsvUrl(params), {
      headers: tok ? { Authorization: `Bearer ${tok}` } : {},
    })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a');
        const url = URL.createObjectURL(blob);
        a.href = url; a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      })
      .catch(() => toast.error('Could not download CSV'));
  }

  const total = leads.length;
  const byStatus = useMemo(() => {
    const out = Object.fromEntries(STATUSES.map((s) => [s.key, []]));
    leads.forEach((l) => { (out[l.status] ||= []).push(l); });
    return out;
  }, [leads]);

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{
          width: 40, height: 40,
          background: 'var(--brand-primary-glow)', color: 'var(--brand-primary-hover)',
          borderRadius: 'var(--radius-md)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Users2 size={20} strokeWidth={2.2} />
        </span>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Leads <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-tertiary)' }}>· {total}</span>
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            Every lead captured from your bot flows.
          </p>
        </div>
        <button type="button" onClick={() => setImportOpen(true)} style={btnGhost}>
          <Upload size={13} /> Import CSV
        </button>
        <button type="button" onClick={downloadCsv} style={btnGhost}>
          <Download size={13} /> Export CSV
        </button>
      </header>

      {/* Filter bar + view toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        padding: 10,
        background: 'var(--surface-card)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
      }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={13} style={{ position: 'absolute', top: 10, left: 10, color: 'var(--text-tertiary)' }} />
          <input value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                 placeholder="Search name, phone, email, interest…"
                 style={{ ...inputStyle, paddingLeft: 30 }} />
        </div>
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                style={inputStyle}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <button type="button" onClick={load} aria-label="Refresh" style={iconBtn}>
          <RefreshCw size={13} />
        </button>
        <div style={{ display: 'flex', borderLeft: '1px solid var(--border-default)', paddingLeft: 8, gap: 4 }}>
          <button type="button" onClick={() => setView2('table')} aria-label="Table view"
                  style={{ ...iconBtn, background: view === 'table' ? 'var(--brand-primary-soft)' : 'transparent' }}>
            <TableIcon size={13} />
          </button>
          <button type="button" onClick={() => setView2('kanban')} aria-label="Kanban view"
                  style={{ ...iconBtn, background: view === 'kanban' ? 'var(--brand-primary-soft)' : 'transparent' }}>
            <Layers size={13} />
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px',
          background: 'var(--brand-primary-soft)',
          border: '1px solid var(--brand-primary)',
          borderRadius: 'var(--radius-md)',
        }}>
          <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>
            {selected.size} selected
          </strong>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>· Bulk update status:</span>
          {STATUSES.map((s) => (
            <button key={s.key} type="button" onClick={() => bulkStatus(s.key)}
                    style={{ ...miniBtn, color: s.color, borderColor: s.color }}>
              {s.label}
            </button>
          ))}
          <button type="button" onClick={() => setSelected(new Set())} style={miniBtn}>
            <X size={11} /> Clear
          </button>
        </div>
      )}

      {/* View body */}
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading…</div>
      ) : leads.length === 0 ? (
        <Empty />
      ) : view === 'kanban' ? (
        <KanbanBoard leads={leads} byStatus={byStatus} onChangeStatus={changeStatus} />
      ) : (
        <Table leads={leads} selected={selected}
               onToggleRow={toggleRow} onToggleAll={toggleAll} />
      )}

      {importOpen && (
        <ImportModal onClose={() => setImportOpen(false)} onImported={() => { setImportOpen(false); load(); }} />
      )}
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
      <Users2 size={28} strokeWidth={1.5} style={{ opacity: 0.4 }} />
      <div style={{ marginTop: 8, fontSize: 14, color: 'var(--text-secondary)' }}>No leads yet.</div>
      <p style={{ margin: '6px 0 0', fontSize: 12 }}>
        Once your bot flows start running, captured leads appear here.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Table view
// ─────────────────────────────────────────────────────────
function Table({ leads, selected, onToggleRow, onToggleAll }) {
  const allSelected = selected.size === leads.length && leads.length > 0;
  return (
    <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <th style={{ ...th, width: 32 }}>
              <input type="checkbox" checked={allSelected} onChange={onToggleAll}
                     aria-label="Select all" />
            </th>
            <th style={th}>Name</th>
            <th style={th}>Phone</th>
            <th style={th}>Status</th>
            <th style={{ ...th, textAlign: 'right' }}>Score</th>
            <th style={th}>Source</th>
            <th style={th}>Assigned</th>
            <th style={th}>Created</th>
            <th style={{ ...th, width: 32 }}></th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => {
            const status = STATUSES.find((s) => s.key === l.status) || STATUSES[0];
            return (
              <tr key={l.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={td}>
                  <input type="checkbox" checked={selected.has(l.id)} onChange={() => onToggleRow(l.id)}
                         aria-label={`Select ${l.name || l.phone}`} />
                </td>
                <td style={td}>
                  <Link to={`/admin/leads/${l.id}`} style={{ fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none' }}>
                    {l.name || <em style={{ color: 'var(--text-tertiary)' }}>(no name)</em>}
                  </Link>
                  {l.email && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{l.email}</div>}
                </td>
                <td style={td}><code style={{ fontSize: 12 }}>{l.phone}</code></td>
                <td style={td}>
                  <span style={{ ...statusPill, color: status.color, borderColor: status.color }}>
                    {status.label}
                  </span>
                </td>
                <td style={{ ...td, textAlign: 'right' }}>
                  <ScoreBadge score={l.quality_score} />
                </td>
                <td style={td}>
                  {l.source_flow_name && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{l.source_flow_name}</div>}
                  {l.source_ad_name && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>📣 {l.source_ad_name}</div>}
                </td>
                <td style={td}>
                  {l.assigned_email ? <span style={{ fontSize: 12 }}>{l.assigned_email}</span>
                                    : <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>—</span>}
                </td>
                <td style={td}>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {l.created_at ? new Date(l.created_at).toLocaleDateString() : '—'}
                  </span>
                </td>
                <td style={td}>
                  <Link to={`/admin/leads/${l.id}`} aria-label="View" style={iconBtn}>
                    <ChevronRight size={13} />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Kanban view
// ─────────────────────────────────────────────────────────
function KanbanBoard({ byStatus, onChangeStatus }) {
  const [draggingId, setDraggingId] = useState(null);
  function onDragStart(e, id) {
    e.dataTransfer.setData('text/plain', String(id));
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(id);
  }
  function onDrop(e, status) {
    e.preventDefault();
    const id = Number(e.dataTransfer.getData('text/plain'));
    if (id) onChangeStatus(id, status);
    setDraggingId(null);
  }
  function onDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STATUSES.length}, minmax(200px, 1fr))`, gap: 10 }}>
      {STATUSES.map((s) => {
        const items = byStatus[s.key] || [];
        return (
          <div key={s.key}
               onDragOver={onDragOver}
               onDrop={(e) => onDrop(e, s.key)}
               style={{
                 background: 'var(--surface-card)',
                 border: '1px solid var(--border-subtle)',
                 borderRadius: 'var(--radius-md)',
                 padding: 10,
                 display: 'flex', flexDirection: 'column', gap: 6,
                 minHeight: 360,
               }}>
            <header style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{s.label}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>{items.length}</span>
            </header>
            {items.map((l) => (
              <article key={l.id}
                       draggable
                       onDragStart={(e) => onDragStart(e, l.id)}
                       style={{
                         padding: 10,
                         background: 'var(--surface-sunken)',
                         border: '1px solid var(--border-subtle)',
                         borderRadius: 'var(--radius-sm)',
                         cursor: 'grab',
                         opacity: draggingId === l.id ? 0.5 : 1,
                       }}>
                <Link to={`/admin/leads/${l.id}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none' }}>
                  {l.name || l.phone}
                </Link>
                <div style={{ marginTop: 2, fontSize: 11, color: 'var(--text-tertiary)' }}>{l.phone}</div>
                {l.interest && (
                  <div style={{
                    marginTop: 6, fontSize: 11,
                    color: 'var(--text-secondary)',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>{l.interest}</div>
                )}
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ScoreBadge score={l.quality_score} small />
                  {l.source_ad_name && (
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      📣 {l.source_ad_name}
                    </span>
                  )}
                </div>
              </article>
            ))}
            {items.length === 0 && (
              <div style={{ padding: 12, textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)' }}>
                Drop here
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ScoreBadge({ score, small }) {
  if (score == null) return null;
  const color =
    score >= 80 ? 'var(--success)' :
    score >= 60 ? 'var(--warning)' :
    score >= 40 ? 'var(--text-secondary)' :
                  'var(--text-tertiary)';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: small ? '1px 6px' : '2px 8px',
      fontSize: small ? 10 : 11, fontWeight: 600,
      color, border: `1px solid ${color}`, background: 'transparent',
      borderRadius: 'var(--radius-pill)',
      fontVariantNumeric: 'tabular-nums',
    }}>
      <Star size={small ? 9 : 10} fill="currentColor" />
      {score}
    </span>
  );
}

function ImportModal({ onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!file) return toast.error('Pick a CSV file');
    setBusy(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await leadAPI.importCsv(fd);
      toast.success(`Imported ${r.data?.created || 0} leads (${r.data?.skipped || 0} skipped)`);
      onImported();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Import failed');
    } finally { setBusy(false); }
  }
  return (
    <div style={backdrop} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modal}>
        <header style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Import leads (CSV)</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ ...iconBtn, marginLeft: 'auto' }}>
            <X size={14} />
          </button>
        </header>
        <div style={{ padding: '0 18px 14px' }}>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-secondary)' }}>
            Required column: <code>phone</code>. Optional: <code>name, email, interest, budget, location, notes, tags</code> (tags comma-separated).
          </p>
          <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] || null)}
                 style={{ width: '100%', fontSize: 13 }} />
        </div>
        <footer style={{ padding: '12px 18px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={btnGhost}>Cancel</button>
          <button type="button" onClick={go} disabled={busy || !file} style={btnPrimary}>
            <Upload size={13} /> {busy ? 'Importing…' : 'Import'}
          </button>
        </footer>
      </div>
    </div>
  );
}

const inputStyle = {
  padding: '8px 10px',
  background: 'var(--surface-sunken)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 13, color: 'var(--text-primary)',
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
};
const th = { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-tertiary)' };
const td = { padding: '10px 12px', verticalAlign: 'top' };
const statusPill = { padding: '2px 8px', fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', border: '1px solid', borderRadius: 'var(--radius-pill)', background: 'transparent' };
const btnPrimary = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--brand-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', textDecoration: 'none' };
const btnGhost = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--surface-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', textDecoration: 'none' };
const iconBtn = { width: 30, height: 30, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', textDecoration: 'none' };
const miniBtn = { display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', background: 'transparent', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'inherit' };
const backdrop = { position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(10,14,20,0.50)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 };
const modal   = { width: '100%', maxWidth: 480, background: 'var(--surface-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)' };
