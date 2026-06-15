/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * MyConnectionsPage — end-user platform connections.
 *
 * Reuses the existing <ConnectedAccounts /> component (Facebook / Instagram /
 * YouTube / GMB / LinkedIn). Resolves the workspace via /end-user/me/, then
 * polls the existing /oauth/status endpoint.
 *
 * Per Rule #9 of the marketplace spec: end-users can ALWAYS disconnect their
 * platforms even when an agency is managing the workspace. The backend's
 * `oauth_disconnect` enforces this — owners bypass the agency-side check.
 */
import { useCallback, useEffect, useState } from 'react';
import { Plug, RefreshCw } from 'lucide-react';

import ConnectedAccounts from '../../components/ui/ConnectedAccounts';
import { endUserAPI, oauthAPI } from '../../services/api';
import toast from '../../components/ui/toast';

export default function MyConnectionsPage() {
  const [workspace, setWorkspace] = useState(null);
  const [status,    setStatus]    = useState({});
  const [loading,   setLoading]   = useState(true);

  const refreshStatus = useCallback(async (clientId) => {
    if (!clientId) return;
    try {
      const r = await oauthAPI.status(clientId);
      setStatus(r.data || {});
    } catch {
      toast.error('Failed to load connection status');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    endUserAPI.me()
      .then((r) => {
        if (cancelled) return;
        setWorkspace(r.data?.workspace || null);
        return refreshStatus(r.data?.workspace?.id);
      })
      .catch(() => toast.error('Could not load your workspace'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshStatus]);

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <span style={{
          width: 40, height: 40,
          background: 'var(--brand-primary-glow)',
          color: 'var(--brand-primary-hover)',
          borderRadius: 'var(--radius-md)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Plug size={20} strokeWidth={2.2} />
        </span>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Connections
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.55 }}>
            Plug Social Stats into your social accounts to start tracking posts, engagement, and DMs.
            You can disconnect any platform at any time — even if an agency is managing your workspace.
          </p>
        </div>
        {workspace && (
          <button
            type="button"
            onClick={() => refreshStatus(workspace.id)}
            style={refreshBtn}
            aria-label="Refresh status"
          >
            <RefreshCw size={13} /> Refresh
          </button>
        )}
      </header>

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading…</div>
      ) : !workspace ? (
        <div style={emptyBox}>
          <strong>No workspace yet.</strong> Finish onboarding to connect platforms.
        </div>
      ) : (
        <ConnectedAccounts
          clientId={workspace.id}
          status={status}
          onRefresh={() => refreshStatus(workspace.id)}
        />
      )}
    </div>
  );
}

const refreshBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 12px',
  background: 'var(--surface-card)',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  fontSize: 12, fontWeight: 600,
  fontFamily: 'inherit',
  cursor: 'pointer',
};

const emptyBox = {
  padding: 24,
  background: 'var(--surface-card)',
  border: '1px dashed var(--border-default)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-secondary)',
  fontSize: 14,
  textAlign: 'center',
};
