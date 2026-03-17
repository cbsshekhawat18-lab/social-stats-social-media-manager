import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Link2, Copy, Check, X, Lock, Calendar, Layers, Clock, Share2, Trash2, Eye } from 'lucide-react';
import { sharedReportsAPI } from '../../services/api';
import { PLATFORMS } from '../../services/platforms';

const ALL_PLATFORMS = Object.keys(PLATFORMS);

const EXPIRY_OPTIONS = [
  { label: 'Never',   value: '' },
  { label: '24 hours', value: '24h' },
  { label: '7 days',   value: '7d' },
  { label: '30 days',  value: '30d' },
];

function buildShareUrl(report) {
  if (!report) return '';
  if (report.share_url) return report.share_url;
  if (report.token) return `${window.location.origin}/report/${report.token}`;
  return '';
}

function getApiError(error, fallback) {
  const data = error?.response?.data;
  if (!data) return fallback;
  if (typeof data === 'string') {
    // Don't show raw HTML error pages
    if (data.trim().startsWith('<')) return fallback;
    return data;
  }
  if (data.detail) return data.detail;
  if (data.error) return data.error;
  const firstValue = Object.values(data)[0];
  if (Array.isArray(firstValue)) return firstValue[0];
  if (typeof firstValue === 'string') return firstValue;
  return fallback;
}

function expiryToDatetime(val) {
  if (!val) return null;
  const now = new Date();
  if (val === '24h') now.setHours(now.getHours() + 24);
  if (val === '7d')  now.setDate(now.getDate() + 7);
  if (val === '30d') now.setDate(now.getDate() + 30);
  return now.toISOString();
}

