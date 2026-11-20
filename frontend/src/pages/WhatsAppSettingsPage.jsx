/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Copy, Eye, EyeOff, Loader2, RefreshCw, Trash2 } from 'lucide-react';

import PageHeader from '../components/layout/PageHeader';
import { useWhatsAppAccount } from '../hooks/useWhatsApp';
import { whatsappAPI } from '../services/api';

const COLORS = {
  primary: '#00CCF5', primaryD: '#00A8D8',
  border: 'var(--border-default)', text: 'var(--text-primary)', muted: 'var(--text-secondary)',
  success: '#10b981', danger: '#dc2626',
};

// Shown until /whatsapp/providers/ answers (and if it can't be reached).
const FALLBACK_PROVIDERS = [
  {
    key: 'meta_cloud', label: 'Meta WhatsApp Cloud API',
    description: 'Connect directly to Meta with your own WhatsApp Business app. No third-party provider.',
    credential_label: 'Access token',
    credential_help: 'A permanent System User access token with whatsapp_business_messaging and whatsapp_business_management permissions.',
    needs_app_secret: true, needs_base_url: false, auth_header: 'Authorization', auth_scheme: 'Bearer',
  },
  {
    key: 'pinbot', label: 'Pinbot', description: 'Pinbot Partners API v3.',
    credential_label: 'API key', credential_help: 'The WABA API key from your Pinbot dashboard.',
    needs_app_secret: false, needs_base_url: false, auth_header: 'apikey', auth_scheme: '',
  },
  {
    key: 'custom', label: 'Other provider (Cloud API compatible)',
    description: 'Any provider that exposes the WhatsApp Cloud API format. You provide its base URL and how the API key is sent.',
    credential_label: 'API key / token', credential_help: 'The key your provider gave you. Set the header it expects below.',
    needs_app_secret: false, needs_base_url: true, auth_header: 'Authorization', auth_scheme: 'Bearer',
  },
];

const EMPTY_FORM = {
  provider: 'meta_cloud',
  waba_id: '', phone_number_id: '', phone_number: '', display_name: '',
  api_key: '', app_secret: '',
  api_base_url: '', auth_header: 'Authorization', auth_scheme: 'Bearer',
};

const FIELD_LABELS = {
  provider: 'Provider', api_key: 'API key', app_secret: 'App Secret', api_base_url: 'API base URL',
  auth_header: 'Auth header', auth_scheme: 'Auth scheme', waba_id: 'WABA ID',
  phone_number_id: 'Phone Number ID', phone_number: 'Phone Number', display_name: 'Display Name',
};

// DRF answers {field: [messages]} — turn it into readable lines.
export function describeError(e) {
  const data = e?.response?.data;
  if (!data) return e?.message || 'Something went wrong.';
  if (typeof data === 'string') return data;
  if (data.detail) return String(data.detail);
  const lines = Object.entries(data).map(([field, msgs]) => {
    const text = Array.isArray(msgs) ? msgs.join(' ') : String(msgs);
    return FIELD_LABELS[field] ? `${FIELD_LABELS[field]}: ${text}` : text;
  });
  return lines.join('\n') || 'Something went wrong.';
}

