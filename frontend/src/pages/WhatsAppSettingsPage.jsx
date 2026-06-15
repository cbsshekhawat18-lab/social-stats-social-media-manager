/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useState } from 'react';
import { CheckCircle2, AlertCircle, Copy, Loader2, Trash2 } from 'lucide-react';

import PageHeader from '../components/layout/PageHeader';
import { useWhatsAppAccount } from '../hooks/useWhatsApp';
import { whatsappAPI } from '../services/api';

const COLORS = {
  primary: '#00CCF5', primaryD: '#00A8D8',
  border: 'var(--border-default)', text: 'var(--text-primary)', muted: 'var(--text-secondary)',
  success: '#10b981', danger: '#dc2626',
};

const WEBHOOK_URL = `${process.env.REACT_APP_API_URL || 'http://localhost:8000/api'}/whatsapp/webhook/`;

export default function WhatsAppSettingsPage() {
  const { account, loading, refetch } = useWhatsAppAccount();

  const [form, setForm] = useState({
    waba_id: '', phone_number_id: '', phone_number: '', display_name: '', api_key: '',
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  // Pre-fill form once account loads
  if (account && form.waba_id === '' && form.phone_number_id === '') {
    setForm({
      waba_id: account.waba_id || '',
      phone_number_id: account.phone_number_id || '',
      phone_number: account.phone_number || '',
      display_name: account.display_name || '',
      api_key: '',
    });
  }

  const onChange = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form };
      if (!payload.api_key) delete payload.api_key;
      if (account) {
        await whatsappAPI.account.update(account.id, payload);
      } else {
        await whatsappAPI.account.create(payload);
      }
      await refetch();
      setForm({ ...form, api_key: '' });
    } catch (e) {
      setError(e.response?.data?.detail || JSON.stringify(e.response?.data) || e.message);
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    if (!account) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await whatsappAPI.account.testConnection(account.id);
      setTestResult({ ok: res.data.ok, detail: res.data.detail || JSON.stringify(res.data.details || {}) });
    } catch (e) {
      setTestResult({ ok: false, detail: e.response?.data?.detail || e.message });
    } finally {
      setTesting(false);
    }
  }

  async function copyWebhook() {
    try {
      await navigator.clipboard.writeText(WEBHOOK_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  async function disconnect() {
    if (!account) return;
    if (!window.confirm('Disconnect WhatsApp? Your contacts and templates will remain, but no messages can be sent or received until reconnected.')) return;
    await whatsappAPI.account.delete(account.id);
    await refetch();
    setForm({ waba_id: '', phone_number_id: '', phone_number: '', display_name: '', api_key: '' });
  }

  return (
    <div style={{ paddingBottom: 32 }}>
      <PageHeader
        title="WhatsApp Settings"
        subtitle="Connect your Pinbot Partners API account"
      />

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>

        {/* Account form */}
        <section style={card}>
          <header style={cardHeader}>
            <h3 style={cardTitle}>Pinbot WABA</h3>
            {account && (
              <span style={{ ...pill, background: '#dcfce7', color: '#15803d' }}>
                <CheckCircle2 size={12} /> Connected
              </span>
            )}
          </header>

          <div style={cardBody}>
            <Field label="WABA ID" value={form.waba_id} onChange={onChange('waba_id')} placeholder="e.g. 123456789012345" />
            <Field label="Phone Number ID" value={form.phone_number_id} onChange={onChange('phone_number_id')} placeholder="e.g. 987654321098765" />
            <Field label="Phone Number" value={form.phone_number} onChange={onChange('phone_number')} placeholder="+91XXXXXXXXXX" />
            <Field label="Display Name" value={form.display_name} onChange={onChange('display_name')} placeholder="My Brand" />
            <Field
              label={account ? 'API Key (leave blank to keep current)' : 'API Key'}
              value={form.api_key}
              onChange={onChange('api_key')}
              placeholder="Pinbot apikey"
              type="password"
              helper={account ? 'For security, the existing api_key is never shown.' : null}
            />

            {error && (
              <div style={errorBox}>
                <AlertCircle size={14} /> <span>{String(error)}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <button onClick={save} disabled={saving} style={btnPrimary}>
                {saving ? <Loader2 size={14} className="spin" /> : null}
                {saving ? 'Saving…' : (account ? 'Update' : 'Connect')}
              </button>
              {account && (
                <>
                  <button onClick={test} disabled={testing} style={btnSecondary}>
                    {testing ? <Loader2 size={14} className="spin" /> : null}
                    {testing ? 'Testing…' : 'Test Connection'}
                  </button>
                  <button onClick={disconnect} style={{ ...btnSecondary, color: COLORS.danger, borderColor: '#fecaca' }}>
                    <Trash2 size={14} /> Disconnect
                  </button>
                </>
              )}
            </div>

            {testResult && (
              <div style={{
                ...errorBox,
                background: testResult.ok ? '#f0fdf4' : '#fef2f2',
                color:      testResult.ok ? '#15803d' : '#b91c1c',
                borderColor: testResult.ok ? '#bbf7d0' : '#fecaca',
              }}>
                {testResult.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                <span>{testResult.ok ? 'Connection OK' : `Failed: ${testResult.detail}`}</span>
              </div>
            )}
          </div>
        </section>

        {/* Webhook URL */}
        <section style={card}>
          <header style={cardHeader}>
            <h3 style={cardTitle}>Webhook URL</h3>
          </header>
          <div style={cardBody}>
            <p style={{ margin: '0 0 12px', color: COLORS.muted, fontSize: 13 }}>
              Configure this URL in your Pinbot dashboard. Set the secret header
              <code style={code}>X-Webhook-Secret</code> to your <code style={code}>WHATSAPP_WEBHOOK_SECRET</code>.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={WEBHOOK_URL}
                readOnly
                style={{ ...input, fontFamily: 'monospace', fontSize: 12 }}
              />
              <button onClick={copyWebhook} style={btnSecondary}>
                <Copy size={14} /> {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </section>

        {/* Account status */}
        {account && (
          <section style={card}>
            <header style={cardHeader}>
              <h3 style={cardTitle}>Account status</h3>
            </header>
            <div style={cardBody}>
              <KV label="Quality rating" value={account.quality_rating} />
              <KV label="Messaging tier" value={account.messaging_tier} />
              <KV label="Last synced" value={account.last_synced_at ? new Date(account.last_synced_at).toLocaleString() : 'never'} />
              <button
                onClick={async () => { await whatsappAPI.account.syncStatus(account.id); refetch(); }}
                style={{ ...btnSecondary, marginTop: 8 }}
              >
                Sync status
              </button>
            </div>
          </section>
        )}
      </div>

      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', helper }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
      <input value={value} onChange={onChange} placeholder={placeholder} type={type} style={input} />
      {helper && <span style={{ fontSize: 11, color: COLORS.muted }}>{helper}</span>}
    </label>
  );
}

function KV({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
      <span style={{ color: COLORS.muted }}>{label}</span>
      <span style={{ fontWeight: 600, color: COLORS.text }}>{value}</span>
    </div>
  );
}

const card = { background: 'var(--surface-card)', border: `1px solid ${COLORS.border}`, borderRadius: 12 };
const cardHeader = {
  padding: '14px 16px', borderBottom: `1px solid ${COLORS.border}`,
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};
const cardTitle = { margin: 0, fontSize: 14, fontWeight: 700, color: COLORS.text };
const cardBody = { padding: 16 };
const input = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: `1px solid ${COLORS.border}`, fontSize: 14, color: COLORS.text,
  outline: 'none', boxSizing: 'border-box',
};
const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '10px 18px', borderRadius: 10, border: 'none',
  background: 'linear-gradient(135deg, #00CCF5, #00A8D8)', color: '#fff',
  fontWeight: 600, fontSize: 13, cursor: 'pointer',
};
const btnSecondary = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '9px 14px', borderRadius: 8, border: `1px solid ${COLORS.border}`,
  background: 'var(--surface-card)', color: COLORS.text, fontWeight: 600, fontSize: 13, cursor: 'pointer',
};
const errorBox = {
  display: 'flex', alignItems: 'center', gap: 8,
  marginTop: 10, padding: '8px 12px', borderRadius: 8,
  background: '#fef2f2', color: COLORS.danger,
  border: '1px solid #fecaca', fontSize: 12,
};
const pill = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
};
const code = {
  background: 'var(--surface-sunken)', padding: '1px 6px', borderRadius: 4,
  fontSize: 12, fontFamily: 'monospace',
};
