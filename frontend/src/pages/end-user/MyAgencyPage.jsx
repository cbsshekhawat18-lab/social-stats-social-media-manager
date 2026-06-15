/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * MyAgencyPage — end-user view of their agency relationships.
 *
 * Shows the active relation (if any) with:
 *   - Agency profile card
 *   - Permission editor (live save) using the shared PermissionMatrix
 *   - Lifecycle controls: pause / resume / terminate
 *   - Activity highlights (last few entries) with deep-link to /u/activity
 *
 * If multiple relations exist (e.g. paused + active), they're listed and the
 * user can pick which one to view.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, ShieldCheck, Pause, Play, AlertTriangle, Flag, Save,
  ChevronRight, ExternalLink, Send, Star,
} from 'lucide-react';

import PermissionMatrix from '../../components/marketplace/PermissionMatrix';
import InviteAgencyModal from '../../components/marketplace/InviteAgencyModal';
import WriteReviewModal from '../../components/marketplace/WriteReviewModal';
import { relationAPI, activityAPI } from '../../services/api';
import toast from '../../components/ui/toast';

const STATUS_PILL = {
  active:     { bg: 'var(--success-bg)',     fg: 'var(--success)',     label: 'Active' },
  paused:     { bg: 'var(--warning-bg)',     fg: 'var(--warning)',     label: 'Paused' },
  pending:    { bg: 'var(--brand-primary-soft)', fg: 'var(--brand-primary-hover)', label: 'Pending' },
  terminated: { bg: 'var(--surface-sunken)', fg: 'var(--text-tertiary)', label: 'Ended' },
  flagged:    { bg: 'var(--danger-bg)',      fg: 'var(--danger)',      label: 'Flagged' },
};

