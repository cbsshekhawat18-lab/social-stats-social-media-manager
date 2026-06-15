/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, AlertCircle, Briefcase, User as UserIcon, Shield } from 'lucide-react';

import AuthLayout from '../components/auth/AuthLayout';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Checkbox from '../components/ui/Checkbox';
import SocialPlatformIcon from '../components/ui/SocialPlatformIcon';
import { useAuth } from '../hooks/useAuth';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

// Seeded by `python manage.py demo_setup`. Surfaced here so anyone cloning
// the repo can take the dashboard for a spin without standing up a real
// account. Safe to remove this block (and the panel below) once the demo
// command is dropped — nothing else depends on it.
const DEMO_LOGINS = [
  { email: 'admin@demo.local',   label: 'Superadmin', icon: Shield,    landing: '/admin'     },
  { email: 'agency@demo.local',  label: 'Agency',     icon: Briefcase, landing: '/dashboard' },
  { email: 'enduser@demo.local', label: 'End user',   icon: UserIcon,  landing: '/u'         },
];
const DEMO_PASSWORD = 'demo';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const urlError = params.get('error');
  const nextPath = params.get('next');

  function validate() {
    const e = {};
    if (!email.trim()) e.email = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email address.';
    if (!password.trim()) e.password = 'Password is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function doLogin(emailVal, passwordVal) {
    setLoading(true);
    try {
      const user = await login(emailVal, passwordVal, true);
      if (nextPath) {
        navigate(nextPath, { replace: true });
      } else if (user.role === 'superadmin' || user.role === 'staff') {
        navigate('/admin');
      } else if (user.account_type === 'end_user') {
        navigate('/u');
      } else if (user.role === 'client' && !user.client_id) {
        navigate('/pending');
      } else if (user.role === 'client' && !user.onboarding_complete) {
        navigate('/dashboard/onboarding');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setServerError(
        detail === 'email_not_verified'
          ? 'Please verify your email before signing in. Check your inbox for the verification link.'
          : 'Invalid email or password. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    setServerError('');
    if (!validate()) return;
    await doLogin(email, password);
  }

  async function signInAsDemo(demoEmail) {
    setServerError('');
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    setAccepted(true);
    await doLogin(demoEmail, DEMO_PASSWORD);
  }

  return (
    <AuthLayout
      footer={
        <>
          New to Social Stats?{' '}
          <Link to="/signup" style={{ color: 'var(--text-link)', fontWeight: 600, textDecoration: 'none' }}>
            Create an account
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
        <header style={{ marginBottom: 24 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
            }}
          >
            Welcome back
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text-secondary)' }}>
            Sign in to your Social Stats workspace.
          </p>
        </header>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors((p) => ({ ...p, email: undefined })); }}
            placeholder="you@company.com"
            error={errors.email}
            size="lg"
            autoFocus
          />

          <div>
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors((p) => ({ ...p, password: undefined })); }}
              placeholder="Enter your password"
              error={errors.password}
              size="lg"
            />
            <div style={{ marginTop: 6, textAlign: 'right' }}>
              <Link
                to="/forgot-password"
                style={{ fontSize: 12, color: 'var(--text-link)', fontWeight: 500, textDecoration: 'none' }}
              >
                Forgot password?
              </Link>
            </div>
          </div>

          <Checkbox
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            label={
              <>
                I agree to the{' '}
                <Link to="/terms" style={{ color: 'var(--text-link)', fontWeight: 500 }}>Terms of Service</Link>
                {' '}and{' '}
                <Link to="/privacy" style={{ color: 'var(--text-link)', fontWeight: 500 }}>Privacy Policy</Link>
              </>
            }
          />

          {(serverError || urlError) && (
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
                lineHeight: 1.45,
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{serverError || decodeURIComponent(urlError)}</span>
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            iconRight={ArrowRight}
            fullWidth
            loading={loading}
            disabled={!accepted}
          >
            Sign in
          </Button>
        </form>

        {/* Divider */}
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
            or continue with
          </span>
          <span style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
        </div>

        {/* SSO row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onClick={() => { window.location.href = `${API_BASE}/auth/social/google/start/`; }}
          >
            <SocialPlatformIcon platform="google" size={16} /> Google
          </Button>
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onClick={() => { window.location.href = `${API_BASE}/auth/social/facebook/start/`; }}
          >
            <SocialPlatformIcon platform="facebook" size={16} /> Facebook
          </Button>
        </div>

        {/* Demo logins — populated by `python manage.py demo_setup` in the
            backend. Each button signs in as the corresponding demo account
            and lands on the right shell. Safe to remove this whole block
            for a production deployment. */}
        <div
          style={{
            marginTop: 24,
            padding: 16,
            background: 'var(--surface-sunken)',
            border: '1px dashed var(--border-default)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 10, gap: 12,
          }}>
            <span style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--brand-primary-hover)',
            }}>
              Try the demo
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              local only · password <code style={{ fontFamily: 'var(--font-mono)' }}>demo</code>
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {DEMO_LOGINS.map((d) => {
              const Icon = d.icon;
              return (
                <button
                  type="button"
                  key={d.email}
                  onClick={() => signInAsDemo(d.email)}
                  disabled={loading}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
                    padding: '10px 12px', minHeight: 'unset',
                    background: 'var(--surface-card)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                    textAlign: 'left',
                    transition: 'var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => { if (!loading) e.currentTarget.style.borderColor = 'var(--brand-primary-glow)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                >
                  <Icon size={14} color="var(--brand-primary-hover)" />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{d.label}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{d.email}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
