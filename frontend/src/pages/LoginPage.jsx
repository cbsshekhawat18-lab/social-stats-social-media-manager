import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

export default function LoginPage() {
  const { login }             = useAuth();
  const navigate              = useNavigate();
  const [email, setEmail]     = useState('');
  const [password, setPass]   = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  // Read ?error= set by the backend after a failed social login
  const urlError = new URLSearchParams(window.location.search).get('error');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const user = await login(email, password);
      navigate(user.role === 'superadmin' || user.role === 'staff' ? '/admin' : '/dashboard');
    } catch {
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    window.location.href = `${API_BASE}/auth/social/google/start/`;
  };

  const handleMicrosoft = () => {
    window.location.href = `${API_BASE}/auth/social/microsoft/start/`;
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logo}>
          <div style={styles.logoIcon}>📊</div>
          <h1 style={styles.logoText}>SocialStats</h1>
          <p style={styles.logoSub}>Social Media Analytics Dashboard</p>
        </div>

        {/* Email/password form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPass(e.target.value)}
              placeholder="••••••••"
              required
              style={styles.input}
            />
          </div>

          {(error || urlError) && (
            <div style={styles.error}>{error || decodeURIComponent(urlError)}</div>
          )}

          <button type="submit" disabled={loading} style={styles.btn}>
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>
        </form>

        {/* Social login — client accounts only */}
        <div style={styles.dividerRow}>
          <span style={styles.dividerLine} />
          <span style={styles.dividerText}>or continue as a user</span>
          <span style={styles.dividerLine} />
        </div>

        <div style={styles.socialButtons}>
          <button type="button" onClick={handleGoogle} style={styles.socialBtn}>
            <GoogleIcon />
            Sign in with Google
          </button>
          <button type="button" onClick={handleMicrosoft} style={styles.socialBtn}>
            <MicrosoftIcon />
            Sign in with Microsoft
          </button>
        </div>

        <p style={styles.footer}>
          Your social media data, all in one place.
        </p>
      </div>
    </div>
  );
}

// ── SVG icons ─────────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      <path fill="none" d="M0 0h48v48H0z"/>
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" style={{ flexShrink: 0 }}>
      <rect x="1"  y="1"  width="9" height="9" fill="#F25022"/>
      <rect x="11" y="1"  width="9" height="9" fill="#7FBA00"/>
      <rect x="1"  y="11" width="9" height="9" fill="#00A4EF"/>
      <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
    </svg>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  card: {
    background: '#fff', borderRadius: 20, padding: '48px 40px',
    width: '100%', maxWidth: 420, boxShadow: '0 25px 60px rgba(0,0,0,.4)',
  },
  logo: { textAlign: 'center', marginBottom: 36 },
  logoIcon: { fontSize: 48, marginBottom: 8 },
  logoText: { margin: '0 0 4px', fontSize: 28, fontWeight: 800, color: '#0f172a' },
  logoSub: { margin: 0, color: '#64748b', fontSize: 14 },
  form: { display: 'flex', flexDirection: 'column', gap: 18 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 600, color: '#374151' },
  input: {
    padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb',
    fontSize: 15, outline: 'none', transition: 'border .2s',
  },
  error: {
    background: '#fef2f2', color: '#dc2626', padding: '10px 14px',
    borderRadius: 8, fontSize: 13, border: '1px solid #fecaca',
  },
  btn: {
    background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff',
    border: 'none', borderRadius: 10, padding: '14px', fontSize: 15,
    fontWeight: 700, cursor: 'pointer', marginTop: 4,
  },
  dividerRow: {
    display: 'flex', alignItems: 'center', gap: 10, margin: '28px 0 20px',
  },
  dividerLine: {
    flex: 1, height: 1, background: '#e5e7eb',
  },
  dividerText: {
    fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap', fontWeight: 500,
  },
  socialButtons: {
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  socialBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    padding: '12px 16px', borderRadius: 10, border: '1.5px solid #e5e7eb',
    background: '#fff', color: '#1e293b', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', transition: 'border-color .2s, background .2s',
  },
  footer: { textAlign: 'center', color: '#94a3b8', fontSize: 12, marginTop: 28, marginBottom: 0 },
};
