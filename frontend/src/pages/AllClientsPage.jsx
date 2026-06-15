/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClients } from '../hooks/useData';
import { invitationAPI, clientsAPI } from '../services/api';
import {
  Search, ChevronRight, Settings, Mail, X,
  Loader2, Users, Send, Clock, CheckCircle,
  XCircle, RefreshCw, Building2, UserCheck, Zap,
} from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';

const STATUS_COLOR = {
  pending:   { text: '#d97706', bg: '#fef3c7', label: 'Pending' },
  accepted:  { text: '#16a34a', bg: '#dcfce7', label: 'Accepted' },
  rejected:  { text: '#dc2626', bg: '#fee2e2', label: 'Rejected' },
  expired:   { text: 'var(--text-tertiary)', bg: 'var(--surface-sunken)', label: 'Expired' },
  cancelled: { text: 'var(--text-tertiary)', bg: 'var(--surface-sunken)', label: 'Canceled' },
};

export default function AllClientsPage({ onSelectClient }) {
  const navigate             = useNavigate();
  const { clients } = useClients();
  const [search, setSearch]  = useState('');

  // ── Sync state ───────────────────────────────────────────────────────────────
  const [syncingAll,  setSyncingAll]  = useState(false);
  const [syncingId,   setSyncingId]   = useState(null);  // per-client sync
  const [syncMsg,     setSyncMsg]     = useState('');

  const handleSyncAll = async () => {
    setSyncingAll(true); setSyncMsg('');
    try {
      const res = await clientsAPI.syncAll();
      setSyncMsg(`Queued sync for ${res.data.queued_clients} client(s).`);
      setTimeout(() => setSyncMsg(''), 5000);
    } catch { setSyncMsg('Sync failed. Please try again.'); }
    finally { setSyncingAll(false); }
  };

  const handleSyncOne = async (clientId) => {
    setSyncingId(clientId);
    try {
      await clientsAPI.triggerSync(clientId);
    } catch { /* ignore */ }
    finally { setSyncingId(null); }
  };

  // ── Invite form ─────────────────────────────────────────────────────────────
  const [inviteEmail,  setInviteEmail]  = useState('');
  const [inviteMsg,    setInviteMsg]    = useState('');
  const [inviting,     setInviting]     = useState(false);
  const [inviteResult, setInviteResult] = useState(''); // '' | 'success' | 'error:…'

  // ── Invitations list ─────────────────────────────────────────────────────────
  const [invitations,     setInvitations]     = useState([]);
  const [loadingInvList,  setLoadingInvList]  = useState(false);
  const [cancelingId,     setCancelingId]     = useState(null);

  const fetchInvitations = useCallback(async () => {
    setLoadingInvList(true);
    try {
      const res = await invitationAPI.mine();
      setInvitations(res.data);
    } catch { /* ignore */ }
    finally { setLoadingInvList(false); }
  }, []);

  useEffect(() => { fetchInvitations(); }, [fetchInvitations]);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true); setInviteResult('');
    try {
      await invitationAPI.send({ client_email: inviteEmail.trim().toLowerCase(), message: inviteMsg.trim() });
      setInviteResult('success');
      setInviteEmail(''); setInviteMsg('');
      fetchInvitations();
    } catch (err) {
      setInviteResult('error:' + (err?.response?.data?.error || 'Failed to send invitation.'));
    } finally { setInviting(false); }
  };

  const handleCancelInv = async (id) => {
    setCancelingId(id);
    try {
      await invitationAPI.cancel(id);
      fetchInvitations();
    } catch { /* ignore */ }
    finally { setCancelingId(null); }
  };

  // ── Derived stats ────────────────────────────────────────────────────────────
  const pendingCount = invitations.filter(i => i.status === 'pending' && !i.is_expired).length;

  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    return !q || c.company?.toLowerCase().includes(q) || c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
  });

  return (
    <div style={S.page}>
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} connected client${clients.length !== 1 ? 's' : ''}`}
      />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Stats strip ─────────────────────────────────────────────────────── */}
      <div style={S.statsRow}>
        <div style={S.statCard}>
          <UserCheck size={18} style={{ color: '#16a34a' }} />
          <div>
            <div style={S.statNum}>{clients.length}</div>
            <div style={S.statLabel}>Connected Clients</div>
          </div>
        </div>
        <div style={S.statCard}>
          <Clock size={18} style={{ color: '#d97706' }} />
          <div>
            <div style={S.statNum}>{pendingCount}</div>
            <div style={S.statLabel}>Pending Invitations</div>
          </div>
        </div>
        <div style={S.statCard}>
          <Mail size={18} style={{ color: '#7c3aed' }} />
          <div>
            <div style={S.statNum}>{invitations.length}</div>
            <div style={S.statLabel}>Total Invitations Sent</div>
          </div>
        </div>
      </div>

      {/* ── Invite panel ────────────────────────────────────────────────────── */}
      <div style={S.invitePanel}>
        <div style={S.invitePanelHeader}>
          <div style={S.invitePanelIcon}><Send size={16} style={{ color: '#7c3aed' }} /></div>
          <div>
            <h3 style={S.invitePanelTitle}>Invite a Client</h3>
            <p style={S.invitePanelSub}>Send an invitation link. Once they sign up and verify their email, you'll receive a notification to send a dashboard access request.</p>
          </div>
        </div>

        {inviteResult === 'success' ? (
          <div style={S.successBanner}>
            <CheckCircle size={16} />
            Invitation sent! The client will receive an email with the invite link. You'll be notified when they join.
            <button onClick={() => setInviteResult('')} style={S.dismissBtn}>Send another</button>
          </div>
        ) : (
          <form onSubmit={handleInvite} style={S.inviteForm}>
            <div style={{ flex: '1 1 220px' }}>
              <label style={S.label}>Client Email <span style={S.req}>*</span></label>
              <input
                type="email" required placeholder="client@company.com"
                value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                style={S.input}
              />
            </div>
            <div style={{ flex: '2 1 300px' }}>
              <label style={S.label}>Personal Message (optional)</label>
              <input
                placeholder="We'd love to manage your social analytics…"
                value={inviteMsg} onChange={e => setInviteMsg(e.target.value)}
                style={S.input}
              />
            </div>
            <div style={{ alignSelf: 'flex-end' }}>
              <button type="submit" disabled={inviting} style={S.sendBtn}>
                {inviting
                  ? <><Loader2 size={13} style={{ animation: 'spin .8s linear infinite' }} /> Sending…</>
                  : <><Send size={13} /> Send Invitation</>}
              </button>
            </div>
            {inviteResult.startsWith('error:') && (
              <div style={{ ...S.errorBanner, width: '100%' }}>
                <XCircle size={14} /> {inviteResult.slice(6)}
              </div>
            )}
          </form>
        )}
      </div>

      {/* ── Sent Invitations ─────────────────────────────────────────────────── */}
      <div style={S.section}>
        <div style={S.sectionHeader}>
          <h3 style={S.sectionTitle}>Sent Invitations</h3>
          <button onClick={fetchInvitations} style={S.refreshBtn} title="Refresh">
            <RefreshCw size={13} style={loadingInvList ? { animation: 'spin .8s linear infinite' } : {}} />
          </button>
        </div>

        {loadingInvList ? (
          <div style={S.centered}>
            <Loader2 size={20} style={{ animation: 'spin .8s linear infinite', color: 'var(--text-tertiary)' }} />
          </div>
        ) : invitations.length === 0 ? (
          <div style={S.emptyState}>
            <Mail size={28} style={{ color: 'var(--text-quaternary)', marginBottom: 8 }} />
            <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: 13 }}>No invitations sent yet. Use the form above to invite your first client.</p>
          </div>
        ) : (
          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead>
                <tr>
                  {['Client Email', 'Status', 'Sent', 'Message', 'Action'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invitations.map(inv => {
                  const st = STATUS_COLOR[inv.is_expired && inv.status === 'pending' ? 'expired' : inv.status] || STATUS_COLOR.expired;
                  const displayStatus = inv.is_expired && inv.status === 'pending' ? 'expired' : inv.status;
                  return (
                    <tr key={inv.id} style={S.tr}>
                      <td style={{ ...S.td, fontWeight: 500 }}>{inv.client_email}</td>
                      <td style={S.td}>
                        <span style={{ ...S.badge, color: st.text, background: st.bg }}>
                          {st.label}
                        </span>
                      </td>
                      <td style={{ ...S.td, color: 'var(--text-tertiary)', fontSize: 12 }}>
                        {inv.invited_at ? new Date(inv.invited_at).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ ...S.td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                        {inv.message || <span style={{ color: 'var(--text-quaternary)' }}>—</span>}
                      </td>
                      <td style={S.td}>
                        {displayStatus === 'pending' ? (
                          <button
                            style={S.cancelBtn}
                            disabled={cancelingId === inv.id}
                            onClick={() => handleCancelInv(inv.id)}
                          >
                            {cancelingId === inv.id
                              ? <Loader2 size={11} style={{ animation: 'spin .8s linear infinite' }} />
                              : <X size={11} />}
                            Cancel
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-quaternary)', fontSize: 12 }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Connected Clients ─────────────────────────────────────────────────── */}
      <div style={S.section}>
        <div style={S.sectionHeader}>
          <h3 style={S.sectionTitle}>Connected Clients</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {syncMsg && (
              <span style={{ fontSize: 12, color: syncMsg.includes('failed') ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                {syncMsg}
              </span>
            )}
            <button onClick={handleSyncAll} disabled={syncingAll} style={S.syncAllBtn} title="Sync all clients">
              {syncingAll
                ? <><Loader2 size={13} style={{ animation: 'spin .8s linear infinite' }} /> Syncing…</>
                : <><Zap size={13} /> Sync All</>}
            </button>
            <div style={S.searchWrapper}>
              <Search size={14} style={S.searchIcon} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search clients…"
                style={S.searchInput}
              />
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={S.emptyState}>
            <Users size={28} style={{ color: 'var(--text-quaternary)', marginBottom: 8 }} />
            <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: 13 }}>
              {clients.length === 0
                ? "No clients connected yet. Invite a client above — once they accept your access request they'll appear here."
                : 'No clients match your search.'}
            </p>
          </div>
        ) : (
          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead>
                <tr>
                  {['Company', 'Contact', 'Email', 'Website', 'Actions'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} style={S.tr}>
                    <td style={{ ...S.td, fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={S.avatar}>{(c.company || c.name || '?')[0].toUpperCase()}</div>
                        {c.company}
                      </div>
                    </td>
                    <td style={S.td}>{c.name}</td>
                    <td style={{ ...S.td, color: 'var(--text-secondary)' }}>{c.email}</td>
                    <td style={S.td}>
                      {c.website
                        ? <a href={c.website} target="_blank" rel="noreferrer" style={S.link}>{c.website}</a>
                        : <span style={{ color: 'var(--text-quaternary)' }}>—</span>}
                    </td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => { onSelectClient?.(c); navigate(`/admin/client/${c.id}`); }}
                          style={S.dashBtn}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            Dashboard <ChevronRight size={12} />
                          </span>
                        </button>
                        <button
                          onClick={() => { onSelectClient?.(c); navigate(`/admin/client/${c.id}/settings`); }}
                          style={S.settingsBtn}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Settings size={12} /> Account
                          </span>
                        </button>
                        <button
                          onClick={() => handleSyncOne(c.id)}
                          disabled={syncingId === c.id}
                          style={S.syncBtn}
                          title="Sync this client"
                        >
                          {syncingId === c.id
                            ? <Loader2 size={12} style={{ animation: 'spin .8s linear infinite' }} />
                            : <RefreshCw size={12} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      {clients.length === 0 && invitations.length === 0 && (
        <div style={S.howItWorks}>
          <h4 style={S.howTitle}>How client onboarding works</h4>
          <div style={S.steps}>
            {[
              { icon: <Send size={16} />, color: '#7c3aed', label: '1. Send Invitation', desc: 'Enter the client\'s email above and send an invitation.' },
              { icon: <Mail size={16} />, color: '#0369a1', label: '2. Client Signs Up', desc: 'The client receives an email, signs up on Social Stats, and verifies their account.' },
              { icon: <Building2 size={16} />, color: '#d97706', label: '3. You Get Notified', desc: 'You\'ll receive an email when the client joins. Then send a dashboard access request.' },
              { icon: <CheckCircle size={16} />, color: '#16a34a', label: '4. Client Accepts', desc: 'Once they accept the access request, they appear in your clients list.' },
            ].map(s => (
              <div key={s.label} style={S.step}>
                <div style={{ ...S.stepIcon, color: s.color, background: s.color + '18' }}>{s.icon}</div>
                <div style={S.stepLabel}>{s.label}</div>
                <div style={S.stepDesc}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  page:       { padding: '28px 32px', maxWidth: 1400, margin: '0 auto' },

  // Stats
  statsRow:   { display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' },
  statCard:   {
    display: 'flex', alignItems: 'center', gap: 12,
    background: 'var(--surface-card)', border: '1px solid #e8edf2', borderRadius: 12,
    padding: '14px 20px', flex: '1 1 160px',
  },
  statNum:    { fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 },
  statLabel:  { fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' },

  // Invite panel
  invitePanel: {
    background: 'linear-gradient(135deg,#faf5ff,#f5f0ff)',
    border: '1.5px solid rgba(124,58,237,0.2)',
    borderRadius: 16, padding: 24, marginBottom: 24,
  },
  invitePanelHeader: { display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 18 },
  invitePanelIcon: {
    width: 36, height: 36, borderRadius: 10,
    background: 'rgba(124,58,237,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  invitePanelTitle: { margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#4c1d95' },
  invitePanelSub:   { margin: 0, fontSize: 13, color: '#7c3aed', lineHeight: 1.5 },
  inviteForm:       { display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' },
  label:            { display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' },
  req:              { color: '#ef4444', marginLeft: 2 },
  input: {
    width: '100%', padding: '10px 14px', borderRadius: 8,
    border: '1.5px solid #ddd6fe', fontSize: 13, outline: 'none',
    boxSizing: 'border-box', background: 'var(--surface-card)',
  },
  sendBtn: {
    display: 'flex', alignItems: 'center', gap: 7,
    padding: '10px 22px', borderRadius: 10, border: 'none',
    background: 'linear-gradient(135deg,#7c3aed,#6d28d9)',
    color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13,
    whiteSpace: 'nowrap',
  },
  successBanner: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: '#dcfce7', color: '#15803d', borderRadius: 10,
    padding: '12px 16px', fontSize: 13, fontWeight: 500,
  },
  dismissBtn: {
    marginLeft: 'auto', background: 'none', border: '1.5px solid #16a34a',
    color: '#16a34a', borderRadius: 8, padding: '5px 14px', cursor: 'pointer',
    fontSize: 12, fontWeight: 700,
  },
  errorBanner: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#fee2e2', color: '#dc2626', borderRadius: 10,
    padding: '10px 14px', fontSize: 13,
  },

  // Section
  section:       { background: 'var(--surface-card)', borderRadius: 16, border: '1px solid #e8edf2', marginBottom: 24, overflow: 'hidden' },
  sectionHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px', borderBottom: '1px solid var(--surface-sunken)',
  },
  sectionTitle:  { margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' },
  refreshBtn: {
    display: 'flex', alignItems: 'center', padding: '5px 8px', borderRadius: 7,
    border: '1px solid var(--border-default)', background: 'var(--surface-sunken)', cursor: 'pointer', color: 'var(--text-secondary)',
  },
  centered:   { display: 'flex', justifyContent: 'center', padding: 32 },
  emptyState: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '40px 20px', textAlign: 'center',
  },

  // Search
  searchWrapper: { position: 'relative', display: 'flex', alignItems: 'center' },
  searchIcon:    { position: 'absolute', left: 9, color: 'var(--text-tertiary)', pointerEvents: 'none' },
  searchInput:   {
    padding: '7px 12px 7px 30px', borderRadius: 8,
    border: '1.5px solid var(--border-default)', fontSize: 12, outline: 'none',
    width: 200, boxSizing: 'border-box',
  },

  // Table
  tableWrap:  { overflowX: 'auto' },
  table:      { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left', padding: '10px 16px', background: 'var(--surface-sunken)',
    color: 'var(--text-secondary)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase',
    letterSpacing: '0.05em', borderBottom: '1px solid var(--surface-sunken)', whiteSpace: 'nowrap',
  },
  tr:   { borderBottom: '1px solid var(--surface-sunken)' },
  td:   { padding: '12px 16px', color: 'var(--text-secondary)', verticalAlign: 'middle' },
  badge: {
    display: 'inline-block', padding: '3px 10px', borderRadius: 20,
    fontSize: 11, fontWeight: 700,
  },
  cancelBtn: {
    display: 'flex', alignItems: 'center', gap: 4,
    background: '#fff5f5', color: '#dc2626', border: '1px solid #fca5a5',
    borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
  },
  link:   { color: '#7c3aed', textDecoration: 'none', fontSize: 12 },
  avatar: {
    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
    background: 'linear-gradient(135deg,#00d7ff22,#7c3aed22)',
    color: 'var(--text-primary)', fontWeight: 800, fontSize: 13,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '1.5px solid var(--border-default)',
  },
  dashBtn: {
    padding: '6px 14px', borderRadius: 8, border: '1.5px solid #00d7ff',
    background: 'transparent', color: '#0099bb', cursor: 'pointer', fontWeight: 600, fontSize: 12,
  },
  settingsBtn: {
    padding: '6px 12px', borderRadius: 8, border: '1.5px solid var(--border-default)',
    background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: 12,
  },
  syncBtn: {
    padding: '6px 8px', borderRadius: 8, border: '1.5px solid var(--border-default)',
    background: 'transparent', color: '#7c3aed', cursor: 'pointer', display: 'flex', alignItems: 'center',
  },
  syncAllBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 14px', borderRadius: 8, border: 'none',
    background: 'linear-gradient(135deg,#7c3aed,#6d28d9)',
    color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap',
  },

  // How it works
  howItWorks: {
    background: 'linear-gradient(135deg,#f0f9ff,var(--surface-page))',
    border: '1px solid var(--border-default)', borderRadius: 16, padding: '28px 32px', marginBottom: 24,
  },
  howTitle: { margin: '0 0 20px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' },
  steps:    { display: 'flex', gap: 20, flexWrap: 'wrap' },
  step:     { flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: 8 },
  stepIcon: {
    width: 36, height: 36, borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stepLabel: { fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' },
  stepDesc:  { fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 },
};