export default function MyAgencyPage() {
  const [relations,    setRelations]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [activeIndex,  setActiveIndex]  = useState(0);
  const [detail,       setDetail]       = useState(null); // for catalog
  const [saving,       setSaving]       = useState(false);
  const [activity,     setActivity]     = useState([]);
  const [terminateOpen, setTerminateOpen] = useState(false);
  const [terminateReason, setTerminateReason] = useState('');

  // Local-edit buffer for permissions — saved to server on "Save changes"
  const [draftPerms, setDraftPerms] = useState({ permissions: {}, requiresApprovalFor: [] });

  const [inviteOpen, setInviteOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    Promise.all([relationAPI.list(), activityAPI.list({ limit: 8 })])
      .then(([rRel, rAct]) => {
        if (cancelled) return;
        const rels = (rRel.data?.relations || []).filter((r) => r.perspective === 'owner');
        setRelations(rels);
        setActivity(rAct.data?.rows || []);
      })
      .catch(() => toast.error('Could not load your agency relationships'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // When activeIndex changes, fetch detail (with catalog) and seed draft
  const current = relations[activeIndex];
  useEffect(() => {
    if (!current) return;
    relationAPI.get(current.id).then((r) => {
      setDetail(r.data);
      setDraftPerms({
        permissions:        { ...(r.data.permissions || {}) },
        requiresApprovalFor: [...(r.data.requires_approval_for || [])],
      });
    }).catch(() => toast.error('Could not load relation details'));
  }, [current?.id]);

  const dirty = useMemo(() => {
    if (!detail) return false;
    const a = detail.permissions || {};
    const b = draftPerms.permissions || {};
    if (JSON.stringify(Object.keys(a).sort().map((k) => [k, !!a[k]])) !==
        JSON.stringify(Object.keys(b).sort().map((k) => [k, !!b[k]]))) return true;
    const ra = (detail.requires_approval_for || []).slice().sort();
    const rb = (draftPerms.requiresApprovalFor || []).slice().sort();
    return JSON.stringify(ra) !== JSON.stringify(rb);
  }, [detail, draftPerms]);

  async function savePerms() {
    if (!current || !dirty) return;
    setSaving(true);
    try {
      const r = await relationAPI.updatePerms(current.id, {
        permissions: draftPerms.permissions,
        requires_approval_for: draftPerms.requiresApprovalFor,
      });
      setDetail((d) => d && { ...d, ...r.data });
      // refresh activity
      const a = await activityAPI.list({ limit: 8 });
      setActivity(a.data?.rows || []);
      toast.success('Permissions updated');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not save permissions');
    } finally {
      setSaving(false);
    }
  }

  async function lifecycle(action, ...args) {
    if (!current) return;
    try {
      const r = await relationAPI[action](current.id, ...args);
      setDetail((d) => d && { ...d, ...r.data });
      setRelations((list) => list.map((rel) => rel.id === current.id ? { ...rel, ...r.data } : rel));
      const a = await activityAPI.list({ limit: 8 });
      setActivity(a.data?.rows || []);
      toast.success(`Relationship ${action}d`);
    } catch (e) {
      toast.error(e?.response?.data?.error || `Could not ${action}`);
    }
  }

  if (loading) return <div style={{ padding: 32, color: 'var(--text-tertiary)' }}>Loading…</div>;

  if (!relations.length) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          My agency
        </h1>
        <p style={{ marginTop: 6, color: 'var(--text-secondary)' }}>
          You're managing your social media yourself. Want help?
        </p>
        <div style={{ marginTop: 18, padding: 20, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <span style={{ width: 40, height: 40, background: 'var(--brand-primary-glow)', color: 'var(--brand-primary-hover)', borderRadius: 'var(--radius-sm)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Send size={18} strokeWidth={2.2} />
          </span>
          <div style={{ flex: 1 }}>
            <strong style={{ color: 'var(--text-primary)', fontSize: 15 }}>Invite an agency to manage your account</strong>
            <p style={{ margin: '4px 0 10px', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.55 }}>
              Already work with someone? Send them an invite by email or pick from the marketplace.
              You stay in full control of permissions and access.
            </p>
            <button type="button" onClick={() => setInviteOpen(true)} style={btnPrimary}>
              <Send size={13} /> Invite an agency
            </button>
          </div>
        </div>
        <InviteAgencyModal open={inviteOpen} onClose={() => setInviteOpen(false)} onSent={() => toast.success('They\'ll get an email — we\'ll notify you when they respond.')} />
      </div>
    );
  }

  const status = current?.status || 'active';
  const statusPill = STATUS_PILL[status] || STATUS_PILL.active;

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            My agency
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>
            {relations.length} relationship{relations.length === 1 ? '' : 's'} · you stay in control of permissions and access.
          </p>
        </div>
        <button type="button" onClick={() => setInviteOpen(true)} style={btnGhost}>
          <Send size={13} /> Invite another agency
        </button>
      </header>
      <InviteAgencyModal open={inviteOpen} onClose={() => setInviteOpen(false)} onSent={() => toast.success('They\'ll get an email — we\'ll notify you when they respond.')} />

      {relations.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {relations.map((r, i) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setActiveIndex(i)}
              style={{
                padding: '6px 12px',
                fontSize: 13, fontWeight: i === activeIndex ? 600 : 500,
                color: i === activeIndex ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: i === activeIndex ? 'var(--brand-primary-soft)' : 'var(--surface-card)',
                border: `1px solid ${i === activeIndex ? 'var(--brand-primary)' : 'var(--border-default)'}`,
                borderRadius: 'var(--radius-pill)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {r.agency.name}
            </button>
          ))}
        </div>
      )}

      {current && (
        <>
          {/* Agency card */}
          <section style={card}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <span style={agencyAvatar}><Building2 size={22} strokeWidth={2} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {current.agency.name}
                  </h2>
                  {current.agency.is_verified && (
                    <span style={verifiedChip}><ShieldCheck size={11} /> Verified</span>
                  )}
                  <span style={{ ...pill, background: statusPill.bg, color: statusPill.fg }}>
                    {statusPill.label}
                  </span>
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {[current.agency.location, current.agency.review_count > 0 ? `★ ${(current.agency.avg_rating || 0).toFixed(1)} (${current.agency.review_count})` : ''].filter(Boolean).join(' · ')}
                </div>
                {current.agency.website && (
                  <a href={current.agency.website} target="_blank" rel="noreferrer" style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--brand-primary-hover)', fontSize: 12 }}>
                    {current.agency.website} <ExternalLink size={11} />
                  </a>
                )}
              </div>
            </div>

            {current.agency.description && (
              <p style={{ marginTop: 12, marginBottom: 0, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
                {current.agency.description}
              </p>
            )}

            {/* Lifecycle buttons */}
            <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {status === 'active' && (
                <button type="button" onClick={() => lifecycle('pause')} style={btnGhost}>
                  <Pause size={13} /> Pause access
                </button>
              )}
              {status === 'paused' && (
                <button type="button" onClick={() => lifecycle('resume')} style={btnGhost}>
                  <Play size={13} /> Resume
                </button>
              )}
              {status !== 'terminated' && (
                <button type="button" onClick={() => lifecycle('flag', 'flagged via end-user UI')} style={btnDangerGhost}>
                  <Flag size={13} /> Flag for review
                </button>
              )}
              {status !== 'terminated' && (
                <button type="button" onClick={() => setTerminateOpen(true)} style={btnDanger}>
                  <AlertTriangle size={13} /> Terminate
                </button>
              )}
              {(status === 'active' || status === 'terminated' || status === 'paused') && (
                <button type="button" onClick={() => setReviewOpen(true)} style={btnGhost}>
                  <Star size={13} /> Write a review
                </button>
              )}
            </div>
          </section>

          <WriteReviewModal
            open={reviewOpen}
            onClose={() => setReviewOpen(false)}
            agency={current.agency}
            onSaved={() => toast.success('Thanks — your review is live.')}
          />

          {/* Permissions editor */}
          {detail?.permission_catalog && (
            <section style={card}>
              <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Permissions
                </h3>
                <button type="button" onClick={savePerms} disabled={!dirty || saving} style={dirty && !saving ? btnPrimary : btnGhost}>
                  <Save size={13} /> {saving ? 'Saving…' : (dirty ? 'Save changes' : 'No changes')}
                </button>
              </header>
              <p style={{ ...hintText, margin: '0 0 12px' }}>
                Toggle anything off to revoke. Mark sensitive actions "Ask me first" so the agency must request approval before acting.
              </p>
              <PermissionMatrix
                catalog={detail.permission_catalog}
                permissions={draftPerms.permissions}
                requiresApprovalFor={draftPerms.requiresApprovalFor}
                readOnly={status === 'terminated'}
                onChange={({ permissions, requiresApprovalFor }) => setDraftPerms({ permissions, requiresApprovalFor })}
              />
            </section>
          )}

          {/* Activity highlights */}
          <section style={card}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                Recent activity
              </h3>
              <Link to="/u/activity" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--brand-primary-hover)', textDecoration: 'none' }}>
                Full log <ChevronRight size={12} />
              </Link>
            </header>
            {activity.length === 0 ? (
              <div style={{ padding: 14, fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                No activity yet.
              </div>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {activity.slice(0, 6).map((row) => (
                  <li key={row.id} style={activityRow}>
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: row.severity === 'critical' ? 'var(--danger)' :
                                  row.severity === 'warning'  ? 'var(--warning)' :
                                  row.severity === 'notice'   ? 'var(--brand-primary)' :
                                                                'var(--text-tertiary)',
                      flexShrink: 0,
                    }} />
                    <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>{row.description}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {new Date(row.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {terminateOpen && (
        <div style={backdropStyle} onClick={(e) => { if (e.target === e.currentTarget) setTerminateOpen(false); }}>
          <div style={{ ...card, width: '100%', maxWidth: 420 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>End the relationship?</h3>
            <p style={{ ...hintText, margin: '0 0 10px' }}>
              The agency loses all access immediately. Tell them why (optional, only the agency sees this).
            </p>
            <textarea
              rows={3}
              value={terminateReason}
              onChange={(e) => setTerminateReason(e.target.value)}
              placeholder="Reason (optional)"
              style={textareaStyle}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button type="button" onClick={() => setTerminateOpen(false)} style={btnGhost}>Cancel</button>
              <button type="button" onClick={() => { setTerminateOpen(false); lifecycle('terminate', terminateReason); setTerminateReason(''); }} style={btnDanger}>
                <AlertTriangle size={13} /> Yes, terminate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const card = {
  padding: 20,
  background: 'var(--surface-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-lg)',
};

const agencyAvatar = {
  width: 44, height: 44,
  background: 'var(--brand-primary-glow)',
  color: 'var(--brand-primary-hover)',
  borderRadius: 'var(--radius-md)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
};

const verifiedChip = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '2px 8px',
  background: 'var(--success-bg)', color: 'var(--success)',
  border: '1px solid var(--success)',
  borderRadius: 'var(--radius-pill)',
  fontSize: 10, fontWeight: 600,
};

const pill = {
  padding: '2px 8px',
  fontSize: 10, fontWeight: 600,
  letterSpacing: '0.04em', textTransform: 'uppercase',
  borderRadius: 'var(--radius-pill)',
};

const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px',
  background: 'var(--brand-primary)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius-md)',
  fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
};
const btnGhost = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 12px',
  background: 'transparent', color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
};
const btnDanger = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 12px',
  background: 'var(--danger)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius-md)',
  fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
};
const btnDangerGhost = {
  ...btnGhost,
  color: 'var(--danger)',
  borderColor: 'var(--danger)',
};

const hintText = {
  fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.55,
};

const activityRow = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '8px 10px',
  background: 'var(--surface-sunken)',
  borderRadius: 'var(--radius-sm)',
};

const backdropStyle = {
  position: 'fixed', inset: 0, zIndex: 1100,
  background: 'rgba(10,14,20,0.50)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 20,
};

const textareaStyle = {
  width: '100%', padding: 10,
  background: 'var(--surface-sunken)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 13, color: 'var(--text-primary)',
  outline: 'none', fontFamily: 'inherit',
  resize: 'vertical', boxSizing: 'border-box',
};
