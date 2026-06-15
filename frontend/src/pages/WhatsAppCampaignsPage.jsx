/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useState, useMemo } from 'react';
import {
  Plus, Send, PauseCircle, PlayCircle, X, RefreshCw, Loader2, AlertCircle, ChevronRight, ChevronLeft,
} from 'lucide-react';

import PageHeader from '../components/layout/PageHeader';
import { useWhatsAppCampaigns, useWhatsAppTemplates, useWhatsAppLists } from '../hooks/useWhatsApp';
import { whatsappAPI } from '../services/api';

const COLORS = {
  primary: '#00CCF5', primaryD: '#00A8D8',
  border: 'var(--border-default)', text: 'var(--text-primary)', muted: 'var(--text-secondary)',
  success: '#10b981', danger: '#dc2626',
};

const STATUS_BADGE = {
  draft:     { bg: 'var(--surface-sunken)', color: 'var(--text-secondary)' },
  scheduled: { bg: '#dbeafe', color: '#1d4ed8' },
  running:   { bg: '#dcfce7', color: '#15803d' },
  completed: { bg: '#dbeafe', color: '#1d4ed8' },
  failed:    { bg: '#fee2e2', color: '#b91c1c' },
  cancelled: { bg: 'var(--surface-sunken)', color: 'var(--text-secondary)' },
  paused:    { bg: '#fef3c7', color: '#a16207' },
};

