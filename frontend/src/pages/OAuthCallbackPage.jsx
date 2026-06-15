/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * OAuthCallbackPage
 * All OAuth platform connections (Facebook, Google, LinkedIn) land here.
 * URL: /oauth/callback?connected=facebook&client_id=3
 *      /oauth/callback?error=facebook_consumer_token&client_id=3
 *
 * Waits for auth to finish loading, then navigates to the correct settings
 * page passing the result via React Router state so SettingsPage shows a banner.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function OAuthCallbackPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return; // wait for JWT to be verified

    const params    = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const error     = params.get('error');
    const clientId  = params.get('client_id');

    const routerState = { oauthConnected: connected || null, oauthError: error || null };

    if (!user) {
      // Not logged in — send to login but keep a note so user can retry
      navigate('/login', { replace: true });
      return;
    }

    const isAdmin = user.role === 'superadmin' || user.role === 'staff';

    if (isAdmin && clientId) {
      navigate(`/admin/client/${clientId}/settings`, { state: routerState, replace: true });
    } else if (isAdmin) {
      navigate('/admin', { replace: true });
    } else {
      navigate('/dashboard/settings', { state: routerState, replace: true });
    }
  }, [loading, user, navigate]);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.spinner} />
        <p style={styles.msg}>Finalising connection…</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-page)' },
  card: { background: 'var(--surface-card)', borderRadius: 20, padding: '48px 56px', textAlign: 'center', boxShadow: '0 25px 60px rgba(0,0,0,.15)', minWidth: 280 },
  spinner: { width: 44, height: 44, border: '4px solid var(--border-default)', borderTopColor: '#00d7ff', borderRadius: '50%', margin: '0 auto 20px', animation: 'spin 0.8s linear infinite' },
  msg: { fontSize: 15, color: 'var(--text-secondary)', margin: 0 },
};
