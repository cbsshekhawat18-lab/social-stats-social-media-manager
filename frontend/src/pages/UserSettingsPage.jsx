/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * UserSettingsPage — /account-settings
 * Tabs: Profile | Security | Agency (client only)
 * Available to all roles (admin, staff, client).
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Lock, Building2, Camera, Save, Loader2,
  Eye, EyeOff, CheckCircle, AlertTriangle, X,
  LogOut, Shield, Mail, Trash2,
  Bell, Palette, Keyboard, Key, Database, Webhook, MoreHorizontal,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { profileAPI } from '../services/api';
import PageHeader from '../components/layout/PageHeader';
import {
  NotificationsSection,
  AppearanceSection,
  KeyboardShortcutsSection,
  APIKeysSection,
  DataPrivacySection,
  WebhooksSection,
  CrossLinksSection,
} from './settings/SettingsSections';
import { MFAManager, ActiveSessionsList } from './settings/SecuritySections';

const CYAN      = '#00d7ff';
const CYAN_SOFT = 'rgba(0,215,255,0.1)';

const TAB_GROUPS = [
  {
    label: 'Account',
    items: [
      { id: 'profile',         label: 'Profile',          icon: User },
      { id: 'security',        label: 'Account & Security', icon: Lock },
      { id: 'agency',          label: 'Agency',           icon: Building2, clientOnly: true },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { id: 'notifications',   label: 'Notifications',    icon: Bell },
      { id: 'appearance',      label: 'Appearance',       icon: Palette },
      { id: 'shortcuts',       label: 'Keyboard',         icon: Keyboard },
    ],
  },
  {
    label: 'Developer',
    items: [
      { id: 'api',             label: 'API Keys',         icon: Key },
      { id: 'webhooks',        label: 'Webhooks',         icon: Webhook },
    ],
  },
  {
    label: 'Privacy',
    items: [
      { id: 'data',            label: 'Data & Privacy',   icon: Database },
      { id: 'more',            label: 'More settings',    icon: MoreHorizontal },
    ],
  },
];

// Flat list for filtering by clientOnly
const TABS = TAB_GROUPS.flatMap((g) => g.items);

