/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * AIUsagePage — admin-only AI cost + usage dashboard.
 *
 * Sections:
 *   - Budget gauge (monthly cap vs. used vs. remaining)
 *   - Totals strip (requests / cost / cached / errors)
 *   - Per-feature breakdown table
 *   - Per-client + per-user breakdowns (collapsible)
 *   - Daily timeseries chart
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, Loader2, RefreshCw,
} from 'lucide-react';

import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import { aiV2API } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

const PERIODS = [
  { id: 'day',   label: 'Today' },
  { id: 'week',  label: 'This week' },
  { id: 'month', label: 'This month' },
];

export default function AIUsagePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'superadmin' || user?.role === 'staff';

  const [period, setPeriod] = useState('month');
  const [overview, setOverview] = useState(null);
  const [byClient, setByClient] = useState(null);
  const [byUser, setByUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function load() {
    if (!isAdmin) return;
    setLoading(true);
    setError('');
    Promise.all([
      aiV2API.usageOverview({ period }),
      aiV2API.usageByClient({ period }),
      aiV2API.usageByUser({ period }),
    ])
      .then(([o, c, u]) => {
        setOverview(o.data || null);
        setByClient(c.data || null);
        setByUser(u.data || null);
      })
      .catch((e) => setError(e?.response?.data?.error || 'Failed to load AI usage'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [period, isAdmin]);

  const totals = overview?.totals || {};
  const budget = overview?.budget || {};
  const features = overview?.by_feature || [];

  if (!isAdmin) {
    return (
      <div className="app-page app-page--lg">
        <PageHeader title="AI Usage" />
        <EmptyState
          icon={AlertTriangle}
          title="Admin access only"
          description="The AI usage dashboard is visible to superadmins and staff."
        />
      </div>
    );
  }

  return (
    <div className="app-page app-page--lg">
      <PageHeader
        title="AI Usage"
        subtitle="Cost, tokens, and request volume across every AI feature."
        actions={(
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                style={{
                  padding: '6px 12px',
                  minHeight: 'auto', minWidth: 'auto',
                  background: period === p.id ? 'var(--brand-primary-soft)' : 'var(--surface-card)',
                  color:      period === p.id ? 'var(--brand-primary-hover)' : 'var(--text-secondary)',
                  border: `1px solid ${period === p.id ? 'var(--brand-primary)' : 'var(--border-default)'}`,
                  borderRadius: 'var(--radius-pill)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {p.label}
              </button>
            ))}
            <Button size="sm" variant="ghost" icon={RefreshCw} onClick={load}>Refresh</Button>
          </div>
        )}
      />

      {error && (
        <Card padding="md" style={{ marginBottom: 12, background: 'var(--danger-bg)', borderColor: 'var(--danger)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)' }}>
            <AlertTriangle size={14} /> {error}
          </div>
        </Card>
      )}

      {loading ? (
        <Card padding="lg">
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Loader2 size={20} style={{ color: 'var(--text-tertiary)', animation: 'spin 1s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        </Card>
      ) : (
        <>
          {/* Budget gauge */}
          <Card padding="md" style={{ marginBottom: 12 }}>
            <BudgetGauge budget={budget} />
          </Card>

          {/* Totals strip */}
          <div style={statsRowStyle}>
            <StatTile label="Requests"        value={fmtNum(totals.requests)} />
            <StatTile label="Cost (this period)" value={`$${(totals.cost_usd || 0).toFixed(4)}`} highlight />
            <StatTile label="Input tokens"   value={fmtNum(totals.input_tokens)} />
            <StatTile label="Output tokens"  value={fmtNum(totals.output_tokens)} />
            <StatTile label="Cache hit rate" value={`${(totals.cache_hit_rate || 0).toFixed(1)}%`} />
            <StatTile label="Errors"         value={fmtNum(totals.errors)} accent={totals.errors ? 'var(--danger)' : 'var(--success)'} />
          </div>

          {/* By feature */}
          <Card padding="none" style={{ marginTop: 16, marginBottom: 12 }}>
            <Card.Header
              title="By feature"
              subtitle="Top features by spend in the selected period"
              style={{ padding: '14px 16px', margin: 0 }}
            />
            {features.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                No AI usage in this period yet.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Feature</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Requests</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Input tokens</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Output tokens</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {features.map((f) => (
                      <tr key={f.feature} style={trStyle}>
                        <td style={tdStyle}><code style={{ fontSize: 12 }}>{f.feature}</code></td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtNum(f.requests)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtNum(f.input_tokens)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtNum(f.output_tokens)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>${f.cost_usd.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Per-client + per-user side by side on desktop, stacked on mobile */}
          <div style={twoColStyle} className="ai-usage-twocol">
            <Card padding="none">
              <Card.Header title="Top clients" style={{ padding: '14px 16px', margin: 0 }} />
              {(byClient?.clients || []).length === 0 ? (
                <div style={emptyCellStyle}>No client-scoped usage in this period.</div>
              ) : (
                <ul style={listStyle}>
                  {(byClient?.clients || []).slice(0, 12).map((c) => (
                    <li key={c.client_id} style={listRowStyle}>
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.client_name || `#${c.client_id}`}
                      </span>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
                        {fmtNum(c.requests)} req
                      </span>
                      <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', minWidth: 70, textAlign: 'right' }}>
                        ${c.cost_usd.toFixed(4)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card padding="none">
              <Card.Header title="Top users" style={{ padding: '14px 16px', margin: 0 }} />
              {(byUser?.users || []).length === 0 ? (
                <div style={emptyCellStyle}>No user-scoped usage in this period.</div>
              ) : (
                <ul style={listStyle}>
                  {(byUser?.users || []).slice(0, 12).map((u) => (
                    <li key={u.user_id} style={listRowStyle}>
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.name || u.email}
                      </span>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
                        {fmtNum(u.requests)} req
                      </span>
                      <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', minWidth: 70, textAlign: 'right' }}>
                        ${u.cost_usd.toFixed(4)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* Daily timeseries — small bar chart */}
          {(overview?.timeseries || []).length > 0 && (
            <Card padding="md" style={{ marginTop: 12 }}>
              <Card.Header title="Daily activity" subtitle="Cost (USD) per day in the selected period" style={{ marginBottom: 12 }} />
              <DailyBars rows={overview.timeseries} />
            </Card>
          )}
        </>
      )}

      <style>{`
        @media (max-width: 880px) { .ai-usage-twocol { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────────────

function BudgetGauge({ budget }) {
  const pct = Math.min(100, Number(budget.percent_used || 0));
  const cap = Number(budget.cap_usd || 0);
  const used = Number(budget.used_usd || 0);
  const remaining = Number(budget.remaining_usd || 0);

  const color =
    budget.alert_level === 'critical' ? 'var(--danger)' :
    budget.alert_level === 'warn'     ? 'var(--warning)' :
    budget.alert_level === 'notice'   ? 'var(--info)' :
                                        'var(--success)';

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <Activity size={14} style={{ color }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            Monthly budget
          </span>
          <Badge
            variant={budget.alert_level === 'critical' ? 'danger' : budget.alert_level === 'warn' ? 'warning' : 'success'}
            size="sm" dot
          >
            {budget.alert_level || 'ok'}
          </Badge>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
          <strong style={{ color: 'var(--text-primary)' }}>${used.toFixed(4)}</strong>
          {' / '}${cap.toFixed(2)} used
          <span style={{ marginLeft: 12, color: 'var(--text-tertiary)' }}>
            ${remaining.toFixed(4)} remaining
          </span>
        </div>
      </div>
      <div style={{
        height: 8, width: '100%',
        background: 'var(--surface-sunken)',
        borderRadius: 999, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: color,
          transition: 'width var(--transition-default)',
        }} />
      </div>
    </>
  );
}

function StatTile({ label, value, highlight, accent }) {
  return (
    <div style={{
      flex: '1 1 140px',
      minWidth: 0,
      padding: '12px 14px',
      background: highlight ? 'var(--brand-primary-soft)' : 'var(--surface-card)',
      border: `1px solid ${highlight ? 'var(--brand-primary-glow)' : 'var(--border-subtle)'}`,
      borderRadius: 'var(--radius-md)',
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
        {label}
      </div>
      <div style={{
        marginTop: 2,
        fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
        color: accent || (highlight ? 'var(--brand-primary-hover)' : 'var(--text-primary)'),
      }}>
        {value}
      </div>
    </div>
  );
}

function DailyBars({ rows }) {
  const max = useMemo(() => Math.max(...rows.map((r) => r.cost_usd || 0), 0.0001), [rows]);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80, overflowX: 'auto' }}>
      {rows.map((r) => {
        const h = Math.max(2, (r.cost_usd / max) * 80);
        return (
          <div key={r.date} title={`${r.date}: $${r.cost_usd.toFixed(4)} (${r.requests} req)`} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            minWidth: 18, flex: '0 0 18px',
          }}>
            <div style={{
              width: 12, height: h,
              background: 'var(--brand-gradient)',
              borderRadius: '2px 2px 0 0',
            }} />
            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 4 }}>
              {r.date.slice(8, 10)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function fmtNum(n) {
  if (n == null) return '0';
  return Number(n).toLocaleString();
}

const statsRowStyle = {
  display: 'flex', flexWrap: 'wrap', gap: 8,
};

const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
const thStyle = {
  textAlign: 'left',
  padding: '10px 14px',
  fontSize: 11, fontWeight: 600,
  letterSpacing: '0.06em', textTransform: 'uppercase',
  color: 'var(--text-tertiary)',
  background: 'var(--surface-sunken)',
  borderBottom: '1px solid var(--border-subtle)',
};
const tdStyle = { padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-primary)' };
const trStyle = {};

const twoColStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
};

const listStyle = { listStyle: 'none', margin: 0, padding: 0 };
const listRowStyle = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '8px 14px',
  borderTop: '1px solid var(--border-subtle)',
  fontSize: 13,
};
const emptyCellStyle = { padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 };
