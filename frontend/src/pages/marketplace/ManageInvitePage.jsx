/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * ManageInvitePage — public landing page for an agency-to-end-user invite.
 *
 * Reached at /invite/:token from the email magic link. Anyone (logged-in
 * or not) can fetch the invite via GET. Accepting requires authentication
 * AND the auth user's email must match `target_email` — if either is
 * missing we route to /auth/end-user/signup with the token so signup can
 * pre-fill and auto-accept.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  Sparkles, Building2, ShieldCheck, Check, X, AlertTriangle, ChevronRight,
  CalendarClock,
} from 'lucide-react';

import { manageRequestAPI } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import toast from '../../components/ui/toast';

const RISK_COLOR = {
  low:      'var(--text-tertiary)',
  medium:   'var(--warning)',
  high:     'var(--danger)',
  critical: 'var(--danger)',
};

export default function ManageInvitePage() {
  const { token } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [invite,   setInvite]   = useState(null);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(true);
  const [busy,     setBusy]     = useState(false);
  // user-side overrides
  const [overrides,    setOverrides]    = useState({});
  const [needApproval, setNeedApproval] = useState({});
  const [declineOpen,  setDeclineOpen]  = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    manageRequestAPI.invite(token)
      .then((r) => { if (!cancelled) setInvite(r.data); })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.response?.data?.error || 'Could not load invitation');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const proposed = invite?.proposed_permissions || {};
  const catalog  = invite?.permission_catalog || {};

  // Effective permissions for preview = proposed XOR overrides
  const effective = useMemo(() => {
    const out = {};
    for (const k of Object.keys(catalog)) {
      out[k] = (k in overrides) ? !!overrides[k] : !!proposed[k];
    }
    return out;
  }, [catalog, overrides, proposed]);

  const grouped = useMemo(() => {
    const out = {};
    Object.entries(catalog).forEach(([key, meta]) => {
      const cat = meta.category || 'other';
      out[cat] = out[cat] || [];
      out[cat].push({ key, ...meta });
    });
    return out;
  }, [catalog]);

  const grantedCount = Object.values(effective).filter(Boolean).length;

  function togglePerm(key) {
    setOverrides((o) => ({ ...o, [key]: !effective[key] }));
  }
  function toggleApproval(key) {
    setNeedApproval((m) => ({ ...m, [key]: !m[key] }));
  }

  async function accept() {
    if (!user) {
      navigate(`/auth/end-user/signup?invite=${token}`);
      return;
    }
    if (invite?.target_email && user.email && user.email.toLowerCase() !== invite.target_email.toLowerCase()) {
      toast.error('This invitation is for a different email. Sign in with that account.');
      return;
    }
    setBusy(true);
    try {
      const requires_approval_for = Object.keys(needApproval).filter((k) => needApproval[k]);
      await manageRequestAPI.accept(token, {
        permissions_overrides: overrides,
        requires_approval_for,
      });
      toast.success('Invitation accepted');
      navigate('/u');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not accept');
    } finally {
      setBusy(false);
    }
  }

  async function decline() {
    if (!user) {
      navigate(`/auth/end-user/signup?invite=${token}`);
      return;
    }
    setBusy(true);
    try {
      await manageRequestAPI.decline(token, { reason: declineReason });
      toast.success('Invitation declined');
      setDeclineOpen(false);
      navigate('/');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not decline');
    } finally {
      setBusy(false);
    }
  }

  if (loading || authLoading) {
    return <CenterFrame><Spinner /></CenterFrame>;
  }

  if (error || !invite) {
    return (
      <CenterFrame>
        <div style={errorBox}>
          <AlertTriangle size={20} style={{ color: 'var(--danger)' }} />
          <div>
            <strong style={{ color: 'var(--text-primary)' }}>Invitation unavailable</strong>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>{error || 'Unknown error'}</p>
          </div>
        </div>
      </CenterFrame>
    );
  }

  const decided = ['accepted', 'declined', 'canceled', 'expired'].includes(invite.status);
  const expired = invite.is_expired || invite.status === 'expired';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-page)', padding: '32px 16px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={topbarStyle}>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'inherit' }}>
            <span style={brandMark}><Sparkles size={14} strokeWidth={2.4} /></span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Social Stats</span>
          </Link>
        </div>

        <div style={card}>
          <header style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 18 }}>
            <span style={agencyAvatar}><Building2 size={22} strokeWidth={2} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand-primary-hover)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Manage-account invitation
              </div>
              <h1 style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
                {invite.agency.name} wants to manage your social
              </h1>
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-tertiary)' }}>
                {invite.agency.is_verified && (
                  <span style={verifiedChip}><ShieldCheck size={11} /> Verified</span>
                )}
                {invite.agency.location && <span>· {invite.agency.location}</span>}
                {invite.agency.review_count > 0 && <span>· ★ {invite.agency.avg_rating.toFixed(1)} ({invite.agency.review_count})</span>}
              </div>
            </div>
          </header>

          {invite.proposed_message && (
            <div style={messageBox}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--brand-primary-hover)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Message from {invite.agency.name}
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                {invite.proposed_message}
              </p>
            </div>
          )}

          {invite.proposed_pricing && (
            <div style={pricingChip}>
              ₹{invite.proposed_pricing.toLocaleString('en-IN')} / month proposed
            </div>
          )}

          <section>
            <div style={sectionHead}>
              <span>What they'll be able to do</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>
                {grantedCount} granted
              </span>
            </div>
            <p style={{ ...hintStyle, marginTop: 4 }}>
              You're in control. Toggle anything off — or mark sensitive actions as "needs my approval"
              so they ping you before doing it.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
              {Object.entries(grouped).map(([cat, perms]) => (
                <div key={cat}>
                  <div style={catLabel}>{cat}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {perms.map((p) => (
                      <div key={p.key} style={permRow}>
                        <input
                          type="checkbox"
                          checked={!!effective[p.key]}
                          disabled={decided}
                          onChange={() => togglePerm(p.key)}
                        />
                        <span style={{ flex: 1, color: 'var(--text-primary)', fontSize: 13 }}>{p.label}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: RISK_COLOR[p.risk] }}>
                          {p.risk}
                        </span>
                        {effective[p.key] && (
                          <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={!!needApproval[p.key]}
                              disabled={decided}
                              onChange={() => toggleApproval(p.key)}
                            />
                            Ask me first
                          </label>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {!decided && !expired && (
            <footer style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <CalendarClock size={12} />
                {invite.expires_at ? `Expires ${new Date(invite.expires_at).toLocaleDateString()}` : ''}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setDeclineOpen(true)} disabled={busy} style={btnGhost}>
                  <X size={14} /> Decline
                </button>
                <button type="button" onClick={accept} disabled={busy} style={btnPrimary}>
                  {busy ? 'Working…' : <>Accept <ChevronRight size={14} /></>}
                </button>
              </div>
            </footer>
          )}

          {decided && (
            <div style={resolvedBox}>
              <Check size={18} style={{ color: 'var(--success)' }} />
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Already {invite.status}</strong>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                  {invite.status === 'accepted' && 'You can manage this relationship from your dashboard.'}
                  {invite.status === 'declined' && 'You can ignore this email — no action needed.'}
                  {invite.status === 'canceled' && 'The agency canceled this invitation.'}
                  {invite.status === 'expired' && 'The invitation expired. Ask the agency to resend.'}
                </p>
              </div>
            </div>
          )}
        </div>

        <p style={{ marginTop: 18, textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>
          You can change permissions or revoke access at any time from your dashboard.
        </p>
      </div>

      {declineOpen && (
        <div style={backdropStyle} onClick={(e) => { if (e.target === e.currentTarget) setDeclineOpen(false); }}>
          <div style={{ ...card, width: '100%', maxWidth: 420 }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Decline this invitation?</h2>
            <textarea
              rows={3}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="(optional) Tell them why — only the agency sees this."
              style={textareaStyle}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button type="button" onClick={() => setDeclineOpen(false)} style={btnGhost}>Cancel</button>
              <button type="button" onClick={decline} disabled={busy} style={btnPrimary}>
                {busy ? 'Working…' : 'Decline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CenterFrame({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--surface-page)' }}>
      {children}
    </div>
  );
}

function Spinner() {
  return <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Loading invitation…</div>;
}

const card = {
  padding: 24,
  background: 'var(--surface-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-md)',
};

const topbarStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  marginBottom: 18,
};

const brandMark = {
  width: 26, height: 26,
  background: 'var(--brand-gradient)',
  color: '#fff',
  borderRadius: 'var(--radius-sm)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};

const agencyAvatar = {
  width: 48, height: 48,
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
  fontSize: 11, fontWeight: 600,
};

const messageBox = {
  marginBottom: 14,
  padding: '12px 14px',
  background: 'var(--brand-primary-soft)',
  border: '1px solid var(--brand-primary-glow)',
  borderRadius: 'var(--radius-md)',
};

const pricingChip = {
  display: 'inline-block',
  padding: '4px 10px',
  marginBottom: 16,
  background: 'var(--surface-sunken)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-pill)',
  fontSize: 12, fontWeight: 600,
  color: 'var(--text-secondary)',
};

const sectionHead = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
  fontSize: 14, fontWeight: 700, color: 'var(--text-primary)',
  paddingTop: 6,
};

const catLabel = {
  fontSize: 10, fontWeight: 600,
  letterSpacing: '0.06em', textTransform: 'uppercase',
  color: 'var(--text-tertiary)', marginBottom: 4,
};

const permRow = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '6px 10px',
  background: 'var(--surface-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)',
};

const hintStyle = {
  margin: 0, fontSize: 12,
  color: 'var(--text-tertiary)', lineHeight: 1.55,
};

const errorBox = {
  display: 'flex', gap: 12,
  padding: 18, maxWidth: 420,
  background: 'var(--surface-card)',
  border: '1px solid var(--danger)',
  borderRadius: 'var(--radius-md)',
};

const resolvedBox = {
  display: 'flex', gap: 12, alignItems: 'flex-start',
  marginTop: 18, padding: 14,
  background: 'var(--success-bg)',
  border: '1px solid var(--success)',
  borderRadius: 'var(--radius-md)',
};

const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '10px 16px',
  background: 'var(--brand-primary)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius-md)',
  fontSize: 13, fontWeight: 600,
  fontFamily: 'inherit', cursor: 'pointer',
};

const btnGhost = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '10px 14px',
  background: 'transparent', color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13, fontWeight: 500,
  fontFamily: 'inherit', cursor: 'pointer',
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
