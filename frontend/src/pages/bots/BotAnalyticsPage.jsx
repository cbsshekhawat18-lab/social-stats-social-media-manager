/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * BotAnalyticsPage — per-flow funnel & drop-off analytics.
 *
 * Layout:
 *   - Flow picker at the top
 *   - 5 KPI cards (triggered / completed / handed-off / leads / completion-rate)
 *   - Funnel chart (success_funnel — visit count per node, biggest first)
 *   - Drop-off table (top_drop_off_nodes)
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  BarChart3, ArrowLeft, Filter, AlertTriangle, TrendingDown, Sparkles, ChevronRight,
} from 'lucide-react';

import { botAPI } from '../../services/api';
import { getNodeMeta } from '../../components/bot/nodeCatalog';
import toast from '../../components/ui/toast';

export default function BotAnalyticsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [flows,    setFlows]    = useState([]);
  const [flow,     setFlow]     = useState(null);
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);

  // Resolve flow id: route param wins, else query param, else first available
  useEffect(() => {
    botAPI.list({}).then((r) => {
      const fs = r.data?.results || r.data || [];
      setFlows(fs);
      if (id) {
        // already routed to a specific flow
      } else if (params.get('flow')) {
        navigate(`/admin/bot-flows/${params.get('flow')}/analytics`, { replace: true });
      } else if (fs.length > 0) {
        navigate(`/admin/bot-flows/${fs[0].id}/analytics`, { replace: true });
      }
    }).catch(() => {});
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([botAPI.get(id), botAPI.analytics(id)])
      .then(([fr, ar]) => { setFlow(fr.data); setData(ar.data); })
      .catch(() => toast.error('Could not load analytics'))
      .finally(() => setLoading(false));
  }, [id]);

  const nodesById = useMemo(() => {
    const m = {};
    (flow?.nodes || []).forEach((n) => { m[n.id] = n; });
    return m;
  }, [flow]);

  const funnelRows = useMemo(() => {
    const rows = (data?.success_funnel || []).map(([nodeId, count]) => {
      const n = nodesById[nodeId];
      const meta = getNodeMeta(n?.type || 'unknown');
      return {
        nodeId,
        node_type: n?.type || 'unknown',
        label: meta.label || n?.type || nodeId,
        color: meta.color || 'var(--brand-primary)',
        count,
      };
    });
    // Sort by count desc — biggest funnel step first
    return rows.sort((a, b) => b.count - a.count);
  }, [data, nodesById]);

  const dropOffRows = useMemo(() => {
    return (data?.top_drop_off_nodes || []).map(([nodeId, count]) => {
      const n = nodesById[nodeId];
      const meta = getNodeMeta(n?.type || 'unknown');
      return {
        nodeId,
        node_type: n?.type || 'unknown',
        label: meta.label || nodeId,
        color: meta.color || 'var(--text-tertiary)',
        count,
      };
    });
  }, [data, nodesById]);

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Link to="/admin/bot-flows" style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', alignSelf: 'flex-start',
      }}>
        <ArrowLeft size={14} /> All flows
      </Link>

      {/* Header + flow picker */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{
          width: 40, height: 40,
          background: 'var(--brand-primary-glow)', color: 'var(--brand-primary-hover)',
          borderRadius: 'var(--radius-md)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <BarChart3 size={20} strokeWidth={2.2} />
        </span>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Flow analytics
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            How users move through your flow — and where they drop off.
          </p>
        </div>
        <select value={id || ''} onChange={(e) => navigate(`/admin/bot-flows/${e.target.value}/analytics`)}
                style={{
                  padding: '8px 12px',
                  background: 'var(--surface-card)', color: 'var(--text-primary)',
                  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
                  fontSize: 13, fontFamily: 'inherit',
                }}>
          {flows.map((f) => <option key={f.id} value={f.id}>{f.name} {f.is_active ? '· active' : ''}</option>)}
        </select>
      </header>

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading…</div>
      ) : !data || !flow ? (
        <Empty />
      ) : (
        <>
          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <KPI label="Triggered"      n={data.totals.triggered} color="var(--brand-primary)" />
            <KPI label="Completed"      n={data.totals.completed} color="var(--success)" />
            <KPI label="Abandoned"      n={data.totals.abandoned} color="var(--text-tertiary)" />
            <KPI label="Handed off"     n={data.totals.handed_off} color="var(--info)" />
            <KPI label="Leads captured" n={data.totals.leads_captured} color="var(--brand-primary-hover)" />
            <KPI label="Completion rate" n={`${data.completion_rate}%`}    color={data.completion_rate >= 50 ? 'var(--success)' : 'var(--warning)'} />
            <KPI label="Lead-capture rate" n={`${data.lead_capture_rate}%`} color={data.lead_capture_rate >= 30 ? 'var(--success)' : 'var(--warning)'} />
          </div>

          {/* Funnel chart */}
          <Section title="Success funnel" subtitle="How many completed conversations passed through each node">
            {funnelRows.length === 0 ? (
              <Empty subtle>No completed conversations yet.</Empty>
            ) : (
              <div style={{ height: Math.max(220, funnelRows.length * 32) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelRows} layout="vertical" margin={{ top: 4, right: 30, left: 12, bottom: 4 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="label" type="category" width={140}
                           tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                    <Tooltip
                      cursor={{ fill: 'var(--surface-sunken)' }}
                      contentStyle={{
                        background: 'var(--surface-elevated)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {funnelRows.map((row, i) => (
                        <Cell key={i} fill={row.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Section>

          {/* Drop-off table */}
          <Section title="Top drop-off nodes" subtitle="Where conversations stalled or failed">
            {dropOffRows.length === 0 ? (
              <Empty subtle>No drop-offs yet — every conversation completed successfully.</Empty>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={th}>Node</th>
                    <th style={th}>Type</th>
                    <th style={{ ...th, textAlign: 'right' }}>Conversations stalled</th>
                  </tr>
                </thead>
                <tbody>
                  {dropOffRows.map((r) => (
                    <tr key={r.nodeId} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={td}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: r.color }} />
                          <strong style={{ color: 'var(--text-primary)' }}>{r.label}</strong>
                          <code style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{r.nodeId}</code>
                        </span>
                      </td>
                      <td style={td}>
                        <span style={pill}>{r.node_type}</span>
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: 'var(--danger)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <TrendingDown size={12} /> {r.count}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* Open in editor */}
          <div>
            <Link to={`/admin/bot-flows/${id}/edit`} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 14px',
              background: 'var(--brand-primary)', color: '#fff',
              border: 'none', borderRadius: 'var(--radius-md)',
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit', textDecoration: 'none',
            }}>
              Open in editor <ChevronRight size={13} />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function KPI({ label, n, color }) {
  return (
    <div style={{
      padding: 12,
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{n}</div>
      <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <section style={{
      padding: 14,
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
    }}>
      <header style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h2>
        {subtitle && <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

function Empty({ children, subtle }) {
  return (
    <div style={{
      padding: subtle ? 16 : 36, textAlign: 'center',
      background: subtle ? 'transparent' : 'var(--surface-card)',
      border: subtle ? 'none' : '1px dashed var(--border-default)',
      borderRadius: 'var(--radius-md)',
      color: 'var(--text-tertiary)', fontSize: 13,
    }}>
      {!subtle && <Sparkles size={28} strokeWidth={1.5} style={{ opacity: 0.4 }} />}
      <div style={{ marginTop: subtle ? 0 : 8 }}>
        {children || 'Pick a flow above to see analytics.'}
      </div>
    </div>
  );
}

const th = { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-tertiary)' };
const td = { padding: '10px 12px', verticalAlign: 'middle' };
const pill = { padding: '2px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-pill)', letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' };
