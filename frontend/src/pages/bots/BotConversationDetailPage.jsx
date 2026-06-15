/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * BotConversationDetailPage — full step-by-step view of a BotConversation.
 *
 * Layout: hero (contact + flow + status) → action bar (handoff / end) →
 * 2-column body: timeline (left, big) + variables panel (right, sticky).
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, User, Bot, Clock, RefreshCw, UserPlus, StopCircle, Sparkles,
  CheckCircle2, AlertTriangle, Wand2, Copy,
} from 'lucide-react';

import { botConversationAPI } from '../../services/api';
import toast from '../../components/ui/toast';

const STATUS_META = {
  active:     { label: 'Active',     color: 'var(--success)',     icon: Sparkles },
  completed:  { label: 'Completed',  color: 'var(--success)',     icon: CheckCircle2 },
  abandoned:  { label: 'Abandoned',  color: 'var(--text-tertiary)', icon: Clock },
  handed_off: { label: 'Handed off', color: 'var(--info)',        icon: UserPlus },
  failed:     { label: 'Failed',     color: 'var(--danger)',      icon: AlertTriangle },
  exited:     { label: 'Exited',     color: 'var(--text-tertiary)', icon: Clock },
};

export default function BotConversationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [conv,    setConv]    = useState(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    botConversationAPI.get(id)
      .then((r) => setConv(r.data))
      .catch(() => toast.error('Could not load conversation'))
      .finally(() => setLoading(false));
  }
  useEffect(load, [id]);

  // Auto-refresh every 3s while active
  useEffect(() => {
    if (!conv || conv.status !== 'active') return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [conv?.status]); // eslint-disable-line

  async function handoff() {
    try {
      await botConversationAPI.handoff(id, {});
      toast.success('Handed off to a teammate');
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not hand off');
    }
  }
  async function end() {
    if (!window.confirm('Force-end this conversation?')) return;
    try {
      await botConversationAPI.end(id);
      toast.success('Conversation ended');
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not end');
    }
  }

  if (loading || !conv) {
    return <div style={{ padding: 32, color: 'var(--text-tertiary)' }}>Loading…</div>;
  }

  const meta = STATUS_META[conv.status] || STATUS_META.active;
  const StatusIcon = meta.icon;
  const cleanVars = Object.entries(conv.variables || {}).filter(([k]) => !k.startsWith('_'));

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Link to="/admin/conversations" style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', alignSelf: 'flex-start',
      }}>
        <ArrowLeft size={14} /> All conversations
      </Link>

      {/* Hero */}
      <header style={{
        padding: 18,
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap',
      }}>
        <span style={{
          width: 48, height: 48, flexShrink: 0,
          background: 'var(--brand-primary-glow)', color: 'var(--brand-primary-hover)',
          borderRadius: 'var(--radius-md)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <User size={22} strokeWidth={2.2} />
        </span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {conv.contact_name || conv.contact_phone || `Contact #${conv.contact}`}
          </h1>
          <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-secondary)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {conv.contact_phone && <code>{conv.contact_phone}</code>}
            {conv.flow_name && <span>Flow: <strong style={{ color: 'var(--text-primary)' }}>{conv.flow_name}</strong></span>}
            <span>Triggered via <code>{conv.triggered_via}</code></span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '4px 12px',
            color: meta.color, border: `1px solid ${meta.color}`, background: 'transparent',
            borderRadius: 'var(--radius-pill)',
            fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
          }}>
            <StatusIcon size={12} /> {meta.label}
          </span>
          {conv.ai_takeover_active && (
            <span style={{
              padding: '2px 10px',
              background: 'var(--brand-primary-soft)', color: 'var(--brand-primary-hover)',
              border: '1px solid var(--brand-primary)',
              borderRadius: 'var(--radius-pill)',
              fontSize: 11, fontWeight: 600,
            }}>
              AI takeover active
            </span>
          )}
        </div>
      </header>

      {/* Action bar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={load} aria-label="Refresh" style={btnGhost}>
          <RefreshCw size={13} /> Refresh
        </button>
        {conv.status === 'active' && (
          <>
            <button type="button" onClick={handoff} style={btnPrimary}>
              <UserPlus size={13} /> Hand off to human
            </button>
            <button type="button" onClick={end} style={btnDanger}>
              <StopCircle size={13} /> End conversation
            </button>
          </>
        )}
        {conv.lead && (
          <Link to={`/admin/leads/${conv.lead}`} style={btnGhost}>
            <Bot size={13} /> View captured lead
          </Link>
        )}
      </div>

      {/* 2-col body */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) 280px', gap: 14 }} className="bot-conv-grid">
        {/* Timeline */}
        <section style={{
          padding: 16,
          background: 'var(--surface-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
        }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            Timeline <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>· {conv.steps?.length || 0} steps</span>
          </h3>
          {(conv.steps || []).length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: 13 }}>No steps recorded.</p>
          ) : (
            <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {conv.steps.map((s) => <Step key={s.id} step={s} />)}
            </ol>
          )}
        </section>

        {/* Right rail */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* AI suggestions — only when handed off, otherwise the bot is driving */}
          {conv.status === 'handed_off' && <AISuggestions conversationId={conv.id} />}

          {/* Variables */}
          <div style={{
            padding: 14,
            background: 'var(--surface-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
          }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Variables
            </h3>
            {cleanVars.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>None collected yet.</p>
            ) : (
              <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {cleanVars.map(([k, v]) => (
                  <div key={k} style={{
                    padding: '6px 8px',
                    background: 'var(--surface-sunken)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 12,
                  }}>
                    <dt style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{k}</dt>
                    <dd style={{ margin: '2px 0 0', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                      {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          {/* Trigger metadata */}
          {conv.trigger_metadata && Object.keys(conv.trigger_metadata).length > 0 && (
            <div style={{
              padding: 14,
              background: 'var(--surface-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
            }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Trigger source
              </h3>
              <pre style={{
                margin: 0, fontSize: 11, color: 'var(--text-secondary)',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                fontFamily: 'var(--font-mono)',
              }}>
                {JSON.stringify(conv.trigger_metadata, null, 2)}
              </pre>
            </div>
          )}

          {/* Path so far */}
          {conv.path_history && conv.path_history.length > 0 && (
            <div style={{
              padding: 14,
              background: 'var(--surface-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
            }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Path so far
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                {conv.path_history.map((nodeId, i) => (
                  <span key={i} style={{
                    padding: '2px 7px',
                    background: 'var(--surface-sunken)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-pill)',
                    color: 'var(--text-secondary)',
                  }}>
                    {nodeId}
                  </span>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      <style>{`
        @media (max-width: 880px) {
          .bot-conv-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function Step({ step }) {
  const isUser = step.direction === 'user_to_bot';
  const isSystem = step.direction === 'system';
  const text = (step.payload?.text || step.payload?.body || step.payload?.caption || '').toString();
  const Icon = isUser ? User : isSystem ? Sparkles : Bot;

  if (isSystem) {
    return (
      <li style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
        <span style={{
          padding: '3px 10px', fontSize: 10, fontWeight: 600,
          letterSpacing: '0.04em', textTransform: 'uppercase',
          color: 'var(--text-tertiary)',
          background: 'var(--surface-sunken)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-pill)',
          fontFamily: 'var(--font-mono)',
        }}>
          {step.node_type}
          {step.payload?.error && <strong style={{ color: 'var(--danger)', marginLeft: 6 }}>· {step.payload.error}</strong>}
        </span>
      </li>
    );
  }

  return (
    <li style={{
      display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row',
      gap: 8, padding: '4px 0',
    }}>
      <span style={{
        width: 26, height: 26, flexShrink: 0,
        background: isUser ? 'var(--surface-card)' : 'var(--brand-gradient)',
        color: isUser ? 'var(--text-secondary)' : '#fff',
        borderRadius: '50%',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={12} />
      </span>
      <div style={{
        maxWidth: '75%',
        padding: '8px 12px',
        background: isUser ? 'var(--surface-sunken)' : '#dcf8c6',
        color: isUser ? 'var(--text-primary)' : '#1f2c34',
        borderRadius: isUser ? '8px 8px 2px 8px' : '8px 8px 8px 2px',
        fontSize: 13, lineHeight: 1.45,
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.6, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
          {step.node_type}
        </div>
        {text || <em style={{ opacity: 0.5 }}>(no text)</em>}
        {step.payload?.buttons && (
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {step.payload.buttons.map((b, i) => (
              <span key={i} style={{
                padding: '4px 10px', textAlign: 'center', fontSize: 11, fontWeight: 500,
                background: '#fff', color: '#075e54',
                border: '1px solid rgba(0,0,0,0.06)', borderRadius: 4,
              }}>{b.title}</span>
            ))}
          </div>
        )}
        <div style={{ marginTop: 4, fontSize: 10, color: 'rgba(0,0,0,0.4)', textAlign: 'right' }}>
          {step.created_at ? new Date(step.created_at).toLocaleTimeString() : ''}
        </div>
      </div>
    </li>
  );
}

function AISuggestions({ conversationId }) {
  const [items, setItems] = useState([]);
  const [busy, setBusy]   = useState(false);

  async function fetchSuggestions() {
    setBusy(true);
    try {
      const r = await botConversationAPI.suggestReplies(conversationId);
      setItems(r.data?.suggestions || []);
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not get suggestions');
    } finally { setBusy(false); }
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied — paste into WhatsApp');
    } catch {
      toast.error('Could not copy');
    }
  }

  return (
    <div style={{
      padding: 14,
      background: 'var(--brand-primary-soft)',
      border: '1px solid var(--brand-primary-glow)',
      borderRadius: 'var(--radius-md)',
    }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <Wand2 size={13} style={{ color: 'var(--brand-primary-hover)' }} />
        <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--brand-primary-hover)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          AI reply suggestions
        </h3>
      </header>
      {items.length === 0 ? (
        <button type="button" onClick={fetchSuggestions} disabled={busy} style={{
          width: '100%', padding: '8px 12px',
          background: 'var(--brand-primary)', color: '#fff',
          border: 'none', borderRadius: 'var(--radius-sm)',
          fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
          cursor: busy ? 'wait' : 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <Sparkles size={12} /> {busy ? 'Thinking…' : 'Suggest 3 replies'}
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((s, i) => (
            <button key={i} type="button" onClick={() => copy(s)} style={{
              padding: '8px 10px', textAlign: 'left',
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12, color: 'var(--text-primary)', fontFamily: 'inherit',
              cursor: 'pointer', lineHeight: 1.4,
              display: 'flex', alignItems: 'flex-start', gap: 6,
            }}>
              <Copy size={11} style={{ flexShrink: 0, marginTop: 2, color: 'var(--text-tertiary)' }} />
              <span>{s}</span>
            </button>
          ))}
          <button type="button" onClick={fetchSuggestions} disabled={busy} style={{
            padding: '6px 10px', alignSelf: 'flex-start',
            background: 'transparent', color: 'var(--brand-primary-hover)',
            border: 'none', borderRadius: 'var(--radius-sm)',
            fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <RefreshCw size={11} /> {busy ? 'Refreshing…' : 'Get fresh suggestions'}
          </button>
        </div>
      )}
    </div>
  );
}

const btnPrimary = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--brand-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', textDecoration: 'none' };
const btnGhost   = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--surface-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', textDecoration: 'none' };
const btnDanger  = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' };
