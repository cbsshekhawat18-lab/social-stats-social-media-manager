/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * ResetPasswordPage — handles two flows:
 *   /forgot-password           → request reset link (email → success state)
 *   /reset-password?token=UUID → confirm new password
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, AlertCircle, CheckCircle, Mail } from 'lucide-react';

import AuthLayout from '../components/auth/AuthLayout';
import PasswordStrength from '../components/auth/PasswordStrength';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { authAPI } from '../services/api';

export default function ResetPasswordPage() {
  const token = new URLSearchParams(window.location.search).get('token');
  return token ? <ResetForm token={token} /> : <ForgotForm />;
}

// ─── Forgot password (request reset link) ────────────────────────────────
function ForgotForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) { setError('Email is required.'); return; }
    setError('');
    setLoading(true);
    try {
      await authAPI.passwordResetRequest(email.trim().toLowerCase());
      setDone(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <AuthLayout
        heroTitle="Help is on the way."
        heroSub="If we recognise the email, you'll receive a reset link in the next minute or two."
      >
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div aria-hidden style={iconBubbleStyle}>
            <Mail size={26} strokeWidth={1.8} />
          </div>
          <h1 style={titleStyle}>Check your inbox</h1>
          <p style={{ ...subStyle, margin: '8px 0 20px' }}>
            If <strong style={{ color: 'var(--text-primary)' }}>{email}</strong> is registered, a reset link is on its way.
          </p>
          <Button as={Link} to="/login" variant="secondary" size="md" fullWidth>
            Back to sign in
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      footer={
        <>
          Remembered it?{' '}
          <Link to="/login" style={{ color: 'var(--text-link)', fontWeight: 600, textDecoration: 'none' }}>
            Back to sign in
          </Link>
        </>
      }
    >
      <div style={cardStyle}>
        <header style={{ marginBottom: 22 }}>
          <h1 style={titleStyle}>Reset your password</h1>
          <p style={subStyle}>Enter your email — we'll send a secure link to reset your password.</p>
        </header>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(''); }}
            placeholder="you@company.com"
            error={error}
            size="lg"
            autoFocus
          />
          <Button type="submit" size="lg" iconRight={ArrowRight} fullWidth loading={loading}>
            Send reset link
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}

// ─── Reset password (confirm new password) ───────────────────────────────
function ResetForm({ token }) {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState('');

  function clearField(field) {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function validate() {
    const e = {};
    if (!password) e.password = 'Password is required.';
    else if (password.length < 8) e.password = 'Password must be at least 8 characters.';
    if (!confirm) e.confirm = 'Please confirm your password.';
    else if (password !== confirm) e.confirm = 'Passwords do not match.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    setServerError('');
    if (!validate()) return;
    setLoading(true);
    try {
      await authAPI.passwordResetConfirm(token, password);
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 2200);
    } catch (err) {
      const data = err?.response?.data;
      if (data?.errors?.password) setErrors((p) => ({ ...p, password: data.errors.password }));
      else setServerError(data?.error || 'This reset link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <AuthLayout
        heroTitle="You're all set."
        heroSub="Your password is updated. Redirecting you to sign in…"
      >
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div aria-hidden style={{ ...iconBubbleStyle, background: 'var(--success-bg)', color: 'var(--success)' }}>
            <CheckCircle size={26} strokeWidth={1.8} />
          </div>
          <h1 style={titleStyle}>Password updated</h1>
          <p style={subStyle}>Your password has been changed successfully.</p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      footer={
        <Link to="/login" style={{ color: 'var(--text-link)', fontWeight: 600, textDecoration: 'none' }}>
          Back to sign in
        </Link>
      }
    >
      <div style={cardStyle}>
        <header style={{ marginBottom: 22 }}>
          <h1 style={titleStyle}>Set a new password</h1>
          <p style={subStyle}>Choose a strong password you haven't used before.</p>
        </header>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <Input
              label="New password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearField('password'); }}
              placeholder="At least 8 characters"
              error={errors.password}
              size="lg"
              autoFocus
            />
            <PasswordStrength password={password} />
          </div>

          <Input
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); clearField('confirm'); }}
            placeholder="Re-enter your password"
            error={errors.confirm}
            success={!!confirm && confirm === password && password.length >= 8 && !errors.confirm}
            size="lg"
          />

          {serverError && (
            <div
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '10px 12px',
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--danger)',
                fontSize: 13,
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{serverError}</span>
            </div>
          )}

          <Button type="submit" size="lg" iconRight={ArrowRight} fullWidth loading={loading}>
            Update password
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}

// ── shared styles ────────────────────────────────────────────────────────
const cardStyle = {
  background: 'var(--surface-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-xl)',
  padding: 32,
  boxShadow: 'var(--shadow-md)',
  textAlign: 'left',
};

const iconBubbleStyle = {
  width: 56,
  height: 56,
  margin: '0 auto 16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--brand-primary-soft)',
  borderRadius: '50%',
  color: 'var(--brand-primary-hover)',
};

const titleStyle = {
  margin: 0,
  fontSize: 22,
  fontWeight: 600,
  letterSpacing: '-0.02em',
  color: 'var(--text-primary)',
};

const subStyle = {
  margin: '6px 0 0',
  fontSize: 14,
  color: 'var(--text-secondary)',
  lineHeight: 1.6,
};
