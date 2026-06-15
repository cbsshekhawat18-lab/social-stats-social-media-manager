/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * TriggerConfigModal — opens when the user clicks Publish.
 *
 * Renders a trigger-type-specific config form (CTWA / keyword / first_message
 * / referral_link / button_reply / manual), saves the patched flow via
 * botAPI.patch, then calls botAPI.publish. The editor uses the returned
 * is_active flag to flip its UI.
 */
import { useState } from 'react';
import { X, Plus, Sparkles, ArrowRight, AlertTriangle } from 'lucide-react';

import { botAPI } from '../../services/api';
import toast from '../ui/toast';
import MetaAdsPicker from './MetaAdsPicker';

const TRIGGER_TYPES = [
  { value: 'ctwa_ad',       label: 'Click-to-WhatsApp ad',  desc: 'Triggered when someone clicks a Meta CTWA ad.' },
  { value: 'keyword',       label: 'Keyword in message',     desc: 'Triggered when an inbound message matches a keyword.' },
  { value: 'first_message', label: 'First message ever',     desc: 'Runs once for any new contact.' },
  { value: 'referral_link', label: 'WhatsApp link referral', desc: 'Triggered when wa.me link includes a known referral code.' },
  { value: 'button_reply',  label: 'Button / list reply',    desc: 'Triggered by a specific interactive-message reply id.' },
  { value: 'manual',        label: 'Manual',                 desc: 'No automatic trigger. Use the test endpoint or jump_to_flow.' },
];

