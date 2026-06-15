/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useEffect, useRef, useState } from 'react';
import {
  Sparkles, X, Send, Loader2, Plus, RefreshCw, ThumbsUp, ThumbsDown,
  Wrench, CheckCircle2, AlertTriangle, Copy, ChevronLeft,
} from 'lucide-react';

import Button from '../ui/Button';
import { aiV2API } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import toast from '../ui/toast';

/**
 * AIChatPanel — slide-in right-side panel for Social Stats chat.
 *
 * Props:
 *   open      bool — whether the panel is visible
 *   onClose   () => void
 *   clientId  required for tenant-scoped tools
 *
 * State:
 *   - Active conversation messages (from /ai/v2/chat/conversations/<id>/)
 *   - Input draft + sending flag
 *   - Pending confirmation cards for dangerous tools
 *
 * Streaming is not implemented in this first version — the panel waits for
 * the full agentic loop response and renders the result. Tool runs render
 * inline as small "🔧 Used tool X" cards.
 */
const QUICK_PROMPTS = [
  'How did Instagram perform this week?',
  'Draft 3 Instagram posts about our summer launch',
  'What time should I post tomorrow?',
  'Show me the latest unread inbox messages',
];

export default function AIChatPanel({ open, onClose, clientId }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pendingConfirmations, setPendingConfirmations] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  // Initial conversation list fetch
  useEffect(() => {
    if (!open) return;
    aiV2API.chatListConversations()
      .then((r) => setConversations(r.data?.conversations || []))
      .catch(() => setConversations([]));
  }, [open]);

  // Load active conversation
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      setPendingConfirmations([]);
      return;
    }
    aiV2API.chatGetConversation(activeId)
      .then((r) => {
        setMessages(r.data?.messages || []);
        setPendingConfirmations([]);
      })
      .catch(() => toast.error('Failed to load conversation'));
  }, [activeId]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  // Focus input when panel opens
  useEffect(() => {
    if (open && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 60);
    }
  }, [open]);

  function newChat() {
    setActiveId(null);
    setMessages([]);
    setPendingConfirmations([]);
    setDraft('');
    setShowHistory(false);
  }

  async function send(text, confirm = null) {
    const message = (text || '').trim();
    if (!message && !confirm) return;
    if (!clientId) {
      toast.error('Pick a client first');
      return;
    }
    setSending(true);

    // Optimistic user bubble
    if (message) {
      setMessages((m) => [...m, {
        id: `tmp-${Date.now()}`, role: 'user', content: message,
        tool_calls: [], tool_results: [], created_at: new Date().toISOString(),
      }]);
    }
    setDraft('');

    try {
      const res = await aiV2API.chat({
        client_id:        clientId,
        conversation_id:  activeId || undefined,
        message,
        confirm:          confirm || undefined,
      });
      const data = res.data || {};

      // Adopt new conversation id if first message
      if (!activeId && data.conversation_id) {
        setActiveId(data.conversation_id);
      }

      // Append assistant reply + tool runs as a single rendered turn
      setMessages((m) => [...m, {
        id: `srv-${Date.now()}`,
        role: 'assistant',
        content: data.assistant_message?.content || '',
        tool_calls: data.assistant_message?.tool_calls || [],
        tool_runs: data.tool_runs || [],
        usage: data.usage,
        created_at: new Date().toISOString(),
      }]);
      setPendingConfirmations(data.pending_confirmations || []);

      // Refresh sidebar list
      try {
        const list = await aiV2API.chatListConversations();
        setConversations(list.data?.conversations || []);
      } catch {}
    } catch (e) {
      const msg = e?.response?.data?.error || 'Social Stats is unavailable';
      toast.error(msg);
    } finally {
      setSending(false);
    }
  }

  async function deleteConversation(id) {
    if (!window.confirm('Delete this conversation?')) return;
    try {
      await aiV2API.chatDeleteConversation(id);
      setConversations((cs) => cs.filter((c) => c.id !== id));
      if (activeId === id) newChat();
    } catch {
      toast.error('Could not delete');
    }
  }

  function onKey(e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      send(draft);
    }
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop (mobile only — tap to close) */}
      <div
        onClick={onClose}
        className="ai-chat-backdrop"
        aria-hidden
        style={{
          position: 'fixed', inset: 0, zIndex: 980,
          background: 'rgba(10,14,20,0.30)',
          backdropFilter: 'blur(2px)',
        }}
      />

      <aside
        role="dialog"
        aria-label="Social Stats chat"
        className="ai-chat-panel"
        style={{
          position: 'fixed',
          top: 0, right: 0, bottom: 0,
          width: 'min(440px, 100vw)',
          background: 'var(--surface-card)',
          borderLeft: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-xl)',
          zIndex: 1000,
          display: 'flex', flexDirection: 'column',
          animation: 'ai-chat-slide 280ms var(--ease-out)',
        }}
      >
        {/* Header */}
        <header style={headerStyle}>
          {showHistory ? (
            <Button variant="ghost" size="sm" iconOnly icon={ChevronLeft} aria-label="Back to chat" onClick={() => setShowHistory(false)} />
          ) : (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
            }}>
              <span style={{
                width: 24, height: 24,
                background: 'var(--brand-gradient)',
                borderRadius: 'var(--radius-sm)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff',
              }}>
                <Sparkles size={13} strokeWidth={2.4} />
              </span>
              Social Stats
            </span>
          )}
          <div style={{ flex: 1 }} />
          {!showHistory && (
            <>
              <Button variant="ghost" size="sm" icon={Plus} onClick={newChat}>New</Button>
              <Button variant="ghost" size="sm" onClick={() => setShowHistory(true)}>History</Button>
            </>
          )}
          <Button variant="ghost" size="sm" iconOnly icon={X} aria-label="Close" onClick={onClose} />
        </header>

        {/* Body */}
        {showHistory ? (
          <ConversationList
            list={conversations}
            activeId={activeId}
            onPick={(id) => { setActiveId(id); setShowHistory(false); }}
            onDelete={deleteConversation}
          />
        ) : (
          <div ref={scrollRef} style={messagesContainerStyle}>
            {messages.length === 0 && !sending && (
              <EmptyChat
                onPick={(text) => { setDraft(text); textareaRef.current?.focus(); }}
              />
            )}
            {messages.map((m, i) => <ChatMessage key={m.id || i} msg={m} />)}
            {sending && <TypingIndicator />}

            {/* Pending confirmation cards */}
            {pendingConfirmations.map((p, i) => (
              <ConfirmationCard
                key={`pc-${i}`}
                confirmation={p}
                onConfirm={() => send('', { tool_name: p.tool_name, tool_input: p.tool_input, tool_use_id: p.tool_use_id })}
                onCancel={() => setPendingConfirmations((cs) => cs.filter((_, idx) => idx !== i))}
              />
            ))}
          </div>
        )}

        {/* Input */}
        {!showHistory && (
          <div style={inputContainerStyle}>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              rows={2}
              placeholder="Ask anything — or type / for slash commands…"
              disabled={sending}
              style={textareaStyle}
            />
            <Button
              size="sm"
              iconOnly icon={sending ? Loader2 : Send}
              onClick={() => send(draft)}
              disabled={!draft.trim() || sending}
              aria-label="Send"
              style={{
                alignSelf: 'flex-end',
                color: '#fff',
                background: 'var(--brand-gradient)',
              }}
            />
          </div>
        )}

        <style>{`
          @keyframes ai-chat-slide { from { transform: translateX(100%); } to { transform: translateX(0); } }
          @media (max-width: 640px) {
            .ai-chat-panel { width: 100vw !important; }
          }
          .ai-chat-backdrop { display: none; }
          @media (max-width: 768px) {
            .ai-chat-backdrop { display: block; }
          }
        `}</style>
      </aside>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Message rendering
