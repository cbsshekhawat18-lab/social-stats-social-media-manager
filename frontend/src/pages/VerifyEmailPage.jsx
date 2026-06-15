/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * VerifyEmailPage — /verify-email?token=UUID
 * Verifies token → stores JWT → redirects to /pending.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';

import AuthLayout from '../components/auth/AuthLayout';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import { authAPI } from '../services/api';
import { useAuth } from '../hooks/useAuth';

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const { refreshAuth } = useAuth();
  const token = new URLSearchParams(window.location.search).get('token');

  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token found in the URL.');
      return;
    }
    authAPI
      .verifyEmail(token)
      .then(async (res) => {
        const { access, refresh } = res.data;
        await refreshAuth(access, refresh);
        setStatus('success');
        setTimeout(() => navigate('/pending', { replace: true }), 2000);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err?.response?.data?.error || 'This verification link is invalid or has expired.');
      });
  }, []);

  return (
    <AuthLayout
      heroTitle={
        status === 'success' ? 'You\'re verified.' :
        status === 'error'   ? 'Couldn\'t verify your email.' :
                               'Just a moment…'
      }
      heroSub={
        status === 'success' ? 'Welcome to Social Stats. Let\'s get your workspace set up.' :
        status === 'error'   ? 'Verification links expire after 24 hours. Resend a fresh one if needed.' :
                               'We\'re activating your Social Stats account.'
      }
    >
      <div style={cardStyle}>
        {status === 'loading' && (
          <>
            <div aria-hidden style={iconBubbleStyle}>
              <Spinner size="md" />
            </div>
            <h1 style={titleStyle}>Verifying your email…</h1>
            <p style={subStyle}>This usually takes just a second.</p>
          </>
        )}

        {status === 'success' && (
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <div aria-hidden style={{ ...iconBubbleStyle, background: 'var(--success-bg)', color: 'var(--success)' }}>
              <CheckCircle size={28} strokeWidth={1.8} />
            </div>
            <h1 style={titleStyle}>Email verified!</h1>
            <p style={subStyle}>Your account is active. Redirecting to your dashboard…</p>
          </motion.div>
        )}

        {status === 'error' && (
          <>
            <div aria-hidden style={{ ...iconBubbleStyle, background: 'var(--danger-bg)', color: 'var(--danger)' }}>
              <XCircle size={28} strokeWidth={1.8} />
            </div>
            <h1 style={titleStyle}>Verification failed</h1>
            <p style={subStyle}>{message}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
              <Button as={Link} to="/signup" size="md" fullWidth>
                Back to sign up
              </Button>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Already verified?{' '}
                <Link to="/login" style={{ color: 'var(--text-link)', fontWeight: 600, textDecoration: 'none' }}>
                  Sign in
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </AuthLayout>
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
  background: 'var(--brand-primary-soft)',
  borderRadius: '50%',
  color: 'var(--brand-primary-hover)',
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
