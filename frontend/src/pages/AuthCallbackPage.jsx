/**
 * AuthCallbackPage — handles the redirect from social login (Google / Microsoft).
 * The backend redirects here with ?access=...&refresh=... in the URL.
 * We store the tokens, fetch /me, then send the user to the right place.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { StatoxLogoHorizontal } from '../components/ui/StatoxLogo';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError]     = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const params   = new URLSearchParams(window.location.search);
    const access   = params.get('access');
    const refresh  = params.get('refresh');
    const status   = params.get('status');
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

    if (status === 'pending') {
      setPending(true);
      return;
    }

    authAPI.me()
      .then(res => {
        const role = res.data.role;
        const onboardingComplete = res.data.onboarding_complete;
        if (role === 'superadmin' || role === 'staff') {
          navigate('/admin');
        } else if (role === 'client' && !onboardingComplete) {
          navigate('/dashboard/onboarding');
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

  if (pending) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.logoWrap}>
            <StatoxLogoHorizontal height={28} />
          </div>
          <div style={styles.pendingIcon}>⏳</div>
          <h2 style={styles.pendingTitle}>Account Pending Approval</h2>
          <p style={styles.pendingText}>
            Your account has been created successfully. An administrator needs to
            assign you to a workspace before you can access the dashboard.
          </p>
          <p style={styles.pendingText}>
            You'll receive an email once your account is activated. Please contact
            your administrator if you need immediate access.
          </p>
          <button onClick={() => { localStorage.clear(); navigate('/login'); }} style={styles.backBtn}>
            Back to Login
          </button>
        </div>
      </div>
    );
  }

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
    background: '#f0f4f9',
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
    borderTopColor: '#00d7ff',
    borderRadius: '50%',
    margin: '0 auto 20px',
    animation: 'spin 0.8s linear infinite',
  },
  msg: { fontSize: 15, color: '#64748b', margin: 0 },
  logoWrap: { display: 'flex', justifyContent: 'center', marginBottom: 24 },
  pendingIcon: { fontSize: 40, marginBottom: 16, textAlign: 'center' },
  pendingTitle: { fontSize: 20, fontWeight: 800, color: '#0f172a', margin: '0 0 12px', textAlign: 'center' },
  pendingText: { fontSize: 14, color: '#475569', lineHeight: 1.7, margin: '0 0 10px', textAlign: 'center' },
  backBtn: {
    marginTop: 20, width: '100%', padding: '12px',
    background: '#00d7ff', color: '#0f172a', border: 'none',
    borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
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
