/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * PendingDashboard — shown to self-registered clients who have no agency yet.
 * Two paths: go solo (setup-solo endpoint) or wait for / accept an agency invitation.
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { soloAPI, invitationAPI } from '../services/api';
import { Building2, UserCheck, Clock, CheckCircle, XCircle, Bell, LogOut, ChevronRight, Loader2 } from 'lucide-react';
import { BrandLogoHorizontal } from '../components/ui/BrandLogo';

const CYAN  = '#00d7ff';
const BG    = 'var(--surface-page)';
const WHITE = '#ffffff';

export default function PendingDashboard() {
  const { user, logout, refreshAuth } = useAuth();
  const navigate = useNavigate();

  const [invitations, setInvitations]   = useState([]);
  const [loadingInvs, setLoadingInvs]   = useState(true);
  const [soloLoading, setSoloLoading]   = useState(false);
  const [respondingId, setRespondingId] = useState(null);
  const [error, setError]               = useState('');
  const [success, setSuccess]           = useState('');

  const fetchInvitations = useCallback(async () => {
    try {
      const res = await invitationAPI.mine();
      setInvitations(res.data.filter(i => i.status === 'pending' && !i.is_expired));
    } catch {
      // ignore
    } finally {
      setLoadingInvs(false);
    }
  }, []);

  useEffect(() => {
    fetchInvitations();
    const interval = setInterval(fetchInvitations, 30000);
    return () => clearInterval(interval);
  }, [fetchInvitations]);

  const handleSolo = async () => {
    setSoloLoading(true);
    setError('');
    try {
      const res = await soloAPI.setup();
      await refreshAuth(res.data.access, res.data.refresh);
      navigate('/dashboard', { replace: true });
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to set up solo account.');
      setSoloLoading(false);
    }
  };

  const handleRespond = async (token, action) => {
    setRespondingId(token + action);
    setError('');
    try {
      const res = await invitationAPI.respond(token, action);
      if (action === 'accept') {
        await refreshAuth(res.data.access, res.data.refresh);
        navigate('/dashboard', { replace: true });
      } else {
        setSuccess('Invitation rejected.');
        fetchInvitations();
      }
    } catch (e) {
      setError(e?.response?.data?.error || 'Something went wrong.');
    } finally {
      setRespondingId(null);
    }
  };

  const pendingCount = invitations.length;

  return (
    <div style={s.page}>
      {/* Top bar */}
      <header style={s.topBar}>
        <BrandLogoHorizontal height={32} />
        <div style={s.topRight}>
          {pendingCount > 0 && (
            <div style={s.bellBadge}>
              <Bell size={18} />
              <span style={s.badge}>{pendingCount}</span>
            </div>
          )}
          <button style={s.logoutBtn} onClick={() => { logout(); navigate('/login'); }}>
            <LogOut size={15} />
            <span>Sign out</span>
          </button>
        </div>
      </header>

      <div style={s.body}>
        {/* Welcome */}
        <div style={s.welcome}>
          <div style={s.avatar}>{(user?.name || user?.email || 'U')[0].toUpperCase()}</div>
          <div>
            <h1 style={s.welcomeTitle}>Welcome{user?.name ? `, ${user.name}` : ''}!</h1>
            <p style={s.welcomeSub}>Choose how you'd like to use Social Stats.</p>
          </div>
        </div>

        {error   && <div style={s.errorBanner}>{error}</div>}
        {success && <div style={s.successBanner}>{success}</div>}

        <div style={s.cards}>
          {/* Solo card */}
          <div style={s.card}>
            <div style={s.cardIcon}><UserCheck size={28} color={CYAN} /></div>
            <h2 style={s.cardTitle}>Use Solo</h2>
            <p style={s.cardDesc}>
              Manage your own social media analytics independently — no agency needed.
              You can connect your platforms right away.
            </p>
            <button
              style={{ ...s.primaryBtn, opacity: soloLoading ? 0.7 : 1 }}
              onClick={handleSolo}
              disabled={soloLoading}
            >
              {soloLoading
                ? <><Loader2 size={16} style={{ animation: 'spin .8s linear infinite' }} /> Setting up…</>
                : <><span>Get started solo</span><ChevronRight size={16} /></>
              }
            </button>
          </div>

          {/* Agency card */}
          <div style={s.card}>
            <div style={s.cardIcon}><Building2 size={28} color='#7c3aed' /></div>
            <h2 style={s.cardTitle}>Connect with an Agency</h2>
            <p style={s.cardDesc}>
              An agency can manage your analytics for you. Accept a pending invitation
              below, or ask your agency to send you one.
            </p>

            {loadingInvs ? (
              <div style={s.loadingRow}><Loader2 size={18} style={{ animation: 'spin .8s linear infinite', color: 'var(--text-tertiary)' }} /></div>
            ) : pendingCount === 0 ? (
              <div style={s.emptyInv}>
                <Clock size={16} color='var(--text-tertiary)' />
                <span>No pending invitations yet.</span>
              </div>
            ) : (
              <div style={s.invList}>
                {invitations.map(inv => (
                  <div key={inv.token} style={s.invItem}>
                    <div style={s.invInfo}>
                      <span style={s.invAgency}>{inv.agency_name}</span>
                      <span style={s.invEmail}>{inv.agency_email}</span>
                      {inv.message && <span style={s.invMsg}>"{inv.message}"</span>}
                    </div>
                    <div style={s.invActions}>
                      <button
                        style={s.acceptBtn}
                        disabled={!!respondingId}
                        onClick={() => handleRespond(inv.token, 'accept')}
                      >
                        {respondingId === inv.token + 'accept'
                          ? <Loader2 size={13} style={{ animation: 'spin .8s linear infinite' }} />
                          : <><CheckCircle size={13} /> Accept</>
                        }
                      </button>
                      <button
                        style={s.rejectBtn}
                        disabled={!!respondingId}
                        onClick={() => handleRespond(inv.token, 'reject')}
                      >
                        {respondingId === inv.token + 'reject'
                          ? <Loader2 size={13} style={{ animation: 'spin .8s linear infinite' }} />
                          : <><XCircle size={13} /> Reject</>
                        }
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    background: BG,
    display: 'flex',
    flexDirection: 'column',
  },
  topBar: {
    background: WHITE,
    borderBottom: '1px solid #e8edf2',
    padding: '14px 32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 1px 4px rgba(0,0,0,.06)',
  },
  topRight: { display: 'flex', alignItems: 'center', gap: 16 },
  bellBadge: {
    position: 'relative',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    background: '#ef4444',
    color: WHITE,
    fontSize: 10,
    fontWeight: 700,
    borderRadius: 999,
    padding: '1px 5px',
    lineHeight: 1.4,
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'none',
    border: '1px solid var(--border-default)',
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 13,
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontWeight: 500,
  },
  body: {
    flex: 1,
    maxWidth: 900,
    width: '100%',
    margin: '0 auto',
    padding: '48px 24px',
  },
  welcome: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    marginBottom: 40,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: '50%',
    background: `linear-gradient(135deg, ${CYAN}, #0099bb)`,
    color: WHITE,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 24,
    fontWeight: 700,
    flexShrink: 0,
  },
  welcomeTitle: { margin: 0, fontSize: 26, fontWeight: 700, color: 'var(--text-primary)' },
  welcomeSub:   { margin: '4px 0 0', fontSize: 15, color: 'var(--text-secondary)' },
  errorBanner: {
    background: '#fef2f2',
    border: '1px solid #fca5a5',
    color: '#dc2626',
    borderRadius: 10,
    padding: '12px 16px',
    marginBottom: 20,
    fontSize: 14,
  },
  successBanner: {
    background: '#f0fdf4',
    border: '1px solid #86efac',
    color: '#166534',
    borderRadius: 10,
    padding: '12px 16px',
    marginBottom: 20,
    fontSize: 14,
  },
  cards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
    gap: 24,
  },
  card: {
    background: WHITE,
    borderRadius: 16,
    padding: '32px 28px',
    boxShadow: '0 2px 12px rgba(0,0,0,.06)',
    border: '1px solid #e8edf2',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 12,
    background: 'var(--surface-sunken)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid #e8edf2',
  },
  cardTitle: { margin: 0, fontSize: 19, fontWeight: 700, color: 'var(--text-primary)' },
  cardDesc:  { margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, flex: 1 },
  primaryBtn: {
    marginTop: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    background: `linear-gradient(135deg, ${CYAN}, #0099bb)`,
    color: WHITE,
    border: 'none',
    borderRadius: 10,
    padding: '12px 20px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity .2s',
  },
  loadingRow: { display: 'flex', justifyContent: 'center', padding: '16px 0' },
  emptyInv: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: 'var(--text-tertiary)',
    fontSize: 13,
    padding: '8px 0',
  },
  invList: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 },
  invItem: {
    background: 'var(--surface-sunken)',
    border: '1px solid #e8edf2',
    borderRadius: 10,
    padding: '12px 14px',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  invInfo:   { display: 'flex', flexDirection: 'column', gap: 2, flex: 1 },
  invAgency: { fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' },
  invEmail:  { fontSize: 12, color: 'var(--text-secondary)' },
  invMsg:    { fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: 2 },
  invActions: { display: 'flex', gap: 8, flexShrink: 0 },
  acceptBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    background: '#dcfce7',
    color: '#166534',
    border: '1px solid #86efac',
    borderRadius: 7,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  rejectBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    background: '#fef2f2',
    color: '#dc2626',
    border: '1px solid #fca5a5',
    borderRadius: 7,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
};
