/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { Send, CheckCheck, Eye, MessageCircle, Settings, ArrowRight } from 'lucide-react';

import PageHeader from '../components/layout/PageHeader';
import StatCard from '../components/ui/StatCard';
import { useWhatsAppDashboard, useWhatsAppAccount, useWhatsAppCampaigns } from '../hooks/useWhatsApp';
import { useAuth } from '../hooks/useAuth';

const COLORS = {
  primary:   '#00CCF5',
  primaryD:  '#00A8D8',
  success:   '#10b981',
  danger:    '#dc2626',
  amber:     '#f59e0b',
  border:    'var(--border-default)',
  bg:        '#f6f8fc',
  card:      '#fff',
  text:      'var(--text-primary)',
  muted:     'var(--text-secondary)',
};

const QUALITY_BADGE = {
  GREEN:   { color: '#10b981', bg: '#dcfce7', label: 'Healthy' },
  YELLOW:  { color: '#f59e0b', bg: '#fef3c7', label: 'Caution' },
  RED:     { color: '#dc2626', bg: '#fee2e2', label: 'Flagged' },
  UNKNOWN: { color: 'var(--text-secondary)', bg: 'var(--surface-sunken)', label: 'Unknown' },
};

const TIER_LABEL = {
  TIER_1K:        '1K / 24h',
  TIER_10K:       '10K / 24h',
  TIER_100K:      '100K / 24h',
  TIER_UNLIMITED: 'Unlimited',
};

function basePath(role) {
  return (role === 'superadmin' || role === 'staff') ? '/admin' : '/dashboard';
}

