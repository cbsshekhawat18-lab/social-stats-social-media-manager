/**
 * OAuthCallbackPage
 * All OAuth platform connections (Facebook, Google, LinkedIn) land here.
 * URL: /oauth/callback?connected=facebook&client_id=3
 *      /oauth/callback?error=facebook_consumer_token&client_id=3
 *
 * We wait for auth to load, then navigate to the correct settings page
 * passing the result via React Router `state` so the SettingsPage
 * can show a banner without relying on query-param timing.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function OAuthCallbackPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [msg, setMsg] = useState('Connecting…');

  useEffect(() => {
    if (loading) return; // wait for auth

    const params    = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const error     = params.get('error');
    const clientId  = params.get('client_id');

    const state = { oauthConnected: connected, oauthError: error };

    if (!user) {
      navigate('/login');
      return;
    }

    const isAdmin = user.role === 'superadmin' || user.role === 'staff';

    if (isAdmin && clientId) {
      navigate(`/admin/client/${clientId}/settings`, { state, replace: true });
    } else if (isAdmin) {
      navigate('/admin', { replace: true });
    } else {
      navigate('/dashboard/settings', { state, replace: true });
    }
  }, [loading, user, navigate]);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.spinner} />
        <p style={styles.msg}>{msg}</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f4f9' },
  card: { background: '#fff', borderRadius: 20, padding: '48px 56px', textAlign: 'center', boxShadow: '0 25px 60px rgba(0,0,0,.15)', minWidth: 280 },
  spinner: { width: 44, height: 44, border: '4px solid #e2e8f0', borderTopColor: '#00d7ff', borderRadius: '50%', margin: '0 auto 20px', animation: 'spin 0.8s linear infinite' },
  msg: { fontSize: 15, color: '#64748b', margin: 0 },
};
