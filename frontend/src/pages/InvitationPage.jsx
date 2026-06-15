/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * InvitationPage — /invitation/:token
 * Public-readable invitation. If the user isn't logged in, we stash the token
 * and bounce them to /login (which will return here after auth).
 * If logged in, we show Accept / Reject UI.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Building2, CheckCircle, XCircle, Clock } from 'lucide-react';

import AuthLayout from '../components/auth/AuthLayout';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import { invitationAPI } from '../services/api';
import { useAuth } from '../hooks/useAuth';

export default function InvitationPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, refreshAuth } = useAuth();

  const [inv, setInv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [responding, setResponding] = useState('');
  const [done, setDone] = useState('');

  useEffect(() => {
    invitationAPI.getByToken(token)
      .then((res) => setInv(res.data))
      .catch((e) => setError(e?.response?.data?.error || 'Invitation not found.'))
      .finally(() => setLoading(false));
  }, [token]);

  // Stash & redirect to login if not authenticated
  useEffect(() => {
    if (!loading && inv && !user) {
      localStorage.setItem('pending_invite_token', token);
      navigate(`/login?next=/invitation/${token}`, { replace: true });
    }
  }, [loading, inv, user, token, navigate]);

  async function handleRespond(action) {
    setResponding(action);
    setError('');
    try {
      const res = await invitationAPI.respond(token, action);
      if (action === 'accept') {
        await refreshAuth(res.data.access, res.data.refresh);
        setDone('accepted');
        setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
      } else {
        setDone('rejected');
      }
    } catch (e) {
      setError(e?.response?.data?.error || 'Something went wrong.');
    } finally {
      setResponding('');
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────
  let content;
  if (loading) {
    content = <CenteredState icon={<Spinner size="md" />} title="Loading invitation…" />;
  } else if (error && !inv) {
    content = (
      <CenteredState
        icon={<XCircle size={28} strokeWidth={1.8} />}
        iconColor="var(--danger)"
        iconBg="var(--danger-bg)"
        title="Invitation not found"
        description={error}
        action={<Button as={Link} to="/login" variant="secondary" fullWidth>Back to sign in</Button>}
      />
    );
  } else if (done === 'accepted') {
    content = (
      <CenteredState
        icon={<CheckCircle size={28} strokeWidth={1.8} />}
        iconColor="var(--success)"
        iconBg="var(--success-bg)"
        title="Invitation accepted!"
        description="Redirecting you to your dashboard…"
      />
    );
  } else if (done === 'rejected') {
    content = (
      <CenteredState
        icon={<XCircle size={28} strokeWidth={1.8} />}
        iconColor="var(--danger)"
        iconBg="var(--danger-bg)"
        title="Invitation declined"
        description={`You've declined the invitation from ${inv?.agency_name}.`}
        action={<Button as={Link} to="/pending" variant="secondary" fullWidth>Back to dashboard</Button>}
      />
    );
  } else if (inv?.is_expired || inv?.status === 'expired') {
    content = (
      <CenteredState
        icon={<Clock size={28} strokeWidth={1.8} />}
        iconColor="var(--warning)"
        iconBg="var(--warning-bg)"
        title="Invitation expired"
        description="This invitation has expired. Ask the agency to send a new one."
        action={<Button as={Link} to="/login" variant="secondary" fullWidth>Back to sign in</Button>}
      />
    );
  } else if (inv?.status && inv.status !== 'pending') {
    content = (
      <CenteredState
        icon={<Building2 size={28} strokeWidth={1.8} />}
        title="Already responded"
        description={`This invitation was already ${inv.status}.`}
        action={<Button as={Link} to="/dashboard" variant="secondary" fullWidth>Go to dashboard</Button>}
      />
    );
  } else if (inv) {
    // Active pending invitation
    content = (
      <div style={cardStyle}>
        <div aria-hidden style={{ ...iconBubbleStyle, background: 'var(--brand-primary-soft)', color: 'var(--brand-primary-hover)' }}>
          <Building2 size={26} strokeWidth={1.8} />
        </div>
        <h1 style={titleStyle}>You've been invited</h1>
        <p style={subStyle}>
          <strong style={{ color: 'var(--text-primary)' }}>{inv.agency_name}</strong> wants to manage your
          social media analytics on Social Stats.
        </p>

        <div
          style={{
            marginTop: 14,
            padding: '12px 14px',
            background: 'var(--surface-sunken)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'left',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
            Agency
          </div>
          <div style={{ marginTop: 4, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
            {inv.agency_name}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {inv.agency_email}
          </div>

          {inv.message && (
            <div
              style={{
                marginTop: 12,
                padding: '10px 12px',
                background: 'var(--surface-card)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 13,
                fontStyle: 'italic',
                color: 'var(--text-secondary)',
                lineHeight: 1.55,
              }}
            >
              "{inv.message}"
            </div>
          )}
        </div>

        {error && (
          <div
            role="alert"
            style={{
              marginTop: 12,
              padding: '10px 12px',
              background: 'var(--danger-bg)',
              border: '1px solid var(--danger)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--danger)',
              fontSize: 13,
              textAlign: 'left',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 18 }}>
          <Button
            variant="secondary"
            size="md"
            icon={XCircle}
            disabled={!!responding}
            loading={responding === 'reject'}
            onClick={() => handleRespond('reject')}
            fullWidth
          >
            Decline
          </Button>
          <Button
            size="md"
            icon={CheckCircle}
            disabled={!!responding}
            loading={responding === 'accept'}
            onClick={() => handleRespond('accept')}
            fullWidth
          >
            Accept
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AuthLayout
      heroTitle="Join your agency on Social Stats."
      heroSub="Accept the invitation to give your agency access to your social media analytics."
    >
      {content}
    </AuthLayout>
  );
}

// ── small centered state helper ─────────────────────────────────────────
function CenteredState({ icon, iconColor, iconBg, title, description, action }) {
  return (
    <div style={{ ...cardStyle, textAlign: 'center' }}>
      <div
        aria-hidden
        style={{
          ...iconBubbleStyle,
          background: iconBg || 'var(--brand-primary-soft)',
          color: iconColor || 'var(--brand-primary-hover)',
        }}
      >
        {icon}
      </div>
      {title && <h1 style={titleStyle}>{title}</h1>}
      {description && <p style={{ ...subStyle, margin: '8px 0 0' }}>{description}</p>}
      {action && <div style={{ marginTop: 20 }}>{action}</div>}
    </div>
  );
}

const cardStyle = {
  background: 'var(--surface-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-xl)',
  padding: 32,
  boxShadow: 'var(--shadow-md)',
  textAlign: 'center',
};

const iconBubbleStyle = {
  width: 56, height: 56,
  margin: '0 auto 16px',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: '50%',
};

const titleStyle = {
  margin: 0,
  fontSize: 22, fontWeight: 600,
  letterSpacing: '-0.02em',
  color: 'var(--text-primary)',
};

const subStyle = {
  margin: '8px 0 0',
  fontSize: 14, lineHeight: 1.6,
  color: 'var(--text-secondary)',
};
