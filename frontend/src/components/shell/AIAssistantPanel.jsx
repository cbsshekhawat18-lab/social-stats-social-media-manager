/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles, Wand2, Hash, RefreshCw, Languages, Clock, X, Copy, Check, Loader2,
  Send, Image as ImageIcon, ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

import Button from '../ui/Button';
import { aiAPI } from '../../services/api';

/**
 * Floating AI Assistant — bottom-right launcher + Cmd/Ctrl+J keyboard shortcut.
 *
 * Tabs:
 *   Compose     → /ai/compose-post/      → 3 variants
 *   Hashtags    → /ai/suggest-hashtags/
 *   Rewrite     → /ai/rewrite/
 *   Translate   → /ai/translate/
 *   Best Time   → /ai/best-time-to-post/
 *   Image Caption → /ai/generate-image-caption/
 *
 * Each tab has its own small form. Output panel shows the result with a
 * "Copy" button and a "Use this" button (just copies for now).
 */
const TABS = [
  { id: 'compose',   label: 'Compose',     icon: Wand2 },
  { id: 'hashtags',  label: 'Hashtags',    icon: Hash },
  { id: 'rewrite',   label: 'Rewrite',     icon: RefreshCw },
  { id: 'translate', label: 'Translate',   icon: Languages },
  { id: 'besttime',  label: 'Best Time',   icon: Clock },
  { id: 'imgcap',    label: 'Image Caption', icon: ImageIcon },
];

export default function AIAssistantPanel() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('compose');

  // Cmd/Ctrl+J toggles
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <FloatingLauncher onClick={() => setOpen(true)} active={open} />
      {open && (
        <Panel
          tab={tab} setTab={setTab}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/* ── Launcher button (always visible, bottom-right) ──────────────────── */
function FloatingLauncher({ onClick, active }) {
  if (active) return null;
  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open AI Assistant (Cmd+J)"
      title={`AI Assistant · ${isMac ? '⌘J' : 'Ctrl+J'}`}
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 80,
        width: 52, height: 52, borderRadius: 999,
        border: 'none', cursor: 'pointer', padding: 0,
        background: 'linear-gradient(135deg, #00CCF5, #00A8D8)',
        color: '#fff',
        boxShadow: '0 6px 18px rgba(0, 168, 216, 0.35), 0 2px 6px rgba(0,0,0,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'transform 0.18s cubic-bezier(0.4,0,0.2,1)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px) scale(1.04)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
    >
      <Sparkles size={20} />
    </button>
  );
}