// ─────────────────────────────────────────────────────────────────────────
function ChatMessage({ msg }) {
  const isUser = msg.role === 'user';
  const text = (msg.content || '').trim();

  return (
    <div style={{ marginBottom: 14 }}>
      {/* Tool runs (assistant only) */}
      {!isUser && (msg.tool_runs?.length > 0 || msg.tool_calls?.length > 0) && (
        <ToolRunStrip runs={msg.tool_runs || []} calls={msg.tool_calls || []} />
      )}

      {/* Bubble — assistant on the left full-width, user right-aligned chip */}
      {text && (
        isUser ? (
          <div style={{
            display: 'flex', justifyContent: 'flex-end',
          }}>
            <div style={{
              maxWidth: '85%',
              padding: '8px 12px',
              background: 'var(--brand-primary-soft)',
              border: '1px solid var(--brand-primary-glow)',
              color: 'var(--text-primary)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13, lineHeight: 1.55,
              whiteSpace: 'pre-wrap',
            }}>
              {text}
            </div>
          </div>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            marginTop: msg.tool_runs?.length ? 10 : 0,
          }}>
            <span style={{
              flexShrink: 0,
              width: 24, height: 24,
              borderRadius: '50%',
              background: 'var(--brand-gradient)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff',
              marginTop: 2,
            }}>
              <Sparkles size={12} strokeWidth={2.4} />
            </span>
            <div style={{
              flex: 1, minWidth: 0,
              padding: '4px 0',
              fontSize: 13, lineHeight: 1.6,
              color: 'var(--text-primary)',
              whiteSpace: 'pre-wrap',
            }}>
              {text}
            </div>
            <Button
              variant="ghost" size="sm" iconOnly icon={Copy}
              aria-label="Copy"
              onClick={() => { try { navigator.clipboard.writeText(text); toast.success('Copied'); } catch { toast.error('Copy failed'); } }}
            />
          </div>
        )
      )}
    </div>
  );
}

