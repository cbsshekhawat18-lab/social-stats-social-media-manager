/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useEffect, useRef, useState } from 'react';
import { Sparkles, Loader2, X, Check, RefreshCw, Copy } from 'lucide-react';

import Button from '../ui/Button';
import { aiV2API } from '../../services/api';
import toast from '../ui/toast';

/**
 * AIWriteButton — drop-in "✨ Write with AI" trigger that opens a small popover
 * to capture (topic, tone, length, platform), calls /ai/v2/compose, and inserts
 * the chosen variant back into the parent through `onInsert(text)`.
 *
 * Usage:
 *   <AIWriteButton clientId={clientId} platform="instagram" onInsert={setDraft} />
 *
 * Props:
 *   clientId:  required for tenant-scoped AI calls
 *   platform:  default platform to compose for (the popover lets the user override)
 *   onInsert:  (text) => void — called when user picks a variant
 *   label:     button label (default "Write with AI")
 *   size:      passes through to <Button>
 *   tone:      starting tone (default 'friendly')
 *   align:     'left' | 'right' — popover alignment relative to the trigger
 */
const TONE_OPTIONS = [
  { value: 'friendly',       label: 'Friendly' },
  { value: 'professional',   label: 'Professional' },
  { value: 'witty',          label: 'Witty' },
  { value: 'inspirational',  label: 'Inspirational' },
  { value: 'urgent',         label: 'Urgent' },
  { value: 'casual',         label: 'Casual' },
];

const LENGTH_OPTIONS = [
  { value: 'short',  label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'long',   label: 'Long' },
];

const PLATFORM_OPTIONS = [
  { value: 'instagram',          label: 'Instagram' },
  { value: 'facebook',           label: 'Facebook' },
  { value: 'linkedin',           label: 'LinkedIn' },
  { value: 'youtube',            label: 'YouTube' },
  { value: 'google_my_business', label: 'GMB' },
];