/* ── Panel (modal-ish) ───────────────────────────────────────────────── */
function Panel({ tab, setTab, onClose }) {
  return (
    <div
      role="dialog"
      aria-label="AI Assistant"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(10,14,20,0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 100%)',
          maxHeight: 'min(720px, calc(100vh - 32px))',
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex', flexDirection: 'column',
          color: 'var(--text-primary)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 28, height: 28, borderRadius: 'var(--radius-sm)',
              background: 'linear-gradient(135deg, #00CCF5, #00A8D8)',
              color: '#fff',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Sparkles size={14} />
            </span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Social Stats</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                Cmd/Ctrl + J
              </div>
            </div>
          </div>
          <button
            type="button" onClick={onClose} aria-label="Close"
            style={{
              width: 28, height: 28, borderRadius: 'var(--radius-sm)',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-tertiary)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              minHeight: 'unset', minWidth: 'unset',
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', overflowX: 'auto',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--surface-sunken)',
        }}>
          {TABS.map((t) => {
            const active = t.id === tab;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                style={{
                  flex: '0 0 auto',
                  padding: '10px 14px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: active ? '2px solid var(--brand-primary)' : '2px solid transparent',
                  color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  fontSize: 13, fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  whiteSpace: 'nowrap',
                  minHeight: 'unset', minWidth: 'unset',
                }}
              >
                <Icon size={13} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {tab === 'compose'   && <ComposeTab />}
          {tab === 'hashtags'  && <HashtagsTab />}
          {tab === 'rewrite'   && <RewriteTab />}
          {tab === 'translate' && <TranslateTab />}
          {tab === 'besttime'  && <BestTimeTab />}
          {tab === 'imgcap'    && <ImageCaptionTab />}
        </div>
      </div>
    </div>
  );
}

/* ── Tabs ────────────────────────────────────────────────────────────── */
function ComposeTab() {
  const [topic, setTopic] = useState('');
  const [platforms, setPlatforms] = useState(['instagram']);
  const [tone, setTone] = useState('friendly');
  const [variants, setVariants] = useState(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!topic.trim()) { toast.error('Topic is required'); return; }
    setLoading(true); setVariants(null);
    try {
      const res = await aiAPI.composePost({ topic, platforms, tone });
      setVariants(res.data?.variants || {});
    } catch (e) { toast.error(e.response?.data?.error || 'Compose failed'); }
    finally     { setLoading(false); }
  }

  return (
    <>
      <Field label="Topic">
        <input value={topic} onChange={(e) => setTopic(e.target.value)}
                placeholder="What's the post about?" style={inputStyle} autoFocus />
      </Field>
      <Field label="Platforms">
        <PlatformPills value={platforms} onChange={setPlatforms} />
      </Field>
      <Field label="Tone">
        <select value={tone} onChange={(e) => setTone(e.target.value)} style={inputStyle}>
          {['friendly', 'professional', 'casual', 'inspirational', 'urgent'].map((t) =>
            <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <RunButton loading={loading} onClick={run} label="Compose 3 variants" />

      {variants && Object.entries(variants).map(([p, list]) => (
        <div key={p} style={{ marginTop: 12 }}>
          <div style={sectionLabel}>{p}</div>
          {list.map((v, i) => <ResultBlock key={i} text={v} />)}
        </div>
      ))}
    </>
  );
}

function HashtagsTab() {
  const [content, setContent] = useState('');
  const [platform, setPlatform] = useState('instagram');
  const [count, setCount] = useState(12);
  const [tags, setTags] = useState(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!content.trim()) { toast.error('Content is required'); return; }
    setLoading(true); setTags(null);
    try {
      const res = await aiAPI.suggestHashtags({ content, platform, count });
      setTags(res.data?.hashtags || []);
    } catch (e) { toast.error(e.response?.data?.error || 'Hashtags failed'); }
    finally     { setLoading(false); }
  }

  return (
    <>
      <Field label="Post content">
        <textarea value={content} onChange={(e) => setContent(e.target.value)}
                   rows={4} placeholder="Paste your post text…"
                   style={{ ...inputStyle, height: 'auto', resize: 'vertical' }} />
      </Field>
      <Field label="Platform">
        <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={inputStyle}>
          {['instagram', 'facebook', 'linkedin', 'youtube'].map((p) =>
            <option key={p} value={p}>{p}</option>)}
        </select>
      </Field>
      <Field label="How many">
        <input type="number" min={3} max={30} value={count}
                onChange={(e) => setCount(Number(e.target.value || 12))} style={inputStyle} />
      </Field>
      <RunButton loading={loading} onClick={run} label="Suggest hashtags" />

      {tags && (
        <ResultBlock text={tags.join(' ')} subText={`${tags.length} hashtag${tags.length === 1 ? '' : 's'}`} />
      )}
    </>
  );
}

function RewriteTab() {
  const [text, setText] = useState('');
  const [instr, setInstr] = useState('shorter');
  const [out, setOut] = useState(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!text.trim()) { toast.error('Text is required'); return; }
    setLoading(true); setOut(null);
    try {
      const res = await aiAPI.rewrite({ text, instruction: instr });
      setOut(res.data?.text || '');
    } catch (e) { toast.error(e.response?.data?.error || 'Rewrite failed'); }
    finally     { setLoading(false); }
  }

  return (
    <>
      <Field label="Original text">
        <textarea value={text} onChange={(e) => setText(e.target.value)}
                   rows={5} placeholder="Paste the text you want to rewrite…"
                   style={{ ...inputStyle, height: 'auto', resize: 'vertical' }} />
      </Field>
      <Field label="Transformation">
        <select value={instr} onChange={(e) => setInstr(e.target.value)} style={inputStyle}>
          <option value="shorter">Make shorter</option>
          <option value="longer">Make longer</option>
          <option value="more casual">More casual</option>
          <option value="more formal">More formal</option>
          <option value="more engaging">More engaging</option>
          <option value="rephrase">Rephrase</option>
        </select>
      </Field>
      <RunButton loading={loading} onClick={run} label="Rewrite" />
      {out && <ResultBlock text={out} />}
    </>
  );
}

function TranslateTab() {
  const [text, setText] = useState('');
  const [lang, setLang] = useState('Spanish');
  const [out, setOut] = useState(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!text.trim()) { toast.error('Text is required'); return; }
    setLoading(true); setOut(null);
    try {
      const res = await aiAPI.translate({ text, target_language: lang });
      setOut(res.data?.text || '');
    } catch (e) { toast.error(e.response?.data?.error || 'Translate failed'); }
    finally     { setLoading(false); }
  }

  return (
    <>
      <Field label="Source text">
        <textarea value={text} onChange={(e) => setText(e.target.value)}
                   rows={5} placeholder="Text to translate…"
                   style={{ ...inputStyle, height: 'auto', resize: 'vertical' }} />
      </Field>
      <Field label="Target language">
        <input value={lang} onChange={(e) => setLang(e.target.value)}
                placeholder="e.g. Spanish, French, Japanese" style={inputStyle} />
      </Field>
      <RunButton loading={loading} onClick={run} label="Translate" />
      {out && <ResultBlock text={out} />}
    </>
  );
}

