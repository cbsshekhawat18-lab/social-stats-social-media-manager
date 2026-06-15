/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * AgencyInviteResponsePage — public landing for an end-user → agency invite.
 *
 * Reached at /agency-invite/:token from the email magic link. The signed-in
 * recipient must be an active member (owner / admin / manager) of the
 * target agency to accept or decline.
 *
 * Difference from ManageInvitePage (): the agency CANNOT widen the
 * permissions the user proposed. They either accept the proposal or decline.
 * (If they want different permissions, they decline + send their own
 * SendManageRequest.)
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Sparkles, Building2, ChevronRight, Check, X, AlertTriangle,
  CalendarClock,
} from 'lucide-react';

import PermissionMatrix from '../../components/marketplace/PermissionMatrix';
import { agencyInviteAPI } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import toast from '../../components/ui/toast';


export default function AgencyInviteResponsePage() {
  const { token } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [invite,  setInvite]  = useState(null);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(true);
  const [busy,    setBusy]    = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    agencyInviteAPI.invite(token)
      .then((r) => { if (!cancelled) setInvite(r.data); })
      .catch((e) => { if (!cancelled) setError(e?.response?.data?.error || 'Could not load invitation'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const grantedCount = useMemo(
    () => Object.values(invite?.proposed_permissions || {}).filter(Boolean).length,
    [invite]
  );

  async function accept() {
    if (!user) {
      navigate(`/login?next=/agency-invite/${token}`);
      return;
    }
    setBusy(true);
    try {
      await agencyInviteAPI.accept(token);
      toast.success('Invitation accepted');
      navigate('/admin');  // agency-side dashboard (existing)
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not accept');
    } finally {
      setBusy(false);
    }
  }

  async function decline() {
    if (!user) {
      navigate(`/login?next=/agency-invite/${token}`);
      return;
    }
    if (!window.confirm('Decline this invitation?')) return;
    setBusy(true);
    try {
      await agencyInviteAPI.decline(token);
      toast.success('Invitation declined');
      navigate('/');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not decline');
    } finally {
      setBusy(false);
    }
  }

  if (loading || authLoading) {
    return <Center><span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Loading invitation…</span></Center>;
  }

  if (error || !invite) {
    return (
      <Center>
        <div style={errorBox}>
          <AlertTriangle size={20} style={{ color: 'var(--danger)' }} />
          <div>
            <strong style={{ color: 'var(--text-primary)' }}>Invitation unavailable</strong>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>{error || 'Unknown error'}</p>
          </div>
        </div>
      </Center>
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
          <header style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
            <span style={clientAvatar}><Building2 size={20} strokeWidth={2} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand-primary-hover)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Manage-account request
              </div>
              <h1 style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
                {invite.client_company} wants you to manage their social
              </h1>
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-tertiary)' }}>
                from <strong style={{ color: 'var(--text-secondary)' }}>{invite.inviter_user_name}</strong> · {invite.inviter_user_email}
                {invite.client_industry && <> · {invite.client_industry}</>}
              </div>
            </div>
          </header>

          {invite.message && (
            <div style={messageBox}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--brand-primary-hover)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Message
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                {invite.message}
              </p>
            </div>
          )}

          {(invite.budget_range || (invite.desired_services && invite.desired_services.length > 0)) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {invite.budget_range && (
                <span style={chipNeutral}>Budget · {invite.budget_range}</span>
              )}
              {(invite.desired_services || []).map((s) => (
                <span key={s} style={chipNeutral}>{s}</span>
              ))}
            </div>
          )}

          <section>
            <div style={sectionHead}>
              <span>Proposed access</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>
                {grantedCount} granted
              </span>
            </div>
            <p style={{ ...hintText, marginTop: 4 }}>
              The client picked these — you can't widen them at accept time. If you need different access,
              decline this and send them a manage-request from your agency dashboard with your own proposal.
            </p>
            <div style={{ marginTop: 12 }}>
              <PermissionMatrix
                catalog={invite.permission_catalog || {}}
                permissions={invite.proposed_permissions || {}}
                requiresApprovalFor={[]}
                readOnly
              />
            </div>
          </section>

          {!decided && !expired && (
            <footer style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <CalendarClock size={12} />
                {invite.expires_at ? `Expires ${new Date(invite.expires_at).toLocaleDateString()}` : ''}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={decline} disabled={busy} style={btnGhost}>
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
                  {invite.status === 'accepted' && 'You are now managing this client.'}
                  {invite.status === 'declined' && 'You declined this invitation.'}
                  {invite.status === 'expired' && 'This invitation expired.'}
                </p>
              </div>
            </div>
          )}
        </div>

        <p style={{ marginTop: 18, textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>
          Both sides keep full visibility into every action taken on this account.
        </p>
      </div>
    </div>
  );
}

function Center({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--surface-page)' }}>
      {children}
    </div>
  );
}

const card = {
  padding: 24,
  background: 'var(--surface-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-md)',
};

const topbarStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 };

const brandMark = {
  width: 26, height: 26,
  background: 'var(--brand-gradient)', color: '#fff',
  borderRadius: 'var(--radius-sm)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};

const clientAvatar = {
  width: 44, height: 44,
  background: 'var(--brand-primary-glow)', color: 'var(--brand-primary-hover)',
  borderRadius: 'var(--radius-md)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
};

const messageBox = {
  marginBottom: 14,
  padding: '12px 14px',
  background: 'var(--brand-primary-soft)',
  border: '1px solid var(--brand-primary-glow)',
  borderRadius: 'var(--radius-md)',
};

const chipNeutral = {
  padding: '3px 10px',
  background: 'var(--surface-sunken)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-pill)',
  fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
};

const sectionHead = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
  fontSize: 14, fontWeight: 700, color: 'var(--text-primary)',
};

const hintText = { margin: 0, fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.55 };

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
  fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
};

const btnGhost = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '10px 14px',
  background: 'transparent', color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
};
