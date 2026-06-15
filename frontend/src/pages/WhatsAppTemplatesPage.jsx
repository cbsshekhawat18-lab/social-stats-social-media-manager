/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useState, useMemo } from 'react';
import { Plus, RefreshCw, Trash2, FileType, Loader2, AlertCircle, Send } from 'lucide-react';

import PageHeader from '../components/layout/PageHeader';
import { useWhatsAppTemplates } from '../hooks/useWhatsApp';
import { whatsappAPI } from '../services/api';
import { safeHtml } from '../utils/sanitize';

const COLORS = {
  primary: '#00CCF5', primaryD: '#00A8D8',
  border: 'var(--border-default)', text: 'var(--text-primary)', muted: 'var(--text-secondary)',
  success: '#10b981', danger: '#dc2626',
};

const STATUS_BADGE = {
  draft:    { bg: 'var(--surface-sunken)', color: 'var(--text-secondary)' },
  pending:  { bg: '#fef3c7', color: '#a16207' },
  approved: { bg: '#dcfce7', color: '#15803d' },
  rejected: { bg: '#fee2e2', color: '#b91c1c' },
  paused:   { bg: '#fef3c7', color: '#a16207' },
};

export default function WhatsAppTemplatesPage() {
  const { data, refetch, loading } = useWhatsAppTemplates();
  const [showDrawer, setShowDrawer] = useState(false);

  return (
    <div style={{ paddingBottom: 32 }}>
      <PageHeader
        title="Templates"
        subtitle={`${data?.length || 0} templates`}
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => refetch()} style={btnSecondary}><RefreshCw size={14} /> Refresh</button>
            <button onClick={() => setShowDrawer(true)} style={btnPrimary}><Plus size={14} /> New Template</button>
          </div>
        }
      />

      <div style={{ padding: '0 16px' }}>
        {loading && <div style={emptyState}><Loader2 size={14} className="spin" /> Loading…</div>}
        {!loading && (data || []).length === 0 && (
          <div style={emptyState}>
            <FileType size={32} color={COLORS.muted} style={{ marginBottom: 8 }} />
            <div style={{ fontWeight: 600, color: COLORS.text }}>No templates yet</div>
            <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 12 }}>
              Templates are required for outbound messages outside the 24h window.
            </div>
            <button onClick={() => setShowDrawer(true)} style={btnPrimary}>
              <Plus size={14} /> Create your first template
            </button>
          </div>
        )}

        <div style={grid}>
          {(data || []).map((t) => (
            <TemplateCard key={t.id} t={t} onChange={refetch} />
          ))}
        </div>
      </div>

      {showDrawer && (
        <CreateTemplateDrawer
          onClose={() => setShowDrawer(false)}
          onCreated={() => { setShowDrawer(false); refetch(); }}
        />
      )}

      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function TemplateCard({ t, onChange }) {
  const status = STATUS_BADGE[t.status] || STATUS_BADGE.draft;
  return (
    <div style={card}>
      <div style={{ padding: 14, borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: COLORS.text, wordBreak: 'break-all' }}>{t.name}</div>
            <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>
              {t.category} · {t.language} · {t.template_type}
            </div>
          </div>
          <span style={{ ...badge, background: status.bg, color: status.color }}>{t.status}</span>
        </div>
      </div>
      <div style={{ padding: 14 }}>
        <div style={preview}
             dangerouslySetInnerHTML={safeHtml(t.preview)} />
        {t.footer && <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 6 }}>{t.footer}</div>}
        {t.rejection_reason && (
          <div style={{ ...errorBox, marginTop: 10 }}>
            <AlertCircle size={14} /> {t.rejection_reason}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
          {t.status !== 'approved' && (
            <button
              onClick={async () => { await whatsappAPI.templates.submit(t.id); onChange(); }}
              style={btnSecondary}
            >
              <Send size={12} /> Resubmit
            </button>
          )}
          <button
            onClick={async () => { await whatsappAPI.templates.sync(t.id); onChange(); }}
            style={btnSecondary}
          >
            <RefreshCw size={12} /> Sync
          </button>
          <button
            onClick={async () => {
              if (window.confirm('Delete this template?')) {
                await whatsappAPI.templates.delete(t.id);
                onChange();
              }
            }}
            style={{ ...btnSecondary, color: COLORS.danger, borderColor: '#fecaca' }}
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateTemplateDrawer({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', category: 'utility', language: 'en_US',
    template_type: 'text', body: '', footer: '',
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const renderedPreview = useMemo(() => {
    let body = form.body || '';
    body = body.replace(/\{\{(\d+)\}\}/g, (_, n) => `[Sample ${n}]`);
    return body;
  }, [form.body]);

  function setName(v) {
    // Slug-like: lowercase, underscores
    const slug = v.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
    setForm({ ...form, name: slug });
  }

  async function save() {
    if (!form.name.trim() || !form.body.trim()) {
      setError('Name and body are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await whatsappAPI.templates.create(form);
      onCreated();
    } catch (e) {
      setError(e.response?.data?.detail || JSON.stringify(e.response?.data) || e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={drawerBackdrop} onClick={onClose}>
      <div style={drawerBox} onClick={(e) => e.stopPropagation()}>
        <header style={{
          padding: 16, borderBottom: `1px solid ${COLORS.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h3 style={{ margin: 0, fontSize: 16, color: COLORS.text }}>New Template</h3>
          <button onClick={onClose} style={iconBtn}>×</button>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 16, padding: 16, overflow: 'auto', flex: 1 }}>
          {/* Form */}
          <div>
            <Field label="Name (slug)" value={form.name}
                   onChange={setName} placeholder="order_confirmation"
                   helper="Lowercase, no spaces" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <SelectField label="Category" value={form.category}
                           onChange={(v) => setForm({ ...form, category: v })}
                           options={['utility', 'marketing', 'authentication']} />
              <SelectField label="Language" value={form.language}
                           onChange={(v) => setForm({ ...form, language: v })}
                           options={['en_US', 'en', 'en_GB', 'es', 'pt_BR', 'fr', 'de', 'hi', 'ar']} />
              <SelectField label="Type" value={form.template_type}
                           onChange={(v) => setForm({ ...form, template_type: v })}
                           options={['text', 'image', 'video', 'document']} />
            </div>

            <label style={{ display: 'block', marginTop: 8 }}>
              <span style={fieldLabel}>Body (use <code style={code}>{'{{1}}'}</code> for variables)</span>
              <textarea
                rows={8}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Hi {{1}}, your order #{{2}} is on the way!"
                style={{ ...input, fontFamily: 'monospace' }}
              />
            </label>

            <Field label="Footer (optional)" value={form.footer}
                   onChange={(v) => setForm({ ...form, footer: v })}
                   placeholder="Reply STOP to unsubscribe" />

            {error && <div style={{ ...errorBox, marginTop: 10 }}><AlertCircle size={14} /> {String(error)}</div>}
          </div>

          {/* Live preview */}
          <div style={{ position: 'sticky', top: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted, marginBottom: 8, textTransform: 'uppercase' }}>
              Preview
            </div>
            <div style={whatsappBubble}>
              <div style={{ whiteSpace: 'pre-wrap' }}>{renderedPreview || 'Start typing your template body…'}</div>
              {form.footer && <div style={{ marginTop: 8, fontSize: 11, color: '#667781' }}>{form.footer}</div>}
            </div>
          </div>
        </div>

        <footer style={{
          padding: 16, borderTop: `1px solid ${COLORS.border}`,
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
          <button onClick={save} disabled={saving} style={btnPrimary}>
            {saving ? 'Submitting…' : 'Submit for Approval'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, helper }) {
  return (
    <label style={{ display: 'block', marginBottom: 10 }}>
      <span style={fieldLabel}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={input} />
      {helper && <span style={{ fontSize: 11, color: COLORS.muted }}>{helper}</span>}
    </label>
  );
}
function SelectField({ label, value, onChange, options }) {
  return (
    <label style={{ display: 'block', marginBottom: 10 }}>
      <span style={fieldLabel}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={input}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

const card = { background: 'var(--surface-card)', border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: 'hidden' };
const grid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: 12,
};
const preview = {
  whiteSpace: 'pre-wrap', fontSize: 13, color: COLORS.text,
  background: 'var(--surface-sunken)', padding: 12, borderRadius: 8,
  border: `1px solid ${COLORS.border}`, minHeight: 60,
};
const emptyState = {
  padding: 40, textAlign: 'center', background: 'var(--surface-card)',
  border: `1px solid ${COLORS.border}`, borderRadius: 12,
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
};
const badge = { display: 'inline-flex', padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600 };
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
  background: 'var(--surface-sunken)', padding: '0px 6px', borderRadius: 4,
  fontSize: 12, fontFamily: 'monospace',
};
const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 8, border: 'none',
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
const drawerBackdrop = {
  position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
  display: 'flex', justifyContent: 'flex-end', zIndex: 100,
};
const drawerBox = {
  background: 'var(--surface-card)', width: '100%', maxWidth: 920, height: '100%',
  display: 'flex', flexDirection: 'column',
  boxShadow: '-12px 0 40px rgba(0,0,0,0.15)',
};
const whatsappBubble = {
  background: '#dcf8c6', borderRadius: 12,
  padding: 12, fontSize: 13, color: 'var(--text-primary)',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};
