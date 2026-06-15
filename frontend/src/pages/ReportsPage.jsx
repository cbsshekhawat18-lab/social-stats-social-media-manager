/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useState, useEffect, useCallback } from 'react';
import { sharedReportsAPI, roiAPI } from '../services/api';
import { useClients } from '../hooks/useData';
import { formatTimeAgo } from '../services/formatters';
import {
  Link2, Copy, Eye, Trash2, Check, Lock, ExternalLink,
  FileText, BarChart3, TrendingUp, RefreshCw, Plus,
} from 'lucide-react';
import ShareReportModal from '../components/ui/ShareReportModal';
import { getPlatformLabel } from '../services/platforms';
import PageHeader from '../components/layout/PageHeader';
import SegmentedTabs from '../components/ui/SegmentedTabs';

function buildShareUrl(report) {
  if (report?.share_url) return report.share_url;
  if (report?.token)     return `${window.location.origin}/report/${report.token}`;
  return '';
}

// ── Shared Links Panel ────────────────────────────────────────────────────────
function SharedLinksPanel({ clientFilter }) {
  const [links, setLinks]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [copied, setCopied]     = useState(null);
  const [shareClientId, setShareClientId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = clientFilter ? { client: clientFilter } : {};
    sharedReportsAPI.list(params)
      .then(res => setLinks(res.data?.results || res.data || []))
      .catch(() => setLinks([]))
      .finally(() => setLoading(false));
  }, [clientFilter]);

  useEffect(() => { load(); }, [load]);

  async function deactivate(id) {
    await sharedReportsAPI.delete(id);
    setLinks(prev => prev.filter(l => l.id !== id));
  }

  function copy(url, id) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <>
      {shareClientId && (
        <ShareReportModal
          clientId={shareClientId}
          onClose={() => { setShareClientId(null); load(); }}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>
          <Link2 size={16} style={{ verticalAlign: 'middle', marginRight: 8, color: '#00d7ff' }} />
          Shared Report Links
        </h2>
        <button onClick={load} style={btnSecondary}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)' }}>Loading links…</div>
      ) : links.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 0', background: 'var(--surface-page)',
          borderRadius: 12, border: '1px dashed var(--text-quaternary)',
        }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🔗</div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15 }}>No shared links yet</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Open a client and click "Share Report" to generate a public link.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {links.map(link => {
            const url = buildShareUrl(link);
            return (
              <div key={link.id} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                background: 'var(--surface-card)', border: '1.5px solid var(--border-default)',
                borderRadius: 12, padding: '14px 18px',
              }}>
                {/* Left */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                      {link.client_name || `User #${link.client}`}
                    </span>
                    {link.is_password_protected && (
                      <Lock size={11} style={{ color: 'var(--text-tertiary)' }} />
                    )}
                    {link.is_expired && (
                      <span style={{
                        fontSize: 10, fontWeight: 800, padding: '1px 7px',
                        borderRadius: 20, background: '#fee2e2', color: '#dc2626',
                      }}>EXPIRED</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    <span>📅 {link.date_from} → {link.date_until}</span>
                    <span>
                      {(link.platforms || []).map(p => getPlatformLabel(p, { short: true })).join(', ')}
                      {link.platforms?.length === 0 && 'All platforms'}
                    </span>
                    <span><Eye size={10} style={{ verticalAlign: 'middle' }} /> {link.view_count} views</span>
                    <span>Created {formatTimeAgo(link.created_at)}</span>
                    {link.expires_at && (
                      <span style={{ color: link.is_expired ? '#dc2626' : 'var(--text-secondary)' }}>
                        Expires {new Date(link.expires_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => copy(url, link.id)}
                    style={{ ...iconBtn, color: copied === link.id ? '#059669' : 'var(--text-secondary)' }}
                    title="Copy link"
                  >
                    {copied === link.id ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  <a href={url} target="_blank" rel="noreferrer" style={{ ...iconBtn, color: '#00d7ff' }} title="Open report">
                    <ExternalLink size={14} />
                  </a>
                  <button
                    onClick={() => deactivate(link.id)}
                    style={{ ...iconBtn, color: '#ef4444' }}
                    title="Deactivate"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ── ROI Reports Panel ─────────────────────────────────────────────────────────
function ROIReportsPanel() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year,  setYear]  = useState(today.getFullYear());
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    roiAPI.getReports({ year })
      .then(res => setReports(res.data?.results || res.data || []))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, [year]);

  const filtered = reports.filter(r => !month || r.month === month);

  function roiColor(pct) {
    if (pct >= 200) return '#059669';
    if (pct >= 100) return '#00d7ff';
    if (pct >= 0)   return '#d97706';
    return '#dc2626';
  }

  function roiLabel(pct) {
    if (pct >= 200) return { label: 'Excellent', bg: '#d1fae5', color: '#059669' };
    if (pct >= 100) return { label: 'Good',      bg: '#e6fbff', color: '#00d7ff' };
    if (pct >= 0)   return { label: 'Average',   bg: '#fef3c7', color: '#d97706' };
    return             { label: 'Review',         bg: '#fee2e2', color: '#dc2626' };
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>
          <TrendingUp size={16} style={{ verticalAlign: 'middle', marginRight: 8, color: '#00d7ff' }} />
          ROI Reports
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            style={selectStyle}
          >
            {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={selectStyle}>
            {[today.getFullYear(), today.getFullYear() - 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)' }}>Loading ROI reports…</div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 0', background: 'var(--surface-page)',
          borderRadius: 12, border: '1px dashed var(--text-quaternary)',
        }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📊</div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15 }}>No ROI reports for this period</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Reports are generated automatically on the 2nd of each month.
          </div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-page)' }}>
                {['User', 'Month', 'ROI %', 'Investment', 'Revenue', 'Leads', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-default)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const pct   = parseFloat(r.roi_percentage) || 0;
                const badge = roiLabel(pct);
                const sym   = r.currency_symbol || '$';
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--surface-sunken)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>{r.client_name}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                      {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][r.month - 1]} {r.year}
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: roiColor(pct) }}>
                      {pct.toFixed(0)}%
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {sym}{(r.total_investment || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {sym}{(r.estimated_revenue || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {(r.estimated_leads || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 800, padding: '3px 10px',
                        borderRadius: 20, background: badge.bg, color: badge.color,
                      }}>{badge.label}</span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <a
                        href={`/admin/roi`}
                        style={{ fontSize: 12, color: '#00d7ff', textDecoration: 'none', fontWeight: 600 }}
                      >
                        View →
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const { clients } = useClients();
  const [clientFilter, setClientFilter] = useState('');
  const [activeTab, setActiveTab]       = useState('shared');

  const tabs = [
    { id: 'shared', label: 'Shared Links', icon: <Link2 size={14} /> },
    { id: 'roi',    label: 'ROI Reports',  icon: <TrendingUp size={14} /> },
  ];

  return (
    <div className="app-page app-page--md">
      <PageHeader
        title="Reports"
        subtitle="Manage shared client report links and monthly ROI summaries"
        actions={(
          <select
            value={clientFilter}
            onChange={e => setClientFilter(e.target.value)}
            style={{ ...selectStyle, minWidth: 200 }}
          >
            <option value="">All clients</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.company}</option>
            ))}
          </select>
        )}
      />

      {/* Tabs */}
      <SegmentedTabs
        items={tabs}
        active={activeTab}
        onChange={setActiveTab}
        compact
        style={{ marginBottom: 24 }}
      />

      {/* Panel */}
      <div
        className="app-surface app-surface--panel"
        style={{ padding: '24px 28px', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}
      >
        {activeTab === 'shared' && (
          <SharedLinksPanel clientFilter={clientFilter || undefined} />
        )}
        {activeTab === 'roi' && (
          <ROIReportsPanel />
        )}
      </div>
    </div>
  );
}

const btnSecondary = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '7px 14px', borderRadius: 9, border: '1.5px solid var(--border-default)',
  background: 'var(--surface-card)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700,
  cursor: 'pointer',
};

const iconBtn = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-default)',
  background: 'var(--surface-page)', cursor: 'pointer', transition: 'all 0.15s',
  textDecoration: 'none',
};

const selectStyle = {
  padding: '8px 12px', borderRadius: 10, border: '1.5px solid var(--border-default)',
  background: 'var(--surface-card)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
  cursor: 'pointer', outline: 'none',
};
