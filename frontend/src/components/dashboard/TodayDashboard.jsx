/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { Link } from 'react-router-dom';
import {
  Sparkles, FileType, Inbox, UserSquare, Send,
  TrendingUp, TrendingDown, ArrowRight, Activity,
  ClipboardCheck, AlertCircle,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

import useDashboardToday from '../../hooks/useDashboardToday';

/**
 *
 * Renders the consolidated payload from `/api/dashboard/today/` as:
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │ 🟦 Today's briefing (AI-generated; hidden when empty)        │
 *   ├──────────┬──────────┬──────────┬──────────────────────────┤
 *   │ Posts    │ Inbox    │ Leads    │ Campaigns                │
 *   ├──────────┴──────────┴──────────┴──────────────────────────┤
 *   │ 30-day engagement chart                                     │
 *   ├─────────────────────────────────┬──────────────────────────┤
 *   │ Recent activity                 │ Pending approvals        │
 *   └─────────────────────────────────┴──────────────────────────┘
 *
 * Self-contained: no parent props. Reads the active client from the global
 * app store and pulls everything via `useDashboardToday()`. Drop into any
 * page where the home overview is wanted.
 *
 * Loading + empty states render placeholders, not the four-card layout, so
 * a fresh client doesn't see "0 0 0 0" tiles that imply broken data.
 */
export default function TodayDashboard() {
  const { data, isLoading, isError } = useDashboardToday();

  if (isLoading) return <SkeletonState />;
  if (isError)   return <ErrorState />;
  if (!data || !data.client_id) return <NoClientState />;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 16,
      padding: 16,
    }}>
      {/* AI briefing — hidden when empty so a fresh workspace doesn't get
          a blank card with a sparkle on top. */}
      {data.briefing && <BriefingCard briefing={data.briefing} />}

      {/* Four metric tiles, one per feature. Each is its own widget so the
          layout collapses gracefully on narrow screens. */}
      <div style={S.metricRow}>
        <PostsTile  posts={data.posts} />
        <InboxTile  inbox={data.inbox} />
        <LeadsTile  leads={data.leads} />
        <CampaignsTile campaigns={data.campaigns} />
      </div>

      {/* 30-day engagement chart. Auto-hides when the client has no metrics
          rows yet (very common for fresh workspaces). */}
      {data.engagement_chart?.length > 0 && (
        <EngagementChart rows={data.engagement_chart} />
      )}

      {/* Activity + approvals side-by-side. Each scrolls independently so
          long activity feeds don't push approvals offscreen. */}
      <div style={S.bottomRow}>
        <RecentActivity items={data.recent_activity || []} />
        <PendingApprovals items={data.pending_approvals || []} />
      </div>
    </div>
  );
}


