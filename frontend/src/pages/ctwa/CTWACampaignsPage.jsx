/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * CTWACampaignsPage — list of CTWA campaigns linking flows to Meta ads.
 *
 * Per-row stats: clicks, conversations, leads, spent, CPL.
 * Click a row → CTWACampaignDetailPage.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Megaphone, Plus, RefreshCw, ExternalLink, Sparkles, ChevronRight,
  CheckCircle2, AlertTriangle,
} from 'lucide-react';

import { ctwaAPI, botAPI, metaAdsAPI } from '../../services/api';
import toast from '../../components/ui/toast';

export default function CTWACampaignsPage() {
  const [camps,    setCamps]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [health,   setHealth]   = useState(null);

  function load() {
    setLoading(true);
    ctwaAPI.list({})
      .then((r) => setCamps(r.data?.results || r.data || []))
      .catch(() => toast.error('Could not load campaigns'))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  useEffect(() => {
    metaAdsAPI.health()
      .then((r) => setHealth(r.data))
      .catch(() => setHealth({ connected: false }));
  }, []);

  const totals = useMemo(() => {
    const t = { clicks: 0, conversations: 0, leads: 0, spent: 0 };
    camps.forEach((c) => {
      t.clicks += c.total_clicks || 0;
      t.conversations += c.total_conversations || 0;
      t.leads += c.total_leads || 0;
      t.spent += Number(c.total_spent || 0);
    });
    return t;
  }, [camps]);

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{
          width: 40, height: 40,
          background: 'var(--brand-primary-glow)', color: 'var(--brand-primary-hover)',
          borderRadius: 'var(--radius-md)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Megaphone size={20} strokeWidth={2.2} />
        </span>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            CTWA campaigns
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            Track each Meta ad → flow → leads. Spend is pulled daily from Meta Insights.
          </p>
        </div>
        <button type="button" onClick={load} aria-label="Refresh" style={iconBtn}>
          <RefreshCw size={13} />
        </button>
        <button type="button" onClick={() => setCreateOpen(true)} style={btnPrimary}>
          <Plus size={13} /> New campaign
        </button>
      </header>

      {/* Meta connection health */}
      {health && <MetaHealthBanner health={health} />}

      {/* Roll-up stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        <Stat label="Clicks"        n={totals.clicks.toLocaleString()} />
        <Stat label="Conversations" n={totals.conversations.toLocaleString()} />
        <Stat label="Leads"         n={totals.leads.toLocaleString()} color="var(--success)" />
        <Stat label="Spent"         n={`₹${totals.spent.toLocaleString()}`} />
        <Stat label="Avg CPL"
              n={totals.leads ? `₹${(totals.spent / totals.leads).toFixed(2)}` : '—'}
              color="var(--brand-primary-hover)" />
      </div>

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading…</div>
      ) : camps.length === 0 ? (
        <Empty onCreate={() => setCreateOpen(true)} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {camps.map((c) => <CampaignCard key={c.id} camp={c} />)}
        </div>
      )}

      {createOpen && (
        <CreateModal onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); load(); }} />
      )}
    </div>
  );
}

function CampaignCard({ camp }) {
  const cpl = camp.total_leads && camp.total_spent
    ? Number(camp.total_spent) / camp.total_leads
    : null;

  return (
    <Link to={`/admin/ctwa/${camp.id}`} style={{
      padding: 14,
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      display: 'flex', flexDirection: 'column', gap: 8,
      textDecoration: 'none', color: 'inherit',
    }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{
          width: 32, height: 32, borderRadius: 'var(--radius-sm)',
          background: 'var(--brand-primary-glow)', color: 'var(--brand-primary-hover)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Megaphone size={15} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {camp.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            {camp.flow_name} · {(camp.ad_ids || []).length} ad{(camp.ad_ids || []).length === 1 ? '' : 's'}
          </div>
        </div>
        <span style={{
          padding: '2px 8px', fontSize: 10, fontWeight: 600,
          letterSpacing: '0.04em', textTransform: 'uppercase',
          color: camp.is_active ? 'var(--success)' : 'var(--text-tertiary)',
          background: camp.is_active ? 'var(--success-bg)' : 'var(--surface-sunken)',
          border: '1px solid currentColor', borderRadius: 'var(--radius-pill)',
        }}>{camp.is_active ? 'Active' : 'Paused'}</span>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        <MiniStat n={camp.total_clicks} label="clicks" />
        <MiniStat n={camp.total_leads} label="leads" />
        <MiniStat n={cpl ? `₹${cpl.toFixed(0)}` : '—'} label="cpl" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
        <span>Spent: ₹{Number(camp.total_spent || 0).toLocaleString()}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--brand-primary-hover)' }}>
          Open <ChevronRight size={11} />
        </span>
      </div>
    </Link>
  );
}

function MetaHealthBanner({ health }) {
  // 4 states: not connected, expired, expiring soon (<7d), connected ok
  if (!health.connected) {
    return (
      <Banner
        tone="warning"
        icon={<AlertTriangle size={14} />}
        title="Meta Ads not connected"
        message={health.error || 'Connect a Facebook account to sync ad spend and route CTWA leads.'}
        action={{ label: 'Connect Facebook', href: '/admin/connections' }}
      />
    );
  }
  if (health.expired) {
    return (
      <Banner
        tone="danger"
        icon={<AlertTriangle size={14} />}
        title="Meta token expired"
        message="Reconnect Facebook so spend keeps syncing."
        action={{ label: 'Reconnect', href: '/admin/connections' }}
      />
    );
  }
  if (typeof health.days_left === 'number' && health.days_left <= 7) {
    return (
      <Banner
        tone="warning"
        icon={<AlertTriangle size={14} />}
        title={`Meta token expires in ${health.days_left} day${health.days_left === 1 ? '' : 's'}`}
        message="Reconnect now to avoid sync interruptions."
        action={{ label: 'Reconnect', href: '/admin/connections' }}
      />
    );
  }
  if (!health.pixel_configured) {
    return (
      <Banner
        tone="info"
        icon={<Sparkles size={14} />}
        title="Add a Meta Pixel for better ad optimization"
        message="When configured, lead captures fire Conversions API events back to Meta — ads optimize on real conversions, not just clicks."
        action={{ label: 'Add Pixel ID', href: '/admin/settings/integrations' }}
      />
    );
  }
  return (
    <Banner
      tone="success"
      icon={<CheckCircle2 size={14} />}
      title={`Connected as ${health.fb_user?.name || 'Meta user'}`}
      message="Ad spend syncs daily. Lead captures push to your Meta Pixel."
      compact
    />
  );
}

function Banner({ tone, icon, title, message, action, compact }) {
  const palettes = {
    info:    { bg: 'var(--brand-primary-soft)', border: 'var(--brand-primary-glow)', text: 'var(--brand-primary-hover)' },
    success: { bg: 'var(--success-bg)',         border: 'var(--success)',           text: 'var(--success)' },
    warning: { bg: 'var(--warning-bg)',         border: 'var(--warning)',           text: 'var(--warning)' },
    danger:  { bg: 'var(--danger-bg)',          border: 'var(--danger)',            text: 'var(--danger)' },
  };
  const p = palettes[tone] || palettes.info;
  return (
    <div style={{
      padding: compact ? '8px 14px' : '10px 14px',
      background: p.bg, color: p.text,
      border: `1px solid ${p.border}`,
      borderRadius: 'var(--radius-md)',
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 12, fontWeight: 700 }}>{title}</div>
        {!compact && message && (
          <div style={{ marginTop: 2, fontSize: 11, opacity: 0.85 }}>{message}</div>
        )}
      </div>
      {action && (
        <Link to={action.href} style={{
          padding: '4px 10px', fontSize: 11, fontWeight: 600,
          color: p.text, background: 'transparent',
          border: `1px solid ${p.border}`, borderRadius: 'var(--radius-pill)',
          textDecoration: 'none',
        }}>{action.label}</Link>
      )}
    </div>
  );
}

function MiniStat({ n, label }) {
  return (
    <div style={{ textAlign: 'center', padding: '6px 4px', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{n ?? 0}</div>
      <div style={{ fontSize: 9, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
    </div>
  );
}

function Stat({ label, n, color }) {
  return (
    <div style={{
      padding: 12,
      background: 'var(--surface-card)', border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{n}</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    </div>
  );
}

function Empty({ onCreate }) {
  return (
    <div style={{
      padding: 36, textAlign: 'center',
      background: 'var(--surface-card)',
      border: '1px dashed var(--border-default)',
      borderRadius: 'var(--radius-md)',
    }}>
      <Megaphone size={32} strokeWidth={1.5} style={{ opacity: 0.4 }} />
      <h2 style={{ margin: '12px 0 6px', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
        No CTWA campaigns yet
      </h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
        Link a bot flow to one or more Meta ads to start tracking CPL.
      </p>
      <button type="button" onClick={onCreate} style={btnPrimary}>
        <Plus size={13} /> New campaign
      </button>
    </div>
  );
}

function CreateModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [flowId, setFlowId] = useState('');
  const [adAccountId, setAdAccountId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [adIds, setAdIds] = useState('');
  const [flows, setFlows] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    botAPI.list({ active: '1' })
      .then((r) => setFlows(r.data?.results || r.data || []))
      .catch(() => {});
  }, []);

  async function go() {
    if (!name.trim() || !flowId || !adAccountId.trim() || !campaignId.trim()) {
      return toast.error('Fill in name, flow, ad account, and campaign');
    }
    setBusy(true);
    try {
      const ids = adIds.split(',').map((s) => s.trim()).filter(Boolean);
      const r = await ctwaAPI.create({
        name: name.trim(),
        flow: Number(flowId),
        ad_account_id: adAccountId.trim(),
        campaign_id: campaignId.trim(),
        ad_ids: ids,
        adset_ids: [],
        is_active: true,
      });
      toast.success('Campaign created');
      onCreated(r.data);
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not create campaign');
    } finally { setBusy(false); }
  }

  return (
    <div style={backdrop} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modal}>
        <header style={{ padding: '14px 18px' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>New CTWA campaign</h2>
        </header>
        <div style={{ padding: '0 18px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={lbl}>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
                   placeholder="Real-estate launch · Diwali" style={inputStyle} />
          </div>
          <div>
            <label style={lbl}>Bot flow</label>
            <select value={flowId} onChange={(e) => setFlowId(e.target.value)} style={inputStyle}>
              <option value="">Pick an active flow…</option>
              {flows.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Ad account ID</label>
            <input value={adAccountId} onChange={(e) => setAdAccountId(e.target.value)}
                   placeholder="act_999999999" style={inputStyle} />
          </div>
          <div>
            <label style={lbl}>Meta campaign ID</label>
            <input value={campaignId} onChange={(e) => setCampaignId(e.target.value)}
                   placeholder="120209xxxxxxx" style={inputStyle} />
          </div>
          <div>
            <label style={lbl}>Ad IDs (comma-separated)</label>
            <input value={adIds} onChange={(e) => setAdIds(e.target.value)}
                   placeholder="120209…, 120209…" style={inputStyle} />
            <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>
              Find these in Meta Ads Manager — only CTWA ads (with WhatsApp destination) trigger this campaign.
            </div>
          </div>
        </div>
        <footer style={{ padding: '12px 18px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={btnGhost}>Cancel</button>
          <button type="button" onClick={go} disabled={busy} style={btnPrimary}>
            <Sparkles size={13} /> {busy ? 'Creating…' : 'Create'}
          </button>
        </footer>
      </div>
    </div>
  );
}

const inputStyle = { width: '100%', padding: '8px 10px', background: 'var(--surface-sunken)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' };
const lbl = { display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 4 };
const btnPrimary = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--brand-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', textDecoration: 'none' };
const btnGhost = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--surface-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' };
const iconBtn = { width: 30, height: 30, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' };
const backdrop = { position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(10,14,20,0.50)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 };
const modal   = { width: '100%', maxWidth: 480, background: 'var(--surface-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)' };