export default function WhatsAppCampaignsPage() {
  const { data, refetch, loading } = useWhatsAppCampaigns();
  const [showWizard, setShowWizard] = useState(false);
  const [detailId, setDetailId] = useState(null);

  return (
    <div style={{ paddingBottom: 32 }}>
      <PageHeader
        title="Campaigns"
        subtitle={`${data?.length || 0} campaigns`}
        action={
          <button onClick={() => setShowWizard(true)} style={btnPrimary}>
            <Plus size={14} /> New Campaign
          </button>
        }
      />

      <div style={{ padding: '0 16px' }}>
        <div style={card}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={th}>Name</th>
                <th style={th}>Template</th>
                <th style={th}>List</th>
                <th style={th}>Status</th>
                <th style={th}>Progress</th>
                <th style={th}>Sent / Total</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} style={emptyRow}><Loader2 size={14} className="spin" /> Loading…</td></tr>}
              {!loading && (data || []).length === 0 && (
                <tr><td colSpan={7} style={emptyRow}>No campaigns yet.</td></tr>
              )}
              {(data || []).map((c) => {
                const status = STATUS_BADGE[c.status] || STATUS_BADGE.draft;
                return (
                  <tr key={c.id}>
                    <td style={td}>
                      <button onClick={() => setDetailId(c.id)} style={linkBtn}>{c.name}</button>
                    </td>
                    <td style={td}>{c.template_name}</td>
                    <td style={td}>{c.contact_list_name}</td>
                    <td style={td}><span style={{ ...badge, background: status.bg, color: status.color }}>{c.status}</span></td>
                    <td style={td}>
                      <div style={progressBar}>
                        <div style={{ ...progressFill, width: `${c.progress_percent}%` }} />
                      </div>
                      <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{c.progress_percent}%</div>
                    </td>
                    <td style={td}>{c.sent_count} / {c.total_count}</td>
                    <td style={td}><CampaignActions c={c} onChange={refetch} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showWizard && (
        <CampaignWizard
          onClose={() => setShowWizard(false)}
          onCreated={() => { setShowWizard(false); refetch(); }}
        />
      )}

      {detailId && (
        <CampaignDetail
          campaignId={detailId}
          onClose={() => setDetailId(null)}
          onChange={refetch}
        />
      )}

      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function CampaignActions({ c, onChange }) {
  async function launch() {
    try {
      await whatsappAPI.campaigns.launch(c.id);
      onChange();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    }
  }
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {(c.status === 'draft' || c.status === 'scheduled') && (
        <button onClick={launch} style={btnSecondary}><Send size={12} /> Launch</button>
      )}
      {c.status === 'running' && (
        <button onClick={async () => { await whatsappAPI.campaigns.pause(c.id); onChange(); }} style={btnSecondary}>
          <PauseCircle size={12} /> Pause
        </button>
      )}
      {c.status === 'paused' && (
        <button onClick={async () => { await whatsappAPI.campaigns.resume(c.id); onChange(); }} style={btnSecondary}>
          <PlayCircle size={12} /> Resume
        </button>
      )}
      {!['completed', 'canceled'].includes(c.status) && (
        <button onClick={async () => { if (window.confirm('Cancel this campaign?')) { await whatsappAPI.campaigns.cancel(c.id); onChange(); } }}
                style={{ ...btnSecondary, color: COLORS.danger, borderColor: '#fecaca' }}>
          <X size={12} />
        </button>
      )}
    </div>
  );
}

function CampaignWizard({ onClose, onCreated }) {
  const [step, setStep] = useState(1);
  const { data: templates } = useWhatsAppTemplates({ status: 'approved' });
  const { data: lists } = useWhatsAppLists();
  const [form, setForm] = useState({
    name: '', template: '', contact_list: '', template_variables: {},
    scheduled_at: '',
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const selectedTemplate = useMemo(
    () => (templates || []).find((t) => String(t.id) === String(form.template)),
    [templates, form.template]
  );

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        template: form.template,
        contact_list: form.contact_list,
        template_variables: form.template_variables,
      };
      if (form.scheduled_at) payload.scheduled_at = form.scheduled_at;
      await whatsappAPI.campaigns.create(payload);
      onCreated();
    } catch (e) {
      setError(e.response?.data?.detail || JSON.stringify(e.response?.data) || e.message);
    } finally {
      setSaving(false);
    }
  }

  const canNext1 = form.name.trim() && form.template && form.contact_list;
  const canSave = canNext1;

  return (
    <div style={modalBackdrop} onClick={onClose}>
      <div style={modalBox} onClick={(e) => e.stopPropagation()}>
        <header style={{
          padding: 16, borderBottom: `1px solid ${COLORS.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h3 style={{ margin: 0, fontSize: 16, color: COLORS.text }}>New Campaign — Step {step} of 3</h3>
          <button onClick={onClose} style={iconBtn}>×</button>
        </header>

        <div style={{ padding: 16 }}>
          <Stepper step={step} />

          {step === 1 && (
            <>
              <Field label="Campaign Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="May launch promo" />
              <SelectField label="Template" value={form.template}
                           onChange={(v) => setForm({ ...form, template: v })}
                           options={[{ id: '', label: '— Select an approved template —' },
                                     ...(templates || []).map((t) => ({ id: t.id, label: `${t.name} (${t.language})` }))]} />
              <SelectField label="Contact List" value={form.contact_list}
                           onChange={(v) => setForm({ ...form, contact_list: v })}
                           options={[{ id: '', label: '— Select a list —' },
                                     ...(lists || []).map((l) => ({ id: l.id, label: `${l.name} (${l.contact_count} contacts)` }))]} />
            </>
          )}

          {step === 2 && (
            <VariablesStep
              template={selectedTemplate}
              variables={form.template_variables}
              onChange={(vars_) => setForm({ ...form, template_variables: vars_ })}
            />
          )}

          {step === 3 && (
            <>
              <Field label="Schedule (optional, leave blank to send now)"
                     type="datetime-local"
                     value={form.scheduled_at}
                     onChange={(v) => setForm({ ...form, scheduled_at: v })} />
              <div style={{ ...infoBox, marginTop: 8 }}>
                Launching this campaign will queue messages for every <b>opted-in</b> contact in the list.
                Contacts in <i>pending</i> or <i>opted-out</i> status will be skipped.
              </div>
            </>
          )}

          {error && <div style={{ ...errorBox, marginTop: 12 }}><AlertCircle size={14} /> {String(error)}</div>}
        </div>

        <footer style={{
          padding: 16, borderTop: `1px solid ${COLORS.border}`,
          display: 'flex', justifyContent: 'space-between',
        }}>
          <button onClick={() => step > 1 ? setStep(step - 1) : onClose()} style={btnSecondary}>
            <ChevronLeft size={14} /> {step > 1 ? 'Back' : 'Cancel'}
          </button>
          {step < 3 ? (
            <button onClick={() => setStep(step + 1)} disabled={step === 1 && !canNext1} style={btnPrimary}>
              Next <ChevronRight size={14} />
            </button>
          ) : (
            <button onClick={save} disabled={saving || !canSave} style={btnPrimary}>
              {saving ? 'Creating…' : 'Create Campaign'}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

function Stepper({ step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
      {[1, 2, 3].map((n) => (
        <div key={n} style={{
          flex: 1, height: 4, borderRadius: 2,
          background: n <= step ? COLORS.primary : COLORS.border,
        }} />
      ))}
    </div>
  );
}

function VariablesStep({ template, variables, onChange }) {
  if (!template) {
    return <div style={{ color: COLORS.muted }}>Select a template in step 1 first.</div>;
  }
  const count = template.variables_count || 0;
  if (count === 0) {
    return <div style={infoBox}>This template has no variables. Continue to step 3.</div>;
  }
  const positions = Array.from({ length: count }, (_, i) => String(i + 1));
  return (
    <div>
      <div style={{ marginBottom: 12, fontSize: 13, color: COLORS.muted }}>
        Map each <code style={code}>{'{{n}}'}</code> placeholder to a static value or contact field.
      </div>
      {positions.map((p) => (
        <div key={p} style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <span style={{ fontFamily: 'monospace', fontSize: 13, color: COLORS.text }}>{`{{${p}}}`}</span>
          <input
            value={variables[p] || ''}
            onChange={(e) => onChange({ ...variables, [p]: e.target.value })}
            placeholder='e.g. "Hello" or {{contact.name}}'
            style={input}
          />
        </div>
      ))}
      <div style={{ ...infoBox, marginTop: 8 }}>
        Use <code style={code}>{'{{contact.name}}'}</code>, <code style={code}>{'{{contact.phone}}'}</code>,
        or <code style={code}>{'{{contact.custom.<key>}}'}</code> to inject contact fields.
      </div>
    </div>
  );
}

function CampaignDetail({ campaignId, onClose, onChange }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initial load
  if (loading && stats === null) {
    whatsappAPI.campaigns.stats(campaignId)
      .then((res) => setStats(res.data))
      .catch(() => setStats({}))
      .finally(() => setLoading(false));
  }

  return (
    <div style={modalBackdrop} onClick={onClose}>
      <div style={{ ...modalBox, maxWidth: 580 }} onClick={(e) => e.stopPropagation()}>
        <header style={{
          padding: 16, borderBottom: `1px solid ${COLORS.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h3 style={{ margin: 0, fontSize: 16, color: COLORS.text }}>Campaign Stats</h3>
          <button onClick={onClose} style={iconBtn}>×</button>
        </header>
        <div style={{ padding: 16 }}>
          {loading && <Loader2 size={14} className="spin" />}
          {stats && (
            <>
              <KV label="Total"     value={stats.total ?? 0} />
              <KV label="Sent"      value={stats.sent ?? 0} />
              <KV label="Delivered" value={stats.delivered ?? 0} />
              <KV label="Read"      value={stats.read ?? 0} />
              <KV label="Failed"    value={stats.failed ?? 0} />
              <KV label="Progress"  value={`${stats.progress_percent ?? 0}%`} />
              {stats.failed > 0 && (
                <button
                  onClick={async () => {
                    await whatsappAPI.campaigns.retryFailed(campaignId);
                    setStats(null); setLoading(true);
                    onChange?.();
                  }}
                  style={{ ...btnSecondary, marginTop: 12 }}
                >
                  <RefreshCw size={12} /> Retry failed messages
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={fieldLabel}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type={type} style={input} />
    </label>
  );
}
function SelectField({ label, value, onChange, options }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={fieldLabel}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={input}>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </label>
  );
}
function KV({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--surface-sunken)', fontSize: 14 }}>
      <span style={{ color: COLORS.muted }}>{label}</span>
      <span style={{ color: COLORS.text, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

const card = { background: 'var(--surface-card)', border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: 'hidden' };
const th = {
  textAlign: 'left', padding: '10px 14px', fontSize: 11,
  textTransform: 'uppercase', letterSpacing: '0.04em',
  color: COLORS.muted, fontWeight: 600, borderBottom: `1px solid ${COLORS.border}`,
};
const td = { padding: '12px 14px', borderBottom: '1px solid var(--surface-sunken)', color: COLORS.text };
const emptyRow = { padding: 24, textAlign: 'center', color: COLORS.muted };
const badge = { display: 'inline-flex', padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600 };
const progressBar = { width: 120, height: 6, background: 'var(--surface-sunken)', borderRadius: 999, overflow: 'hidden' };
const progressFill = { height: '100%', background: 'linear-gradient(90deg,#00CCF5,#00A8D8)' };
const linkBtn = {
  background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
  color: COLORS.primaryD, fontWeight: 600, fontSize: 13, textAlign: 'left',
};
const input = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: `1px solid ${COLORS.border}`, fontSize: 13, outline: 'none', boxSizing: 'border-box',
};
const fieldLabel = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.04em',
  marginBottom: 4,
};
const code = {
  background: 'var(--surface-sunken)', padding: '0 6px', borderRadius: 4, fontFamily: 'monospace', fontSize: 12,
};
const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '9px 16px', borderRadius: 8, border: 'none',
  background: 'linear-gradient(135deg, #00CCF5, #00A8D8)', color: '#fff',
  fontWeight: 600, fontSize: 13, cursor: 'pointer',
};
const btnSecondary = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`,
  background: 'var(--surface-card)', color: COLORS.text, fontWeight: 600, fontSize: 12, cursor: 'pointer',
};
const iconBtn = {
  background: 'transparent', border: 'none', padding: 4, cursor: 'pointer',
  fontSize: 22, lineHeight: 1, color: COLORS.muted,
};
const errorBox = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '8px 12px', borderRadius: 8,
  background: '#fef2f2', color: COLORS.danger,
  border: '1px solid #fecaca', fontSize: 12,
};
const infoBox = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '10px 12px', borderRadius: 8,
  background: '#eff6ff', color: '#1d4ed8',
  border: '1px solid #bfdbfe', fontSize: 13,
};
const modalBackdrop = {
  position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
};
const modalBox = {
  background: 'var(--surface-card)', borderRadius: 14, width: '100%', maxWidth: 560,
  display: 'flex', flexDirection: 'column',
  boxShadow: '0 24px 60px rgba(0,0,0,0.18)',
  maxHeight: '92vh', overflow: 'auto',
};
