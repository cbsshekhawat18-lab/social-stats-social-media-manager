/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Zap, Play, Pause, Trash2, ChevronRight, X, Sparkles,
  MessageSquare, MessageCircle, Star, AtSign, AlertCircle,
  Send, Bell, UserPlus, Tag, Webhook, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';

import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { automationsAPI } from '../../services/api';

const TRIGGER_OPTIONS = [
  { id: 'new_comment',         label: 'New comment',           icon: MessageSquare,
    desc: 'Fires whenever a new inbound comment arrives' },
  { id: 'new_dm',              label: 'New direct message',    icon: MessageCircle,
    desc: 'Fires on inbound DMs' },
  { id: 'new_review',          label: 'New review',            icon: Star,
    desc: 'Fires on a new Google Business review' },
  { id: 'keyword_mention',     label: 'Keyword mention',       icon: AtSign,
    desc: 'Fires when an inbound message contains certain keywords' },
  { id: 'negative_sentiment',  label: 'Negative sentiment',    icon: AlertCircle,
    desc: 'Fires when inbound sentiment is flagged negative' },
];

const ACTION_OPTIONS = [
  { id: 'auto_reply',     label: 'Auto-reply',          icon: Send,
    desc: 'Posts a fixed text reply' },
  { id: 'ai_smart_reply', label: 'AI smart-reply',      icon: Sparkles,
    desc: 'Lets Social Stats write a short reply matching your brand voice' },
  { id: 'notify',         label: 'Send notification',   icon: Bell,
    desc: 'Creates an in-app notification' },
  { id: 'assign',         label: 'Assign to user',      icon: UserPlus,
    desc: 'Assigns the conversation to a specific user' },
  { id: 'add_tag',        label: 'Add tag',             icon: Tag,
    desc: 'Tags the conversation for later filtering' },
  { id: 'webhook',        label: 'Call webhook',        icon: Webhook,
    desc: 'POSTs the event payload to your URL' },
];