export default function ShareReportModal({ clientId, onClose }) {
  const today      = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + '01';

  const [dateFrom,    setDateFrom]    = useState(monthStart);
  const [dateUntil,   setDateUntil]   = useState(today);
  const [platforms,   setPlatforms]   = useState(ALL_PLATFORMS);
  const [expiry,      setExpiry]      = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [password,    setPassword]    = useState('');
  const [creating,    setCreating]    = useState(false);
  const [error,       setError]       = useState('');
  const [shareUrl,    setShareUrl]    = useState('');
  const [copied,      setCopied]      = useState(false);

  // Existing links for this client
  const [links,      setLinks]      = useState([]);
  const [linksLoading, setLinksLoading] = useState(true);

  useEffect(() => {
    setLinksLoading(true);
    sharedReportsAPI.list({ client: clientId })
      .then(res => setLinks(res.data.results || res.data))
      .catch(() => {})
      .finally(() => setLinksLoading(false));
  }, [clientId]);

  function togglePlatform(p) {
    setPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  }

  async function handleCreate() {
    if (!dateFrom || !dateUntil) { setError('Please set a date range.'); return; }
    if (platforms.length === 0)  { setError('Select at least one platform.'); return; }
    if (usePassword && !password.trim()) { setError('Please enter a password or disable password protection.'); return; }
    setError('');
    setCreating(true);
    try {
      const payload = {
        client:     clientId,
        date_from:  dateFrom,
        date_until: dateUntil,
        platforms,
        expires_at: expiryToDatetime(expiry),
        password:   usePassword ? password : '',
      };
      const res = await sharedReportsAPI.create(payload);
      const created = res.data;
      const nextUrl = buildShareUrl(created);
      setShareUrl(nextUrl);
      setLinks(prev => [created, ...prev]);
    } catch (e) {
      setError(getApiError(e, 'Failed to create link.'));
    } finally {
      setCreating(false);
    }
  }

  function copyUrl(url) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function deleteLink(id) {
    await sharedReportsAPI.delete(id);
    setLinks(prev => prev.filter(l => l.id !== id));
    if (shareUrl && links.find(l => l.id === id)?.share_url === shareUrl) {
      setShareUrl('');
    }
  }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        {/* Header */}
        <div style={modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Share2 size={18} style={{ color: '#6366f1' }} />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
              Share Report
            </h2>
          </div>
          <button onClick={onClose} style={closeBtn}><X size={18} /></button>
        </div>

        <div style={body}>
          {/* ── Create New Link ─────────────────────────── */}
          <section style={section}>
            <h3 style={sectionTitle}><Calendar size={14} /> Date Range</h3>
            <div style={{ display: 'flex', gap: 10 }}>
              <input type="date" value={dateFrom}  onChange={e => setDateFrom(e.target.value)}  style={inputStyle} />
              <span style={{ alignSelf: 'center', color: '#94a3b8' }}>→</span>
              <input type="date" value={dateUntil} onChange={e => setDateUntil(e.target.value)} style={inputStyle} />
            </div>
          </section>

          <section style={section}>
            <h3 style={sectionTitle}><Layers size={14} /> Platforms</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {ALL_PLATFORMS.map(p => {
                const pl  = PLATFORMS[p];
                const sel = platforms.includes(p);
                return (
                  <button
                    key={p}
                    onClick={() => togglePlatform(p)}
                    style={{
                      ...platformChip,
                      background: sel ? (pl?.bg || '#f0f4ff')  : '#f8fafc',
                      color:      sel ? (pl?.color || '#6366f1') : '#64748b',
                      borderColor: sel ? (pl?.color || '#6366f1') : '#e5e7eb',
                    }}
                  >
                    {pl?.icon} {pl?.label || p}
                  </button>
                );
              })}
            </div>
          </section>

          <section style={section}>
            <h3 style={sectionTitle}><Clock size={14} /> Expiry</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              {EXPIRY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setExpiry(opt.value)}
                  style={{
                    ...expiryChip,
                    background:  expiry === opt.value ? '#6366f1' : '#f8fafc',
                    color:       expiry === opt.value ? '#fff'     : '#64748b',
                    borderColor: expiry === opt.value ? '#6366f1'  : '#e5e7eb',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          <section style={section}>
            <h3 style={sectionTitle}><Lock size={14} /> Password Protection</h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={usePassword}
                onChange={e => setUsePassword(e.target.checked)}
                style={{ accentColor: '#6366f1' }}
              />
              Protect with password
            </label>
            {usePassword && (
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password…"
                style={{ ...inputStyle, marginTop: 8 }}
              />
            )}
          </section>

          {error && <p style={{ color: '#dc2626', fontSize: 13, margin: '0 0 12px' }}>{error}</p>}

          <button onClick={handleCreate} disabled={creating} style={createBtn}>
            <Link2 size={15} />
            {creating ? 'Creating…' : 'Generate Link'}
          </button>

          {/* ── Generated URL + QR ──────────────────────── */}
          {shareUrl && (
            <div style={urlBox}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
                This link opens the public HTML report page you can share with the client.
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
                <input readOnly value={shareUrl} style={{ ...inputStyle, flex: 1, fontSize: 12 }} />
                <button onClick={() => copyUrl(shareUrl)} style={copyBtn}>
                  {copied ? <Check size={15} style={{ color: '#16a34a' }} /> : <Copy size={15} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <a href={shareUrl} target="_blank" rel="noreferrer" style={openBtn}>
                  <Eye size={15} />
                  Open
                </a>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <QRCodeSVG value={shareUrl} size={140} />
              </div>
            </div>
          )}
        </div>

        {/* ── Existing Links ───────────────────────────── */}
        {!linksLoading && links.length > 0 && (
          <div style={existingSection}>
            <h3 style={{ ...sectionTitle, marginBottom: 10 }}>
              <Link2 size={14} /> Existing Links
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {links.map(link => (
                <div key={link.id} style={linkRow}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>
                      {link.date_from} → {link.date_until}
                      {link.is_password_protected && (
                        <Lock size={10} style={{ marginLeft: 6, color: '#94a3b8', verticalAlign: 'middle' }} />
                      )}
                      {link.is_expired && (
                        <span style={{ marginLeft: 6, fontSize: 10, color: '#dc2626', fontWeight: 700 }}>EXPIRED</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', display: 'flex', gap: 10 }}>
                      <span><Eye size={10} style={{ verticalAlign: 'middle' }} /> {link.view_count} views</span>
                      {link.expires_at && <span>Expires {new Date(link.expires_at).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <a href={buildShareUrl(link)} target="_blank" rel="noreferrer" style={iconBtn} title="Open report">
                    <Eye size={14} />
                  </a>
                  <button onClick={() => copyUrl(buildShareUrl(link))} style={iconBtn} title="Copy link">
                    <Copy size={14} />
                  </button>
                  <button onClick={() => deleteLink(link.id)} style={{ ...iconBtn, color: '#ef4444' }} title="Deactivate">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: 16,
};
const modal = {
  background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520,
  maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
  boxShadow: '0 20px 60px rgba(0,0,0,.25)',
};
const modalHeader = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '18px 20px', borderBottom: '1px solid #f1f5f9',
};
const closeBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: '#94a3b8', padding: 4, display: 'flex',
};
const body = {
  padding: '18px 20px', overflowY: 'auto', flex: 1,
};
const section     = { marginBottom: 18 };
const sectionTitle = {
  display: 'flex', alignItems: 'center', gap: 6,
  fontSize: 12, fontWeight: 700, color: '#64748b',
  textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8,
};
const inputStyle = {
  padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb',
  fontSize: 13, color: '#0f172a', outline: 'none', background: '#f8fafc',
  width: '100%', boxSizing: 'border-box',
};
const platformChip = {
  padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
  border: '1.5px solid', cursor: 'pointer', transition: 'all .15s',
};
const expiryChip = {
  padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
  border: '1.5px solid', cursor: 'pointer', transition: 'all .15s',
};
const createBtn = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
  justifyContent: 'center', padding: '10px 0',
  background: '#6366f1', color: '#fff', border: 'none',
  borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
  marginBottom: 16,
};
const urlBox = {
  background: '#f8fafc', borderRadius: 12, padding: 16,
  border: '1px solid #e5e7eb', marginBottom: 8,
};
const copyBtn = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
  background: '#f1f5f9', border: '1px solid #e5e7eb', borderRadius: 8,
  fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', color: '#374151',
};
const openBtn = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
  background: '#6366f1', border: '1px solid #6366f1', borderRadius: 8,
  fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', color: '#fff', textDecoration: 'none',
};
const existingSection = {
  padding: '16px 20px', borderTop: '1px solid #f1f5f9', background: '#fafafa',
};
const linkRow = {
  display: 'flex', alignItems: 'center', gap: 8,
  background: '#fff', borderRadius: 10, padding: '10px 12px',
  border: '1px solid #e5e7eb',
};
const iconBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: '#94a3b8', padding: 4, display: 'flex', flexShrink: 0, textDecoration: 'none',
};
