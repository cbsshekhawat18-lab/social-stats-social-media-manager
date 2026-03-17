import { useState } from 'react';
import { oauthAPI } from '../../services/api';
import { PLATFORMS } from '../../services/platforms';
import { Lightbulb, Zap } from 'lucide-react';

export default function ConnectedAccounts({ clientId, status, onRefresh }) {
  const [loading, setLoading] = useState({});

  const handleConnect = (platform) => {
    const urlMap = {
      facebook:           oauthAPI.facebookUrl(clientId),
      instagram:          oauthAPI.facebookUrl(clientId), // same flow
      youtube:            oauthAPI.googleUrl(clientId),
      google_my_business: oauthAPI.googleUrl(clientId),   // same flow
      linkedin:           oauthAPI.linkedinUrl(clientId),
    };
    // Redirect browser to OAuth start
    window.location.href = urlMap[platform];
  };

  const handleDisconnect = async (platform) => {
    if (!window.confirm(`Disconnect ${PLATFORMS[platform]?.label}? Sync will stop.`)) return;
    setLoading(l => ({ ...l, [platform]: true }));
    try {
      await oauthAPI.disconnect(clientId, platform);
      onRefresh?.();
    } finally {
      setLoading(l => ({ ...l, [platform]: false }));
    }
  };

  const platformOrder = ['facebook','instagram','youtube','linkedin','google_my_business'];

  return (
    <div>
      <h2 style={styles.heading}>Connected Accounts</h2>
      <p style={styles.sub}>
        Connect your social media accounts to start syncing stats automatically.
      </p>

      <div style={styles.grid}>
        {platformOrder.map(key => {
          const p      = PLATFORMS[key];
          const s      = status[key] || {};
          const active = s.status === 'active';
          const expired= s.status === 'expired';
          const conn   = active || expired;

          // Instagram is always connected via Facebook; only show note (no separate button)
          const ytConnected  = (status['youtube']  || {}).status === 'active';
          const fbConnected  = (status['facebook'] || {}).status === 'active';
          const groupNote = key === 'instagram' && fbConnected && conn
            ? <span style={styles.groupNoteInner}><Zap size={13} style={{ flexShrink: 0 }} /> Connected via Facebook</span>
            : key === 'google_my_business' && ytConnected && conn
            ? <span style={styles.groupNoteInner}><Zap size={13} style={{ flexShrink: 0 }} /> Connected via Google</span>
            : null;

          return (
            <div key={key} style={{ ...styles.card, borderLeft: `4px solid ${p.color}` }}>
              <div style={styles.cardTop}>
                <div style={styles.platformInfo}>
                  <span style={styles.platformIcon}>{p.icon}</span>
                  <div>
                    <div style={styles.platformName}>{p.label}</div>
                    {s.account_name && (
                      <div style={styles.accountName}>@{s.account_name}</div>
                    )}
                  </div>
                </div>

                <div style={styles.statusBadge(active, expired)}>
                  {active ? '● Active' : expired ? '⚠ Expired' : '○ Not connected'}
                </div>
              </div>

              {s.expires_at && (
                <div style={styles.expiry}>
                  Token expires: {new Date(s.expires_at).toLocaleDateString()}
                </div>
              )}

              {groupNote ? (
                <div style={styles.groupNote}>{groupNote}</div>
              ) : conn ? (
                <button
                  onClick={() => handleDisconnect(key)}
                  disabled={loading[key]}
                  style={styles.disconnectBtn}
                >
                  {loading[key] ? 'Disconnecting…' : 'Disconnect'}
                </button>
              ) : (
                <button
                  onClick={() => handleConnect(key)}
                  style={{ ...styles.connectBtn, background: p.color }}
                >
                  Connect {p.label} →
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Help box */}
      <div style={styles.helpBox}>
        <strong style={styles.helpTitle}><Lightbulb size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />How it works:</strong>
        <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 13, color: '#64748b' }}>
          <li>Click a Connect button → you'll be redirected to log in to that platform</li>
          <li>Approve the permissions requested</li>
          <li>You'll be brought back here — data starts syncing automatically</li>
          <li>Facebook & Instagram share one login. YouTube & Google My Business share one login.</li>
        </ul>
      </div>
    </div>
  );
}

const styles = {
  heading: { margin: '0 0 6px', fontSize: 20, fontWeight: 700, color: '#0f172a' },
  sub:     { margin: '0 0 24px', color: '#64748b', fontSize: 14 },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 16, marginBottom: 24,
  },
  card: {
    background: '#fff', borderRadius: 12, padding: 20,
    boxShadow: '0 1px 6px rgba(0,0,0,.07)',
  },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  platformInfo: { display: 'flex', alignItems: 'center', gap: 10 },
  platformIcon: { fontSize: 28 },
  platformName: { fontWeight: 700, fontSize: 15, color: '#0f172a' },
  accountName:  { fontSize: 12, color: '#64748b', marginTop: 2 },
  statusBadge: (active, expired) => ({
    fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
    background: active ? '#dcfce7' : expired ? '#fef3c7' : '#f1f5f9',
    color:      active ? '#16a34a' : expired ? '#d97706' : '#64748b',
  }),
  expiry:       { fontSize: 12, color: '#94a3b8', marginBottom: 10 },
  groupNote:    { fontSize: 12, color: '#2563eb', fontStyle: 'italic', marginTop: 4 },
  groupNoteInner: { display: 'flex', alignItems: 'center', gap: 4 },
  connectBtn: {
    width: '100%', padding: '10px', borderRadius: 8, border: 'none',
    color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13,
  },
  disconnectBtn: {
    width: '100%', padding: '9px', borderRadius: 8, border: '1.5px solid #e5e7eb',
    background: '#fff', color: '#dc2626', cursor: 'pointer', fontWeight: 600, fontSize: 13,
  },
  helpBox: {
    background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10,
    padding: '14px 18px', fontSize: 13, color: '#1e40af',
  },
  helpTitle: { display: 'flex', alignItems: 'center' },
};
