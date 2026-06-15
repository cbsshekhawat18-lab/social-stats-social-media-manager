/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * InviteAgencyModal — end-user invites an agency to manage their workspace.
 *
 * Two entry points:
 * 1. With a `targetAgency` prop (from a marketplace agency profile in )
 * → shows the agency card at the top, no email field.
 * 2. Without a target → shows a single "agency email or slug" field. The
 * backend resolves slug-or-email and creates the invite either way
 * (linking to the existing Agency if found, or storing the bare email
 * so the agency can sign up + claim).
 *
 * The user controls the proposed permission matrix — defaults to the spec's
 * sensible defaults (read + draft + brand voice on; everything else off).
 */
import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Send, X, Building2, Check } from 'lucide-react';

import PermissionMatrix from './PermissionMatrix';
import { agencyInviteAPI } from '../../services/api';
import toast from '../ui/toast';

// Server-side AGENCY_CLIENT_PERMISSIONS catalog.
// Mirrors backend (). Used only for default seeding — the backend
// validates and clamps to valid keys regardless.
const SEED_CATALOG = {
  view_analytics:        { label: 'View Analytics',          category: 'Read',       risk: 'low',      default: true  },
  view_posts:            { label: 'View Posts',              category: 'Read',       risk: 'low',      default: true  },
  view_inbox:            { label: 'View Inbox',              category: 'Read',       risk: 'medium',   default: true  },
  view_audience:         { label: 'View Audience Data',      category: 'Read',       risk: 'low',      default: true  },
  export_data:           { label: 'Export Data',             category: 'Read',       risk: 'low',      default: true  },
  generate_reports:      { label: 'Generate Reports',        category: 'Read',       risk: 'low',      default: true  },
  draft_posts:           { label: 'Create Draft Posts',      category: 'Content',    risk: 'low',      default: true  },
  publish_posts:         { label: 'Publish Posts',           category: 'Content',    risk: 'high',     default: false },
  schedule_posts:        { label: 'Schedule Posts',          category: 'Content',    risk: 'medium',   default: true  },
  delete_posts:          { label: 'Delete Posts',            category: 'Content',    risk: 'high',     default: false },
  edit_published:        { label: 'Edit Published Posts',    category: 'Content',    risk: 'medium',   default: false },
  reply_comments:        { label: 'Reply to Comments',       category: 'Engagement', risk: 'medium',   default: false },
  reply_messages:        { label: 'Reply to DMs',            category: 'Engagement', risk: 'high',     default: false },
  reply_reviews:         { label: 'Reply to Reviews',        category: 'Engagement', risk: 'medium',   default: true  },
  delete_comments:       { label: 'Delete Comments',         category: 'Engagement', risk: 'high',     default: false },
  block_users:           { label: 'Block / Hide Users',      category: 'Engagement', risk: 'high',     default: false },
  create_campaigns:      { label: 'Create WhatsApp Campaigns',category: 'Campaigns',  risk: 'medium',   default: false },
  send_campaigns:        { label: 'Send WhatsApp Campaigns', category: 'Campaigns',  risk: 'high',     default: false },
  manage_contacts:       { label: 'Manage Contacts',         category: 'Campaigns',  risk: 'medium',   default: false },
  view_ads:              { label: 'View Ad Performance',     category: 'Ads',        risk: 'low',      default: false },
  create_ads:            { label: 'Create Ads',              category: 'Ads',        risk: 'high',     default: false },
  spend_on_ads:          { label: 'Spend Ad Budget',         category: 'Ads',        risk: 'critical', default: false },
  manage_team:           { label: 'Manage Team Members',     category: 'Settings',   risk: 'high',     default: false },
  manage_automation:     { label: 'Set Up Automations',      category: 'Settings',   risk: 'medium',   default: false },
  manage_brand_voice:    { label: 'Train AI Brand Voice',    category: 'Settings',   risk: 'low',      default: true  },
  disconnect_platforms:  { label: 'Disconnect Platforms',    category: 'Critical',   risk: 'critical', default: false },
  change_billing:        { label: 'Change Billing',          category: 'Critical',   risk: 'critical', default: false },
};

