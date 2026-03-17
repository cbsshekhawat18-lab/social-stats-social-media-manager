/**
 * AuthCallbackPage — handles the redirect from social login (Google / Microsoft).
 * The backend redirects here with ?access=...&refresh=... in the URL.
 * We store the tokens, fetch /me, then send the user to the right place.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError]   = useState('');

  useEffect(() => {
    const params   = new URLSearchParams(window.location.search);
    const access   = params.get('access');
    const refresh  = params.get('refresh');
    const errorMsg = params.get('error');

    if (errorMsg) {
      setError(decodeURIComponent(errorMsg));
      setTimeout(() => navigate('/login'), 3500);
      return;
    }

    if (!access || !refresh) {
      setError('Missing tokens. Redirecting to login…');
      setTimeout(() => navigate('/login'), 2000);
      return;
    }

    localStorage.setItem('access_token',  access);
    localStorage.setItem('refresh_token', refresh);

    authAPI.me()
      .then(res => {
        const role = res.data.role;
        if (role === 'superadmin' || role === 'staff') {
          navigate('/admin');
        } else {
          navigate('/dashboard');
        }
      })
      .catch(() => {
        localStorage.clear();
        setError('Authentication failed. Redirecting to login…');
        setTimeout(() => navigate('/login'), 2000);
      });
  }, [navigate]);

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
    background: 'linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)',
  },
  card: {
    background: '#fff',
    borderRadius: 20,
    padding: '48px 56px',
    textAlign: 'center',
    boxShadow: '0 25px 60px rgba(0,0,0,.4)',
    minWidth: 280,
  },
  spinner: {
    width: 44,
    height: 44,
    border: '4px solid #e2e8f0',
    borderTopColor: '#2563eb',
    borderRadius: '50%',
    margin: '0 auto 20px',
    animation: 'spin 0.8s linear infinite',
  },
  msg: { fontSize: 15, color: '#64748b', margin: 0 },
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