export default function AIWriteButton({
  clientId,
  platform = 'instagram',
  onInsert,
  label = 'Write with AI',
  size = 'sm',
  tone: initialTone = 'friendly',
  align = 'left',
}) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState(initialTone);
  const [length, setLength] = useState('medium');
  const [plat, setPlat] = useState(platform);
  const [loading, setLoading] = useState(false);
  const [variants, setVariants] = useState([]);
  const wrapRef = useRef(null);

  // Close on outside click + Esc
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function reset() {
    setVariants([]);
    setTopic('');
  }

  async function generate() {
    const t = (topic || '').trim();
    if (!t) {
      toast.error('Tell me what to write about');
      return;
    }
    if (!clientId) {
      toast.error('Pick a client first');
      return;
    }
    setLoading(true);
    try {
      const res = await aiV2API.compose({
        client_id: clientId,
        topic:     t,
        platforms: [plat],
        tone,
        length,
      });
      const list = res.data?.variants || [];
      if (list.length === 0) {
        toast.error('No variants returned');
      } else {
        setVariants(list);
      }
    } catch (e) {
      const detail = e?.response?.data?.error || 'Generation failed';
      toast.error(detail);
    } finally {
      setLoading(false);
    }
  }

  function pickVariant(v) {
    const text = v.content + (v.hashtags?.length ? '\n\n' + v.hashtags.join(' ') : '');
    onInsert?.(text);
    setOpen(false);
    reset();
    toast.success('Inserted into draft');
  }

  function copyVariant(v) {
    const text = v.content + (v.hashtags?.length ? '\n\n' + v.hashtags.join(' ') : '');
    try {
      navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Could not copy');
    }
  }

  return (
    <span ref={wrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <Button
        variant="ghost"
        size={size}
        icon={Sparkles}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{
          color: 'var(--brand-primary-hover)',
          fontWeight: 600,
        }}
      >
        {label}
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label="Write with AI"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            [align === 'right' ? 'right' : 'left']: 0,
            zIndex: 200,
            width: 360,
            maxWidth: '92vw',
            padding: 16,
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {variants.length === 0 ? (
            <>
              <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}>
                  <Sparkles size={14} style={{ color: 'var(--brand-primary-hover)' }} />
                  Write with Social Stats
                </div>
                <Button variant="ghost" size="sm" iconOnly icon={X} aria-label="Close" onClick={() => setOpen(false)} />
              </header>

              <label style={fieldLabel}>What is this post about?</label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    if (!loading) generate();
                  }
                }}
                placeholder="Summer collection drops Friday — soft drinks for soft moments"
                rows={3}
                autoFocus
                style={textareaStyle}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                <div>
                  <label style={fieldLabel}>Platform</label>
                  <select value={plat} onChange={(e) => setPlat(e.target.value)} style={selectStyle}>
                    {PLATFORM_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={fieldLabel}>Tone</label>
                  <select value={tone} onChange={(e) => setTone(e.target.value)} style={selectStyle}>
                    {TONE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              <label style={{ ...fieldLabel, marginTop: 10 }}>Length</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {LENGTH_OPTIONS.map((l) => {
                  const active = length === l.value;
                  return (
                    <button
                      key={l.value}
                      type="button"
                      onClick={() => setLength(l.value)}
                      style={{
                        flex: 1,
                        padding: '7px 10px',
                        minHeight: 'auto', minWidth: 'auto',
                        background: active ? 'var(--brand-primary-soft)' : 'var(--surface-card)',
                        color: active ? 'var(--brand-primary-hover)' : 'var(--text-secondary)',
                        border: `1px solid ${active ? 'var(--brand-primary)' : 'var(--border-default)'}`,
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {l.label}
                    </button>
                  );
                })}
              </div>

              <Button
                onClick={generate}
                size="md"
                fullWidth
                loading={loading}
                style={{ marginTop: 14 }}
                icon={Sparkles}
              >
                {loading ? 'Social Stats is writing…' : 'Generate'}
              </Button>
              <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                Cmd+Enter to generate · Esc to close
              </p>
            </>
          ) : (
            <>
              <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}>
                  <Sparkles size={14} style={{ color: 'var(--brand-primary-hover)' }} />
                  Pick a variant
                </div>
                <Button variant="ghost" size="sm" iconOnly icon={X} aria-label="Close" onClick={() => setOpen(false)} />
              </header>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
                {variants.map((v, i) => (
                  <article
                    key={i}
                    style={{
                      padding: 12,
                      background: 'var(--surface-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                        {v.platform || plat}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        {(v.character_count ?? (v.content || '').length)} chars
                      </span>
                    </div>
                    <div style={{
                      fontSize: 13, lineHeight: 1.55,
                      color: 'var(--text-primary)',
                      whiteSpace: 'pre-wrap',
                      maxHeight: 120, overflow: 'auto',
                    }}>
                      {v.content}
                    </div>
                    {v.hashtags?.length ? (
                      <div style={{ marginTop: 6, fontSize: 12, color: 'var(--brand-primary-hover)' }}>
                        {v.hashtags.join(' ')}
                      </div>
                    ) : null}
                    <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                      <Button size="xs" icon={Check} onClick={() => pickVariant(v)}>Insert</Button>
                      <Button size="xs" variant="ghost" icon={Copy} onClick={() => copyVariant(v)}>Copy</Button>
                    </div>
                  </article>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                <Button size="sm" variant="secondary" icon={RefreshCw} onClick={() => { reset(); }}>Try again</Button>
                <Button size="sm" variant="ghost" onClick={() => { generate(); }} loading={loading}>
                  Regenerate
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </span>
  );
}

const fieldLabel = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--text-tertiary)',
  marginBottom: 4,
};

const textareaStyle = {
  width: '100%',
  minHeight: 60,
  padding: '8px 10px',
  background: 'var(--surface-card)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 13,
  lineHeight: 1.5,
  color: 'var(--text-primary)',
  fontFamily: 'inherit',
  outline: 'none',
  resize: 'vertical',
  boxSizing: 'border-box',
};

const selectStyle = {
  width: '100%',
  padding: '7px 10px',
  background: 'var(--surface-card)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 13,
  color: 'var(--text-primary)',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
};
