/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * TestModeDrawer — slide-in panel that lets the editor fire a test run of
 * the current flow against a tester phone number.
 *
 * Flow:
 *   1. User enters a phone (E.164 ideally — backend normalises).
 *   2. POST /bot-flows/<id>/test/ — server creates a BotConversation, runs
 *      the engine synchronously to the first wait point.
 *   3. Drawer polls /bot-conversations/<conv_id>/ every 1.5s for the
 *      audit trail (steps[]) and renders them as WhatsApp-style bubbles.
 *   4. User can Stop the test (POST /bot-conversations/<id>/end/) or
 *      tap "Restart" to fire a fresh run.
 */
import { useEffect, useRef, useState } from 'react';
import {
  X, PlayCircle, RefreshCw, StopCircle, Sparkles, User, Bot,
  ArrowDown,
} from 'lucide-react';

import { botAPI, botConversationAPI } from '../../services/api';
import toast from '../ui/toast';

const POLL_INTERVAL_MS = 1500;
const ABANDON_AFTER_MS = 5 * 60 * 1000;  // stop polling after 5min idle

export default function TestModeDrawer({ flow, onClose }) {
  const [phone, setPhone]           = useState(localStorage.getItem('bot_test_phone') || '');
  const [conv,  setConv]            = useState(null);
  const [steps, setSteps]           = useState([]);
  const [running, setRunning]       = useState(false);
  const [busy, setBusy]             = useState(false);
  const scrollRef = useRef(null);
  const pollTimer = useRef(null);
  const lastActivityAt = useRef(Date.now());

  // Auto-scroll on new steps
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [steps.length]);

  // Cleanup poll on unmount
  useEffect(() => () => stopPolling(), []);

  function stopPolling() {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }

  function poll(convId) {
    botConversationAPI.get(convId)
      .then((r) => {
        const c = r.data;
        const newSteps = c.steps || [];
        if (newSteps.length !== steps.length) lastActivityAt.current = Date.now();
        setSteps(newSteps);
        setConv(c);
        const stillRunning = c.status === 'active';
        setRunning(stillRunning);

        const idleFor = Date.now() - lastActivityAt.current;
        if (stillRunning && idleFor < ABANDON_AFTER_MS) {
          pollTimer.current = setTimeout(() => poll(convId), POLL_INTERVAL_MS);
        }
      })
      .catch(() => {
        // transient — keep trying
        if (running) pollTimer.current = setTimeout(() => poll(convId), POLL_INTERVAL_MS * 2);
      });
  }

  async function start() {
    if (!phone.trim()) return toast.error('Enter a phone number');
    localStorage.setItem('bot_test_phone', phone.trim());
    setBusy(true); setSteps([]);
    stopPolling();
    try {
      const r = await botAPI.test(flow.id, phone.trim());
      const convId = r.data?.conversation_id;
      if (!convId) throw new Error('No conversation_id returned');
      lastActivityAt.current = Date.now();
      setRunning(true);
      poll(convId);
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not start test run');
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    if (!conv?.id) return;
    stopPolling();
    try { await botConversationAPI.end(conv.id); } catch {}
    setRunning(false);
    botConversationAPI.get(conv.id).then((r) => setConv(r.data)).catch(() => {});
  }

  return (
    <aside style={drawerStyle}>
      {/* Header */}
      <header style={headerStyle}>
        <span style={{
          width: 28, height: 28,
          background: 'var(--brand-gradient)', color: '#fff',
          borderRadius: 'var(--radius-sm)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <PlayCircle size={14} strokeWidth={2.4} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Test mode
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {flow?.name || 'Flow'}
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" style={iconBtn}>
          <X size={14} />
        </button>
      </header>

      {/* Phone + start */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
        <label style={lbl}>Tester phone (E.164)</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={phone} onChange={(e) => setPhone(e.target.value)}
                 placeholder="+91 9876543210" style={inputStyle} />
          {!running ? (
            <button type="button" onClick={start} disabled={busy} style={btnPrimary}>
              {busy ? '…' : <>{steps.length ? <><RefreshCw size={13} /> Restart</> : <><PlayCircle size={13} /> Run</>}</>}
            </button>
          ) : (
            <button type="button" onClick={stop} style={btnDanger}>
              <StopCircle size={13} /> Stop
            </button>
          )}
        </div>
        {conv && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>
            Conversation #{conv.id} · status:{' '}
            <strong style={{
              color: running ? 'var(--success)' :
                     conv.status === 'completed' ? 'var(--success)' :
                     conv.status === 'failed' ? 'var(--danger)' :
                     'var(--text-tertiary)',
            }}>{conv.status}</strong>
          </div>
        )}
      </div>

      {/* Audit trail */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 14, background: 'var(--surface-sunken)' }}>
        {steps.length === 0 && !running && (
          <Empty />
        )}
        {steps.map((s, i) => <StepRow key={s.id || i} step={s} />)}
        {running && (
          <div style={{ display: 'flex', gap: 6, padding: '8px 12px', color: 'var(--text-tertiary)', fontSize: 12 }}>
            <Sparkles size={11} className="ai-loading-pulse" /> Bot is thinking…
            <style>{`@keyframes ai-loading-pulse{0%,100%{opacity:.6}50%{opacity:1}} .ai-loading-pulse{animation:ai-loading-pulse 1.4s ease-in-out infinite}`}</style>
          </div>
        )}
      </div>

      {/* Variables panel */}
      {conv?.variables && Object.keys(conv.variables).filter((k) => !k.startsWith('_')).length > 0 && (
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-card)' }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 4 }}>
            Variables collected
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {Object.entries(conv.variables)
              .filter(([k]) => !k.startsWith('_'))
              .map(([k, v]) => (
                <span key={k} style={{
                  padding: '2px 7px',
                  background: 'var(--surface-sunken)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: 11, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)',
                }}>
                  {k}=<strong>{typeof v === 'object' ? JSON.stringify(v).slice(0, 40) : String(v).slice(0, 40)}</strong>
                </span>
              ))}
          </div>
        </div>
      )}
    </aside>
  );
}