export default function WhatsAppSettingsPage() {
  const { account, refetch } = useWhatsAppAccount();

  const [providers, setProviders] = useState(FALLBACK_PROVIDERS);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [rotating, setRotating] = useState(false);

  useEffect(() => {
    let alive = true;
    whatsappAPI.providers()
      .then((res) => { if (alive && res.data?.providers?.length) setProviders(res.data.providers); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Fill the form from the saved account (secrets are never sent back).
  const accountId = account?.id;
  useEffect(() => {
    if (!account) return;
    setForm({
      provider: account.provider || 'pinbot',
      waba_id: account.waba_id || '',
      phone_number_id: account.phone_number_id || '',
      phone_number: account.phone_number || '',
      display_name: account.display_name || '',
      api_key: '', app_secret: '',
      api_base_url: account.api_base_url || '',
      auth_header: account.auth_header || 'Authorization',
      auth_scheme: account.provider === 'custom' ? (account.auth_scheme || '') : 'Bearer',
    });
    // Re-run only when a different or re-saved account arrives, not on every render.
  }, [accountId, account?.updated_at]);   // eslint-disable-line

  const provider = providers.find((p) => p.key === form.provider) || providers[0];
  const isCustom = form.provider === 'custom';
  const providerChanged = !!account && account.provider !== form.provider;
  const urlChanged = !!account && !providerChanged && isCustom
    && form.api_base_url.trim().replace(/\/+$/, '') !== (account.api_base_url || '');
  const mustReenterKey = providerChanged || urlChanged;
  const keepsKey = !!account && account.has_api_key && !mustReenterKey;
  const keepsAppSecret = !!account && account.has_app_secret && !providerChanged;

  const onChange = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  function pickProvider(key) {
    const next = providers.find((p) => p.key === key);
    setForm({
      ...form, provider: key, api_key: '', app_secret: '',
      auth_header: next?.auth_header || 'Authorization',
      auth_scheme: next?.auth_scheme ?? 'Bearer',
    });
    setError(null);
    setTestResult(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setTestResult(null);
    try {
      const payload = {
        provider: form.provider,
        waba_id: form.waba_id.trim(),
        phone_number_id: form.phone_number_id.trim(),
        phone_number: form.phone_number.trim(),
        display_name: form.display_name.trim(),
      };
      if (form.api_key) payload.api_key = form.api_key.trim();
      if (form.app_secret) payload.app_secret = form.app_secret.trim();
      if (isCustom) {
        payload.api_base_url = form.api_base_url.trim();
        payload.auth_header = form.auth_header.trim();
        payload.auth_scheme = form.auth_scheme.trim();
      }
      if (account) {
        await whatsappAPI.account.update(account.id, payload);
      } else {
        await whatsappAPI.account.create(payload);
      }
      await refetch();
      setForm((f) => ({ ...f, api_key: '', app_secret: '' }));
    } catch (e) {
      setError(describeError(e));
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
      setTestResult({ ok: res.data.ok, detail: res.data.detail || '' });
    } catch (e) {
      setTestResult({ ok: false, detail: e.response?.data?.detail || e.message });
    } finally {
      setTesting(false);
    }
  }

  async function copy(what, value) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied(''), 1500);
    } catch {}
  }

  async function rotateToken() {
    if (!account) return;
    if (!window.confirm('Create a new verify token? The current one stops working immediately, so you must update it in your provider\'s webhook settings.')) return;
    setRotating(true);
    try {
      await whatsappAPI.account.rotateWebhookToken(account.id);
      await refetch();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setRotating(false);
    }
  }

  async function disconnect() {
    if (!account) return;
    if (!window.confirm('Disconnect WhatsApp? Your contacts and templates will remain, but no messages can be sent or received until reconnected.')) return;
    await whatsappAPI.account.delete(account.id);
    await refetch();
    setForm(EMPTY_FORM);
    setTestResult(null);
  }

  return (
    <div style={{ paddingBottom: 32 }}>
      <PageHeader
        title="WhatsApp Settings"
        subtitle="Connect the WhatsApp Business provider you use, with your own credentials"
      />

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>

        {/* Provider + credentials */}
        <section style={card}>
          <header style={cardHeader}>
            <h3 style={cardTitle}>WhatsApp provider</h3>
            {account && (
              <span style={{ ...pill, background: '#dcfce7', color: '#15803d' }}>
                <CheckCircle2 size={12} /> Connected{account.provider_label ? ` · ${account.provider_label}` : ''}
              </span>
            )}
          </header>

          <div style={cardBody}>
            <div role="radiogroup" aria-label="WhatsApp provider" style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
              {providers.map((p) => {
                const active = p.key === form.provider;
                return (
                  <label key={p.key} style={{ ...providerCard, borderColor: active ? COLORS.primary : COLORS.border, background: active ? 'rgba(0,204,245,0.06)' : 'transparent' }}>
                    <input
                      type="radio" name="wa-provider" value={p.key} checked={active}
                      onChange={() => pickProvider(p.key)} style={{ marginTop: 3 }}
                    />
                    <span>
                      <span style={{ display: 'block', fontWeight: 600, fontSize: 14, color: COLORS.text }}>{p.label}</span>
                      <span style={{ display: 'block', fontSize: 12, color: COLORS.muted, marginTop: 2 }}>{p.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>

            {mustReenterKey && (
              <div style={{ ...errorBox, marginTop: 0, marginBottom: 12, background: '#fffbeb', color: '#92400e', borderColor: '#fde68a' }}>
                <AlertCircle size={14} />
                <span>
                  {providerChanged
                    ? `Switching provider: enter the ${provider.credential_label.toLowerCase()} for ${provider.label}. The saved key is never sent to a different provider.`
                    : 'The base URL changed: enter the API key again. The saved key is never sent to a different address.'}
                </span>
              </div>
            )}

            {isCustom && (
              <>
                <Field
                  label="API base URL" value={form.api_base_url} onChange={onChange('api_base_url')}
                  placeholder="https://api.your-provider.com/v1"
                  helper="Must be https. Messages are sent to {base URL}/{phone number ID}/messages."
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field
                    label="Auth header" value={form.auth_header} onChange={onChange('auth_header')}
                    placeholder="Authorization" helper="The header your provider reads the key from."
                  />
                  <Field
                    label="Auth scheme" value={form.auth_scheme} onChange={onChange('auth_scheme')}
                    placeholder="Bearer" helper="Word sent before the key. Leave blank to send the key alone."
                  />
                </div>
              </>
            )}

            <Field label="WABA ID" value={form.waba_id} onChange={onChange('waba_id')} placeholder="e.g. 123456789012345" />
            <Field label="Phone Number ID" value={form.phone_number_id} onChange={onChange('phone_number_id')} placeholder="e.g. 987654321098765" />
            <Field label="Phone Number" value={form.phone_number} onChange={onChange('phone_number')} placeholder="+91XXXXXXXXXX" />
            <Field label="Display Name" value={form.display_name} onChange={onChange('display_name')} placeholder="My Brand" />
            <Field
              label={provider.credential_label}
              value={form.api_key}
              onChange={onChange('api_key')}
              placeholder={keepsKey ? 'Leave blank to keep the saved one' : provider.credential_label}
              type="password"
              helper={keepsKey ? 'Saved and encrypted. For security it is never shown again.' : provider.credential_help}
            />
            {(provider.needs_app_secret || isCustom) && (
              <Field
                label={provider.needs_app_secret ? 'App Secret' : 'Webhook signing secret (optional)'}
                value={form.app_secret}
                onChange={onChange('app_secret')}
                placeholder={keepsAppSecret ? 'Leave blank to keep the saved one' : (provider.needs_app_secret ? 'Meta app → App settings → Basic' : 'Only if your provider signs webhooks')}
                type="password"
                helper={provider.needs_app_secret
                  ? 'Used to check the signature on every incoming webhook, so only Meta can deliver messages to this workspace.'
                  : 'If set, incoming webhooks must carry a valid X-Hub-Signature-256 made with this secret.'}
              />
            )}

            {error && (
              <div style={errorBox} role="alert">
                <AlertCircle size={14} style={{ flexShrink: 0 }} /> <span style={{ whiteSpace: 'pre-line' }}>{String(error)}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <button onClick={save} disabled={saving} style={btnPrimary}>
                {saving ? <Loader2 size={14} className="spin" /> : null}
                {saving ? 'Saving…' : (account ? 'Update' : 'Connect')}
              </button>
              {account && (
                <>
                  <button onClick={test} disabled={testing || mustReenterKey} style={btnSecondary} title={mustReenterKey ? 'Save your changes first' : undefined}>
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

        {/* Webhook */}
        <section style={card}>
          <header style={cardHeader}>
            <h3 style={cardTitle}>Webhook</h3>
          </header>
          <div style={cardBody}>
            {!account ? (
              <p style={{ margin: 0, color: COLORS.muted, fontSize: 13 }}>
                Connect an account first. You will then get a webhook URL and verify token that belong to this workspace only.
              </p>
            ) : (
              <>
                <p style={{ margin: '0 0 12px', color: COLORS.muted, fontSize: 13 }}>
                  {account.provider === 'meta_cloud'
                    ? 'In your Meta app, open WhatsApp → Configuration, paste the Callback URL and Verify token below, then subscribe to the "messages" field.'
                    : 'Set this URL as the webhook in your provider\'s dashboard.'}
                  {' '}
                  {account.webhook_auth === 'signature'
                    ? 'Each delivery is checked against your App Secret signature.'
                    : (<>Add the header <code style={code}>X-Webhook-Secret</code> with the verify token as its value — deliveries without it are rejected.</>)}
                </p>

                <span style={miniLabel}>Callback URL</span>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <input value={account.webhook_url || ''} readOnly aria-label="Callback URL" style={{ ...input, fontFamily: 'monospace', fontSize: 12 }} />
                  <button onClick={() => copy('url', account.webhook_url || '')} style={btnSecondary}>
                    <Copy size={14} /> {copied === 'url' ? 'Copied' : 'Copy'}
                  </button>
                </div>

                <span style={miniLabel}>Verify token</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    value={account.webhook_verify_token || ''} readOnly aria-label="Verify token"
                    type={showToken ? 'text' : 'password'}
                    style={{ ...input, fontFamily: 'monospace', fontSize: 12, flex: '1 1 200px', width: 'auto' }}
                  />
                  <button onClick={() => setShowToken(!showToken)} style={btnSecondary} aria-label={showToken ? 'Hide verify token' : 'Show verify token'}>
                    {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button onClick={() => copy('token', account.webhook_verify_token || '')} style={btnSecondary}>
                    <Copy size={14} /> {copied === 'token' ? 'Copied' : 'Copy'}
                  </button>
                  <button onClick={rotateToken} disabled={rotating} style={btnSecondary}>
                    <RefreshCw size={14} className={rotating ? 'spin' : undefined} /> New token
                  </button>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Account status */}
        {account && (
          <section style={card}>
            <header style={cardHeader}>
              <h3 style={cardTitle}>Account status</h3>
            </header>
            <div style={cardBody}>
              <KV label="Provider" value={account.provider_label || account.provider} />
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
      <span style={miniLabel}>{label}</span>
      <input value={value} onChange={onChange} placeholder={placeholder} type={type} style={input} autoComplete={type === 'password' ? 'new-password' : 'off'} />
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
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
};
const cardTitle = { margin: 0, fontSize: 14, fontWeight: 700, color: COLORS.text };
const cardBody = { padding: 16 };
const miniLabel = {
  display: 'block', fontSize: 12, fontWeight: 600, color: COLORS.muted,
  textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2,
};
const providerCard = {
  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
  borderRadius: 10, border: `1px solid ${COLORS.border}`, cursor: 'pointer',
};
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
