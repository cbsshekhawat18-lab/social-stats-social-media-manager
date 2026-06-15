/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useEffect, useRef, useState } from 'react';
import { Sparkles, RefreshCw, Loader2 } from 'lucide-react';

import Button from '../ui/Button';
import AILoading from './AILoading';
import { aiV2API } from '../../services/api';
import toast from '../ui/toast';

/**
 * AIReplySuggestions — three AI-suggested reply chips that sit above any
 * reply box (Inbox, comments, reviews).
 *
 * Pass either a Social Stats `messageId` / `conversationId` OR raw `messageText`.
 * Click a chip to call `onPick(text)` — typically wired to set the reply
 * input's value. The recommended suggestion is highlighted with brand cyan.
 *
 * Props:
 *   clientId        required for tenant-scoped AI calls
 *   messageId       (optional) Social Stats Message id — preferred input
 *   conversationId  (optional) Social Stats Conversation id (uses last inbound msg)
 *   messageText     (optional) raw text (fallback when ids not available)
 *   platform        platform slug (whatsapp / instagram / facebook / linkedin / ...)
 *   senderName      optional first name of the customer (improves replies)
 *   onPick          (text) => void — called when user clicks a suggestion
 *   autoLoad        bool — fetch suggestions immediately on mount (default true)
 */
const TONE_STYLES = {
  professional: { color: 'var(--info)',           bg: 'var(--info-bg)',           label: 'Professional' },
  friendly:     { color: 'var(--brand-primary-hover)', bg: 'var(--brand-primary-soft)', label: 'Friendly' },
  empathetic:   { color: 'var(--module-ai)',      bg: 'rgba(139,92,246,0.10)',    label: 'Empathetic' },
  warm:         { color: 'var(--success)',        bg: 'var(--success-bg)',        label: 'Warm' },
  apologetic:   { color: 'var(--warning)',        bg: 'var(--warning-bg)',        label: 'Apologetic' },
};

export default function AIReplySuggestions({
  clientId,
  messageId,
  conversationId,
  messageText,
  platform = 'whatsapp',
  senderName = '',
  onPick,
  autoLoad = true,
}) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState('');
  const reqIdRef = useRef(0);

  async function load() {
    if (!clientId) return;
    if (!messageId && !conversationId && !messageText) return;
    const myReq = ++reqIdRef.current;
    setLoading(true);
    setError('');
    try {
      const res = await aiV2API.replySuggest({
        client_id:       clientId,
        message_id:      messageId,
        conversation_id: conversationId,
        message:         messageText,
        platform,
        sender_name:     senderName,
      });
      if (myReq !== reqIdRef.current) return;
      setSuggestions(res.data?.suggestions || []);
      setSummary(res.data?.summary || '');
    } catch (e) {
      if (myReq !== reqIdRef.current) return;
      const msg = e?.response?.data?.error || 'AI suggestions unavailable';
      setError(msg);
    } finally {
      if (myReq === reqIdRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    if (!autoLoad) return;
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [messageId, conversationId, autoLoad]);

  function pick(s) {
    onPick?.(s.text || '');
    toast.success('Suggestion inserted');
  }

  if (!clientId) return null;

  // Header row
  const Header = (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontSize: 11, fontWeight: 600,
        letterSpacing: '0.06em', textTransform: 'uppercase',
        color: 'var(--text-tertiary)',
      }}>
        <Sparkles size={11} style={{ color: 'var(--brand-primary-hover)' }} />
        Social Stats · suggested replies
      </span>
      <button
        type="button"
        onClick={load}
        aria-label="Regenerate suggestions"
        disabled={loading}
        style={{
          minHeight: 'auto', minWidth: 'auto',
          width: 24, height: 24,
          padding: 0, border: 'none',
          background: 'transparent',
          color: 'var(--text-tertiary)',
          cursor: loading ? 'not-allowed' : 'pointer',
          borderRadius: 'var(--radius-sm)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {loading
          ? <Loader2 size={12} style={{ animation: 'ai-spin 0.9s linear infinite' }} />
          : <RefreshCw size={12} />}
      </button>
    </div>
  );

  if (loading && suggestions.length === 0) {
    return (
      <div style={wrapperStyle}>
        {Header}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
          <AILoading variant="inline" label="Drafting three options for you…" />
          <AILoading height={36} />
          <AILoading height={36} />
          <AILoading height={36} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={wrapperStyle}>
        {Header}
        <div style={{ ...emptyRowStyle, color: 'var(--danger)' }}>{error}</div>
      </div>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <div style={wrapperStyle}>
      {Header}
      {summary && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, fontStyle: 'italic' }}>
          {summary}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {suggestions.map((s, i) => {
          const style = TONE_STYLES[(s.tone || '').toLowerCase()] || TONE_STYLES.professional;
          const isRecommended = !!s.recommended;
          return (
            <button
              type="button"
              key={i}
              onClick={() => pick(s)}
              style={{
                textAlign: 'left',
                padding: '10px 12px',
                minHeight: 'auto', minWidth: 'auto',
                fontFamily: 'inherit',
                background: isRecommended ? 'var(--brand-primary-soft)' : 'var(--surface-card)',
                border: `1px solid ${isRecommended ? 'var(--brand-primary)' : 'var(--border-subtle)'}`,
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                transition: 'var(--transition-fast)',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}
              onMouseEnter={(e) => {
                if (!isRecommended) e.currentTarget.style.borderColor = 'var(--border-default)';
              }}
              onMouseLeave={(e) => {
                if (!isRecommended) e.currentTarget.style.borderColor = 'var(--border-subtle)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center',
                  fontSize: 10, fontWeight: 600,
                  letterSpacing: '0.04em', textTransform: 'uppercase',
                  color: style.color, background: style.bg,
                  padding: '2px 6px', borderRadius: 'var(--radius-pill)',
                }}>
                  {style.label}
                </span>
                {isRecommended && (
                  <span style={{
                    fontSize: 10, fontWeight: 600,
                    color: 'var(--brand-primary-hover)',
                    letterSpacing: '0.04em', textTransform: 'uppercase',
                  }}>
                    · Recommended
                  </span>
                )}
              </div>
              <div style={{
                fontSize: 13, lineHeight: 1.5,
                color: 'var(--text-primary)',
              }}>
                {s.text}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const wrapperStyle = {
  padding: '12px 14px',
  marginBottom: 8,
  background: 'var(--surface-sunken)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-lg)',
};

const emptyRowStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 4px',
  fontSize: 12, color: 'var(--text-tertiary)',
};