export default function TriggerConfigModal({ flow, onClose, onPublished }) {
  const [triggerType, setTriggerType]   = useState(flow.trigger_type || 'ctwa_ad');
  const [config,      setConfig]        = useState(flow.trigger_config || {});
  const [busy,        setBusy]          = useState(false);
  const [validation,  setValidation]    = useState(null);

  async function go() {
    setBusy(true); setValidation(null);
    try {
      // 1. Save trigger config
      await botAPI.patch(flow.id, {
        trigger_type: triggerType,
        trigger_config: config,
      });
      // 2. Publish (server validates, returns 400 with issues on failure)
      const r = await botAPI.publish(flow.id);
      toast.success('Flow published');
      onPublished?.(r.data);
    } catch (e) {
      const data = e?.response?.data || {};
      if (data.issues) {
        setValidation({ ok: false, issues: data.issues });
      } else {
        toast.error(data.error || 'Could not publish');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={backdrop} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modal}>
        <header style={headerStyle}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--brand-primary-hover)' }}>
              Publish flow
            </div>
            <h2 style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 700 }}>
              {flow.name}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={iconBtn}><X size={14} /></button>
        </header>

        <div style={{ padding: '0 20px 18px', flex: 1, overflowY: 'auto' }}>
          {/* Trigger type picker */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, marginBottom: 18 }}>
            {TRIGGER_TYPES.map((t) => {
              const selected = triggerType === t.value;
              return (
                <button key={t.value} type="button" onClick={() => setTriggerType(t.value)}
                        style={{
                          padding: 12, textAlign: 'left',
                          background: selected ? 'var(--brand-primary-soft)' : 'var(--surface-card)',
                          border: `1px solid ${selected ? 'var(--brand-primary)' : 'var(--border-subtle)'}`,
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {t.label}
                  </div>
                  <div style={{ marginTop: 2, fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
                    {t.desc}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Trigger-specific config */}
          {triggerType === 'ctwa_ad' && (
            <MetaAdsPicker value={config} onChange={setConfig} />
          )}

          {triggerType === 'keyword' && (
            <KeywordConfig value={config} onChange={setConfig} />
          )}

          {triggerType === 'referral_link' && (
            <ReferralLinkConfig value={config} onChange={setConfig} />
          )}

          {triggerType === 'button_reply' && (
            <ButtonReplyConfig value={config} onChange={setConfig} />
          )}

          {(triggerType === 'first_message' || triggerType === 'manual') && (
            <Hint>
              No additional config needed. {triggerType === 'first_message'
                ? 'This flow will run for every new contact who has never had a conversation with you before.'
                : 'You\'ll need to use the test endpoint or jump_to_flow to enter this flow.'}
            </Hint>
          )}

          {validation && !validation.ok && (
            <div style={errBox}>
              <AlertTriangle size={16} />
              <div>
                <strong>Validation failed</strong>
                <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 12 }}>
                  {validation.issues.map((iss, i) => <li key={i}>{iss}</li>)}
                </ul>
              </div>
            </div>
          )}
        </div>

        <footer style={footerStyle}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            <Sparkles size={11} style={{ verticalAlign: '-1px', marginRight: 4 }} />
            We'll re-validate before going live.
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose} style={btnGhost}>Cancel</button>
            <button type="button" onClick={go} disabled={busy} style={btnPrimary}>
              {busy ? 'Publishing…' : <>Publish <ArrowRight size={13} /></>}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Per-trigger config widgets
// ─────────────────────────────────────────────────────────
function KeywordConfig({ value, onChange }) {
  const keywords = value?.keywords || [];
  const [draft, setDraft] = useState('');

  function add() {
    const v = draft.trim();
    if (!v) return;
    onChange({ ...value, keywords: [...keywords, v], match_type: value?.match_type || 'contains' });
    setDraft('');
  }
  function remove(i) {
    onChange({ ...value, keywords: keywords.filter((_, idx) => idx !== i) });
  }

  return (
    <>
      <Field label="Keywords">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          {keywords.map((k, i) => (
            <span key={i} style={kwChip}>
              {k}
              <button type="button" onClick={() => remove(i)} aria-label={`Remove ${k}`} style={chipRemove}>
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)}
                 onKeyDown={(e) => { if (e.key === 'Enter') { add(); e.preventDefault(); } }}
                 placeholder="hi, hello, interested"
                 style={inputStyle} />
          <button type="button" onClick={add} style={addBtn}>
            <Plus size={12} /> Add
          </button>
        </div>
      </Field>
      <Field label="Match type">
        <select value={value?.match_type || 'contains'}
                onChange={(e) => onChange({ ...value, match_type: e.target.value })}
                style={inputStyle}>
          <option value="exact">Exact match (whole message equals one of the keywords)</option>
          <option value="contains">Contains (any keyword appears anywhere)</option>
          <option value="regex">Regex (each keyword treated as a pattern)</option>
        </select>
      </Field>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
        <input type="checkbox" checked={!!value?.case_sensitive}
               onChange={(e) => onChange({ ...value, case_sensitive: e.target.checked })} />
        Case-sensitive
      </label>
    </>
  );
}

function ReferralLinkConfig({ value, onChange }) {
  const codes = value?.referral_codes || [];
  const [draft, setDraft] = useState('');
  return (
    <Field label="Referral codes">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
        {codes.map((c, i) => (
          <span key={i} style={kwChip}>
            {c}
            <button type="button" aria-label={`Remove ${c}`}
                    onClick={() => onChange({ ...value, referral_codes: codes.filter((_, idx) => idx !== i) })}
                    style={chipRemove}>
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)}
               onKeyDown={(e) => {
                 if (e.key === 'Enter' && draft.trim()) {
                   onChange({ ...value, referral_codes: [...codes, draft.trim()] });
                   setDraft('');
                   e.preventDefault();
                 }
               }}
               placeholder="LP_REAL_ESTATE_2024"
               style={inputStyle} />
      </div>
      <p style={{ marginTop: 6, fontSize: 12, color: 'var(--text-tertiary)' }}>
        Use these codes in your <code>wa.me/&lt;number&gt;?text=…</code> tracking URLs. The bot triggers when an inbound message carries the referral code.
      </p>
    </Field>
  );
}

function ButtonReplyConfig({ value, onChange }) {
  const payloads = value?.button_payloads || [];
  const [draft, setDraft] = useState('');
  return (
    <Field label="Button / list reply ids that trigger this flow">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
        {payloads.map((p, i) => (
          <span key={i} style={kwChip}>
            {p}
            <button type="button" aria-label={`Remove ${p}`}
                    onClick={() => onChange({ ...value, button_payloads: payloads.filter((_, idx) => idx !== i) })}
                    style={chipRemove}>
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <input value={draft} onChange={(e) => setDraft(e.target.value)}
             onKeyDown={(e) => {
               if (e.key === 'Enter' && draft.trim()) {
                 onChange({ ...value, button_payloads: [...payloads, draft.trim()] });
                 setDraft('');
                 e.preventDefault();
               }
             }}
             placeholder="BUY_NOW, BOOK_DEMO"
             style={inputStyle} />
    </Field>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{
        display: 'block', fontSize: 11, fontWeight: 600,
        letterSpacing: '0.04em', textTransform: 'uppercase',
        color: 'var(--text-tertiary)', marginBottom: 4,
      }}>{label}</label>
      {children}
    </div>
  );
}

function Hint({ children }) {
  return (
    <p style={{
      margin: 0, padding: 12, fontSize: 13,
      color: 'var(--text-secondary)', lineHeight: 1.55,
      background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)',
    }}>{children}</p>
  );
}

const backdrop = {
  position: 'fixed', inset: 0, zIndex: 1200,
  background: 'rgba(10,14,20,0.50)',
  backdropFilter: 'blur(2px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 20,
};

const modal = {
  width: '100%', maxWidth: 640, maxHeight: '90vh',
  display: 'flex', flexDirection: 'column',
  background: 'var(--surface-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-xl)',
  overflow: 'hidden',
};

const headerStyle = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '14px 20px 8px',
};

const footerStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '14px 20px',
  background: 'var(--surface-card)',
  borderTop: '1px solid var(--border-subtle)',
};

const inputStyle = {
  width: '100%', padding: '8px 10px',
  background: 'var(--surface-sunken)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 13, color: 'var(--text-primary)',
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
};

const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px',
  background: 'var(--brand-primary)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius-md)',
  fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
};
const btnGhost = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 12px',
  background: 'transparent', color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
  fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
};
const iconBtn = {
  width: 28, height: 28, padding: 0,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent', color: 'var(--text-tertiary)',
  border: 'none', borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
};

const addBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '8px 12px',
  background: 'var(--brand-primary)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius-sm)',
  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
};

const kwChip = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '3px 4px 3px 10px',
  background: 'var(--brand-primary-soft)', color: 'var(--brand-primary-hover)',
  border: '1px solid var(--brand-primary-glow)',
  borderRadius: 'var(--radius-pill)',
  fontSize: 12, fontWeight: 500,
};

const chipRemove = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 16, height: 16, padding: 0, marginLeft: 2,
  background: 'transparent', color: 'inherit',
  border: 'none', borderRadius: 8, cursor: 'pointer',
};

const errBox = {
  marginTop: 14, padding: 12,
  display: 'flex', gap: 10, alignItems: 'flex-start',
  background: 'var(--danger-bg)', color: 'var(--danger)',
  border: '1px solid var(--danger)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 13,
};
