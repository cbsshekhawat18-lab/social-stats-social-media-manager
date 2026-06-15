/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * SignupPage — /signup?invite=TOKEN
 * Email/password signup for clients. Also supports Google/Facebook social signup.
 * After submit → "check your email" success state with resend.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, AlertCircle, CheckCircle, Mail, RefreshCw, Building2 } from 'lucide-react';

import AuthLayout from '../components/auth/AuthLayout';
import PasswordStrength from '../components/auth/PasswordStrength';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Checkbox from '../components/ui/Checkbox';
import Confetti from '../components/ui/Confetti';
import SocialPlatformIcon from '../components/ui/SocialPlatformIcon';
import { useAuth } from '../hooks/useAuth';
import { authAPI, invitationAPI } from '../services/api';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

export default function SignupPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const params = new URLSearchParams(window.location.search);
  const inviteToken = params.get('invite');

  const [inv, setInv] = useState(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [resending, setResending] = useState(false);
  const [resentMsg, setResentMsg] = useState('');

  // Redirect already-logged-in users
  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  // Fetch invitation preview
  useEffect(() => {
    if (!inviteToken) return;
    invitationAPI.getByToken(inviteToken).then((res) => setInv(res.data)).catch(() => {});
    localStorage.setItem('pending_invite_token', inviteToken);
  }, [inviteToken]);

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
    if (!fullName.trim()) e.fullName = 'Full name is required.';
    if (!email.trim()) e.email = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email address.';
    if (!password) e.password = 'Password is required.';
    else if (password.length < 8) e.password = 'Password must be at least 8 characters.';
    if (!confirmPwd) e.confirmPwd = 'Please confirm your password.';
    else if (password !== confirmPwd) e.confirmPwd = 'Passwords do not match.';
    if (!accepted) e.terms = 'You must accept the Terms of Service.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    setServerError('');
    if (!validate()) return;
    setLoading(true);
    try {
      await authAPI.signup({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        terms_accepted: true,
      });
      setDone(true);
    } catch (err) {
      const data = err?.response?.data;
      if (data?.errors) {
        const m = {};
        if (data.errors.full_name) m.fullName = data.errors.full_name;
        if (data.errors.email) m.email = data.errors.email;
        if (data.errors.password) m.password = data.errors.password;
        setErrors(m);
      } else {
        setServerError(data?.detail || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setResentMsg('');
    try {
      await authAPI.resendVerification(email);
      setResentMsg('A new verification email has been sent.');
    } catch {
      setResentMsg('Could not resend. Please try again.');
    } finally {
      setResending(false);
    }
  }

  function handleGoogle() {
    if (inviteToken) localStorage.setItem('pending_invite_token', inviteToken);
    window.location.href = `${API_BASE}/auth/social/google/start/`;
  }
  function handleFacebook() {
    if (inviteToken) localStorage.setItem('pending_invite_token', inviteToken);
    window.location.href = `${API_BASE}/auth/social/facebook/start/`;
  }

  // ───────────────────────────── Success state ─────────────────────────────
  if (done) {
    return (
      <>
        <Confetti />
        <AuthLayout
          heroTitle="One last step."
          heroSub="We just sent a verification link to your inbox — open it to activate your account."
        >
        <div
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xl)',
            padding: 32,
            boxShadow: 'var(--shadow-md)',
            textAlign: 'center',
          }}
        >
          <div
            aria-hidden
            style={{
              width: 56, height: 56,
              margin: '0 auto 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--brand-primary-soft)',
              borderRadius: '50%',
              color: 'var(--brand-primary-hover)',
            }}
          >
            <Mail size={26} strokeWidth={1.8} />
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
            Check your inbox
          </h1>
          <p style={{ margin: '8px 0 20px', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            We sent a verification link to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>.
            Click the link in the email to activate your account.
          </p>

          {resentMsg && (
            <div
              role="status"
              style={{
                padding: '10px 12px',
                marginBottom: 14,
                background: resentMsg.startsWith('A new') ? 'var(--success-bg)' : 'var(--danger-bg)',
                border: `1px solid ${resentMsg.startsWith('A new') ? 'var(--success)' : 'var(--danger)'}`,
                borderRadius: 'var(--radius-md)',
                color: resentMsg.startsWith('A new') ? 'var(--success)' : 'var(--danger)',
                fontSize: 13,
              }}
            >
              {resentMsg}
            </div>
          )}

          <Button
            variant="secondary"
            size="md"
            icon={RefreshCw}
            fullWidth
            loading={resending}
            onClick={handleResend}
          >
            Resend verification email
          </Button>
          <div style={{ marginTop: 14, fontSize: 13, color: 'var(--text-secondary)' }}>
            Already verified?{' '}
            <Link to="/login" style={{ color: 'var(--text-link)', fontWeight: 600, textDecoration: 'none' }}>
              Sign in
            </Link>
          </div>
        </div>
        </AuthLayout>
      </>
    );
  }

  // ───────────────────────────── Form state ──────────────────────────────────
  return (
    <AuthLayout
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--text-link)', fontWeight: 600, textDecoration: 'none' }}>
            Sign in
          </Link>
        </>
      }
    >
      <div
        style={{
          background: 'var(--surface-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          padding: 32,
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <header style={{ marginBottom: 22 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Create your account
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text-secondary)' }}>
            Start your 14-day free trial. No credit card required.
          </p>
        </header>

        {inv && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '10px 12px',
              marginBottom: 18,
              background: 'var(--brand-primary-soft)',
              border: '1px solid var(--brand-primary-glow)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              color: 'var(--text-secondary)',
            }}
          >
            <Building2 size={15} style={{ color: 'var(--brand-primary-hover)', flexShrink: 0, marginTop: 1 }} />
            <span>
              You've been invited by <strong style={{ color: 'var(--text-primary)' }}>{inv.agency_name}</strong>.
              Sign up below to join their workspace.
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input
            label="Full name"
            autoComplete="name"
            value={fullName}
            onChange={(e) => { setFullName(e.target.value); clearField('fullName'); }}
            placeholder="Your full name"
            error={errors.fullName}
            size="lg"
            autoFocus
          />

          <Input
            label="Work email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); clearField('email'); }}
            placeholder="you@company.com"
            error={errors.email}
            size="lg"
          />

          <div>
            <Input
              label="Password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearField('password'); }}
              placeholder="At least 8 characters"
              error={errors.password}
              size="lg"
            />
            <PasswordStrength password={password} />
          </div>

          <Input
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            value={confirmPwd}
            onChange={(e) => { setConfirmPwd(e.target.value); clearField('confirmPwd'); }}
            placeholder="Re-enter your password"
            error={errors.confirmPwd}
            success={!!confirmPwd && confirmPwd === password && password.length >= 8 && !errors.confirmPwd}
            size="lg"
          />

          <Checkbox
            checked={accepted}
            onChange={(e) => { setAccepted(e.target.checked); if (errors.terms) clearField('terms'); }}
            label={
              <>
                I agree to the{' '}
                <Link to="/terms" style={{ color: 'var(--text-link)', fontWeight: 500 }}>Terms</Link>
                {' '}and{' '}
                <Link to="/privacy" style={{ color: 'var(--text-link)', fontWeight: 500 }}>Privacy Policy</Link>
              </>
            }
          />
          {errors.terms && (
            <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: -6 }}>{errors.terms}</div>
          )}

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
            Create account
          </Button>
        </form>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            margin: '20px 0',
            color: 'var(--text-tertiary)',
          }}
        >
          <span style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
          <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            or sign up with
          </span>
          <span style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Button variant="secondary" size="lg" fullWidth onClick={handleGoogle}>
            <SocialPlatformIcon platform="google" size={16} /> Google
          </Button>
          <Button variant="secondary" size="lg" fullWidth onClick={handleFacebook}>
            <SocialPlatformIcon platform="facebook" size={16} /> Facebook
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
}