export default function UserSettingsPage() {
  const { user, refreshAuth, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('profile');

  return (
    <div style={s.page}>
      <PageHeader title="Settings" subtitle="Manage your account, workspace, and integrations" />

      <div className="settings-body" style={s.body}>
        {/* Sidebar tabs */}
        <div className="settings-sidebar" style={s.sidebar}>
          {TAB_GROUPS.map((group) => {
            const visible = group.items.filter((t) => !t.clientOnly || user?.role === 'client');
            if (visible.length === 0) return null;
            return (
              <div key={group.label} style={{ marginBottom: 6 }}>
                <div style={s.sidebarHeading}>{group.label}</div>
                {visible.map((t) => {
                  const Icon = t.icon;
                  const active = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      aria-current={active ? 'page' : undefined}
                      style={{ ...s.tabBtn, ...(active ? s.tabActive : {}) }}
                    >
                      <Icon size={14} strokeWidth={2} />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Panel */}
        <div className="settings-panel" style={s.panel}>
          {tab === 'profile'       && <ProfileTab user={user} logout={logout} navigate={navigate} />}
          {tab === 'security'      && <SecurityTab user={user} />}
          {tab === 'agency' && user?.role === 'client' && (
            <AgencyTab user={user} refreshAuth={refreshAuth} navigate={navigate} />
          )}
          {tab === 'notifications' && <NotificationsSection />}
          {tab === 'appearance'    && <AppearanceSection />}
          {tab === 'shortcuts'     && <KeyboardShortcutsSection />}
          {tab === 'api'           && <APIKeysSection />}
          {tab === 'webhooks'      && <WebhooksSection />}
          {tab === 'data'          && <DataPrivacySection />}
          {tab === 'more'          && <CrossLinksSection user={user} />}
        </div>
      </div>
    </div>
  );
}

// ── Profile Tab ───────────────────────────────────────────────────────────────

function ProfileTab({ user, logout, navigate }) {
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [avatar,    setAvatar]    = useState(null);
  const [preview,   setPreview]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [success,   setSuccess]   = useState('');
  const [error,     setError]     = useState('');
  const fileRef = useRef();

  useEffect(() => {
    profileAPI.get().then(res => {
      setFirstName(res.data.first_name || '');
      setLastName(res.data.last_name   || '');
      setPreview(res.data.avatar       || null);
    }).catch(() => {
      setFirstName(user?.name?.split(' ')[0] || '');
    }).finally(() => setLoading(false));
  }, []);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatar(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleRemoveAvatar = async () => {
    setAvatar(null);
    setPreview(null);
    const fd = new FormData();
    fd.append('first_name', firstName);
    fd.append('last_name',  lastName);
    fd.append('remove_avatar', 'true');
    await profileAPI.update(fd);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!firstName.trim()) { setError('First name is required.'); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('first_name', firstName.trim());
      fd.append('last_name',  lastName.trim());
      if (avatar) fd.append('avatar', avatar);
      await profileAPI.update(fd);
      setSuccess('Profile updated successfully.');
      setAvatar(null);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to save. Please try again.');
    } finally { setSaving(false); }
  };

  if (loading) return <Spinner />;

  const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || (user?.name?.[0] || 'U').toUpperCase();

  return (
    <div style={s.tabContent}>
      <h3 style={s.sectionTitle}>Profile Information</h3>
      <p style={s.sectionSub}>Update your name and profile photo.</p>

      <form onSubmit={handleSave}>
        {/* Avatar */}
        <div className="settings-avatar-row" style={s.avatarRow}>
          <div style={s.avatarWrap}>
            {preview
              ? <img src={preview} alt="avatar" style={s.avatarImg} />
              : <div style={s.avatarInitials}>{initials}</div>
            }
            <button type="button" onClick={() => fileRef.current.click()} style={s.cameraBtn} title="Change photo">
              <Camera size={13} />
            </button>
            {preview && (
              <button type="button" onClick={handleRemoveAvatar} style={s.removeAvatarBtn} title="Remove photo">
                <X size={12} />
              </button>
            )}
          </div>
          <div>
            <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>Profile Photo</p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>JPG, PNG or GIF · Max 5MB</p>
            <button type="button" onClick={() => fileRef.current.click()} style={s.uploadBtn}>
              Upload Photo
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
        </div>

        <div className="settings-field-grid" style={s.fieldGrid}>
          <Field label="First Name" required>
            <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jane" style={s.input} />
          </Field>
          <Field label="Last Name">
            <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Smith" style={s.input} />
          </Field>
        </div>

        <Field label="Email Address">
          <div style={{ ...s.input, background: 'var(--surface-sunken)', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Mail size={14} color="var(--text-tertiary)" />
            {user?.email || '—'}
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>Email cannot be changed here.</p>
        </Field>

        {error   && <Alert type="error"   msg={error} />}
        {success && <Alert type="success" msg={success} />}

        <button type="submit" disabled={saving} style={s.saveBtn}>
          {saving ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</> : <><Save size={15} /> Save Changes</>}
        </button>
      </form>

      {user?.role === 'client' && (
        <DeleteAccountSection logout={logout} navigate={navigate} />
      )}
    </div>
  );
}

// ── Delete Account Section (client only) ──────────────────────────────────────

const DELETE_REASONS = [
  'I no longer need this account',
  'Privacy concerns',
  'Switching to another platform',
  'Too many emails / notifications',
  'Technical issues',
  'Other',
];

function DeleteAccountSection({ logout, navigate }) {
  const [step,     setStep]     = useState(0); // 0=hidden 1=reason 2=confirm
  const [reason,   setReason]   = useState('');
  const [typed,    setTyped]    = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error,    setError]    = useState('');

  const handleDelete = async () => {
    setError('');
    setDeleting(true);
    try {
      await profileAPI.deleteAccount({ reason });
      logout();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to delete account. Please try again.');
      setDeleting(false);
    }
  };

  return (
    <div style={ds.zone}>
      <div style={ds.zoneHeader}>
        <Trash2 size={16} color="#dc2626" />
        <span style={ds.zoneTitle}>Danger Zone</span>
      </div>

      <div style={ds.zoneBody}>
        <div>
          <p style={ds.zoneLabel}>Delete Account</p>
          <p style={ds.zoneDesc}>Permanently delete your account and all associated data. This action cannot be undone.</p>
        </div>
        {step === 0 && (
          <button onClick={() => setStep(1)} style={ds.deleteBtn}>
            <Trash2 size={14} /> Delete Account
          </button>
        )}
      </div>

      {/* Step 1 — Reason */}
      {step === 1 && (
        <div style={ds.confirmBox}>
          <AlertTriangle size={20} color="#dc2626" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <p style={ds.confirmTitle}>Why are you deleting your account?</p>
            <p style={ds.confirmDesc}>Please select a reason. This helps us improve Social Stats.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
              {DELETE_REASONS.map(r => (
                <label key={r} style={ds.radioRow}>
                  <input
                    type="radio"
                    name="delete_reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    style={{ accentColor: '#dc2626', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{r}</span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { if (reason) setStep(2); }}
                disabled={!reason}
                style={{ ...ds.nextBtn, opacity: reason ? 1 : 0.45 }}
              >
                Continue
              </button>
              <button onClick={() => { setStep(0); setReason(''); }} style={ds.cancelBtn}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2 — Final confirm */}
      {step === 2 && (
        <div style={{ ...ds.confirmBox, borderColor: '#fca5a5', background: '#fff5f5' }}>
          <AlertTriangle size={20} color="#dc2626" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <p style={ds.confirmTitle}>This will permanently delete everything</p>
            <div style={ds.warningList}>
              {[
                'All your analytics data and reports',
                'All connected social media accounts',
                'All calendar posts and schedules',
                'Your agency connection and history',
                'Your profile and account credentials',
              ].map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <X size={13} color="#dc2626" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, margin: '16px 0 6px' }}>
              Type <strong>DELETE</strong> to confirm:
            </p>
            <input
              value={typed}
              onChange={e => setTyped(e.target.value)}
              placeholder="DELETE"
              style={{ ...s.input, borderColor: typed === 'DELETE' ? '#fca5a5' : undefined, marginBottom: 14 }}
            />
            {error && <Alert type="error" msg={error} />}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleDelete}
                disabled={typed !== 'DELETE' || deleting}
                style={{ ...ds.confirmDeleteBtn, opacity: typed !== 'DELETE' ? 0.45 : 1 }}
              >
                {deleting
                  ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Deleting...</>
                  : <><Trash2 size={14} /> Permanently Delete Account</>}
              </button>
              <button onClick={() => { setStep(0); setReason(''); setTyped(''); setError(''); }} style={ds.cancelBtn}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ds = {
  zone: {
    marginTop: 40,
    borderTop: '1px solid #fee2e2',
    paddingTop: 24,
  },
  zoneHeader: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
  },
  zoneTitle: {
    fontSize: 13, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  zoneBody: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 16, flexWrap: 'wrap',
  },
  zoneLabel: { margin: '0 0 4px', fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' },
  zoneDesc:  { margin: 0, fontSize: 13, color: 'var(--text-secondary)', maxWidth: 420 },
  deleteBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0,
    padding: '9px 18px', borderRadius: 10,
    border: '1.5px solid #fca5a5', background: '#fef2f2',
    color: '#dc2626', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  },
  confirmBox: {
    display: 'flex', gap: 14, padding: '20px 22px', borderRadius: 16,
    background: '#fffbeb', border: '1px solid #fde68a', marginTop: 16,
  },
  confirmTitle: { margin: '0 0 4px', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' },
  confirmDesc:  { margin: '0 0 14px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 },
  radioRow: {
    display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
    padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border-default)',
    background: 'var(--surface-card)',
  },
  warningList: {
    background: '#fef2f2', borderRadius: 12, padding: '14px 16px',
    border: '1px solid #fecaca',
  },
  nextBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '9px 20px', borderRadius: 10, border: 'none',
    background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  },
  cancelBtn: {
    padding: '9px 20px', borderRadius: 10,
    border: '1px solid var(--border-default)', background: 'var(--surface-card)',
    color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  confirmDeleteBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    padding: '10px 20px', borderRadius: 10, border: 'none',
    background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  },
};

// ── Security Tab ──────────────────────────────────────────────────────────────

function SecurityTab({ user }) {
  const [current,  setCurrent]  = useState('');
  const [newPwd,   setNewPwd]   = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showC,    setShowC]    = useState(false);
  const [showN,    setShowN]    = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [success,  setSuccess]  = useState('');
  const [error,    setError]    = useState('');
  const [isSocial, setIsSocial] = useState(false);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    profileAPI.get().then(res => setIsSocial(res.data.is_social)).finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!current || !newPwd || !confirm) { setError('All fields are required.'); return; }
    if (newPwd !== confirm) { setError('New passwords do not match.'); return; }
    if (newPwd.length < 8)  { setError('Password must be at least 8 characters.'); return; }
    setSaving(true);
    try {
      await profileAPI.changePassword({ current_password: current, new_password: newPwd, confirm_password: confirm });
      setSuccess('Password changed successfully.');
      setCurrent(''); setNewPwd(''); setConfirm('');
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to change password.');
    } finally { setSaving(false); }
  };

  if (loading) return <Spinner />;

  return (
    <div style={s.tabContent}>
      <h3 style={s.sectionTitle}>Security</h3>
      <p style={s.sectionSub}>Manage your account password and security settings.</p>

      {/* Account type badge */}
      <div style={s.infoCard}>
        <Shield size={18} color={CYAN} />
        <div>
          <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
            {isSocial ? 'Social Login Account' : 'Email & Password Account'}
          </p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
            {isSocial
              ? 'Your account is linked to Google. Password login is not available.'
              : 'You can change your password below.'
            }
          </p>
        </div>
      </div>

      {isSocial ? (
        <div style={{ ...s.infoCard, background: 'linear-gradient(135deg,#f0f9ff,#f8faff)', border: '1px solid rgba(0,215,255,0.15)', marginTop: 20 }}>
          <CheckCircle size={18} color={CYAN} />
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>
            Password management is handled by Google. To change your password, visit your Google account settings.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSave} style={{ marginTop: 24 }}>
          <Field label="Current Password" required>
            <PwdInput value={current} onChange={setCurrent} show={showC} onToggle={() => setShowC(v => !v)} placeholder="Enter current password" />
          </Field>
          <Field label="New Password" required>
            <PwdInput value={newPwd} onChange={setNewPwd} show={showN} onToggle={() => setShowN(v => !v)} placeholder="At least 8 characters" />
          </Field>
          <Field label="Confirm New Password" required>
            <PwdInput value={confirm} onChange={setConfirm} show={showConf} onToggle={() => setShowConf(v => !v)} placeholder="Re-enter new password" />
          </Field>

          {error   && <Alert type="error"   msg={error} />}
          {success && <Alert type="success" msg={success} />}

          <button type="submit" disabled={saving} style={s.saveBtn}>
            {saving ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</> : <><Lock size={15} /> Change Password</>}
          </button>
        </form>
      )}

      {!isSocial && (
        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: '0.04em',
                       textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
            Two-factor authentication
          </h4>
          <MFAManager />

          <h4 style={{ margin: '8px 0 0', fontSize: 14, fontWeight: 700, letterSpacing: '0.04em',
                       textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
            Active sessions
          </h4>
          <ActiveSessionsList />
        </div>
      )}
    </div>
  );
}

// ── Agency Tab ────────────────────────────────────────────────────────────────

function AgencyTab({ user, refreshAuth, navigate }) {
  const [info,         setInfo]         = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirm,      setConfirm]      = useState(false);
  const [error,        setError]        = useState('');

  useEffect(() => {
    profileAPI.agencyInfo()
      .then(res => setInfo(res.data))
      .catch(() => setInfo({ connected: false }))
      .finally(() => setLoading(false));
  }, []);

  const handleDisconnect = async () => {
    setError(''); setDisconnecting(true);
    try {
      const res = await profileAPI.disconnectAgency();
      const updatedUser = await refreshAuth(res.data.access, res.data.refresh);
      // If they already have a client account, go straight to dashboard.
      // Only go to /pending if they have no client record at all.
      if (updatedUser?.client_id) {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/pending', { replace: true });
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to disconnect. Please try again.');
      setDisconnecting(false);
    }
    setConfirm(false);
  };

  if (loading) return <Spinner />;

  return (
    <div style={s.tabContent}>
      <h3 style={s.sectionTitle}>Agency Connection</h3>
      <p style={s.sectionSub}>Manage your connection to your agency on Social Stats.</p>

      {!info?.connected ? (
        <div style={{ ...s.infoCard, background: 'linear-gradient(135deg,var(--surface-sunken),#f0f9ff)', border: '1px solid rgba(0,215,255,0.15)', marginTop: 8 }}>
          <Building2 size={18} color="var(--text-tertiary)" />
          <div>
            <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>No Agency Connected</p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>You are not currently connected to any agency.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Agency card */}
          <div style={s.agencyCard}>
            <div style={s.agencyIconWrap}>
              <Building2 size={22} color="#7c3aed" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{info.agency_name}</p>
              <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--text-secondary)' }}>{info.agency_email}</p>
              {info.agency_since && (
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>
                  Connected since {new Date(info.agency_since).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              )}
            </div>
            <div style={s.connectedBadge}>
              <span style={s.connectedDot} />
              Connected
            </div>
          </div>

          {/* What agency can do */}
          <div style={s.permsList}>
            <p style={{ margin: '0 0 10px', fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>Your agency can:</p>
            {['View your analytics and reports', 'Manage your connected social accounts', 'Create and schedule posts on your behalf', 'Generate AI insights for your account'].map(p => (
              <div key={p} style={s.permItem}>
                <CheckCircle size={14} color="#16a34a" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p}</span>
              </div>
            ))}
          </div>

          {error && <Alert type="error" msg={error} />}

          {/* Disconnect */}
          {!confirm ? (
            <button onClick={() => setConfirm(true)} style={s.disconnectBtn}>
              <LogOut size={15} />
              Disconnect from Agency
            </button>
          ) : (
            <div style={s.confirmBox}>
              <AlertTriangle size={20} color="#d97706" />
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Confirm Disconnect</p>
                <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Are you sure you want to disconnect from <strong>{info.agency_name}</strong>? They will lose access to your account and be notified by email.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={handleDisconnect} disabled={disconnecting} style={s.confirmYes}>
                    {disconnecting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <LogOut size={14} />}
                    {disconnecting ? 'Disconnecting...' : 'Yes, Disconnect'}
                  </button>
                  <button onClick={() => setConfirm(false)} style={s.confirmNo}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Shared small components ───────────────────────────────────────────────────

function Field({ label, required, children }) {
  return (
    <div style={s.field}>
      <label style={s.label}>
        {label}
        {required && <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function PwdInput({ value, onChange, show, onToggle, placeholder }) {
  return (
    <div style={s.pwdWrap}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...s.input, paddingRight: 40 }}
      />
      <button type="button" onClick={onToggle} style={s.eyeBtn}>
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

function Alert({ type, msg }) {
  const isError = type === 'error';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 14px', borderRadius: 12, marginBottom: 16,
      background: isError ? '#fef2f2' : '#f0fdf4',
      border: `1px solid ${isError ? '#fecaca' : '#bbf7d0'}`,
      color: isError ? '#b91c1c' : '#166534', fontSize: 13,
    }}>
      {isError ? <AlertTriangle size={15} /> : <CheckCircle size={15} />}
      {msg}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
      <Loader2 size={28} color={CYAN} style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  page: { minHeight: '100vh' },
  body: {
    display: 'flex', gap: 24, padding: '24px 28px',
    maxWidth: 960, margin: '0 auto',
    '@media(max-width:640px)': { flexDirection: 'column' },
  },
  sidebar: {
    width: 220, flexShrink: 0,
    display: 'flex', flexDirection: 'column', gap: 1,
    padding: 8,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-xs)',
    alignSelf: 'flex-start',
    position: 'sticky',
    top: 80,
  },
  sidebarHeading: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-tertiary)',
    padding: '6px 10px 8px',
  },
  tabBtn: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 10px',
    minHeight: 'unset', minWidth: 'unset',
    borderRadius: 'var(--radius-sm)', border: 'none',
    background: 'none', fontSize: 13, fontWeight: 500,
    color: 'var(--text-secondary)', cursor: 'pointer', textAlign: 'left',
    transition: 'var(--transition-fast)',
    fontFamily: 'inherit',
  },
  tabActive: {
    background: 'var(--brand-primary-soft)',
    color: 'var(--text-primary)',
    fontWeight: 600,
    boxShadow: 'inset 2px 0 0 var(--brand-primary)',
  },
  panel: {
    flex: 1,
    minWidth: 0,
    background: 'var(--surface-card)',
    borderRadius: 'var(--radius-xl)',
    border: '1px solid var(--border-subtle)',
    boxShadow: 'var(--shadow-sm)',
    overflow: 'hidden',
  },
  tabContent: { padding: '32px 36px' },
  sectionTitle: { margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' },
  sectionSub:   { margin: '0 0 28px', fontSize: 14, color: 'var(--text-secondary)' },
  avatarRow:    { display: 'flex', alignItems: 'center', gap: 24, marginBottom: 28 },
  avatarWrap:   { position: 'relative', width: 80, height: 80, flexShrink: 0 },
  avatarImg:    { width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(0,215,255,0.25)' },
  avatarInitials: {
    width: 80, height: 80, borderRadius: '50%',
    background: 'linear-gradient(135deg,#00d7ff,#0099bb)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 26, fontWeight: 800, color: '#021418',
  },
  cameraBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: '50%',
    background: 'var(--text-primary)', border: '2px solid #fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: '#fff',
  },
  removeAvatarBtn: {
    position: 'absolute', top: -4, right: -4,
    width: 20, height: 20, borderRadius: '50%',
    background: '#ef4444', border: '2px solid #fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: '#fff',
  },
  uploadBtn: {
    marginTop: 10, padding: '7px 16px', borderRadius: 10,
    border: `1.5px solid ${CYAN}`, background: CYAN_SOFT,
    color: '#0a7a8f', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  fieldGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 0 },
  field:     { display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 18 },
  label:     { fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' },
  input: {
    height: 44, padding: '0 14px', borderRadius: 12,
    border: '1px solid rgba(148,163,184,0.3)',
    background: 'rgba(248,250,252,0.96)', fontSize: 14,
    color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
    transition: 'border .15s, box-shadow .15s',
    boxSizing: 'border-box', width: '100%',
  },
  pwdWrap:   { position: 'relative' },
  eyeBtn: {
    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)',
    display: 'flex', alignItems: 'center',
  },
  saveBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '12px 28px', borderRadius: 14, border: 'none',
    background: `linear-gradient(135deg,${CYAN},#0099bb)`,
    color: '#021418', fontSize: 14, fontWeight: 800,
    cursor: 'pointer', boxShadow: '0 6px 20px rgba(0,215,255,0.25)',
    marginTop: 4,
  },
  infoCard: {
    display: 'flex', alignItems: 'flex-start', gap: 14,
    padding: '16px 18px', borderRadius: 14,
    background: 'linear-gradient(135deg,var(--surface-sunken),#f0f9ff)',
    border: '1px solid var(--border-default)',
  },
  agencyCard: {
    display: 'flex', alignItems: 'center', gap: 16,
    padding: '20px 20px', borderRadius: 16, marginBottom: 20,
    background: 'linear-gradient(135deg,#faf5ff,#f5f3ff)',
    border: '1px solid rgba(124,58,237,0.2)',
  },
  agencyIconWrap: {
    width: 48, height: 48, borderRadius: 14,
    background: 'rgba(124,58,237,0.1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  connectedBadge: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '5px 12px', borderRadius: 20, flexShrink: 0,
    background: '#dcfce7', color: '#166534', fontSize: 12, fontWeight: 700,
  },
  connectedDot: {
    width: 7, height: 7, borderRadius: '50%', background: '#16a34a',
    boxShadow: '0 0 6px rgba(22,163,74,0.6)',
  },
  permsList: {
    padding: '16px 18px', borderRadius: 14, marginBottom: 24,
    background: 'linear-gradient(135deg,#f0f9ff,#f8faff)',
    border: '1px solid rgba(0,215,255,0.15)',
  },
  permItem: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 },
  disconnectBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '11px 22px', borderRadius: 12,
    border: '1.5px solid #fca5a5', background: '#fef2f2',
    color: '#dc2626', fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
  confirmBox: {
    display: 'flex', gap: 14, padding: '18px 20px', borderRadius: 16,
    background: '#fffbeb', border: '1px solid #fde68a',
  },
  confirmYes: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '10px 20px', borderRadius: 10, border: 'none',
    background: '#dc2626', color: '#fff', fontSize: 13,
    fontWeight: 700, cursor: 'pointer',
  },
  confirmNo: {
    padding: '10px 20px', borderRadius: 10,
    border: '1px solid var(--border-default)', background: 'var(--surface-card)',
    color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
};
