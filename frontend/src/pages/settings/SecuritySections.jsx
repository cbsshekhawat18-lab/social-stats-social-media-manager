/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 *
 *   <MFAManager />        — TOTP enrol / disable / regenerate codes
 *   <ActiveSessionsList /> — list + revoke + sign-out-everywhere
 *
 * Both components are self-contained — drop into any page that needs them.
 */

import { useEffect, useState } from 'react';
import {
  Shield, ShieldCheck, ShieldOff, Smartphone, Key, RefreshCw, AlertTriangle,
  X, Copy, LogOut, Monitor, Wand2,
} from 'lucide-react';

import { mfaAPI, sessionsAPI } from '../../services/api';
import toast from '../../components/ui/toast';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';


// ─────────────────────────────────────────────────────────────────────────
// MFA Manager
// ─────────────────────────────────────────────────────────────────────────
export function MFAManager() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  // Enrolment wizard state
  const [setupData, setSetupData] = useState(null);  // {secret, qr_data_uri, otpauth_url}
  const [verifyCode, setVerifyCode] = useState('');
  const [busy, setBusy] = useState(false);

  // Just-issued backup codes (shown once)
  const [backupCodes, setBackupCodes] = useState(null);

  // Disable wizard state
  const [disableOpen, setDisableOpen] = useState(false);

  function load() {
    setLoading(true);
    mfaAPI.status()
      .then((r) => setStatus(r.data))
      .catch(() => toast.error('Could not load MFA status'))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function startSetup() {
    setBusy(true);
    try {
      const r = await mfaAPI.setup();
      setSetupData(r.data);
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not start MFA setup');
    } finally { setBusy(false); }
  }

  async function confirmSetup() {
    if (!verifyCode.trim()) { toast.error('Enter the 6-digit code'); return; }
    setBusy(true);
    try {
      const r = await mfaAPI.verifySetup(verifyCode.trim());
      setBackupCodes(r.data.backup_codes || []);
      setSetupData(null);
      setVerifyCode('');
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Verification failed');
    } finally { setBusy(false); }
  }

  async function regenerateBackupCodes() {
    const code = window.prompt('Enter your current 6-digit code to regenerate backup codes:');
    if (!code) return;
    try {
      const r = await mfaAPI.regenerateBackupCodes(code.trim());
      setBackupCodes(r.data.backup_codes || []);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not regenerate codes');
    }
  }

  async function disableMfa(password, code) {
    setBusy(true);
    try {
      await mfaAPI.disable({ password, code });
      toast.success('MFA disabled');
      setDisableOpen(false);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not disable MFA');
    } finally { setBusy(false); }
  }

  function copyAll(codes) {
    try {
      navigator.clipboard.writeText(codes.join('\n'));
      toast.success('Backup codes copied');
    } catch { toast.error('Could not copy'); }
  }

  if (loading) return <Card padding="md"><div style={{ color: 'var(--text-tertiary)' }}>Loading…</div></Card>;

  // — Enrolment wizard step 1 (QR shown) —
  if (setupData) {
    return (
      <Card padding="md">
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
          <Shield size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />
          Enrol MFA — step 1 of 2
        </div>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-secondary)' }}>
          Scan the QR code with Google Authenticator, 1Password, or any TOTP app.
        </p>
        <div style={{
          display: 'inline-block', padding: 12,
          background: '#fff', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-sm)', marginBottom: 10,
        }}>
          <img src={setupData.qr_data_uri} alt="MFA QR" style={{ width: 180, height: 180, display: 'block' }} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10 }}>
          Or enter manually: <code style={{ userSelect: 'all' }}>{setupData.secret}</code>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', maxWidth: 360 }}>
          <input
            value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)}
            placeholder="123456" inputMode="numeric" maxLength={6}
            style={{
              flex: 1, padding: '8px 12px', fontSize: 14,
              fontFamily: 'var(--font-mono)', textAlign: 'center', letterSpacing: '0.2em',
              background: 'var(--surface-sunken)',
              border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
            }}
          />
          <Button onClick={confirmSetup} disabled={busy} icon={ShieldCheck} size="sm">
            {busy ? 'Verifying…' : 'Verify'}
          </Button>
          <Button variant="ghost" size="sm" iconOnly icon={X}
                  aria-label="Cancel"
                  onClick={() => { setSetupData(null); setVerifyCode(''); }} />
        </div>
      </Card>
    );
  }

  // — Just-issued backup codes —
  if (backupCodes) {
    return (
      <Card padding="md" style={{ borderColor: 'var(--warning)', background: 'var(--warning-bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700,
                      color: 'var(--warning)', marginBottom: 6 }}>
          <AlertTriangle size={14} /> Save these backup codes — shown once
        </div>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-secondary)' }}>
          Each code can be used ONCE if you lose your authenticator. Store them in a password manager.
        </p>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6,
          padding: 10, background: 'var(--surface-sunken)',
          borderRadius: 'var(--radius-sm)',
          fontFamily: 'var(--font-mono)', fontSize: 13, userSelect: 'all',
        }}>
          {backupCodes.map((c) => <span key={c}>{c}</span>)}
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
          <Button size="sm" icon={Copy} onClick={() => copyAll(backupCodes)}>Copy all</Button>
          <Button size="sm" variant="ghost" onClick={() => setBackupCodes(null)}>I've saved them</Button>
        </div>
      </Card>
    );
  }

  // — Disabled MFA panel —
  if (!status?.enabled) {
    return (
      <Card padding="md">
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <span style={{
            width: 40, height: 40, flexShrink: 0,
            background: 'var(--surface-sunken)', color: 'var(--text-tertiary)',
            borderRadius: 'var(--radius-md)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}><ShieldOff size={18} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Two-factor auth (TOTP)</div>
            <p style={{ margin: '4px 0 12px', fontSize: 13, color: 'var(--text-secondary)' }}>
              Add a second factor — a 6-digit code from your authenticator app — on top of your password.
              Strongly recommended for admin accounts.
            </p>
            <Button size="sm" icon={Wand2} disabled={busy} onClick={startSetup}>
              {busy ? 'Starting…' : 'Set up MFA'}
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // — Enabled MFA panel —
  return (
    <Card padding="md">
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <span style={{
          width: 40, height: 40, flexShrink: 0,
          background: 'var(--success-bg)', color: 'var(--success)',
          borderRadius: 'var(--radius-md)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}><ShieldCheck size={18} /></span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Two-factor auth is on</div>
            <Badge variant="success">Enabled</Badge>
          </div>
          <p style={{ margin: '4px 0 12px', fontSize: 13, color: 'var(--text-secondary)' }}>
            {status.backup_codes_remaining} backup code{status.backup_codes_remaining === 1 ? '' : 's'} remaining ·{' '}
            {status.last_used_at
              ? `last used ${new Date(status.last_used_at).toLocaleDateString()}`
              : 'never used yet'}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button size="sm" icon={Key} variant="secondary" onClick={regenerateBackupCodes}>
              Regenerate backup codes
            </Button>
            <Button size="sm" icon={ShieldOff} variant="danger" onClick={() => setDisableOpen(true)}>
              Disable MFA
            </Button>
          </div>
        </div>
      </div>

      {disableOpen && <DisableMfaModal busy={busy} onClose={() => setDisableOpen(false)} onConfirm={disableMfa} />}
    </Card>
  );
}


function DisableMfaModal({ busy, onClose, onConfirm }) {
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{
      position: 'fixed', inset: 0, zIndex: 1300,
      background: 'rgba(10,14,20,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 420,
        background: 'var(--surface-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)', padding: 18,
      }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: 'var(--danger)' }}>
          Disable MFA
        </h2>
        <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text-secondary)' }}>
          We require your password AND a current 6-digit code so a hijacker can't disable MFA from a stolen session.
        </p>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
               placeholder="Password" style={modalInput} />
        <input value={code} onChange={(e) => setCode(e.target.value)}
               placeholder="6-digit code" inputMode="numeric" maxLength={6}
               style={{ ...modalInput, marginTop: 8, fontFamily: 'var(--font-mono)', textAlign: 'center' }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="danger" disabled={busy}
                  onClick={() => onConfirm(password, code.trim())}>
            {busy ? 'Disabling…' : 'Disable MFA'}
          </Button>
        </div>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────
// Active sessions
// ─────────────────────────────────────────────────────────────────────────
export function ActiveSessionsList() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    sessionsAPI.list()
      .then((r) => setSessions(r.data?.sessions || []))
      .catch(() => toast.error('Could not load sessions'))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function revoke(id) {
    if (!window.confirm('Revoke this session? The device will be signed out immediately.')) return;
    try {
      await sessionsAPI.revoke(id);
      toast.success('Session revoked');
      load();
    } catch { toast.error('Could not revoke'); }
  }

  async function revokeAll() {
    if (!window.confirm('Sign out of every other device? This cannot be undone.')) return;
    try {
      const r = await sessionsAPI.revokeAll();
      toast.success(`${r.data.revoked} session(s) revoked`);
      load();
    } catch { toast.error('Could not sign out everywhere'); }
  }

  if (loading) return <Card padding="md"><div style={{ color: 'var(--text-tertiary)' }}>Loading sessions…</div></Card>;

  const active = sessions.filter((s) => s.is_active);

  return (
    <Card padding="none">
      <div style={{
        padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <Monitor size={16} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Active sessions</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            {active.length} active · {sessions.length - active.length} revoked (last 90 days)
          </div>
        </div>
        {active.length > 1 && (
          <Button size="sm" variant="ghost" icon={LogOut} onClick={revokeAll}>
            Sign out everywhere
          </Button>
        )}
      </div>

      {sessions.length === 0 ? (
        <EmptyState icon={Smartphone} title="No sessions yet"
                    description="Your active sessions will appear here." compact />
      ) : (
        sessions.map((s, i) => (
          <div key={s.id} style={{
            display: 'grid', gridTemplateColumns: '1fr auto', gap: 12,
            padding: '12px 18px',
            borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none',
            opacity: s.is_active ? 1 : 0.55,
            alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {s.browser || 'Unknown browser'} on {s.os || 'unknown OS'}
                {' '}<span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>· {s.device || 'device'}</span>
                {!s.is_active && <Badge style={{ marginLeft: 6 }}>Revoked</Badge>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {s.ip || 'unknown IP'} · last used {new Date(s.last_used_at).toLocaleString()}
              </div>
            </div>
            {s.is_active && (
              <Button size="sm" variant="ghost" iconOnly icon={X}
                      aria-label="Revoke session" onClick={() => revoke(s.id)} />
            )}
          </div>
        ))
      )}
    </Card>
  );
}


const modalInput = {
  width: '100%', padding: '10px 12px',
  background: 'var(--surface-sunken)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 14, color: 'var(--text-primary)',
  outline: 'none', fontFamily: 'inherit',
};
