/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * SendManageRequestModal — agency-side wizard for inviting an end-user
 * to be managed.
 *
 * Steps:
 * 1. Target — email + (optional) phone
 * 2. Permissions — granular matrix grouped by category
 * 3. Pitch — message + optional pricing/services
 * 4. Review — final preview + send
 *
 * Permissions default to `meta.default` from AGENCY_CLIENT_PERMISSIONS,
 * which the public invite endpoint surfaces. We hardcode the catalog here
 * to match the backend; a future stage can fetch it dynamically.
 */
import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Send, X, Check } from 'lucide-react';

import { manageRequestAPI } from '../../services/api';
import toast from '../ui/toast';

// Matches backend AGENCY_CLIENT_PERMISSIONS (). Order = display order.
const PERMISSIONS = [
  // read
  { key: 'view_analytics',   label: 'View Analytics',           cat: 'Read',       def: true,  risk: 'low' },
  { key: 'view_posts',       label: 'View Posts',                cat: 'Read',       def: true,  risk: 'low' },
  { key: 'view_inbox',       label: 'View Inbox',                cat: 'Read',       def: true,  risk: 'medium' },
  { key: 'view_audience',    label: 'View Audience Data',        cat: 'Read',       def: true,  risk: 'low' },
  { key: 'export_data',      label: 'Export Data',               cat: 'Read',       def: true,  risk: 'low' },
  { key: 'generate_reports', label: 'Generate Reports',          cat: 'Read',       def: true,  risk: 'low' },
  // content
  { key: 'draft_posts',      label: 'Create Draft Posts',        cat: 'Content',    def: true,  risk: 'low' },
  { key: 'publish_posts',    label: 'Publish Posts',             cat: 'Content',    def: false, risk: 'high' },
  { key: 'schedule_posts',   label: 'Schedule Posts',            cat: 'Content',    def: true,  risk: 'medium' },
  { key: 'delete_posts',     label: 'Delete Posts',              cat: 'Content',    def: false, risk: 'high' },
  { key: 'edit_published',   label: 'Edit Published Posts',      cat: 'Content',    def: false, risk: 'medium' },
  // engagement
  { key: 'reply_comments',   label: 'Reply to Comments',         cat: 'Engagement', def: false, risk: 'medium' },
  { key: 'reply_messages',   label: 'Reply to DMs',              cat: 'Engagement', def: false, risk: 'high' },
  { key: 'reply_reviews',    label: 'Reply to Reviews',          cat: 'Engagement', def: true,  risk: 'medium' },
  { key: 'delete_comments',  label: 'Delete Comments',           cat: 'Engagement', def: false, risk: 'high' },
  { key: 'block_users',      label: 'Block / Hide Users',        cat: 'Engagement', def: false, risk: 'high' },
  // campaigns
  { key: 'create_campaigns', label: 'Create WhatsApp Campaigns', cat: 'Campaigns',  def: false, risk: 'medium' },
  { key: 'send_campaigns',   label: 'Send WhatsApp Campaigns',   cat: 'Campaigns',  def: false, risk: 'high' },
  { key: 'manage_contacts',  label: 'Manage Contacts',           cat: 'Campaigns',  def: false, risk: 'medium' },
  // ads
  { key: 'view_ads',         label: 'View Ad Performance',       cat: 'Ads',        def: false, risk: 'low' },
  { key: 'create_ads',       label: 'Create Ads',                cat: 'Ads',        def: false, risk: 'high' },
  { key: 'spend_on_ads',     label: 'Spend Ad Budget',           cat: 'Ads',        def: false, risk: 'critical' },
  // settings
  { key: 'manage_team',         label: 'Manage Team Members',  cat: 'Settings', def: false, risk: 'high' },
  { key: 'manage_automation',   label: 'Set Up Automations',   cat: 'Settings', def: false, risk: 'medium' },
  { key: 'manage_brand_voice',  label: 'Train AI Brand Voice', cat: 'Settings', def: true,  risk: 'low' },
  // critical
  { key: 'disconnect_platforms', label: 'Disconnect Platforms', cat: 'Critical', def: false, risk: 'critical' },
  { key: 'change_billing',       label: 'Change Billing',       cat: 'Critical', def: false, risk: 'critical' },
];

