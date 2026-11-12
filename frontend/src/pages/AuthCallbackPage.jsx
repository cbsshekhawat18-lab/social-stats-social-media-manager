/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * AuthCallbackPage — handles the redirect from social login (Google /
 * Microsoft / Facebook). The backend redirects here with a one-time
 * ?code=… (never the tokens themselves); we strip it from the address bar,
 * swap it for tokens via POST /auth/social/exchange/, load the user into the
 * auth context and send them to the right place.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useAuth } from '../hooks/useAuth';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { refreshAuth } = useAuth();
  const [error, setError] = useState('');
  // The code is single-use; React StrictMode runs effects twice in dev.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const params   = new URLSearchParams(window.location.search);
    const code     = params.get('code');
    const errorMsg = params.get('error');
    // Keep the code out of browser history, bookmarks and Referer headers.
    window.history.replaceState(window.history.state, '', window.location.pathname);

    const fail = (msg, delay = 2000) => {
      setError(msg);
      setTimeout(() => navigate('/login', { replace: true }), delay);
    };

    if (errorMsg) {
      fail(errorMsg, 3500);
      return;
    }
    if (!code) {
      fail('Missing sign-in code. Redirecting to login…');
      return;
    }

    authAPI.socialExchange(code)
      .then(async ({ data }) => {
        // MFA-enabled account: no JWTs yet — finish on the login page's
        // second-factor step with the short-lived handshake token.
        if (data.mfa_required && data.mfa_token) {
          navigate('/login', { replace: true, state: { mfaToken: data.mfa_token } });
          return;
        }
        if (!data.access || !data.refresh) throw new Error('missing tokens');

        const me = await refreshAuth(data.access, data.refresh);
        const { role, onboarding_complete: onboardingComplete, client_id: clientId } = me;
        if (role === 'superadmin' || role === 'staff') {
          navigate('/admin', { replace: true });
        } else if (data.state === 'self' || (role === 'client' && !clientId)) {
          navigate('/pending', { replace: true });
        } else if (!onboardingComplete) {
          navigate('/dashboard/onboarding', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      })
      .catch(() => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        fail('Authentication failed. Redirecting to login…');
      });
  }, [navigate, refreshAuth]);


  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {error ? (
          <>
            <div style={styles.errorIcon}>✕</div>
            <p style={styles.errorText}>{error}</p>
          </>
        ) : (
          <>
            <div style={styles.spinner} />
            <p style={styles.msg}>Signing you in…</p>
          </>
        )}
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--surface-page)',
  },
  card: {
    background: 'var(--surface-card)',
    borderRadius: 20,
    padding: '48px 56px',
    textAlign: 'center',
    boxShadow: '0 25px 60px rgba(0,0,0,.4)',
    minWidth: 280,
  },
  spinner: {
    width: 44,
    height: 44,
    border: '4px solid var(--border-default)',
    borderTopColor: '#00d7ff',
    borderRadius: '50%',
    margin: '0 auto 20px',
    animation: 'spin 0.8s linear infinite',
  },
  msg: { fontSize: 15, color: 'var(--text-secondary)', margin: 0 },
  errorIcon: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: '#fef2f2',
    color: '#dc2626',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    fontWeight: 800,
    margin: '0 auto 16px',
  },
  errorText: { fontSize: 14, color: '#dc2626', margin: 0 },
};
