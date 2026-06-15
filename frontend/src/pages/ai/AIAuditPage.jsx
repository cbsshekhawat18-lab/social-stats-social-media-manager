/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * AIAuditPage — client-visible "What did Social Stats do for me?" feed.
 *
 * Shows every AI request scoped to the current client, recent first.
 * Includes a quota meter at the top (today's usage vs daily cap) and a
 * left-side "by feature" filter list. Built for transparency + compliance
 * audit trails.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Sparkles, Filter, RefreshCw, AlertTriangle, CheckCircle2,
} from 'lucide-react';

import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import AIBadge from '../../components/ai/AIBadge';
import AILoading from '../../components/ai/AILoading';
import { aiV2API } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import toast from '../../components/ui/toast';

const STATUS_VARIANT = {
  success:       { variant: 'success', icon: CheckCircle2 },
  error:         { variant: 'danger',  icon: AlertTriangle },
  rate_limited:  { variant: 'warning', icon: AlertTriangle },
  budget_capped: { variant: 'warning', icon: AlertTriangle },
};

export default function AIAuditPage({ clientId: propClientId = null }) {
  const { user } = useAuth();
  const clientId = propClientId || user?.client_id || null;

  const [data, setData]       = useState(null);
  const [feature, setFeature] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    if (!clientId) return;
    setLoading(true);
    const params = { client_id: clientId, limit: 100 };
    if (feature) params.feature = feature;
    aiV2API.audit(params)
      .then((r) => setData(r.data || null))
      .catch(() => toast.error('Failed to load AI audit'))
      .finally(() => setLoading(false));
  }
  useEffect(load, [clientId, feature]);

  const rows  = data?.rows || [];
  const byFeature = data?.by_feature || [];
  const quota = data?.quota || {};

  return (
    <div className="app-page app-page--lg">
      <PageHeader
        title="What did Social Stats do for me?"
        subtitle="Every AI request on this client account — for transparency + compliance."
        actions={(
          <Button variant="ghost" size="sm" icon={RefreshCw} onClick={load}>Refresh</Button>
        )}
      />

      {/* Quota meter */}
      <Card padding="md" style={{ marginBottom: 12 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10, marginBottom: 8, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles size={14} style={{ color: 'var(--brand-primary-hover)' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              Today&apos;s AI quota
            </span>
          </div>
          <span style={{
            fontSize: 13, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums',
          }}>
            <strong style={{ color: 'var(--text-primary)' }}>{quota.used ?? 0}</strong>
            {' / '}{quota.limit ?? 0} requests used
            <span style={{ marginLeft: 12, color: 'var(--text-tertiary)' }}>
              ({quota.remaining ?? 0} remaining)
            </span>
          </span>
        </div>
        <div style={{
          height: 6, background: 'var(--surface-sunken)',
          borderRadius: 999, overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, quota.percent || 0)}%`,
            background: (quota.percent || 0) > 80 ? 'var(--warning)' : 'var(--brand-gradient)',
            transition: 'width var(--transition-default)',
          }} />
        </div>
      </Card>

      <div style={twoColStyle} className="ai-audit-cols">
        {/* Filter list */}
        <Card padding="none">
          <Card.Header
            title="Filter by feature"
            subtitle={feature ? 'Showing one feature' : 'All features'}
            style={{ padding: '14px 16px', margin: 0 }}
          />
          <ul style={listStyle}>
            <FilterRow
              label="All features"
              count={byFeature.reduce((s, f) => s + (f.count || 0), 0)}
              active={!feature}
              onClick={() => setFeature('')}
            />
            {byFeature.map((f) => (
              <FilterRow
                key={f.feature}
                label={f.feature}
                count={f.count}
                active={feature === f.feature}
                onClick={() => setFeature(f.feature)}
              />
            ))}
          </ul>
        </Card>

        {/* Activity feed */}
        <Card padding="none" style={{ minHeight: 320 }}>
          <Card.Header
            title="Activity feed"
            subtitle={`${rows.length} most recent — newest first`}
            style={{ padding: '14px 16px', margin: 0 }}
          />
          {loading ? (
            <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <AILoading variant="dots" label="Loading activity…" />
              {[0, 1, 2, 3].map((i) => (
                <AILoading key={i} height={32} />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No AI activity yet"
              description="As you use Social Stats features, every request shows up here."
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Feature</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Model</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>In/out tokens</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Cost</th>
                    <th style={thStyle}>When</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const sv = STATUS_VARIANT[r.status] || STATUS_VARIANT.success;
                    const Icon = sv.icon;
                    return (
                      <tr key={r.id} style={trStyle}>
                        <td style={tdStyle}>
                          <code style={{ fontSize: 12, color: 'var(--text-primary)' }}>{r.feature}</code>
                          {r.cached && (
                            <AIBadge cached size="sm" style={{ marginLeft: 6 }} />
                          )}
                        </td>
                        <td style={tdStyle}>
                          <Badge variant={sv.variant} size="sm" icon={Icon}>
                            {r.status}
                          </Badge>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                            {r.model}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: 'var(--text-secondary)' }}>
                          {r.input_tokens.toLocaleString()} / {r.output_tokens.toLocaleString()}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          ${r.cost_usd.toFixed(4)}
                        </td>
                        <td style={{ ...tdStyle, fontSize: 12, color: 'var(--text-tertiary)' }}>
                          {r.created_at ? new Date(r.created_at).toLocaleString(undefined, {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                          }) : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <p style={{
        marginTop: 14, padding: '10px 14px',
        background: 'var(--brand-primary-soft)',
        border: '1px solid var(--brand-primary-glow)',
        borderRadius: 'var(--radius-md)',
        fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55,
      }}>
        <Sparkles size={12} style={{ color: 'var(--brand-primary-hover)', verticalAlign: -1 }} />
        {' '}
        SocialStats powers every request below. We log each call for compliance and
        do not train on your data. AI-generated content is marked with a
        <strong> ✨ AI-assisted</strong> badge in the UI. Sensitive verticals (medical,
        legal, financial) include a regulatory disclaimer. Vendor-level disclosure is
        in our <a href="/privacy">Privacy Policy</a>.
      </p>

      <style>{`
        @media (max-width: 880px) { .ai-audit-cols { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}

function FilterRow({ label, count, active, onClick }) {
  return (
    <li
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px',
        borderTop: '1px solid var(--border-subtle)',
        cursor: 'pointer',
        background: active ? 'var(--brand-primary-soft)' : 'transparent',
      }}
    >
      <span style={{
        fontSize: 12, color: active ? 'var(--brand-primary-hover)' : 'var(--text-primary)',
        fontWeight: active ? 600 : 500,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{count}</span>
    </li>
  );
}

const twoColStyle = {
  display: 'grid',
  gridTemplateColumns: '260px 1fr',
  gap: 12,
};

const listStyle = { listStyle: 'none', margin: 0, padding: 0 };

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
const tdStyle = { padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-primary)', verticalAlign: 'middle' };
const trStyle = {};