export default function WhatsAppDashboard() {
  const { user } = useAuth();
  const { data, loading } = useWhatsAppDashboard();
  const { account } = useWhatsAppAccount();
  const { data: campaigns } = useWhatsAppCampaigns();

  const root = basePath(user?.role);

  const series = useMemo(() => (data?.time_series || []).map((d) => ({
    date:  d.date.slice(5),
    count: d.count,
  })), [data]);

  if (!account && !loading) {
    return (
      <div>
        <PageHeader title="WhatsApp" subtitle="Pinbot Cloud API integration" />
        <EmptyState root={root} />
      </div>
    );
  }

  const quality = QUALITY_BADGE[account?.quality_rating || 'UNKNOWN'];
  const tier    = TIER_LABEL[account?.messaging_tier || 'TIER_1K'];

  return (
    <div style={{ paddingBottom: 32 }}>
      <PageHeader
        title="WhatsApp"
        subtitle={account?.phone_number || account?.display_name || 'Cloud API integration'}
        action={
          <Link to={`${root}/whatsapp/settings`} style={btnSecondary}>
            <Settings size={14} /> Settings
          </Link>
        }
      />

      {/* Account status row */}
      {account && (
        <div style={{ padding: '0 16px', marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ ...badge, background: quality.bg, color: quality.color }}>
            ● Quality: {quality.label}
          </span>
          <span style={{ ...badge, background: '#eef2ff', color: '#4338ca' }}>
            Tier: {tier}
          </span>
        </div>
      )}

      {/* Stat cards */}
      <div style={statRow}>
        <StatCard label="Today"        value={data?.messages_today || 0}  icon={Send}        color="#0891b2" />
        <StatCard label="Last 7 days"  value={data?.messages_week || 0}   icon={MessageCircle} color="#2563eb" />
        <StatCard label="Last 30 days" value={data?.messages_month || 0}  icon={Send}        color="#6366f1" />
        <StatCard label="Active campaigns" value={data?.active_campaigns || 0} icon={Send}    color="#22c55e" />
      </div>

      {/* Rates */}
      <div style={statRow}>
        <RateCard label="Delivery Rate" value={data?.delivery_rate || 0} icon={CheckCheck} color={COLORS.success} />
        <RateCard label="Read Rate"     value={data?.read_rate || 0}     icon={Eye}        color="#0891b2" />
      </div>

      {/* Time series chart */}
      <div style={{ ...card, margin: '0 16px 16px' }}>
        <div style={cardHeader}>
          <h3 style={cardTitle}>Outbound messages — last 30 days</h3>
        </div>
        <div style={{ height: 280, padding: '8px 12px 12px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <CartesianGrid stroke="var(--surface-sunken)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: COLORS.muted }} />
              <YAxis tick={{ fontSize: 11, fill: COLORS.muted }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke={COLORS.primary} strokeWidth={2.5}
                    dot={{ r: 3, fill: COLORS.primary }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent campaigns */}
      <div style={{ ...card, margin: '0 16px 16px' }}>
        <div style={cardHeader}>
          <h3 style={cardTitle}>Recent campaigns</h3>
          <Link to={`${root}/whatsapp/campaigns`} style={linkChip}>
            View all <ArrowRight size={12} />
          </Link>
        </div>
        {(campaigns || []).length === 0 ? (
          <div style={emptyRow}>No campaigns yet. Create one from the Campaigns page.</div>
        ) : (
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Name</th>
                <th style={th}>Status</th>
                <th style={th}>Total</th>
                <th style={th}>Delivered</th>
                <th style={th}>Read</th>
                <th style={th}>Failed</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.slice(0, 8).map((c) => (
                <tr key={c.id}>
                  <td style={td}>{c.name}</td>
                  <td style={td}><StatusPill status={c.status} /></td>
                  <td style={td}>{c.total_count}</td>
                  <td style={td}>{c.delivered_count}</td>
                  <td style={td}>{c.read_count}</td>
                  <td style={td}>{c.failed_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function RateCard({ label, value, icon: Icon, color }) {
  return (
    <div style={{ ...card, flex: 1, minWidth: 200, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <span style={{
          width: 32, height: 32, borderRadius: 8,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: `${color}15`, color,
        }}><Icon size={16} /></span>
        <span style={{ fontSize: 12, color: COLORS.muted, fontWeight: 700, textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color: COLORS.text, letterSpacing: '-0.03em' }}>
        {Number(value || 0).toFixed(1)}%
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    draft:     { bg: 'var(--surface-sunken)', color: 'var(--text-secondary)' },
    scheduled: { bg: '#dbeafe', color: '#1d4ed8' },
    running:   { bg: '#dcfce7', color: '#15803d' },
    completed: { bg: '#dbeafe', color: '#1d4ed8' },
    failed:    { bg: '#fee2e2', color: '#b91c1c' },
    cancelled: { bg: 'var(--surface-sunken)', color: 'var(--text-secondary)' },
    paused:    { bg: '#fef3c7', color: '#a16207' },
  };
  const { bg, color } = map[status] || map.draft;
  return <span style={{ ...badge, background: bg, color, fontSize: 11 }}>{status}</span>;
}

function EmptyState({ root }) {
  return (
    <div style={{ padding: '40px 16px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ ...card, maxWidth: 480, padding: 32, textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: 'linear-gradient(135deg, #00CCF5, #00A8D8)',
          margin: '0 auto 16px',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <MessageCircle size={28} color="#fff" />
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: 18, color: COLORS.text }}>Connect your WhatsApp Business account</h3>
        <p style={{ margin: '0 0 16px', color: COLORS.muted, fontSize: 13 }}>
          You'll need a Pinbot Partners apikey, your WABA ID, and the phone number ID.
        </p>
        <Link to={`${root}/whatsapp/settings`} style={btnPrimary}>
          Set up WhatsApp <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}

const card = {
  background: COLORS.card,
  borderRadius: 12,
  border: `1px solid ${COLORS.border}`,
  overflow: 'hidden',
};
const cardHeader = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '14px 16px', borderBottom: `1px solid ${COLORS.border}`,
};
const cardTitle = {
  margin: 0, fontSize: 14, fontWeight: 700, color: COLORS.text, letterSpacing: '-0.01em',
};
const statRow = {
  display: 'flex', gap: 12, padding: '0 16px 12px', flexWrap: 'wrap',
};
const badge = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
};
const linkChip = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  fontSize: 12, fontWeight: 600, color: COLORS.primaryD, textDecoration: 'none',
};
const table = {
  width: '100%', borderCollapse: 'collapse', fontSize: 13,
};
const th = {
  textAlign: 'left', padding: '10px 16px', color: COLORS.muted,
  fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em',
  borderBottom: `1px solid ${COLORS.border}`,
};
const td = {
  padding: '12px 16px', color: COLORS.text, borderBottom: '1px solid var(--surface-sunken)',
};
const emptyRow = {
  padding: '40px 16px', textAlign: 'center', color: COLORS.muted, fontSize: 13,
};
const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '10px 18px', borderRadius: 10, border: 'none',
  background: 'linear-gradient(135deg, #00CCF5, #00A8D8)', color: '#fff',
  fontWeight: 600, fontSize: 13, cursor: 'pointer', textDecoration: 'none',
};
const btnSecondary = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 8, border: `1px solid ${COLORS.border}`,
  background: 'var(--surface-card)', color: COLORS.text, fontWeight: 600, fontSize: 13,
  cursor: 'pointer', textDecoration: 'none',
};