function ToolRunStrip({ runs, calls }) {
  // Combine: prefer runs (executed) over calls (just announced)
  const items = (runs && runs.length) ? runs : calls.map((c) => ({ name: c.name, ok: null }));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
      {items.map((r, i) => (
        <div
          key={i}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 8px',
            background: 'var(--surface-sunken)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 11, color: 'var(--text-secondary)',
            alignSelf: 'flex-start',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {r.ok === false
            ? <AlertTriangle size={11} style={{ color: 'var(--danger)' }} />
            : r.ok === true
              ? <CheckCircle2 size={11} style={{ color: 'var(--success)' }} />
              : <Wrench size={11} style={{ color: 'var(--brand-primary-hover)' }} />}
          <span style={{ fontWeight: 500 }}>{r.name}</span>
          {r.error && <span style={{ color: 'var(--danger)' }}>· {String(r.error).slice(0, 60)}</span>}
        </div>
      ))}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <span style={{
        flexShrink: 0,
        width: 24, height: 24,
        borderRadius: '50%',
        background: 'var(--brand-gradient)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff',
      }}>
        <Sparkles size={12} strokeWidth={2.4} />
      </span>
      <div style={{ display: 'inline-flex', gap: 3, alignItems: 'flex-end', height: 16 }}>
        {[0, 0.15, 0.3].map((d, i) => (
          <span
            key={i}
            style={{
              width: 5, height: 5, borderRadius: '50%',
              background: 'var(--brand-primary-hover)',
              animation: 'ai-pulse 1.2s ease-in-out infinite',
              animationDelay: `${d}s`,
            }}
          />
        ))}
        <style>{`
          @keyframes ai-pulse { 0%,80%,100% { opacity: .3; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-3px); } }
        `}</style>
      </div>
    </div>
  );
}

function ConfirmationCard({ confirmation, onConfirm, onCancel }) {
  return (
    <div
      role="alert"
      style={{
        marginTop: 10, marginBottom: 10,
        padding: 14,
        background: 'var(--warning-bg)',
        border: '1px solid var(--warning)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <AlertTriangle size={16} style={{ color: 'var(--warning)', marginTop: 1 }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--warning)' }}>
            Confirm action
          </div>
          <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.55 }}>
            {confirmation.summary || confirmation.tool_name}
          </div>
          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            tool: {confirmation.tool_name}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={onConfirm} icon={CheckCircle2}>Confirm</Button>
      </div>
    </div>
  );
}

function EmptyChat({ onPick }) {
  return (
    <div style={{ padding: '24px 8px' }}>
      <div style={{
        textAlign: 'center', marginBottom: 18,
      }}>
        <div style={{
          width: 44, height: 44,
          margin: '0 auto 12px',
          background: 'var(--brand-gradient)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', boxShadow: 'var(--shadow-brand)',
        }}>
          <Sparkles size={22} strokeWidth={2} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
          Hi, I&apos;m Social Stats
        </div>
        <p style={{ margin: '6px auto 0', maxWidth: 280, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          Ask me about your data, draft posts, reply to your inbox, or get a daily briefing.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {QUICK_PROMPTS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onPick(q)}
            style={{
              textAlign: 'left',
              padding: '10px 12px',
              background: 'var(--surface-sunken)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              fontSize: 12, color: 'var(--text-primary)',
              cursor: 'pointer', fontFamily: 'inherit',
              minHeight: 'auto', minWidth: 'auto',
            }}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function ConversationList({ list, activeId, onPick, onDelete }) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
      <div style={{
        fontSize: 11, fontWeight: 600,
        letterSpacing: '0.06em', textTransform: 'uppercase',
        color: 'var(--text-tertiary)',
        padding: '4px 8px 8px',
      }}>
        Conversations
      </div>
      {list.length === 0 ? (
        <div style={{ padding: 12, fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>
          No conversations yet — start chatting.
        </div>
      ) : (
        list.map((c) => (
          <div
            key={c.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px',
              background: c.id === activeId ? 'var(--brand-primary-soft)' : 'transparent',
              border: c.id === activeId ? '1px solid var(--brand-primary)' : '1px solid transparent',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 2, cursor: 'pointer',
            }}
            onClick={() => onPick(c.id)}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 500,
                color: 'var(--text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {c.title || 'Untitled chat'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                {c.updated_at ? new Date(c.updated_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
              </div>
            </div>
            <Button
              variant="ghost" size="sm" iconOnly icon={X}
              aria-label="Delete conversation"
              onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
            />
          </div>
        ))
      )}
    </div>
  );
}

const headerStyle = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '12px 14px',
  borderBottom: '1px solid var(--border-subtle)',
  background: 'var(--surface-card)',
};

const messagesContainerStyle = {
  flex: 1,
  overflowY: 'auto',
  padding: '16px 14px',
  background: 'var(--surface-page)',
};

const inputContainerStyle = {
  display: 'flex', gap: 8, alignItems: 'flex-end',
  padding: '10px 12px 14px',
  borderTop: '1px solid var(--border-subtle)',
  background: 'var(--surface-card)',
};

const textareaStyle = {
  flex: 1, minHeight: 40,
  padding: '8px 12px',
  background: 'var(--surface-sunken)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13, fontFamily: 'inherit',
  color: 'var(--text-primary)',
  outline: 'none', resize: 'vertical',
  boxSizing: 'border-box',
};
