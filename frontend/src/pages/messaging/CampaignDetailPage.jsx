/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from 'recharts';
import {
  PauseCircle, X, RefreshCw, Loader2, AlertCircle, CheckCircle2, Send, Clock,
} from 'lucide-react';

import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import DataTable from '../../components/ui/DataTable';
import { whatsappAPI } from '../../services/api';

const STATUS_VARIANT = {
  draft: 'default', scheduled: 'info', running: 'success', completed: 'info',
  failed: 'danger',  cancelled: 'default', paused: 'warning',
};

const PIE_COLORS = {
  sent:      'var(--text-tertiary)',
  delivered: '#0891b2',
  read:      '#10b981',
  failed:    '#ef4444',
};

export default function CampaignDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState(null);
  const [stats, setStats] = useState(null);
  const [messages, setMessages] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [c, s, m] = await Promise.all([
        whatsappAPI.campaigns.get(id),
        whatsappAPI.campaigns.stats(id),
        whatsappAPI.messages.list({ campaign: id }),
      ]);
      setCampaign(c.data);
      setStats(s.data);
      setMessages(m.data?.results || m.data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  if (loading || !campaign) {
    return (
      <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
        <Loader2 size={20} className="ds-spin" color="var(--text-tertiary)" />
        <style>{`.ds-spin { animation: ds-spin 0.9s linear infinite; } @keyframes ds-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const filtered = filter === 'all'
    ? messages
    : messages.filter((m) => m.status === filter);

  const pie = [
    { name: 'Sent',      value: stats?.sent      || 0, color: PIE_COLORS.sent      },
    { name: 'Delivered', value: stats?.delivered || 0, color: PIE_COLORS.delivered },
    { name: 'Read',      value: stats?.read      || 0, color: PIE_COLORS.read      },
    { name: 'Failed',    value: stats?.failed    || 0, color: PIE_COLORS.failed    },
  ].filter((p) => p.value > 0);

  return (
    <div style={{ paddingBottom: 32 }}>
      <PageHeader
        title={campaign.name}
        subtitle={`${campaign.template_name} → ${campaign.contact_list_name}`}
        backHref="../campaigns"
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            {campaign.status === 'running' && (
              <Button variant="secondary" icon={PauseCircle}
                      onClick={async () => { await whatsappAPI.campaigns.pause(campaign.id); load(); }}>
                Pause
              </Button>
            )}
            {!['completed', 'canceled'].includes(campaign.status) && (
              <Button variant="secondary" icon={X}
                      onClick={async () => {
                        if (window.confirm('Cancel this campaign?')) {
                          await whatsappAPI.campaigns.cancel(campaign.id); load();
                        }
                      }}>
                Cancel
              </Button>
            )}
            {(stats?.failed || 0) > 0 && (
              <Button variant="secondary" icon={RefreshCw}
                      onClick={async () => { await whatsappAPI.campaigns.retryFailed(campaign.id); load(); }}>
                Retry failed
              </Button>
            )}
          </div>
        }
      />

      <div style={{ padding: '0 24px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 16 }}>
        <Card padding="md">
          <Card.Header title="Status breakdown" />
          {pie.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
              No messages dispatched yet.
            </div>
          ) : (
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pie}
                    dataKey="value"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {pie.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
            {pie.map((p) => (
              <div key={p.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: p.color }} />
                {p.name}: <strong>{p.value}</strong>
              </div>
            ))}
          </div>
        </Card>

        <Card padding="md">
          <Card.Header title="Meta" />
          <KV label="Status"   value={<Badge variant={STATUS_VARIANT[campaign.status]} dot>{campaign.status}</Badge>} />
          <KV label="Total"    value={campaign.total_count} />
          <KV label="Progress" value={`${campaign.progress_percent}%`} />
          <KV label="Scheduled" value={campaign.scheduled_at ? new Date(campaign.scheduled_at).toLocaleString() : '—'} />
          <KV label="Started"   value={campaign.started_at   ? new Date(campaign.started_at).toLocaleString()   : '—'} />
          <KV label="Completed" value={campaign.completed_at ? new Date(campaign.completed_at).toLocaleString() : '—'} />
        </Card>
      </div>

      <div style={{ padding: '16px 24px 0', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {['all', 'sent', 'delivered', 'read', 'failed'].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            style={{
              padding: '6px 12px',
              background: filter === s ? 'var(--brand-primary-glow)' : 'var(--surface-card)',
              color: filter === s ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: `1px solid ${filter === s ? 'transparent' : 'var(--border-subtle)'}`,
              borderRadius: 'var(--radius-pill)',
              fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
              minHeight: 'unset', minWidth: 'unset',
              transition: 'var(--transition-fast)',
            }}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ padding: '12px 24px' }}>
        <DataTable
          columns={[
            {
              key: 'phone',
              header: 'Contact',
              accessor: (m) => m.contact?.phone,
              render: (m) => (
                <div>
                  <div style={{ fontWeight: 500 }}>{m.contact?.name || m.contact?.phone}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    {m.contact?.phone}
                  </div>
                </div>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              accessor: (m) => m.status,
              render: (m) => <Badge variant={STATUS_VARIANT[m.status] || 'default'} dot>{m.status}</Badge>,
              width: 120,
            },
            {
              key: 'created_at',
              header: 'Sent',
              accessor: (m) => m.created_at,
              render: (m) => (
                <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                  {new Date(m.created_at).toLocaleString()}
                </span>
              ),
              width: 180,
            },
            {
              key: 'error',
              header: 'Error',
              render: (m) => m.error_message
                ? <span style={{ fontSize: 12, color: 'var(--danger)' }}>{m.error_message}</span>
                : <span style={{ color: 'var(--text-tertiary)' }}>—</span>,
            },
          ]}
          rows={filtered}
          rowKey="id"
          pageSize={50}
          emptyState={{
            icon: Send,
            title: 'No messages match this filter',
            description: 'Switch filter or wait for delivery receipts.',
          }}
        />
      </div>
    </div>
  );
}

function KV({ label, value }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 0',
      borderBottom: '1px solid var(--border-subtle)',
      fontSize: 13,
    }}>
      <span style={{ color: 'var(--text-tertiary)' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{value}</span>
    </div>
  );
}