function StepRow({ step }) {
  const isUser = step.direction === 'user_to_bot';
  const isSystem = step.direction === 'system';
  const text = stepText(step);

  if (isSystem) {
    return (
      <div style={{ display: 'flex', gap: 6, padding: '6px 0', justifyContent: 'center' }}>
        <span style={{
          padding: '3px 10px', fontSize: 10, fontWeight: 600,
          background: 'var(--surface-card)', color: 'var(--text-tertiary)',
          border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-pill)',
          letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>
          {step.node_type} {text && `· ${text.slice(0, 50)}`}
        </span>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', gap: 6, marginBottom: 8,
      flexDirection: isUser ? 'row-reverse' : 'row',
    }}>
      <span style={{
        width: 22, height: 22, flexShrink: 0,
        background: isUser ? 'var(--surface-card)' : 'var(--brand-gradient)',
        color: isUser ? 'var(--text-secondary)' : '#fff',
        borderRadius: '50%',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isUser ? <User size={11} /> : <Bot size={11} />}
      </span>
      <div style={{
        maxWidth: '75%',
        padding: '8px 12px',
        fontSize: 13, lineHeight: 1.45,
        background: isUser ? 'var(--surface-card)' : '#dcf8c6',
        color: isUser ? 'var(--text-primary)' : '#1f2c34',
        border: `1px solid ${isUser ? 'var(--border-subtle)' : 'transparent'}`,
        borderRadius: isUser ? '8px 8px 2px 8px' : '8px 8px 8px 2px',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {text || <em style={{ color: 'var(--text-tertiary)' }}>({step.node_type})</em>}
      </div>
    </div>
  );
}

function stepText(s) {
  const p = s.payload || {};
  if (p.text)    return p.text;
  if (p.body)    return p.body + (p.buttons ? `\n${p.buttons.map((b) => `[${b.title}]`).join('  ')}` : '');
  if (p.caption) return p.caption + (p.link ? `\n${p.link}` : '');
  if (p.template_name) return `📨 ${p.template_name}`;
  return '';
}

function Empty() {
  return (
    <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
      <ArrowDown size={20} style={{ opacity: 0.4, marginBottom: 8 }} />
      <div>Enter a phone number above and click Run.</div>
      <p style={{ margin: '8px 0 0', fontSize: 11 }}>
        Use a real WhatsApp number you control — the bot will message it via your Pinbot account.
      </p>
    </div>
  );
}

const drawerStyle = {
  position: 'fixed', top: 0, right: 0, bottom: 0,
  width: 'min(420px, 100vw)',
  background: 'var(--surface-card)',
  borderLeft: '1px solid var(--border-subtle)',
  boxShadow: 'var(--shadow-xl)',
  zIndex: 1100,
  display: 'flex', flexDirection: 'column',
  animation: 'bot-test-slide 220ms ease-out',
};

const headerStyle = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '12px 14px',
  borderBottom: '1px solid var(--border-subtle)',
};

const lbl = {
  display: 'block', fontSize: 11, fontWeight: 600,
  letterSpacing: '0.04em', textTransform: 'uppercase',
  color: 'var(--text-tertiary)', marginBottom: 4,
};
const inputStyle = {
  flex: 1, padding: '8px 10px',
  background: 'var(--surface-sunken)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 13, color: 'var(--text-primary)',
  outline: 'none', fontFamily: 'inherit',
};

const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '0 14px',
  background: 'var(--brand-primary)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius-sm)',
  fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
};
const btnDanger = {
  ...btnPrimary,
  background: 'var(--danger)',
};
const iconBtn = {
  width: 28, height: 28, padding: 0,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent', color: 'var(--text-tertiary)',
  border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
};
