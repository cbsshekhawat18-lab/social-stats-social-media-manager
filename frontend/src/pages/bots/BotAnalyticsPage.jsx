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
  BarChart3, ArrowLeft, Sparkles, ChevronRight,
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
  const [days,     setDays]     = useState('');   // '' = all time

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
    Promise.all([botAPI.get(id), botAPI.analytics(id, days ? { days } : undefined)])
      .then(([fr, ar]) => { setFlow(fr.data); setData(ar.data); })
      .catch(() => toast.error('Could not load analytics'))
      .finally(() => setLoading(false));
  }, [id, days]);

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
        <select value={days} onChange={(e) => setDays(e.target.value)} aria-label="Period for the funnels"
                style={{
                  padding: '8px 12px',
                  background: 'var(--surface-card)', color: 'var(--text-primary)',
                  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
                  fontSize: 13, fontFamily: 'inherit',
                }}>
          <option value="">All time</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
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

          {/* Per-node funnel */}
          <Section title="Node funnel"
                   subtitle="For each step: conversations that reached it, went on, are waiting there now, or stopped there (abandoned, failed or ended early)">
            <NodeFunnel rows={data.node_funnel || []} />
          </Section>

          {/* Ad funnel */}
          <Section title="Ad funnel"
                   subtitle="Click-to-WhatsApp campaigns linked to this flow: ad click → conversation → lead → converted">
            <AdFunnel funnel={data.ctwa_funnel} />
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

const num = (v) => (v ?? 0).toLocaleString();
const money = (v) => (v == null ? '—' : `₹${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
const pct = (v) => (v == null ? '—' : `${v}%`);

export function NodeFunnel({ rows }) {
  const reached = rows.filter((r) => r.entered > 0 || r.in_current_version);
  const max = Math.max(1, ...reached.map((r) => r.entered));
  if (!reached.some((r) => r.entered > 0)) {
    return <Empty subtle>No conversations in this period yet.</Empty>;
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 640 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <th style={th}>Step</th>
            <th style={{ ...th, textAlign: 'right' }}>Entered</th>
            <th style={{ ...th, textAlign: 'right' }}>Went on</th>
            <th style={{ ...th, textAlign: 'right' }}>Waiting</th>
            <th style={{ ...th, textAlign: 'right' }}>Dropped off</th>
          </tr>
        </thead>
        <tbody>
          {reached.map((r) => {
            const meta = getNodeMeta(r.node_type || 'unknown');
            return (
              <tr key={r.node_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ ...td, maxWidth: 380 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {r.in_current_version ? (meta.label || r.label) : 'Removed step'}
                    </strong>
                    {!r.in_current_version && <span style={pill}>older version</span>}
                  </div>
                  {r.summary && (
                    <div style={{
                      marginTop: 2, marginLeft: 18, fontSize: 12, color: 'var(--text-tertiary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{r.summary}</div>
                  )}
                  <div style={{ marginTop: 5, marginLeft: 18, height: 4, background: 'var(--surface-sunken)', borderRadius: 2 }}>
                    <div style={{ width: `${(r.entered / max) * 100}%`, height: '100%', background: meta.color, borderRadius: 2 }} />
                  </div>
                </td>
                <td style={tdNum}>{num(r.entered)}</td>
                <td style={tdNum}>{num(r.exited)}</td>
                <td style={{ ...tdNum, color: 'var(--text-secondary)' }}>{num(r.waiting)}</td>
                <td style={{ ...tdNum, color: r.dropped_off ? 'var(--danger)' : 'var(--text-tertiary)', fontWeight: r.dropped_off ? 700 : 400 }}>
                  {num(r.dropped_off)}{r.dropped_off ? ` · ${r.drop_off_rate}%` : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AdFunnel({ funnel }) {
  const campaigns = funnel?.campaigns || [];
  if (campaigns.length === 0) {
    return <Empty subtle>No Click-to-WhatsApp campaign is linked to this flow.</Empty>;
  }
  const t = funnel.totals;
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 12 }}>
        <KPI label="Ad clicks"      n={num(t.clicks)}        color="var(--brand-primary)" />
        <KPI label="Conversations"  n={num(t.conversations)} color="var(--info)" />
        <KPI label="Leads"          n={num(t.leads)}         color="var(--brand-primary-hover)" />
        <KPI label="Converted"      n={num(t.converted)}     color="var(--success)" />
        <KPI label="Spend"          n={money(t.spent)}       color="var(--text-primary)" />
        <KPI label="Cost per lead"  n={money(t.cost_per_lead)} color="var(--warning)" />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 720 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <th style={th}>Campaign</th>
              <th style={{ ...th, textAlign: 'right' }}>Clicks</th>
              <th style={{ ...th, textAlign: 'right' }}>Conversations</th>
              <th style={{ ...th, textAlign: 'right' }}>Leads</th>
              <th style={{ ...th, textAlign: 'right' }}>Converted</th>
              <th style={{ ...th, textAlign: 'right' }}>Spend</th>
              <th style={{ ...th, textAlign: 'right' }}>Cost / lead</th>
              <th style={{ ...th, textAlign: 'right' }}>Cost / conversion</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={td}>
                  <Link to={`/admin/ctwa/${c.id}`} style={{ color: 'var(--text-primary)', fontWeight: 600, textDecoration: 'none' }}>
                    {c.name}
                  </Link>
                  {!c.is_active && <span style={{ ...pill, marginLeft: 6 }}>paused</span>}
                </td>
                <td style={tdNum}>{num(c.clicks)}</td>
                <td style={tdNum}>{num(c.conversations)}<Sub>{pct(c.click_to_conversation_rate)}</Sub></td>
                <td style={tdNum}>{num(c.leads)}<Sub>{pct(c.conversation_to_lead_rate)}</Sub></td>
                <td style={tdNum}>{num(c.converted)}<Sub>{pct(c.lead_to_converted_rate)}</Sub></td>
                <td style={tdNum}>{money(c.spent)}</td>
                <td style={{ ...tdNum, fontWeight: 700 }}>{money(c.cost_per_lead)}</td>
                <td style={tdNum}>{money(c.cost_per_conversion)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
        Percentages are the share of the previous step. Clicks and spend are campaign totals synced from Meta
        (not limited to the selected period); conversations and leads are counted here.
      </p>
    </>
  );
}

function Sub({ children }) {
  return <span style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 400 }}>{children}</span>;
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
const tdNum = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' };
const pill = { padding: '2px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-pill)', letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' };
