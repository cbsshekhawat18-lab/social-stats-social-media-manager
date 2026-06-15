/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * CTWACampaignDetailPage — per-campaign analytics + sync trigger.
 *
 * Backend () returns:
 * {
 * totals: { clicks, conversations, leads, spent, cpl },
 * leads_per_day: [{date, c}],
 * conversations_per_day:[{date, c}],
 * }
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Megaphone, RefreshCw, ExternalLink, ChevronRight, Sparkles, AlertTriangle,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

import { ctwaAPI } from '../../services/api';
import toast from '../../components/ui/toast';

export default function CTWACampaignDetailPage() {
  const { id } = useParams();
  const [camp,    setCamp]    = useState(null);
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [adBreakdown, setAdBreakdown] = useState(null);
  const [adBusy, setAdBusy] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([ctwaAPI.get(id), ctwaAPI.analytics(id)])
      .then(([cr, ar]) => { setCamp(cr.data); setData(ar.data); })
      .catch(() => toast.error('Could not load campaign'))
      .finally(() => setLoading(false));
  }
  useEffect(load, [id]);

  function fetchAdBreakdown() {
    setAdBusy(true);
    ctwaAPI.adBreakdown(id)
      .then((r) => setAdBreakdown(r.data))
      .catch(() => toast.error('Could not fetch per-ad insights'))
      .finally(() => setAdBusy(false));
  }

  async function syncMeta() {
    setSyncing(true);
    try {
      const r = await ctwaAPI.syncMeta(id);
      if (r.data?.ok) {
        toast.success(`Synced from Meta — spent ₹${(r.data.total_spent || 0).toLocaleString()}`);
      } else {
        toast.error(r.data?.error || 'Meta sync failed');
      }
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not sync');
    } finally { setSyncing(false); }
  }

  if (loading || !camp || !data) {
    return <div style={{ padding: 32, color: 'var(--text-tertiary)' }}>Loading…</div>;
  }

  // Merge daily series so the chart has both lines aligned by date
  const dailyMap = new Map();
  (data.leads_per_day || []).forEach((r) => {
    dailyMap.set(r.date, { date: r.date, leads: r.c, convs: 0 });
  });
  (data.conversations_per_day || []).forEach((r) => {
    const existing = dailyMap.get(r.date) || { date: r.date, leads: 0 };
    existing.convs = r.c;
    dailyMap.set(r.date, existing);
  });
  const series = Array.from(dailyMap.values()).sort((a, b) => (a.date > b.date ? 1 : -1));

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Link to="/admin/ctwa" style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', alignSelf: 'flex-start',
      }}>
        <ArrowLeft size={14} /> All campaigns
      </Link>

      {/* Hero */}
      <header style={{
        padding: 18,
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap',
      }}>
        <span style={{
          width: 48, height: 48, flexShrink: 0,
          background: 'var(--brand-primary-glow)', color: 'var(--brand-primary-hover)',
          borderRadius: 'var(--radius-md)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Megaphone size={22} strokeWidth={2.2} />
        </span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {camp.name}
          </h1>
          <div style={{ marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-secondary)' }}>
            <span>Flow: <Link to={`/admin/bot-flows/${camp.flow}/edit`} style={{ color: 'var(--brand-primary-hover)', fontWeight: 600 }}>{camp.flow_name}</Link></span>
            <span>Meta campaign: <code>{camp.campaign_id}</code></span>
            <span>{(camp.ad_ids || []).length} ad{(camp.ad_ids || []).length === 1 ? '' : 's'}</span>
          </div>
          {camp.last_synced_at && (
            <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>
              Last synced: {new Date(camp.last_synced_at).toLocaleString()}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={syncMeta} disabled={syncing} style={btnGhost}>
            <RefreshCw size={13} /> {syncing ? 'Syncing…' : 'Sync Meta'}
          </button>
        </div>
      </header>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        <KPI label="Clicks"        n={data.totals.clicks.toLocaleString()} />
        <KPI label="Conversations" n={data.totals.conversations.toLocaleString()} color="var(--brand-primary)" />
        <KPI label="Leads"         n={data.totals.leads.toLocaleString()}  color="var(--success)" />
        <KPI label="Spent"         n={`₹${Number(data.totals.spent || 0).toLocaleString()}`} />
        <KPI label="CPL"
             n={data.totals.cpl != null ? `₹${data.totals.cpl}` : '—'}
             color={data.totals.cpl != null && data.totals.cpl < 200 ? 'var(--success)' : 'var(--warning)'} />
      </div>

      {/* Daily series */}
      <Section title="Last 30 days" subtitle="Conversations started vs leads captured per day">
        {series.length === 0 ? (
          <Empty>No daily activity yet — once your ads start running, this chart populates.</Empty>
        ) : (
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 6, right: 18, left: 12, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: 'var(--surface-sunken)' }}
                  contentStyle={{
                    background: 'var(--surface-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-sm)', fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} />
                <defs>
                  <linearGradient id="conv-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--brand-primary)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--brand-primary)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="leads-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--success)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="convs" name="Conversations"
                      stroke="var(--brand-primary)" fill="url(#conv-gradient)" strokeWidth={2} />
                <Area type="monotone" dataKey="leads" name="Leads"
                      stroke="var(--success)" fill="url(#leads-gradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>

      {/* Per-ad performance breakdown */}
      <Section title="Per-ad performance"
               subtitle="Spend, clicks and CTR pulled directly from Meta Insights (last 30 days)">
        {!adBreakdown ? (
          <div style={{ padding: 12, textAlign: 'center' }}>
            <button type="button" onClick={fetchAdBreakdown} disabled={adBusy} style={btnGhost}>
              {adBusy ? 'Loading…' : 'Load per-ad insights'}
            </button>
          </div>
        ) : !adBreakdown.ok ? (
          <Empty>
            {adBreakdown.error === 'meta ads not connected'
              ? 'Connect Facebook to pull per-ad insights.'
              : `Couldn't load: ${adBreakdown.error}`}
          </Empty>
        ) : (adBreakdown.ads || []).length === 0 ? (
          <Empty>No ad-level data available yet — Meta typically lags by ~6h.</Empty>
        ) : (
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--surface-sunken)', textAlign: 'left' }}>
                  <th style={th}>Ad</th>
                  <th style={{ ...th, textAlign: 'right' }}>Impressions</th>
                  <th style={{ ...th, textAlign: 'right' }}>Clicks</th>
                  <th style={{ ...th, textAlign: 'right' }}>CTR</th>
                  <th style={{ ...th, textAlign: 'right' }}>CPC</th>
                  <th style={{ ...th, textAlign: 'right' }}>Spend</th>
                </tr>
              </thead>
              <tbody>
                {adBreakdown.ads.map((a) => (
                  <tr key={a.ad_id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{a.ad_name}</div>
                      <code style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{a.ad_id}</code>
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {a.impressions.toLocaleString()}
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {a.clicks.toLocaleString()}
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {a.ctr ? `${a.ctr.toFixed(2)}%` : '—'}
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {a.cpc ? `₹${a.cpc.toFixed(2)}` : '—'}
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      ₹{a.spend.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" onClick={fetchAdBreakdown} disabled={adBusy} style={{
              ...btnGhost, marginTop: 8, fontSize: 11,
            }}>
              <RefreshCw size={11} /> {adBusy ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        )}
      </Section>

      {/* Linked ads */}
      <Section title="Linked Meta ads" subtitle="Ads that trigger this flow when clicked">
        {(camp.ad_ids || []).length === 0 ? (
          <Empty>No ads linked yet — edit the campaign to link CTWA ads from your ad account.</Empty>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {camp.ad_ids.map((adId) => (
              <li key={adId} style={{
                padding: '8px 12px',
                background: 'var(--surface-sunken)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex', alignItems: 'center', gap: 10,
                fontSize: 13,
              }}>
                <Megaphone size={13} style={{ color: 'var(--text-tertiary)' }} />
                <code>{adId}</code>
                <a href={`https://www.facebook.com/ads/manager/?act=${(camp.ad_account_id || '').replace('act_', '')}`}
                   target="_blank" rel="noreferrer"
                   style={{ marginLeft: 'auto', color: 'var(--brand-primary-hover)', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  Ads Manager <ExternalLink size={11} />
                </a>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Footer link */}
      <Link to={`/admin/leads?source_campaign_id=${encodeURIComponent(camp.campaign_id)}`} style={{
        ...btnPrimary, alignSelf: 'flex-start',
      }}>
        View all leads from this campaign <ChevronRight size={13} />
      </Link>
    </div>
  );
}

function KPI({ label, n, color }) {
  return (
    <div style={{
      padding: 12,
      background: 'var(--surface-card)', border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{n}</div>
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

function Empty({ children }) {
  return (
    <div style={{
      padding: 16, textAlign: 'center',
      color: 'var(--text-tertiary)', fontSize: 13,
    }}>
      {children}
    </div>
  );
}

const btnPrimary = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--brand-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', textDecoration: 'none' };
const btnGhost = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--surface-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' };
const th = { padding: '8px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' };
const td = { padding: '10px', color: 'var(--text-primary)', verticalAlign: 'top' };