function BestTimeTab() {
  const [platform, setPlatform] = useState('instagram');
  const [slots, setSlots] = useState(null);
  const [source, setSource] = useState(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true); setSlots(null);
    try {
      const res = await aiAPI.bestTimeToPost({ platform });
      setSlots(res.data?.slots || []);
      setSource(res.data?.source || '');
    } catch (e) { toast.error(e.response?.data?.error || 'Best-time failed'); }
    finally     { setLoading(false); }
  }

  return (
    <>
      <Field label="Platform">
        <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={inputStyle}>
          {['instagram', 'facebook', 'linkedin', 'youtube', 'google_my_business'].map((p) =>
            <option key={p} value={p}>{p}</option>)}
        </select>
      </Field>
      <RunButton loading={loading} onClick={run} label="Find best times" />
      {slots && (
        <div style={{ marginTop: 12 }}>
          <div style={sectionLabel}>
            Top 3 slots {source ? `· ${source.replace('_', ' ')}` : ''}
          </div>
          {slots.map((s, i) => (
            <div key={i} style={resultBlockStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600 }}>{s.label}</span>
                {s.score != null && (
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    score {s.score} {s.samples ? `· ${s.samples} samples` : ''}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function ImageCaptionTab() {
  const [imageUrl, setImageUrl] = useState('');
  const [platform, setPlatform] = useState('instagram');
  const [out, setOut] = useState(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!imageUrl.trim()) { toast.error('Image URL is required'); return; }
    setLoading(true); setOut(null);
    try {
      const res = await aiAPI.generateImageCaption({ image_url: imageUrl, platform });
      setOut(res.data?.caption || '');
    } catch (e) { toast.error(e.response?.data?.error || 'Caption failed'); }
    finally     { setLoading(false); }
  }

  return (
    <>
      <Field label="Image URL">
        <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://…/photo.jpg" style={inputStyle} />
      </Field>
      <Field label="Platform">
        <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={inputStyle}>
          {['instagram', 'facebook', 'linkedin', 'youtube'].map((p) =>
            <option key={p} value={p}>{p}</option>)}
        </select>
      </Field>
      <RunButton loading={loading} onClick={run} label="Generate caption" />
      {out && <ResultBlock text={out} />}
    </>
  );
}

/* ── Shared bits ─────────────────────────────────────────────────────── */
function Field({ label, children }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
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

function PlatformPills({ value, onChange }) {
  const all = ['facebook', 'instagram', 'youtube', 'linkedin', 'google_my_business'];
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {all.map((p) => {
        const on = value.includes(p);
        return (
          <button
            key={p} type="button"
            onClick={() => onChange(on ? value.filter((x) => x !== p) : [...value, p])}
            style={{
              padding: '6px 12px', borderRadius: 'var(--radius-pill)',
              border: `1px solid ${on ? 'transparent' : 'var(--border-subtle)'}`,
              background: on ? 'var(--brand-primary-glow)' : 'var(--surface-card)',
              color: on ? 'var(--brand-primary-hover)' : 'var(--text-secondary)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              minHeight: 'unset', minWidth: 'unset',
              transition: 'var(--transition-fast)',
            }}
          >
            {p}
          </button>
        );
      })}
    </div>
  );
}

function RunButton({ loading, onClick, label }) {
  return (
    <Button onClick={onClick} loading={loading} icon={Send}
            fullWidth style={{ marginTop: 4 }}>
      {label}
    </Button>
  );
}

function ResultBlock({ text, subText }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }
  return (
    <div style={resultBlockStyle}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8,
      }}>
        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', flex: 1, fontSize: 13, lineHeight: 1.5 }}>
          {text}
        </div>
        <button
          type="button" onClick={copy}
          aria-label="Copy"
          style={{
            flexShrink: 0,
            width: 28, height: 28, borderRadius: 'var(--radius-sm)',
            background: 'transparent', border: '1px solid var(--border-subtle)',
            color: 'var(--text-tertiary)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            minHeight: 'unset', minWidth: 'unset',
          }}
        >
          {copied ? <Check size={12} color="var(--success)" /> : <Copy size={12} />}
        </button>
      </div>
      {subText && (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>{subText}</div>
      )}
    </div>
  );
}

const inputStyle = {
  width: '100%', height: 36, padding: '0 12px',
  background: 'var(--surface-card)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13, color: 'var(--text-primary)',
  outline: 'none', boxSizing: 'border-box',
  minHeight: 'unset',
};

const sectionLabel = {
  fontSize: 11, fontWeight: 600,
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase', letterSpacing: 0.4,
  marginBottom: 6, marginTop: 4,
};

const resultBlockStyle = {
  padding: '10px 12px',
  background: 'var(--surface-sunken)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  marginTop: 8,
};
