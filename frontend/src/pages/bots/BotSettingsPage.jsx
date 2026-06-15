/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * BotSettingsPage
 *
 * Workspace-level controls for the CTWA bot:
 * • Kill switch: pause every flow without disabling them individually
 * • Per-contact rate limit (msgs/min)
 * • Per-conversation hard cap (msgs/conv)
 * • Spam threshold (auto-end at this score)
 *
 * The kill switch acts immediately — the runner re-reads `bot_enabled` on
 * every inbound message.
 */
import { useEffect, useState } from 'react';
import {
  ShieldCheck, ShieldOff, Save, AlertTriangle, Sparkles,
} from 'lucide-react';

import { botSettingsAPI } from '../../services/api';
import toast from '../../components/ui/toast';

export default function BotSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [s, setS] = useState({
    bot_enabled:             true,
    bot_max_msgs_per_minute: 20,
    bot_max_msgs_per_conv:   200,
    bot_spam_threshold:      5,
  });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    botSettingsAPI.get()
      .then((r) => setS(r.data))
      .catch(() => toast.error('Could not load bot settings'))
      .finally(() => setLoading(false));
  }, []);

  function patch(p) {
    setS((prev) => ({ ...prev, ...p }));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      const r = await botSettingsAPI.update(s);
      setS(r.data);
      setDirty(false);
      toast.success('Saved');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not save');
    } finally { setSaving(false); }
  }

  if (loading) {
    return <div style={{ padding: 32, color: 'var(--text-tertiary)' }}>Loading…</div>;
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{
          width: 40, height: 40,
          background: 'var(--brand-primary-glow)', color: 'var(--brand-primary-hover)',
          borderRadius: 'var(--radius-md)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ShieldCheck size={20} strokeWidth={2.2} />
        </span>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Bot safety
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            Workspace-wide guardrails. Changes take effect immediately.
          </p>
        </div>
      </header>

      {/* Kill switch */}
      <section style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            width: 40, height: 40,
            background: s.bot_enabled ? 'var(--success-bg)' : 'var(--danger-bg)',
            color:      s.bot_enabled ? 'var(--success)'    : 'var(--danger)',
            borderRadius: 'var(--radius-md)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            {s.bot_enabled ? <ShieldCheck size={18} /> : <ShieldOff size={18} />}
          </span>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              {s.bot_enabled ? 'Bot is running' : 'Bot is paused'}
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
              {s.bot_enabled
                ? 'Inbound messages route to your active flows.'
                : 'All inbound messages skip the engine and go to your inbox.'}
            </p>
          </div>
          <Toggle on={s.bot_enabled} onChange={(v) => patch({ bot_enabled: v })} />
        </div>
      </section>

      {/* Limits */}
      <section style={card}>
        <h2 style={sectionTitle}>Anti-abuse limits</h2>

        <Row
          label="Messages per minute, per contact"
          help="Drops bursts where a single number floods the bot. Counted in a 60-second sliding window."
        >
          <NumberInput value={s.bot_max_msgs_per_minute}
                       min={1} max={600}
                       onChange={(v) => patch({ bot_max_msgs_per_minute: v })} />
        </Row>

        <Row
          label="Messages per conversation"
          help="Hard cap that breaks runaway loops. Conversations are auto-ended when they cross this number of inbound messages."
        >
          <NumberInput value={s.bot_max_msgs_per_conv}
                       min={10} max={10000} step={10}
                       onChange={(v) => patch({ bot_max_msgs_per_conv: v })} />
        </Row>

        <Row
          label="Spam threshold"
          help="Each inbound message earns a heuristic score (URLs, repeated chars, length). At this total, the conversation is auto-ended and flagged as spam."
        >
          <NumberInput value={s.bot_spam_threshold}
                       min={1} max={50}
                       onChange={(v) => patch({ bot_spam_threshold: v })} />
        </Row>
      </section>

      {/* Helpful explainer */}
      <div style={{
        padding: 12,
        background: 'var(--brand-primary-soft)',
        border: '1px solid var(--brand-primary-glow)',
        color: 'var(--brand-primary-hover)',
        borderRadius: 'var(--radius-md)',
        display: 'flex', gap: 8, alignItems: 'flex-start',
        fontSize: 12, lineHeight: 1.5,
      }}>
        <Sparkles size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <strong>How safety stacks:</strong> rate limit drops bursts before
          the engine runs. Per-conversation cap catches long-running loops.
          Spam threshold targets clearly malicious content. All three fail
          open — if anything misbehaves, the bot keeps working.
        </div>
      </div>

      {/* Save */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        {dirty && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '6px 10px', fontSize: 11, fontWeight: 600,
            color: 'var(--warning)', background: 'var(--warning-bg)',
            border: '1px solid var(--warning)', borderRadius: 'var(--radius-pill)',
          }}>
            <AlertTriangle size={11} /> Unsaved changes
          </span>
        )}
        <button type="button" onClick={save} disabled={!dirty || saving} style={{
          ...btnPrimary,
          opacity: !dirty || saving ? 0.6 : 1,
          cursor: !dirty || saving ? 'not-allowed' : 'pointer',
        }}>
          <Save size={13} /> {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}

function Toggle({ on, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-pressed={on}
      style={{
        position: 'relative',
        width: 40, height: 22,
        background: on ? 'var(--success)' : 'var(--border-default)',
        border: 'none', borderRadius: 11,
        cursor: 'pointer', transition: 'background 120ms ease',
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: on ? 20 : 2,
        width: 18, height: 18,
        background: '#fff', borderRadius: '50%',
        transition: 'left 120ms ease',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}

function Row({ label, help, children }) {
  return (
    <div style={{
      padding: '14px 0',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex', alignItems: 'flex-start', gap: 16,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
        {help && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{help}</p>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function NumberInput({ value, onChange, min, max, step = 1 }) {
  return (
    <input
      type="number"
      value={value} onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value || 0))))}
      min={min} max={max} step={step}
      style={{
        width: 96, padding: '7px 10px',
        background: 'var(--surface-sunken)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-sm)',
        fontSize: 13, color: 'var(--text-primary)',
        textAlign: 'right', fontVariantNumeric: 'tabular-nums',
        outline: 'none', fontFamily: 'inherit',
      }}
    />
  );
}

const card = {
  padding: 16,
  background: 'var(--surface-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
};
const sectionTitle = {
  margin: '0 0 4px', fontSize: 11, fontWeight: 700,
  color: 'var(--text-tertiary)', letterSpacing: '0.06em',
  textTransform: 'uppercase',
};
const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px',
  background: 'var(--brand-primary)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius-md)',
  fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
};
