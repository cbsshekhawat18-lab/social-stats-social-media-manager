/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * End-user (B2C) self-signup. Multi-step wizard:
 *   1. Account — full name + email + password
 *   2. About   — industry + company name + phone (skippable except industry)
 *   3. Confirm — terms + go
 *
 * After signup the API returns access + refresh tokens; we drop them in
 * localStorage (matching the existing pattern in LoginPage) and route to /u.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Check, Sparkles } from 'lucide-react';

import { endUserAPI } from '../../services/api';
import toast from '../../components/ui/toast';

const INDUSTRY_OPTIONS = [
  { value: 'real_estate',  label: 'Real estate' },
  { value: 'clinic',       label: 'Clinic / hospital' },
  { value: 'restaurant',   label: 'Restaurant / cafe' },
  { value: 'retail',       label: 'Retail / e-commerce' },
  { value: 'creator',      label: 'Creator / influencer' },
  { value: 'professional', label: 'Professional services' },
  { value: 'other',        label: 'Other' },
];

export default function EndUserSignupPage() {
  const navigate = useNavigate();
  const [step,    setStep]    = useState(1);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    full_name: '',
    email:     '',
    password:  '',
    industry:  '',
    company_name: '',
    phone:     '',
    terms:     false,
  });

  const set = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

  function next() {
    if (step === 1) {
      if (!form.full_name.trim()) return toast.error('Tell us your name');
      if (!form.email.trim())     return toast.error('Email is required');
      if (form.password.length < 8) return toast.error('Password must be at least 8 characters');
    }
    if (step === 2 && !form.industry) return toast.error('Pick an industry so we can tune Social Stats for you');
    setStep((s) => Math.min(3, s + 1));
  }

  async function submit() {
    if (!form.terms) return toast.error('Please accept the Terms of Service');
    setLoading(true);
    try {
      const res = await endUserAPI.signup({
        email:        form.email.trim().toLowerCase(),
        password:     form.password,
        full_name:    form.full_name.trim(),
        industry:     form.industry,
        company_name: form.company_name.trim() || form.full_name.trim(),
        phone:        form.phone.trim(),
        terms_accepted: true,
      });
      const { access, refresh, user, workspace } = res.data;
      localStorage.setItem('access_token',  access);
      localStorage.setItem('refresh_token', refresh);
      localStorage.setItem('end_user_signup_workspace', JSON.stringify(workspace || {}));
      toast.success(`Welcome to Social Stats, ${user?.first_name || ''}!`);
      // Trigger a fresh /me bootstrap by routing through /auth-callback so the
      // existing useAuth hook picks up the new session.
      navigate('/u');
    } catch (e) {
      const data = e?.response?.data || {};
      const errs = data.errors || {};
      const first = Object.values(errs)[0] || data.detail || 'Signup failed';
      toast.error(String(first));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-page)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{
        width: '100%', maxWidth: 460,
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        padding: 28,
      }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <span style={{
            width: 32, height: 32,
            background: 'var(--brand-gradient)',
            borderRadius: 'var(--radius-sm)',
            color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={16} strokeWidth={2.4} />
          </span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              Get started with Social Stats
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              Free forever · no agency required
            </div>
          </div>
        </header>

        <Stepper current={step} />

        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Your full name" value={form.full_name} onChange={set('full_name')} placeholder="Priya Singh" autoFocus />
            <Field label="Email" type="email" value={form.email} onChange={set('email')} placeholder="you@yourbiz.com" />
            <Field label="Password" type="password" value={form.password} onChange={set('password')} placeholder="At least 8 characters" />
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <Label>What do you do?</Label>
              <select value={form.industry} onChange={set('industry')} style={selectStyle}>
                <option value="">Choose one…</option>
                {INDUSTRY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <Field label="Business name (optional)" value={form.company_name} onChange={set('company_name')} placeholder="Defaults to your name" />
            <Field label="Phone (optional)" value={form.phone} onChange={set('phone')} placeholder="+91 …" />
          </div>
        )}

        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Summary form={form} />
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <input
                type="checkbox"
                checked={form.terms}
                onChange={(e) => setForm((s) => ({ ...s, terms: e.target.checked }))}
                style={{ marginTop: 3 }}
              />
              <span>
                I accept the <Link to="/terms" style={{ color: 'var(--brand-primary-hover)' }}>Terms of Service</Link>{' '}
                and the <Link to="/privacy" style={{ color: 'var(--brand-primary-hover)' }}>Privacy Policy</Link>.
              </span>
            </label>
          </div>
        )}

        <footer style={{ display: 'flex', gap: 8, marginTop: 22 }}>
          {step > 1 && (
            <button type="button" onClick={() => setStep(step - 1)} style={btnGhost}>
              <ArrowLeft size={14} /> Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step < 3 && (
            <button type="button" onClick={next} style={btnPrimary}>
              Continue <ArrowRight size={14} />
            </button>
          )}
          {step === 3 && (
            <button type="button" onClick={submit} disabled={loading || !form.terms} style={btnPrimary}>
              {loading ? 'Creating…' : 'Create account'} <Check size={14} />
            </button>
          )}
        </footer>

        <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--brand-primary-hover)', fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}

function Stepper({ current }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          style={{
            flex: 1, height: 4, borderRadius: 4,
            background: n <= current ? 'var(--brand-primary)' : 'var(--border-subtle)',
            transition: 'background 0.2s',
          }}
        />
      ))}
    </div>
  );
}

function Field({ label, ...props }) {
  return (
    <div>
      <Label>{label}</Label>
      <input {...props} style={inputStyle} />
    </div>
  );
}

function Label({ children }) {
  return (
    <label style={{
      display: 'block',
      fontSize: 11, fontWeight: 600,
      letterSpacing: '0.04em', textTransform: 'uppercase',
      color: 'var(--text-tertiary)',
      marginBottom: 4,
    }}>
      {children}
    </label>
  );
}

function Summary({ form }) {
  const rows = [
    ['Name',     form.full_name],
    ['Email',    form.email],
    ['Industry', INDUSTRY_OPTIONS.find((i) => i.value === form.industry)?.label || form.industry],
    ['Business', form.company_name || form.full_name],
    ['Phone',    form.phone || '—'],
  ];
  return (
    <div style={{
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      padding: 14,
      background: 'var(--surface-sunken)',
    }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', gap: 12, fontSize: 13, padding: '4px 0' }}>
          <span style={{ width: 80, color: 'var(--text-tertiary)' }}>{k}</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  background: 'var(--surface-sunken)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 14, color: 'var(--text-primary)',
  outline: 'none', fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const selectStyle = { ...inputStyle };

const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '10px 16px',
  background: 'var(--brand-primary)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  fontSize: 13, fontWeight: 600,
  fontFamily: 'inherit',
  cursor: 'pointer',
};

const btnGhost = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '10px 14px',
  background: 'transparent',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13, fontWeight: 500,
  fontFamily: 'inherit',
  cursor: 'pointer',
};
