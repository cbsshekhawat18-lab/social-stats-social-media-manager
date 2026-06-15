/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * AdminTrustQueuePage — superadmin trust & safety queue.
 *
 * Two tabs:
 *   - Verifications: pending agency-verification submissions
 *   - Disputes:      open / under-review disputes
 *
 * Lives at /admin/trust. Approve/reject/resolve buttons inline so it can
 * function as a one-screen reviewer console.
 */
import { useEffect, useState } from 'react';
import {
  ShieldCheck, AlertTriangle, FileText, ExternalLink, Check, X,
  RefreshCw, Pause, Slash, MessageSquare,
} from 'lucide-react';

import { verificationAPI, disputeAPI } from '../../services/api';
import toast from '../../components/ui/toast';


export default function AdminTrustQueuePage() {
  const [tab, setTab] = useState('verifications');
  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Trust & safety queue
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>
          Verify agencies and resolve disputes. Superadmin-only.
        </p>
      </header>

      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border-subtle)' }}>
        <Tab active={tab === 'verifications'} onClick={() => setTab('verifications')}>
          <ShieldCheck size={13} /> Verifications
        </Tab>
        <Tab active={tab === 'disputes'} onClick={() => setTab('disputes')}>
          <AlertTriangle size={13} /> Disputes
        </Tab>
      </div>

      {tab === 'verifications' ? <Verifications /> : <Disputes />}
    </div>
  );
}


function Tab({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '10px 16px',
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: 'transparent',
      color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
      border: 'none',
      borderBottom: `2px solid ${active ? 'var(--brand-primary)' : 'transparent'}`,
      fontSize: 13, fontWeight: active ? 600 : 500,
      fontFamily: 'inherit', cursor: 'pointer',
      marginBottom: -1,
    }}>
      {children}
    </button>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Verifications
