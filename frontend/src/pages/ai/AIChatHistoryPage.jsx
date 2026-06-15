/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * AIChatHistoryPage — full-page browser for past Social Stats conversations.
 *
 * Left: searchable list of conversations (active + archived toggle).
 * Right: selected conversation with all messages.
 *
 * Different from the floating chat panel — this is for re-reading + deleting
 * old threads, not live chat.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Sparkles, MessageSquare, Trash2, Archive, ArchiveRestore,
  Search, Loader2, X, Wrench, AlertTriangle, CheckCircle2,
} from 'lucide-react';

import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { aiV2API } from '../../services/api';
import toast from '../../components/ui/toast';

export default function AIChatHistoryPage() {
  const [conversations, setConversations] = useState([]);
  const [showArchived, setShowArchived]   = useState(false);
  const [selected, setSelected]           = useState(null);  // active conversation_id
  const [thread, setThread]               = useState(null);  // full conversation w/ messages
  const [search, setSearch]               = useState('');
  const [loadingList, setLoadingList]     = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);

  function loadList() {
    setLoadingList(true);
    aiV2API.chatListConversations(showArchived ? { archived: 'true' } : {})
      .then((r) => setConversations(r.data?.conversations || []))
      .catch(() => setConversations([]))
      .finally(() => setLoadingList(false));
  }
  useEffect(loadList, [showArchived]);

  useEffect(() => {
    if (!selected) { setThread(null); return; }
    setLoadingThread(true);
    aiV2API.chatGetConversation(selected)
      .then((r) => setThread(r.data || null))
      .catch(() => toast.error('Failed to load conversation'))
      .finally(() => setLoadingThread(false));
  }, [selected]);

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) => (c.title || '').toLowerCase().includes(q));
  }, [conversations, search]);

  async function archive(id, archived) {
    try {
      await aiV2API.chatPatchConversation(id, { archived });
      toast.success(archived ? 'Archived' : 'Restored');
      loadList();
      if (selected === id) setSelected(null);
    } catch {
      toast.error('Could not update conversation');
    }
  }

  async function deleteConv(id) {
    if (!window.confirm('Delete this conversation? This cannot be undone.')) return;
    try {
      await aiV2API.chatDeleteConversation(id);
      toast.success('Deleted');
      if (selected === id) setSelected(null);
      loadList();
    } catch {
      toast.error('Could not delete');
    }
  }

  return (
    <div className="app-page app-page--lg">
      <PageHeader
        title="Chat History"
        subtitle="Past conversations with Social Stats"
        actions={(
          <Button
            size="sm" variant="ghost"
            icon={showArchived ? ArchiveRestore : Archive}
            onClick={() => { setShowArchived((v) => !v); setSelected(null); }}
          >
            {showArchived ? 'Show active' : 'Show archived'}
          </Button>
        )}
      />

      <div style={twoColStyle} className="ai-history-cols">
        {/* List */}
        <Card padding="none" style={{ minHeight: 480, display: 'flex', flexDirection: 'column' }}>
          <div style={{
            padding: '10px 12px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Search size={14} style={{ color: 'var(--text-tertiary)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations…"
              style={{
                flex: 1, minHeight: 'auto',
                padding: '4px 0',
                background: 'transparent', border: 'none',
                fontSize: 13, color: 'var(--text-primary)',
                outline: 'none', fontFamily: 'inherit',
              }}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loadingList ? (
              <div style={{ padding: 24, textAlign: 'center' }}>
                <Loader2 size={16} style={{ color: 'var(--text-tertiary)', animation: 'spin 1s linear infinite' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title={showArchived ? 'No archived chats' : 'No conversations yet'}
                description={showArchived ? null : 'Press ⌘J anywhere to start a chat with Social Stats.'}
                compact
              />
            ) : (
              filtered.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 12px',
                    borderTop: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    background: selected === c.id ? 'var(--brand-primary-soft)' : 'transparent',
                  }}
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
                      {c.updated_at ? new Date(c.updated_at).toLocaleString(undefined, {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      }) : ''}
                    </div>
                  </div>
                  <Button
                    variant="ghost" size="sm" iconOnly
                    icon={c.archived ? ArchiveRestore : Archive}
                    aria-label={c.archived ? 'Restore' : 'Archive'}
                    onClick={(e) => { e.stopPropagation(); archive(c.id, !c.archived); }}
                  />
                  <Button
                    variant="ghost" size="sm" iconOnly icon={Trash2}
                    aria-label="Delete"
                    onClick={(e) => { e.stopPropagation(); deleteConv(c.id); }}
                  />
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Detail */}
        <Card padding="none" style={{ minHeight: 480, display: 'flex', flexDirection: 'column' }}>
          {!selected ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <EmptyState
                icon={Sparkles}
                title="Pick a conversation"
                description="Click a chat on the left to read it."
                compact
              />
            </div>
          ) : loadingThread ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Loader2 size={20} style={{ color: 'var(--text-tertiary)', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : !thread ? (
            <EmptyState icon={MessageSquare} title="Conversation not found" />
          ) : (
            <>
              <header style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {thread.title || 'Untitled chat'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {thread.created_at ? new Date(thread.created_at).toLocaleString() : ''} · {thread.messages?.length || 0} messages
                  </div>
                </div>
                <Button variant="ghost" size="sm" iconOnly icon={X} aria-label="Close" onClick={() => setSelected(null)} />
              </header>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
                {(thread.messages || []).filter((m) => m.role !== 'system').map((m, i) => (
                  <HistoryMessage key={m.id || i} msg={m} />
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      <style>{`
        @media (max-width: 880px) { .ai-history-cols { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}

function HistoryMessage({ msg }) {
  const isUser = msg.role === 'user';
  // Tool result rows often have empty .content but populated .tool_results
  const text = (msg.content || '').trim();
  const toolResults = msg.tool_results || [];
  const toolCalls   = msg.tool_calls || [];

  // Tool-call summaries (assistant)
  if (!isUser && toolCalls.length > 0 && !text) {
    return (
      <div style={{ marginBottom: 10 }}>
        {toolCalls.map((c, i) => (
          <div key={i} style={toolPillStyle}>
            <Wrench size={11} /> <strong>{c.name}</strong>
          </div>
        ))}
      </div>
    );
  }

  // Pure tool-result rows (saved as user-role messages with tool_results JSON)
  if (isUser && !text && toolResults.length > 0) {
    return (
      <div style={{ marginBottom: 10 }}>
        {toolResults.map((tr, i) => (
          <div key={i} style={{ ...toolPillStyle, color: 'var(--text-tertiary)' }}>
            <CheckCircle2 size={11} style={{ color: 'var(--success)' }} /> tool result
          </div>
        ))}
      </div>
    );
  }

  if (!text) return null;

  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <div style={userBubbleStyle}>{text}</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
      <span style={avatarStyle}>
        <Sparkles size={12} strokeWidth={2.4} />
      </span>
      <div style={assistantTextStyle}>{text}</div>
    </div>
  );
}

// ── styles ─────────────────────────────────────────────────────────────
const twoColStyle = {
  display: 'grid',
  gridTemplateColumns: '320px 1fr',
  gap: 12,
};

const userBubbleStyle = {
  maxWidth: '80%',
  padding: '8px 12px',
  background: 'var(--brand-primary-soft)',
  border: '1px solid var(--brand-primary-glow)',
  color: 'var(--text-primary)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13, lineHeight: 1.55,
  whiteSpace: 'pre-wrap',
};

const avatarStyle = {
  flexShrink: 0,
  width: 22, height: 22,
  borderRadius: '50%',
  background: 'var(--brand-gradient)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  color: '#fff',
  marginTop: 1,
};

const assistantTextStyle = {
  flex: 1,
  fontSize: 13, lineHeight: 1.6,
  color: 'var(--text-primary)',
  whiteSpace: 'pre-wrap',
  padding: '2px 0',
};

const toolPillStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '3px 8px',
  background: 'var(--surface-sunken)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 11, color: 'var(--text-secondary)',
  fontFamily: 'var(--font-mono)',
  marginBottom: 4,
};
