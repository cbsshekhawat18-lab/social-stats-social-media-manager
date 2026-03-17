import { useState } from 'react';
import { useSyncLogs } from '../hooks/useData';
import { PLATFORMS } from '../services/platforms';
import { ChevronUp, ChevronDown } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';

const STATUSES = ['all', 'success', 'failed', 'running', 'pending'];

export default function SyncLogsPage() {
  const { logs, loading } = useSyncLogs(null);
  const [expanded, setExpanded]       = useState(null);
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterStatus, setFilterStatus]     = useState('all');
  const [filterClient, setFilterClient]     = useState('');

  const clientNames = [...new Set(logs.map(l => l.client_name).filter(Boolean))].sort();

  const filtered = logs.filter(l => {
    if (filterPlatform !== 'all' && l.platform !== filterPlatform) return false;
    if (filterStatus   !== 'all' && l.status   !== filterStatus)   return false;
    if (filterClient   && l.client_name !== filterClient)          return false;
    return true;
  });

  return (
    <div style={styles.page}>
      <PageHeader
        title="Sync Logs"
        subtitle={`${filtered.length} of ${logs.length} record${logs.length !== 1 ? 's' : ''}`}
      />

      {/* Filter bar */}
      <div style={styles.filterBar}>
        <select value={filterClient} onChange={e => setFilterClient(e.target.value)} style={styles.select}>
          <option value="">All Users</option>
          {clientNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>

        <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)} style={styles.select}>
          <option value="all">All Platforms</option>
          {Object.entries(PLATFORMS).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>

        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={styles.select}>
          {STATUSES.map(s => (
            <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>

        {(filterClient || filterPlatform !== 'all' || filterStatus !== 'all') && (
          <button
            onClick={() => { setFilterClient(''); setFilterPlatform('all'); setFilterStatus('all'); }}
            style={styles.clearBtn}
          >
            Clear filters ✕
          </button>
        )}
      </div>

      <div style={styles.tableWrap}>
        {loading ? (
          <div style={styles.center}>Loading logs…</div>
        ) : filtered.length === 0 ? (
          <div style={styles.center}>
            {logs.length === 0 ? 'No sync logs yet. Click "Sync Now" on a user dashboard to start.' : 'No logs match the selected filters.'}
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                {['User','Platform','Status','Records Synced','Started','Duration','Error'].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <>
                  <tr key={l.id} style={styles.tr}>
                    <td style={{ ...styles.td, fontWeight: 600 }}>{l.client_name || '—'}</td>
                    <td style={styles.td}>
                      {PLATFORMS[l.platform]?.icon} {PLATFORMS[l.platform]?.label || l.platform}
                    </td>
                    <td style={styles.td}>
                      <span style={badge(l.status)}>{l.status}</span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>{l.records_synced ?? 0}</td>
                    <td style={styles.td}>{new Date(l.started_at).toLocaleString()}</td>
                    <td style={styles.td}>{l.duration_seconds != null ? `${l.duration_seconds}s` : '—'}</td>
                    <td style={styles.td}>
                      {l.error_message ? (
                        <button
                          onClick={() => setExpanded(expanded === l.id ? null : l.id)}
                          style={styles.errorBtn}
                        >
                          <span style={styles.errorBtnInner}>
                            {expanded === l.id ? <><ChevronUp size={12} /> Hide</> : <><ChevronDown size={12} /> View</>}
                          </span>
                        </button>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                      )}
                    </td>
                  </tr>
                  {expanded === l.id && l.error_message && (
                    <tr key={`${l.id}-err`} style={{ background: '#fff7f7' }}>
                      <td colSpan={7} style={styles.errorCell}>
                        <pre style={styles.errorText}>{l.error_message}</pre>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const statusColors = {
  success: { background: '#dcfce7', color: '#16a34a' },
  failed:  { background: '#fee2e2', color: '#dc2626' },
  running: { background: '#dbeafe', color: '#2563eb' },
  pending: { background: '#f1f5f9', color: '#64748b' },
};

function badge(status) {
  return {
    display: 'inline-block', padding: '2px 10px', borderRadius: 20,
    fontSize: 11, fontWeight: 600,
    ...(statusColors[status] || statusColors.pending),
  };
}

const styles = {
  page:      { padding: '28px 32px', maxWidth: 1400, margin: '0 auto' },
  filterBar: { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 },
  select: {
    padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb',
    fontSize: 13, background: '#fff', color: '#374151', cursor: 'pointer', outline: 'none',
  },
  clearBtn: {
    padding: '8px 14px', borderRadius: 8, border: '1.5px solid #fca5a5',
    background: '#fff7f7', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 600,
  },
  tableWrap: {
    background: '#fff', borderRadius: 14, padding: 24,
    boxShadow: '0 1px 6px rgba(0,0,0,.07)', overflowX: 'auto',
  },
  table:     { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left', padding: '10px 12px', background: '#f8fafc',
    color: '#64748b', fontWeight: 600, fontSize: 12, borderBottom: '1px solid #e5e7eb',
    whiteSpace: 'nowrap',
  },
  tr:        { borderBottom: '1px solid #f1f5f9' },
  td:        { padding: '12px 12px', color: '#374151', verticalAlign: 'middle' },
  center:    { textAlign: 'center', color: '#94a3b8', padding: 40 },
  errorBtn: {
    padding: '3px 10px', borderRadius: 6, border: '1px solid #fca5a5',
    background: '#fff7f7', color: '#dc2626', cursor: 'pointer', fontSize: 11, fontWeight: 600,
  },
  errorBtnInner: { display: 'flex', alignItems: 'center', gap: 4 },
  errorCell: { padding: '0 16px 12px' },
  errorText: {
    margin: 0, padding: '12px 16px', borderRadius: 8,
    background: '#fef2f2', color: '#991b1b', fontSize: 12,
    whiteSpace: 'pre-wrap', wordBreak: 'break-all', border: '1px solid #fecaca',
  },
};