// ─────────────────────────────────────────────────────────────────────────────
function Verifications() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  function load() {
    setLoading(true);
    verificationAPI.pending()
      .then((r) => setRows(r.data?.agencies || []))
      .catch(() => toast.error('Could not load queue'))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function decide(id, approve) {
    const note = window.prompt(approve ? 'Approval note (optional)' : 'Reason for rejection (visible to the agency)');
    if (note === null) return;
    setBusy(true);
    try {
      const fn = approve ? verificationAPI.approve : verificationAPI.reject;
      await fn(id, note);
      toast.success(approve ? 'Verified' : 'Rejected — agency notified');
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not decide');
    } finally { setBusy(false); }
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--text-tertiary)' }}>Loading…</div>;
  if (rows.length === 0) {
    return (
      <div style={emptyBox}>
        <ShieldCheck size={28} strokeWidth={1.6} style={{ opacity: 0.4 }} />
        <div style={{ marginTop: 8 }}>No pending verifications.</div>
      </div>
    );
  }
  return (
    <ul style={list}>
      {rows.map((a) => {
        const docs = a.documents || {};
        const items = docs.documents || [];
        const decision = docs.decision || 'pending';
        return (
          <li key={a.id} style={card}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {a.name} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>· {a.slug}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  Submitted {docs.submitted_at ? new Date(docs.submitted_at).toLocaleString() : '—'}
                </div>
              </div>
              <span style={{
                padding: '2px 8px', fontSize: 10, fontWeight: 600,
                letterSpacing: '0.04em', textTransform: 'uppercase',
                borderRadius: 'var(--radius-pill)',
                color:      decision === 'pending' ? 'var(--warning)' : decision === 'rejected' ? 'var(--danger)' : 'var(--success)',
                background: decision === 'pending' ? 'var(--warning-bg)' : decision === 'rejected' ? 'var(--danger-bg)' : 'var(--success-bg)',
                border: '1px solid currentColor',
              }}>{decision}</span>
            </header>

            <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {items.map((d, i) => (
                <li key={i} style={{ fontSize: 13 }}>
                  <FileText size={12} style={{ verticalAlign: '-1px', marginRight: 6, color: 'var(--text-tertiary)' }} />
                  <span style={{ color: 'var(--text-tertiary)' }}>{d.type}</span>{' '}
                  <a href={d.url} target="_blank" rel="noreferrer" style={{ color: 'var(--brand-primary-hover)' }}>
                    {d.url} <ExternalLink size={11} style={{ verticalAlign: '-2px' }} />
                  </a>
                  {d.note && <span style={{ color: 'var(--text-secondary)' }}> — {d.note}</span>}
                </li>
              ))}
            </ul>

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button type="button" onClick={() => decide(a.id, false)} disabled={busy} style={btnGhost}>
                <X size={13} /> Reject
              </button>
              <button type="button" onClick={() => decide(a.id, true)} disabled={busy} style={btnPrimary}>
                <Check size={13} /> Approve
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Disputes
// ─────────────────────────────────────────────────────────────────────────────
function Disputes() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('open');

  function load() {
    setLoading(true);
    disputeAPI.list(statusFilter ? { status: statusFilter } : {})
      .then((r) => setRows(r.data?.disputes || []))
      .catch(() => toast.error('Could not load disputes'))
      .finally(() => setLoading(false));
  }
  useEffect(load, [statusFilter]);

  async function resolve(d) {
    const action = window.prompt('Action: paused / terminated / warned / dismissed / escalated');
    if (!action) return;
    if (!['paused', 'terminated', 'warned', 'dismissed', 'escalated'].includes(action)) {
      toast.error('Unknown action');
      return;
    }
    const resolution = window.prompt('Resolution note (visible to both sides)') || '';
    try {
      await disputeAPI.resolve(d.id, { status: 'resolved', action, resolution });
      toast.success('Resolved');
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not resolve');
    }
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--text-tertiary)' }}>Loading…</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        {['open', 'under_review', 'resolved', 'rejected', 'escalated', ''].map((s) => (
          <button key={s || 'all'} type="button" onClick={() => setStatusFilter(s)} style={{
            padding: '5px 10px',
            fontSize: 11, fontWeight: statusFilter === s ? 600 : 500,
            color: statusFilter === s ? 'var(--text-primary)' : 'var(--text-secondary)',
            background: statusFilter === s ? 'var(--brand-primary-soft)' : 'var(--surface-card)',
            border: `1px solid ${statusFilter === s ? 'var(--brand-primary)' : 'var(--border-default)'}`,
            borderRadius: 'var(--radius-pill)',
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {s || 'all'}
          </button>
        ))}
        <button type="button" onClick={load} style={btnGhost}><RefreshCw size={13} /> Refresh</button>
      </div>

      {rows.length === 0 ? (
        <div style={emptyBox}>
          <AlertTriangle size={28} strokeWidth={1.6} style={{ opacity: 0.4 }} />
          <div style={{ marginTop: 8 }}>No disputes match the filter.</div>
        </div>
      ) : (
        <ul style={list}>
          {rows.map((d) => (
            <li key={d.id} style={card}>
              <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {d.client_name} <span style={{ color: 'var(--text-tertiary)' }}>vs</span> {d.agency_name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    Filed by {d.filer_email} · {new Date(d.created_at).toLocaleString()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{
                    padding: '2px 8px', fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
                    color: d.severity === 'critical' || d.severity === 'high' ? 'var(--danger)' : 'var(--warning)',
                    background: d.severity === 'critical' || d.severity === 'high' ? 'var(--danger-bg)' : 'var(--warning-bg)',
                    border: '1px solid currentColor', borderRadius: 'var(--radius-pill)',
                  }}>{d.severity}</span>
                  <span style={{
                    padding: '2px 8px', fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
                    color: 'var(--text-tertiary)', background: 'var(--surface-sunken)',
                    border: '1px solid var(--border-default)', borderRadius: 'var(--radius-pill)',
                  }}>{d.status}</span>
                </div>
              </header>

              <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                {d.reason}
              </p>

              {d.evidence_urls?.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>
                  Evidence:{' '}
                  {d.evidence_urls.map((u, i) => (
                    <a key={i} href={u} target="_blank" rel="noreferrer" style={{ color: 'var(--brand-primary-hover)', marginRight: 8 }}>
                      [{i + 1}] <ExternalLink size={10} style={{ verticalAlign: '-1px' }} />
                    </a>
                  ))}
                </div>
              )}

              {d.resolution && (
                <div style={{ marginTop: 10, padding: 10, background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', fontSize: 12 }}>
                  <strong>Resolution ({d.action_taken || 'no action'}):</strong> {d.resolution}
                </div>
              )}

              {d.status === 'open' || d.status === 'under_review' ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button type="button" onClick={() => resolve(d)} style={btnPrimary}>
                    <MessageSquare size={13} /> Resolve
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


const list = { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 };
const card = {
  padding: 16,
  background: 'var(--surface-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
};
const emptyBox = {
  padding: 36, textAlign: 'center',
  background: 'var(--surface-card)',
  border: '1px dashed var(--border-default)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-tertiary)',
};

const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px',
  background: 'var(--brand-primary)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius-md)',
  fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
};
const btnGhost = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 12px',
  background: 'var(--surface-card)', color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
};