const RISK_COLOR = {
  low:      'var(--text-tertiary)',
  medium:   'var(--warning)',
  high:     'var(--danger)',
  critical: 'var(--danger)',
};

function defaultPerms() {
  return PERMISSIONS.reduce((acc, p) => ({ ...acc, [p.key]: p.def }), {});
}

export default function SendManageRequestModal({ open, onClose, onSent }) {
  const [step,    setStep]    = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    target_email: '',
    target_phone: '',
    permissions:  defaultPerms(),
    proposed_message: '',
    proposed_pricing: '',
    proposed_services: [],
  });

  const grouped = useMemo(() => {
    const out = {};
    PERMISSIONS.forEach((p) => {
      out[p.cat] = out[p.cat] || [];
      out[p.cat].push(p);
    });
    return out;
  }, []);

  if (!open) return null;

  function next() {
    if (step === 1 && !/^\S+@\S+\.\S+$/.test(form.target_email)) {
      return toast.error('Enter a valid email');
    }
    setStep((s) => Math.min(4, s + 1));
  }

  function togglePerm(key) {
    setForm((s) => ({ ...s, permissions: { ...s.permissions, [key]: !s.permissions[key] } }));
  }

  async function send() {
    setLoading(true);
    try {
      const pricing = form.proposed_pricing === '' ? null : Number(form.proposed_pricing);
      const r = await manageRequestAPI.send({
        target_email:         form.target_email.trim().toLowerCase(),
        target_phone:         form.target_phone.trim(),
        proposed_permissions: form.permissions,
        proposed_message:     form.proposed_message,
        proposed_pricing:     pricing,
        proposed_services:    form.proposed_services,
      });
      toast.success(`Invitation sent to ${form.target_email}`);
      onSent?.(r.data);
      onClose?.();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not send invitation');
    } finally {
      setLoading(false);
    }
  }

  const granted = Object.values(form.permissions).filter(Boolean).length;

  return (
    <div role="dialog" aria-modal="true" aria-label="Send manage request" style={backdropStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div style={modalStyle}>
        <header style={headerStyle}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
              Step {step} of 4
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
              Invite a client to manage
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={iconBtn}><X size={16} /></button>
        </header>

        <Stepper current={step} />

        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 24px 18px' }}>
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Client email" type="email" value={form.target_email}
                     onChange={(e) => setForm((s) => ({ ...s, target_email: e.target.value }))}
                     placeholder="client@business.com" autoFocus />
              <Field label="Phone (optional, sends WhatsApp invite)" value={form.target_phone}
                     onChange={(e) => setForm((s) => ({ ...s, target_phone: e.target.value }))}
                     placeholder="+91 …" />
            </div>
          )}

          {step === 2 && (
            <div>
              <p style={hintStyle}>
                Pick which actions you should be able to perform on the client's behalf.
                The client will see this list and can override anything before accepting.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {Object.entries(grouped).map(([cat, perms]) => (
                  <div key={cat}>
                    <div style={catLabel}>{cat}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {perms.map((p) => {
                        const on = !!form.permissions[p.key];
                        return (
                          <label key={p.key} style={permRow}>
                            <input type="checkbox" checked={on} onChange={() => togglePerm(p.key)} />
                            <span style={{ flex: 1, color: 'var(--text-primary)' }}>{p.label}</span>
                            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: RISK_COLOR[p.risk] }}>
                              {p.risk}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <Label>Message to the client</Label>
                <textarea
                  value={form.proposed_message}
                  onChange={(e) => setForm((s) => ({ ...s, proposed_message: e.target.value }))}
                  rows={4}
                  placeholder="Tell them what you'll do for them — wins, examples, timeline."
                  style={textareaStyle}
                />
              </div>
              <Field label="Monthly fee (optional, in INR)" type="number"
                     value={form.proposed_pricing}
                     onChange={(e) => setForm((s) => ({ ...s, proposed_pricing: e.target.value }))}
                     placeholder="e.g., 5000" />
            </div>
          )}

          {step === 4 && (
            <ReviewSummary form={form} granted={granted} />
          )}
        </div>

        <footer style={footerStyle}>
          {step > 1 ? (
            <button type="button" onClick={() => setStep(step - 1)} style={btnGhost}>
              <ArrowLeft size={14} /> Back
            </button>
          ) : <span />}
          {step < 4 ? (
            <button type="button" onClick={next} style={btnPrimary}>
              Continue <ArrowRight size={14} />
            </button>
          ) : (
            <button type="button" onClick={send} disabled={loading} style={btnPrimary}>
              {loading ? 'Sending…' : <>Send invitation <Send size={14} /></>}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

function ReviewSummary({ form, granted }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Row k="To"             v={form.target_email} />
      {form.target_phone && <Row k="Phone" v={form.target_phone} />}
      <Row k="Permissions"     v={`${granted} granted, ${PERMISSIONS.length - granted} declined`} />
      {form.proposed_pricing && <Row k="Monthly fee"  v={`₹${form.proposed_pricing}`} />}
      <Row k="Message"        v={form.proposed_message || <em style={{ color: 'var(--text-tertiary)' }}>(none)</em>} multiline />
      <p style={{ ...hintStyle, marginTop: 8 }}>
        <Check size={11} style={{ marginRight: 4, verticalAlign: 'middle', color: 'var(--success)' }} />
        Client receives an email with a magic link. Their decision is recorded — you can cancel from your sent list any time.
      </p>
    </div>
  );
}

function Row({ k, v, multiline }) {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: multiline ? 'flex-start' : 'center', fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ width: 110, color: 'var(--text-tertiary)', flexShrink: 0 }}>{k}</span>
      <span style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{v}</span>
    </div>
  );
}

function Stepper({ current }) {
  return (
    <div style={{ display: 'flex', gap: 5, padding: '0 24px 14px' }}>
      {[1,2,3,4].map((n) => (
        <div key={n} style={{
          flex: 1, height: 3, borderRadius: 3,
          background: n <= current ? 'var(--brand-primary)' : 'var(--border-subtle)',
          transition: 'background 0.2s',
        }} />
      ))}
    </div>
  );
}

function Field({ label, ...props }) {
  return (
    <div>
      <Label>{label}</Label>
      <input {...props} style={inputStyle} />
    </div>
  );
}

function Label({ children }) {
  return (
    <label style={{
      display: 'block', fontSize: 11, fontWeight: 600,
      letterSpacing: '0.04em', textTransform: 'uppercase',
      color: 'var(--text-tertiary)', marginBottom: 4,
    }}>{children}</label>
  );
}

const backdropStyle = {
  position: 'fixed', inset: 0, zIndex: 1100,
  background: 'rgba(10,14,20,0.50)',
  backdropFilter: 'blur(2px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 20,
};

const modalStyle = {
  width: '100%', maxWidth: 560, maxHeight: '90vh',
  display: 'flex', flexDirection: 'column',
  background: 'var(--surface-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-xl)',
};

const headerStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '16px 20px 8px',
};

const footerStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '14px 20px',
  borderTop: '1px solid var(--border-subtle)',
  background: 'var(--surface-card)',
  gap: 10,
};

const inputStyle = {
  width: '100%', padding: '10px 12px',
  background: 'var(--surface-sunken)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 13, color: 'var(--text-primary)',
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
};

const textareaStyle = { ...inputStyle, resize: 'vertical', minHeight: 80, fontFamily: 'inherit' };

const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '9px 16px',
  background: 'var(--brand-primary)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius-md)',
  fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
  cursor: 'pointer',
};

const btnGhost = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '9px 14px',
  background: 'transparent', color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
  cursor: 'pointer',
};

const iconBtn = {
  width: 30, height: 30, padding: 0,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent', color: 'var(--text-tertiary)',
  border: 'none', borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
};

const hintStyle = {
  margin: '0 0 12px', fontSize: 12,
  color: 'var(--text-tertiary)', lineHeight: 1.55,
};

const catLabel = {
  fontSize: 10, fontWeight: 600,
  letterSpacing: '0.06em', textTransform: 'uppercase',
  color: 'var(--text-tertiary)', marginBottom: 4,
};

const permRow = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '6px 8px',
  fontSize: 13,
  background: 'var(--surface-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
};