const SERVICE_OPTIONS = [
  { value: 'content',     label: 'Content creation' },
  { value: 'analytics',   label: 'Analytics & reporting' },
  { value: 'inbox',       label: 'Inbox & engagement' },
  { value: 'campaigns',   label: 'WhatsApp campaigns' },
  { value: 'ads',         label: 'Paid ads' },
  { value: 'strategy',    label: 'Strategy & growth' },
];

const BUDGET_RANGES = [
  '< ₹5,000/mo',
  '₹5,000–10,000/mo',
  '₹10,000–25,000/mo',
  '₹25,000–50,000/mo',
  '> ₹50,000/mo',
  'Open / discuss',
];

function defaultPerms() {
  const out = {};
  Object.entries(SEED_CATALOG).forEach(([k, v]) => { out[k] = v.default; });
  return out;
}

export default function InviteAgencyModal({ open, onClose, targetAgency = null, onSent }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    target_locator:       '',  // email or slug, when targetAgency is null
    proposed_permissions: defaultPerms(),
    requires_approval_for: [],  // user can't pre-set approval flags here; agency-side mirrors via flow
    message:              '',
    desired_services:     [],
    budget_range:         '',
  });

  const granted = useMemo(
    () => Object.values(form.proposed_permissions).filter(Boolean).length,
    [form.proposed_permissions]
  );

  if (!open) return null;

  function next() {
    if (!targetAgency && step === 1 && !form.target_locator.trim()) {
      return toast.error('Pick an agency or enter their email');
    }
    setStep((s) => Math.min(targetAgency ? 3 : 4, s + 1));
  }

  async function send() {
    setLoading(true);
    try {
      const payload = {
        proposed_permissions: form.proposed_permissions,
        message:              form.message,
        desired_services:     form.desired_services,
        budget_range:         form.budget_range,
      };
      if (targetAgency) {
        payload.target_agency_id = targetAgency.id;
      } else {
        const v = form.target_locator.trim().toLowerCase();
        if (v.includes('@')) payload.target_agency_email = v;
        else                  payload.target_agency_slug  = v;
      }
      const r = await agencyInviteAPI.send(payload);
      toast.success('Invitation sent');
      onSent?.(r.data);
      onClose?.();
    } catch (e) {
      toast.error(e?.response?.data?.error || Object.values(e?.response?.data?.errors || {})[0] || 'Could not send invitation');
    } finally {
      setLoading(false);
    }
  }

  // step layout: 1: target (skipped when targetAgency) · 2: permissions · 3: pitch · 4 (or 3 with target): review
  const useFour = !targetAgency;
  const totalSteps = useFour ? 4 : 3;
  const realStep = targetAgency ? step + 1 : step;  // map for permission/pitch when target is fixed

  function toggleService(value) {
    setForm((s) => {
      const set = new Set(s.desired_services);
      if (set.has(value)) set.delete(value); else set.add(value);
      return { ...s, desired_services: Array.from(set) };
    });
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Invite an agency" style={backdropStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div style={modalStyle}>
        <header style={headerStyle}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
              Step {step} of {totalSteps}
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
              {targetAgency ? `Invite ${targetAgency.name}` : 'Invite an agency'}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={iconBtn}><X size={16} /></button>
        </header>

        <Stepper current={step} total={totalSteps} />

        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 24px 18px' }}>
          {targetAgency && (
            <div style={agencyHeader}>
              <span style={agencyAvatar}><Building2 size={18} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{targetAgency.name}</div>
                {targetAgency.location && <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{targetAgency.location}</div>}
              </div>
            </div>
          )}

          {/* Step 1 (only shown when no target) */}
          {!targetAgency && step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Label>Agency email or slug</Label>
              <input
                type="text"
                autoFocus
                value={form.target_locator}
                onChange={(e) => setForm((s) => ({ ...s, target_locator: e.target.value }))}
                placeholder="hello@theiragency.com  or  their-agency-slug"
                style={inputStyle}
              />
              <p style={hintText}>
                If the agency is already on Social Stats, use their slug. Otherwise, their email — we'll send them
                an invitation to join Social Stats and accept your request.
              </p>
            </div>
          )}

          {/* Permissions */}
          {((targetAgency && step === 1) || (!targetAgency && step === 2)) && (
            <div>
              <p style={hintText}>
                Pick what the agency should be allowed to do. They'll see your selection — and they can't widen it.
              </p>
              <div style={{ marginTop: 8 }}>
                <PermissionMatrix
                  catalog={SEED_CATALOG}
                  permissions={form.proposed_permissions}
                  requiresApprovalFor={[]}
                  onChange={({ permissions }) => setForm((s) => ({ ...s, proposed_permissions: permissions }))}
                />
              </div>
            </div>
          )}

          {/* Pitch */}
          {((targetAgency && step === 2) || (!targetAgency && step === 3)) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <Label>Message</Label>
                <textarea
                  rows={4}
                  value={form.message}
                  onChange={(e) => setForm((s) => ({ ...s, message: e.target.value }))}
                  placeholder="Tell them about your business and what you'd like help with."
                  style={textareaStyle}
                />
              </div>
              <div>
                <Label>What do you need help with?</Label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {SERVICE_OPTIONS.map((opt) => {
                    const active = form.desired_services.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleService(opt.value)}
                        style={{
                          padding: '6px 12px',
                          fontSize: 12, fontWeight: active ? 600 : 500,
                          background: active ? 'var(--brand-primary-soft)' : 'var(--surface-card)',
                          color: active ? 'var(--brand-primary-hover)' : 'var(--text-secondary)',
                          border: `1px solid ${active ? 'var(--brand-primary)' : 'var(--border-default)'}`,
                          borderRadius: 'var(--radius-pill)',
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label>Budget range (optional)</Label>
                <select
                  value={form.budget_range}
                  onChange={(e) => setForm((s) => ({ ...s, budget_range: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">—</option>
                  {BUDGET_RANGES.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Review */}
          {((targetAgency && step === 3) || (!targetAgency && step === 4)) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Row k="To" v={targetAgency ? targetAgency.name : form.target_locator} />
              <Row k="Permissions" v={`${granted} granted, ${Object.keys(SEED_CATALOG).length - granted} declined`} />
              <Row k="Services" v={form.desired_services.length ? form.desired_services.join(', ') : '—'} />
              {form.budget_range && <Row k="Budget" v={form.budget_range} />}
              <Row k="Message" v={form.message || <em style={{ color: 'var(--text-tertiary)' }}>(none)</em>} multiline />
              <p style={{ ...hintText, marginTop: 8 }}>
                <Check size={11} style={{ marginRight: 4, verticalAlign: 'middle', color: 'var(--success)' }} />
                The agency receives an email + in-app notification. You'll be told as soon as they accept or decline.
              </p>
            </div>
          )}
        </div>

        <footer style={footerStyle}>
          {step > 1 ? (
            <button type="button" onClick={() => setStep(step - 1)} style={btnGhost}>
              <ArrowLeft size={14} /> Back
            </button>
          ) : <span />}
          {step < totalSteps ? (
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

function Stepper({ current, total }) {
  return (
    <div style={{ display: 'flex', gap: 5, padding: '0 24px 14px' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          flex: 1, height: 3, borderRadius: 3,
          background: i + 1 <= current ? 'var(--brand-primary)' : 'var(--border-subtle)',
          transition: 'background 0.2s',
        }} />
      ))}
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

function Row({ k, v, multiline }) {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: multiline ? 'flex-start' : 'center', fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ width: 110, color: 'var(--text-tertiary)', flexShrink: 0 }}>{k}</span>
      <span style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{v}</span>
    </div>
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
const textareaStyle = { ...inputStyle, resize: 'vertical', minHeight: 80 };

const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '9px 16px',
  background: 'var(--brand-primary)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius-md)',
  fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
};
const btnGhost = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '9px 14px',
  background: 'transparent', color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
};
const iconBtn = {
  width: 30, height: 30, padding: 0,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent', color: 'var(--text-tertiary)',
  border: 'none', borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
};

const agencyHeader = {
  display: 'flex', alignItems: 'center', gap: 12,
  padding: 12, marginBottom: 14,
  background: 'var(--surface-sunken)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
};

const agencyAvatar = {
  width: 32, height: 32,
  background: 'var(--brand-primary-glow)',
  color: 'var(--brand-primary-hover)',
  borderRadius: 'var(--radius-sm)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
};

const hintText = {
  margin: 0, fontSize: 12,
  color: 'var(--text-tertiary)', lineHeight: 1.55,
};