// ── Briefing ──────────────────────────────────────────────────────────
function BriefingCard({ briefing }) {
  return (
    <div style={{
      ...S.card,
      background: 'linear-gradient(135deg, var(--brand-primary-soft), transparent)',
      borderLeft: '3px solid var(--brand-primary)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Sparkles size={14} color="var(--brand-primary)" />
        <span style={S.cardLabel}>Today's briefing</span>
      </div>
      <pre style={{
        margin: 0, fontFamily: 'inherit',
        fontSize: 14, lineHeight: 1.6,
        color: 'var(--text-primary)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {briefing}
      </pre>
    </div>
  );
}


// ── Metric tiles ──────────────────────────────────────────────────────
function PostsTile({ posts = {} }) {
  const delta = posts.reach_change_pct;
  return (
    <Tile
      icon={FileType}
      label="Posts"
      headline={`${posts.published_today ?? 0} today`}
      subtitle={
        <>
          {(posts.scheduled ?? 0)} scheduled · {(posts.queued ?? 0)} queued
        </>
      }
      footer={delta != null ? (
        <DeltaPill value={delta} suffix="reach" />
      ) : null}
    />
  );
}

function InboxTile({ inbox = {} }) {
  return (
    <Tile
      icon={Inbox}
      label="Inbox"
      headline={`${inbox.unread ?? 0} unread`}
      subtitle={
        <>
          {(inbox.priority ?? 0)} priority · {(inbox.replied_today ?? 0)} replied today
        </>
      }
      footer={inbox.avg_reply_minutes != null ? (
        <span style={S.tinyLine}>Avg reply {fmtMinutes(inbox.avg_reply_minutes)}</span>
      ) : null}
    />
  );
}

function LeadsTile({ leads = {} }) {
  return (
    <Tile
      icon={UserSquare}
      label="Leads"
      headline={`${leads.new_today ?? 0} new`}
      subtitle={
        <>
          {(leads.qualified ?? 0)} qualified · {(leads.converted_today ?? 0)} converted today
        </>
      }
      footer={leads.pipeline_value > 0 ? (
        <span style={S.tinyLine}>Pipeline {fmtCurrency(leads.pipeline_value)}</span>
      ) : null}
    />
  );
}

function CampaignsTile({ campaigns = {} }) {
  const rate = campaigns.avg_delivery_rate_pct;
  return (
    <Tile
      icon={Send}
      label="Campaigns"
      headline={`${campaigns.running ?? 0} running`}
      subtitle={
        <>
          {(campaigns.sent_today ?? 0).toLocaleString()} sent today
        </>
      }
      footer={rate != null ? (
        <span style={S.tinyLine}>{rate}% delivered</span>
      ) : null}
    />
  );
}


function Tile({ icon: Icon, label, headline, subtitle, footer }) {
  return (
    <div style={S.card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Icon size={14} color="var(--text-tertiary)" />
        <span style={S.cardLabel}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
        {headline}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
        {subtitle}
      </div>
      {footer && <div style={{ marginTop: 10 }}>{footer}</div>}
    </div>
  );
}


function DeltaPill({ value, suffix = '' }) {
  const positive = value >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 8px',
      fontSize: 11, fontWeight: 600,
      color: positive ? 'var(--success)' : 'var(--danger)',
      background: positive ? 'var(--success-bg)' : 'var(--danger-bg)',
      borderRadius: 'var(--radius-pill)',
    }}>
      <Icon size={11} />
      {Math.abs(value)}% {suffix}
    </span>
  );
}


// ── Engagement chart ──────────────────────────────────────────────────
function EngagementChart({ rows }) {
  return (
    <div style={S.card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Activity size={14} color="var(--text-tertiary)" />
        <span style={S.cardLabel}>Engagement · last 30 days</span>
      </div>
      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="dt-eng" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"  stopColor="var(--brand-primary)" stopOpacity={0.30} />
                <stop offset="100%" stopColor="var(--brand-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--border-subtle)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
              axisLine={{ stroke: 'var(--border-subtle)' }}
              tickLine={false}
              tickFormatter={(d) => d ? d.slice(5) : ''}    // MM-DD only
            />
            <YAxis
              tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
              axisLine={false} tickLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
              }}
              labelStyle={{ color: 'var(--text-primary)' }}
            />
            <Area
              type="monotone" dataKey="engagement"
              stroke="var(--brand-primary)" strokeWidth={2}
              fill="url(#dt-eng)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}


// ── Activity feed ─────────────────────────────────────────────────────
function RecentActivity({ items }) {
  return (
    <div style={S.card}>
      <div style={S.sectionHeader}>
        <span style={S.cardLabel}>Recent activity</span>
        <Link to="/admin/audit-log" style={S.linkSubtle}>
          View all <ArrowRight size={11} />
        </Link>
      </div>
      {items.length === 0 ? (
        <EmptyHint text="No activity yet — actions across Composer, Inbox and Leads will surface here." />
      ) : (
        <ul style={S.list}>
          {items.slice(0, 8).map((a) => (
            <li key={a.id} style={S.listItem}>
              <ActivityIcon severity={a.severity} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13,
                  color: 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {a.description}
                </div>
                <div style={S.listMeta}>
                  {a.actor_type} · {fmtTimeAgo(a.created_at)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


function ActivityIcon({ severity }) {
  // Color coding mirrors ActivityLog severity (info / warning / critical).
  const color =
    severity === 'critical' ? 'var(--danger)' :
    severity === 'warning'  ? 'var(--warning)' :
                              'var(--brand-primary)';
  return (
    <span style={{
      flexShrink: 0,
      width: 6, height: 6, marginTop: 7,
      borderRadius: '50%', background: color,
    }} />
  );
}


// ── Pending approvals ─────────────────────────────────────────────────
function PendingApprovals({ items }) {
  return (
    <div style={S.card}>
      <div style={S.sectionHeader}>
        <span style={S.cardLabel}>Pending approvals</span>
        <Link to="/admin/approvals" style={S.linkSubtle}>
          Review all <ArrowRight size={11} />
        </Link>
      </div>
      {items.length === 0 ? (
        <EmptyHint text="Nothing waiting on you. Agency actions that need approval will appear here." />
      ) : (
        <ul style={S.list}>
          {items.map((a) => (
            <li key={a.id} style={S.listItem}>
              <ClipboardCheck size={14} color="var(--text-tertiary)" style={{ flexShrink: 0, marginTop: 4 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 500,
                  color: 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {labelFor(a.action_type)}
                </div>
                <div style={S.listMeta}>
                  by {a.requested_by} · {fmtTimeAgo(a.created_at)}
                </div>
                {a.preview && (
                  <div style={{
                    fontSize: 11, color: 'var(--text-tertiary)',
                    marginTop: 4,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {a.preview}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


// ── States ────────────────────────────────────────────────────────────
function SkeletonState() {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ ...S.card, height: 60 }} />
      <div style={{ ...S.metricRow, marginTop: 16 }}>
        {[0, 1, 2, 3].map((i) => <div key={i} style={{ ...S.card, height: 100 }} />)}
      </div>
      <div style={{ ...S.card, marginTop: 16, height: 220 }} />
    </div>
  );
}

function ErrorState() {
  return (
    <div style={{ ...S.card, margin: 16, color: 'var(--danger)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <AlertCircle size={14} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>Could not load dashboard</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
        Try refreshing in a few seconds.
      </div>
    </div>
  );
}

function NoClientState() {
  return (
    <div style={{ ...S.card, margin: 16 }}>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        Select a client to see today's briefing.
      </div>
    </div>
  );
}

function EmptyHint({ text }) {
  return (
    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '8px 4px 0' }}>
      {text}
    </div>
  );
}


// ── Style tokens ──────────────────────────────────────────────────────
const S = {
  card: {
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: 14,
  },
  cardLabel: {
    fontSize: 11, fontWeight: 600,
    letterSpacing: 0.6, textTransform: 'uppercase',
    color: 'var(--text-tertiary)',
  },
  metricRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12,
  },
  bottomRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 12,
  },
  sectionHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  list: {
    listStyle: 'none', margin: 0, padding: 0,
    display: 'flex', flexDirection: 'column', gap: 6,
    maxHeight: 240, overflowY: 'auto',
  },
  listItem: {
    display: 'flex', gap: 8, alignItems: 'flex-start',
    padding: '6px 0',
    borderBottom: '1px solid var(--border-subtle)',
  },
  listMeta: {
    fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2,
  },
  tinyLine: {
    fontSize: 11, color: 'var(--text-tertiary)',
  },
  linkSubtle: {
    display: 'inline-flex', alignItems: 'center', gap: 3,
    fontSize: 11, color: 'var(--text-link)', textDecoration: 'none',
  },
};


// ── Formatters ────────────────────────────────────────────────────────
function fmtCurrency(n) {
  if (n == null) return '—';
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1_000)    return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
}

function fmtMinutes(m) {
  if (m == null) return '—';
  if (m < 60)  return `${Math.round(m)}m`;
  if (m < 1440) return `${(m / 60).toFixed(1)}h`;
  return `${Math.round(m / 1440)}d`;
}

function fmtTimeAgo(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!then) return '';
  const sec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (sec < 60)    return `${sec}s ago`;
  if (sec < 3600)  return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function labelFor(actionType) {
  // Friendlier labels for the small set we know about.
  const map = {
    publish_post:        'Publish a post',
    delete_post:         'Delete a post',
    draft_post:          'Create a draft',
    send_campaign:       'Send a WhatsApp campaign',
    reply_comment:       'Reply to a comment',
    reply_dm:            'Reply to a DM',
    reply_review:        'Reply to a review',
    publish_bot:         'Publish a bot flow',
    unpublish_bot:       'Unpublish a bot flow',
    disconnect_platform: 'Disconnect a platform',
  };
  return map[actionType] || actionType.replace(/_/g, ' ');
}