export default function AutomationsPage() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editing, setEditing] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await automationsAPI.list();
      setRules(res.data?.results || res.data || []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function toggle(rule) {
    try { await automationsAPI.toggle(rule.id); load(); }
    catch { toast.error('Toggle failed'); }
  }
  async function destroy(rule) {
    if (!window.confirm(`Delete "${rule.name}"?`)) return;
    try { await automationsAPI.delete(rule.id); load(); toast.success('Deleted'); }
    catch { toast.error('Delete failed'); }
  }

  return (
    <div style={{ paddingBottom: 32 }}>
      <PageHeader
        title="Automations"
        subtitle="If this happens, do that — across every connected platform"
        action={<Button icon={Plus} onClick={() => { setEditing(null); setShowBuilder(true); }}>
          New Rule
        </Button>}
      />

      <div style={{
        display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px',
        gap: 16, padding: '0 24px',
      }} className="automations-grid">
        <div>
          {loading && (
            <div style={{ padding: 32, textAlign: 'center' }}>
              <Loader2 size={18} className="ds-spin" color="var(--text-tertiary)" />
            </div>
          )}
          {!loading && rules.length === 0 && (
            <Card padding="none" style={{ overflow: 'hidden' }}>
              <EmptyState
                icon={Zap}
                title="No automations yet"
                description="Automations save you from staring at the inbox. Pick a template on the right or build one from scratch."
                action={<Button icon={Plus} onClick={() => { setEditing(null); setShowBuilder(true); }}>
                  Build a rule
                </Button>}
              />
            </Card>
          )}
          {rules.map((rule) => (
            <RuleRow key={rule.id} rule={rule}
                     onToggle={() => toggle(rule)}
                     onEdit={() => { setEditing(rule); setShowBuilder(true); }}
                     onDelete={() => destroy(rule)} />
          ))}
        </div>

        <TemplatesSidebar onPick={(tpl) => { setEditing(tpl); setShowBuilder(true); }} />
      </div>

      {showBuilder && (
        <RuleBuilder
          initial={editing}
          onClose={() => setShowBuilder(false)}
          onSaved={() => { setShowBuilder(false); load(); }}
        />
      )}

      <style>{`
        .ds-spin { animation: ds-spin 0.9s linear infinite; }
        @keyframes ds-spin { to { transform: rotate(360deg); } }
        @media (max-width: 1024px) {
          .automations-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

/* ── Rule row ──────────────────────────────────────────────────────────── */
function RuleRow({ rule, onToggle, onEdit, onDelete }) {
  const trigger = TRIGGER_OPTIONS.find((t) => t.id === rule.trigger_type);
  const action  = ACTION_OPTIONS.find((a) => a.id === rule.action_type);
  const TIcon = trigger?.icon || Zap;
  const AIcon = action?.icon  || Send;

  return (
    <Card padding="md" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              {rule.name}
            </span>
            <Badge variant={rule.is_active ? 'success' : 'default'} dot>
              {rule.is_active ? 'Active' : 'Paused'}
            </Badge>
            {rule.run_count > 0 && (
              <Badge>fired {rule.run_count}×</Badge>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                        fontSize: 12, color: 'var(--text-secondary)' }}>
            <Pill icon={TIcon} label={trigger?.label || rule.trigger_type} />
            <ChevronRight size={12} color="var(--text-tertiary)" />
            <Pill icon={AIcon} label={action?.label || rule.action_type} accent />
          </div>

          {rule.last_run_at && (
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>
              Last fired {new Date(rule.last_run_at).toLocaleString()}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          <Button variant="ghost" size="sm"
                  icon={rule.is_active ? Pause : Play}
                  onClick={onToggle}
                  iconOnly aria-label={rule.is_active ? 'Pause' : 'Resume'} />
          <Button variant="ghost" size="sm" onClick={onEdit}>Edit</Button>
          <Button variant="ghost" size="sm" icon={Trash2} onClick={onDelete}
                  iconOnly aria-label="Delete" />
        </div>
      </div>
    </Card>
  );
}

function Pill({ icon: Icon, label, accent }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 'var(--radius-pill)',
      background: accent ? 'var(--brand-primary-glow)' : 'var(--surface-sunken)',
      color: accent ? 'var(--brand-primary-hover)' : 'var(--text-secondary)',
      border: '1px solid var(--border-subtle)',
      fontSize: 11, fontWeight: 600,
    }}>
      <Icon size={11} />
      {label}
    </span>
  );
}

/* ── Templates sidebar ─────────────────────────────────────────────────── */
function TemplatesSidebar({ onPick }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    automationsAPI.templates()
      .then((res) => setTemplates(res.data?.templates || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card padding="none" style={{ overflow: 'hidden', alignSelf: 'flex-start',
                                   position: 'sticky', top: 'calc(var(--topbar-height) + 16px)' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex', alignItems: 'center', gap: 8 }}>
        <Sparkles size={14} color="var(--brand-primary-hover)" />
        <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>Templates</strong>
      </div>
      <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
        {loading && <div style={{ padding: 16, color: 'var(--text-tertiary)', fontSize: 12 }}>Loading…</div>}
        {templates.map((t, i) => (
          <button
            key={i} type="button"
            onClick={() => onPick(t)}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '12px 16px',
              background: 'transparent',
              border: 'none', borderBottom: '1px solid var(--border-subtle)',
              cursor: 'pointer', minHeight: 'unset', minWidth: 'unset',
              transition: 'var(--transition-fast)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
              {t.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {t.description}
            </div>
          </button>
        ))}
      </div>
    </Card>
  );
}

/* ── Rule builder modal ────────────────────────────────────────────────── */
function RuleBuilder({ initial, onClose, onSaved }) {
  const isExisting = !!initial?.id;

  const [form, setForm] = useState(() => ({
    name:             initial?.name             || '',
    trigger_type:     initial?.trigger_type     || 'new_comment',
    trigger_filters:  initial?.trigger_filters  || {},
    action_type:      initial?.action_type      || 'notify',
    action_config:    initial?.action_config    || {},
    is_active:        initial?.is_active ?? true,
  }));
  const [saving, setSaving] = useState(false);

  const trigger = useMemo(() => TRIGGER_OPTIONS.find((t) => t.id === form.trigger_type), [form.trigger_type]);
  const action  = useMemo(() => ACTION_OPTIONS.find((a) => a.id === form.action_type),    [form.action_type]);

  async function save() {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      if (isExisting) await automationsAPI.update(initial.id, form);
      else            await automationsAPI.create(form);
      toast.success(isExisting ? 'Updated' : 'Created');
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed');
    } finally { setSaving(false); }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(10,14,20,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <Card onClick={(e) => e.stopPropagation()} padding="none" style={{
        width: 'min(620px, 100%)',
        maxHeight: 'calc(100vh - 32px)', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <header style={modalHeader}>
          <div>
            <strong style={{ fontSize: 16 }}>
              {isExisting ? 'Edit rule' : (initial ? 'Customise template' : 'New rule')}
            </strong>
            {initial && !isExisting && (
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                Pre-filled from "{initial.name}" template
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={iconBtnStyle}>
            <X size={14} />
          </button>
        </header>

        <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
          <Field label="Rule name">
            <input value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Auto-thank for 5-star reviews"
                    style={inputStyle} autoFocus />
          </Field>

          <SectionLabel>1. Trigger</SectionLabel>
          <select value={form.trigger_type}
                   onChange={(e) => setForm({ ...form, trigger_type: e.target.value, trigger_filters: {} })}
                   style={inputStyle}>
            {TRIGGER_OPTIONS.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          {trigger?.desc && (
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>{trigger.desc}</div>
          )}

          <TriggerFilters
            type={form.trigger_type}
            value={form.trigger_filters}
            onChange={(f) => setForm({ ...form, trigger_filters: f })}
          />

          <SectionLabel>2. Action</SectionLabel>
          <select value={form.action_type}
                   onChange={(e) => setForm({ ...form, action_type: e.target.value, action_config: {} })}
                   style={inputStyle}>
            {ACTION_OPTIONS.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
          {action?.desc && (
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>{action.desc}</div>
          )}

          <ActionConfig
            type={form.action_type}
            value={form.action_config}
            onChange={(c) => setForm({ ...form, action_config: c })}
          />

          <label style={{ display: 'flex', alignItems: 'center', gap: 8,
                          marginTop: 16, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            Enabled — fire immediately on save
          </label>
        </div>

        <footer style={modalFooter}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>
            {isExisting ? 'Save changes' : 'Create rule'}
          </Button>
        </footer>
      </Card>
    </div>
  );
}

/* ── Trigger-specific filter inputs ────────────────────────────────────── */
function TriggerFilters({ type, value, onChange }) {
  const set = (k, v) => onChange({ ...value, [k]: v });

  if (type === 'keyword_mention') {
    const kws = (value.keywords || []).join(', ');
    return (
      <Field label="Keywords (comma-separated)">
        <input value={kws}
                onChange={(e) => set('keywords', e.target.value.split(',').map((x) => x.trim()).filter(Boolean))}
                placeholder="urgent, asap, refund"
                style={inputStyle} />
      </Field>
    );
  }
  if (type === 'new_review') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
        <Field label="Min rating">
          <input type="number" min={1} max={5}
                  value={value.min_rating ?? ''}
                  onChange={(e) => set('min_rating', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="1" style={inputStyle} />
        </Field>
        <Field label="Max rating">
          <input type="number" min={1} max={5}
                  value={value.max_rating ?? ''}
                  onChange={(e) => set('max_rating', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="5" style={inputStyle} />
        </Field>
      </div>
    );
  }
  // For other triggers, optionally restrict to specific platforms
  const allPlatforms = ['facebook', 'instagram', 'youtube', 'linkedin', 'google_my_business'];
  const selected = value.platforms || [];
  return (
    <div style={{ marginTop: 12 }}>
      <SectionLabel small>Restrict to platforms (optional)</SectionLabel>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {allPlatforms.map((p) => {
          const on = selected.includes(p);
          return (
            <button
              key={p} type="button"
              onClick={() => set('platforms', on ? selected.filter((x) => x !== p) : [...selected, p])}
              style={pillStyle(on)}
            >
              {p}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Action-specific config inputs ─────────────────────────────────────── */
function ActionConfig({ type, value, onChange }) {
  const set = (k, v) => onChange({ ...value, [k]: v });

  if (type === 'auto_reply') {
    return (
      <Field label="Reply template (use {author_name}, {platform}, {content})">
        <textarea value={value.template || ''}
                   onChange={(e) => set('template', e.target.value)}
                   rows={3}
                   placeholder="Thanks {author_name}! Glad you liked the post."
                   style={{ ...inputStyle, height: 'auto', resize: 'vertical' }} />
      </Field>
    );
  }
  if (type === 'ai_smart_reply') {
    return (
      <div style={{ ...infoBoxStyle, marginTop: 12 }}>
        <Sparkles size={14} color="var(--brand-primary-hover)" />
        <span>Social Stats writes a short on-brand reply using the trained brand voice.</span>
      </div>
    );
  }
  if (type === 'notify') {
    return (
      <>
        <Field label="Notification title">
          <input value={value.title || ''}
                  onChange={(e) => set('title', e.target.value)}
                  placeholder="Heads up — needs attention"
                  style={inputStyle} />
        </Field>
        <Field label="Body (use {author_name}, {platform}, {content})">
          <textarea value={value.body || ''}
                     onChange={(e) => set('body', e.target.value)}
                     rows={3}
                     placeholder="{author_name} on {platform}: {content}"
                     style={{ ...inputStyle, height: 'auto', resize: 'vertical' }} />
        </Field>
      </>
    );
  }
  if (type === 'assign') {
    return (
      <Field label="User ID to assign to">
        <input type="number" value={value.user_id || ''}
                onChange={(e) => set('user_id', e.target.value ? Number(e.target.value) : undefined)}
                placeholder="42" style={inputStyle} />
      </Field>
    );
  }
  if (type === 'add_tag') {
    return (
      <Field label="Tag to apply">
        <input value={value.tag || ''}
                onChange={(e) => set('tag', e.target.value)}
                placeholder="priority"
                style={inputStyle} />
      </Field>
    );
  }
  if (type === 'webhook') {
    return (
      <Field label="Webhook URL">
        <input value={value.url || ''}
                onChange={(e) => set('url', e.target.value)}
                placeholder="https://your-app.example.com/webhook"
                style={inputStyle} />
      </Field>
    );
  }
  return null;
}

/* ── Layout helpers ────────────────────────────────────────────────────── */
function Field({ label, children }) {
  return (
    <label style={{ display: 'block', marginTop: 12 }}>
      <span style={{
        display: 'block', fontSize: 11, fontWeight: 600,
        color: 'var(--text-tertiary)',
        textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6,
      }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function SectionLabel({ children, small }) {
  return (
    <div style={{
      marginTop: small ? 12 : 20, marginBottom: 8,
      fontSize: small ? 11 : 12, fontWeight: 700,
      color: 'var(--text-tertiary)',
      textTransform: 'uppercase', letterSpacing: 0.6,
    }}>
      {children}
    </div>
  );
}

function pillStyle(on) {
  return {
    padding: '4px 10px', borderRadius: 'var(--radius-pill)',
    border: `1px solid ${on ? 'transparent' : 'var(--border-subtle)'}`,
    background: on ? 'var(--brand-primary-glow)' : 'var(--surface-card)',
    color: on ? 'var(--brand-primary-hover)' : 'var(--text-secondary)',
    fontSize: 11, fontWeight: 600, cursor: 'pointer',
    minHeight: 'unset', minWidth: 'unset',
  };
}

const inputStyle = {
  width: '100%', padding: '9px 12px',
  background: 'var(--surface-card)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13, color: 'var(--text-primary)',
  outline: 'none', boxSizing: 'border-box', minHeight: 'unset',
  fontFamily: 'inherit',
};

const iconBtnStyle = {
  width: 28, height: 28, borderRadius: 'var(--radius-sm)',
  background: 'transparent', border: 'none', cursor: 'pointer',
  color: 'var(--text-tertiary)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  minHeight: 'unset', minWidth: 'unset',
};

const modalHeader = {
  padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};

const modalFooter = {
  padding: 12, borderTop: '1px solid var(--border-subtle)',
  display: 'flex', justifyContent: 'flex-end', gap: 8,
};

const infoBoxStyle = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '10px 12px', borderRadius: 'var(--radius-md)',
  background: 'var(--brand-primary-glow)', color: 'var(--text-primary)',
  fontSize: 12, lineHeight: 1.5,
};
