/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * BentoPreviews — small animated UI peeks used inside FeatureBento tiles.
 * Each preview is intentionally lightweight (pure HTML/SVG, framer-motion
 * for the few animated bits) so 8 of them on one page don't tank perf.
 *
 * Every preview honours `prefers-reduced-motion` via framer-motion's
 * `useReducedMotion` hook (used inside the bits that genuinely animate).
 */
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowUpRight, Send, Zap, Bot, Sparkles, BarChart3,
  Calendar, FileText, MessageCircle, TrendingUp,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// 1. AI Assistant — chat with streaming reply
// ─────────────────────────────────────────────────────────────────────────────
export function AIAssistantPreview() {
  return (
    <div style={cardStyle}>
      <Bubble side="user" tone="cyan">Write 3 posts for our new property launch</Bubble>
      <Bubble side="ai">
        Here are three drafts tuned to your brand voice
        <span style={dotsStyle}>
          <span style={dot(0)} /><span style={dot(0.15)} /><span style={dot(0.3)} />
        </span>
      </Bubble>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Composer — multi-platform tabs
// ─────────────────────────────────────────────────────────────────────────────
export function ComposerPreview() {
  const platforms = [
    { name: 'Instagram', tone: '#E4405F', active: true },
    { name: 'Facebook',  tone: '#1877F2' },
    { name: 'LinkedIn',  tone: '#0A66C2' },
  ];
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {platforms.map((p) => (
          <span key={p.name} style={{
            padding: '4px 10px',
            fontSize: 10, fontWeight: 600,
            color: p.active ? '#fff' : 'var(--text-tertiary)',
            background: p.active ? p.tone : 'var(--surface-sunken)',
            border: `1px solid ${p.active ? p.tone : 'var(--border-subtle)'}`,
            borderRadius: 'var(--radius-pill)',
          }}>{p.name}</span>
        ))}
      </div>
      <div style={{
        padding: 10,
        background: 'var(--surface-sunken)',
        borderRadius: 'var(--radius-sm)',
        fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5,
      }}>
        New launch — luxury 3BHK at <strong style={{ color: 'var(--text-primary)' }}>Acme Heights</strong>. Rooftop pool, smart home, ready to move in. Site visits open this weekend 🌅
      </div>
      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Auto-resized for IG · 220 chars</span>
        <Send size={11} style={{ color: '#00CCF5' }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Inbox — chat list across platforms
// ─────────────────────────────────────────────────────────────────────────────
export function InboxPreview() {
  const messages = [
    { name: 'Priya S.',    plat: 'IG', text: 'Is this still available?',     tone: '#E4405F', delay: 0 },
    { name: 'Acme Group',  plat: 'WA', text: 'Can we visit on Saturday?',    tone: '#25D366', delay: 0.15 },
    { name: 'Rahul Verma', plat: 'FB', text: 'What is the price range?',     tone: '#1877F2', delay: 0.3 },
  ];
  return (
    <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
      {messages.map((m, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -8 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ delay: 0.2 + m.delay, duration: 0.4 }}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px',
            borderBottom: i < messages.length - 1 ? '1px solid var(--border-subtle)' : 'none',
          }}
        >
          <span style={{
            width: 26, height: 26, flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: m.tone, color: '#fff',
            borderRadius: '50%',
            fontSize: 9, fontWeight: 700,
          }}>{m.plat}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {m.text}
            </div>
          </div>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#00CCF5', flexShrink: 0,
          }} />
        </motion.div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Bot Builder — node graph with edges
// ─────────────────────────────────────────────────────────────────────────────
export function BotBuilderPreview() {
  return (
    <svg viewBox="0 0 240 130" preserveAspectRatio="xMidYMid meet"
         style={{ width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id="bb-edge" x1="0" x2="1">
          <stop offset="0%"   stopColor="#00CCF5" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      {/* Edges */}
      <motion.path d="M 50 30 L 110 30" stroke="url(#bb-edge)" strokeWidth="1.5" fill="none"
                   initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.3 }} />
      <motion.path d="M 170 30 L 230 65" stroke="url(#bb-edge)" strokeWidth="1.5" fill="none"
                   initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.6 }} />
      <motion.path d="M 170 30 L 110 100" stroke="url(#bb-edge)" strokeWidth="1.5" fill="none"
                   initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.6 }} />

      {/* Nodes */}
      <Node x={20}  y={30} label="Start"   tone="#00CCF5" />
      <Node x={140} y={30} label="Ask"     tone="#a78bfa" delay={0.4} />
      <Node x={200} y={65} label="Capture" tone="#34d399" delay={0.8} />
      <Node x={80}  y={100} label="Reply"  tone="#fbbf24" delay={0.8} />
    </svg>
  );
}

function Node({ x, y, label, tone, delay = 0.1 }) {
  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.6 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.4 }}
    >
      <rect x={x} y={y - 10} width={60} height={20}
            rx={6} fill="var(--surface-elevated)"
            stroke={tone} strokeWidth="1.2" />
      <circle cx={x + 6} cy={y} r={3} fill={tone} />
      <text x={x + 14} y={y + 3.5}
            fontSize="9" fontWeight="600"
            fill="var(--text-primary)"
            fontFamily="Inter, sans-serif">{label}</text>
    </motion.g>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. AI Insights — alert card with metric
// ─────────────────────────────────────────────────────────────────────────────
export function AIInsightPreview() {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{
          width: 22, height: 22, borderRadius: '50%',
          background: 'rgba(245, 158, 11, 0.15)',
          color: '#f59e0b',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}><Sparkles size={11} /></span>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b',
                       textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          AI insight · just now
        </span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.45 }}>
        Engagement dropped 30% on Tuesdays
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
        Try moving your Tuesday post to 7pm — your audience is most active then.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Automations — IF/THEN rule chain
// ─────────────────────────────────────────────────────────────────────────────
export function AutomationsPreview() {
  return (
    <div style={cardStyle}>
      <div style={ruleRowStyle}>
        <span style={kindStyle('cyan')}>IF</span>
        <span style={ruleTextStyle}>Comment matches keyword "price"</span>
      </div>
      <ChainArrow />
      <div style={ruleRowStyle}>
        <span style={kindStyle('purple')}>THEN</span>
        <span style={ruleTextStyle}>Reply with template <strong style={{ color: 'var(--text-primary)' }}>"Pricing"</strong></span>
      </div>
      <ChainArrow />
      <div style={ruleRowStyle}>
        <span style={kindStyle('green')}>AND</span>
        <span style={ruleTextStyle}>Tag contact as <strong style={{ color: 'var(--text-primary)' }}>hot lead</strong></span>
      </div>
    </div>
  );
}

function ChainArrow() {
  return (
    <div aria-hidden style={{ height: 14, marginLeft: 16, display: 'flex', alignItems: 'center' }}>
      <span style={{
        display: 'block', width: 1.5, height: '100%',
        background: 'linear-gradient(to bottom, #00CCF5, #8b5cf6)',
      }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Analytics — sparkline chart
// ─────────────────────────────────────────────────────────────────────────────
export function AnalyticsPreview() {
  const reduced = useReducedMotion();
  const path = 'M 0 60 L 30 50 L 60 55 L 90 40 L 120 30 L 150 38 L 180 22 L 210 18 L 240 10';
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>Reach · 30d</span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 2,
          fontSize: 11, fontWeight: 700, color: 'var(--success)',
        }}><TrendingUp size={11} /> +23%</span>
      </div>
      <svg viewBox="0 0 240 80" style={{ width: '100%', height: 80 }}>
        <defs>
          <linearGradient id="ana-line" x1="0" x2="1">
            <stop offset="0%"  stopColor="#00CCF5" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
          <linearGradient id="ana-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#00CCF5" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#00CCF5" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path d={path + ' L 240 80 L 0 80 Z'} fill="url(#ana-fill)"
                     initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
                     viewport={{ once: true }} transition={{ delay: 0.6, duration: 0.5 }} />
        <motion.path d={path} fill="none" stroke="url(#ana-line)" strokeWidth="2" strokeLinecap="round"
                     initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }}
                     viewport={{ once: true }} transition={{ duration: reduced ? 0 : 1.2, ease: 'easeOut' }} />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-tertiary)' }}>
        <span>Apr 1</span><span>Apr 15</span><span>Apr 30</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Reports — PDF preview card
// ─────────────────────────────────────────────────────────────────────────────
export function ReportsPreview() {
  return (
    <div style={{ ...cardStyle, position: 'relative', overflow: 'hidden' }}>
      <div style={{
        padding: 12,
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 'var(--radius-sm)',
        color: '#0f172a',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          paddingBottom: 8, borderBottom: '1px solid #e2e8f0',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700 }}>Acme Realty · April</span>
          <FileText size={11} style={{ color: '#64748b' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <ReportStat label="Reach"  value="248K" />
          <ReportStat label="Posts"  value="42"   />
          <ReportStat label="Leads"  value="312"  />
        </div>
        <div style={{ marginTop: 8, height: 24, background: 'linear-gradient(90deg, #00CCF5 65%, #e2e8f0 65%)',
                      borderRadius: 4 }} />
        <div style={{ marginTop: 6, fontSize: 9, color: '#64748b' }}>
          AI summary: Your reach grew 23% MoM, driven by Reels…
        </div>
      </div>
    </div>
  );
}

function ReportStat({ label, value }) {
  return (
    <div style={{ flex: 1, padding: '6px 8px', background: '#f8fafc', borderRadius: 4 }}>
      <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared bits
// ─────────────────────────────────────────────────────────────────────────────
const cardStyle = {
  padding: 14,
  background: 'var(--surface-sunken)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  display: 'flex', flexDirection: 'column', gap: 8,
  height: '100%',
};

function Bubble({ side, tone = 'plain', children }) {
  const isUser = side === 'user';
  const cyan = tone === 'cyan';
  return (
    <div style={{
      alignSelf: isUser ? 'flex-end' : 'flex-start',
      maxWidth: '88%',
      padding: '8px 12px',
      fontSize: 12, lineHeight: 1.5,
      color: cyan ? 'var(--brand-primary-hover)' : 'var(--text-primary)',
      background: cyan ? 'var(--brand-primary-soft)' : 'var(--surface-card)',
      border: cyan ? 'none' : '1px solid var(--border-subtle)',
      borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
    }}>
      {children}
    </div>
  );
}

const dotsStyle = {
  display: 'inline-flex', gap: 3, marginLeft: 6, verticalAlign: 'middle',
};

const dot = (delay) => ({
  width: 4, height: 4, borderRadius: '50%',
  background: 'var(--text-tertiary)', display: 'inline-block',
  animation: `mkt-dot 1.4s ease-in-out ${delay}s infinite`,
});

const ruleRowStyle = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '6px 10px',
  background: 'var(--surface-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 11, color: 'var(--text-secondary)',
};

const ruleTextStyle = {
  flex: 1, minWidth: 0,
};

const kindStyle = (tone) => {
  const colors = {
    cyan:   { color: '#00CCF5', bg: 'rgba(0,204,245,0.1)' },
    purple: { color: '#a78bfa', bg: 'rgba(139,92,246,0.1)' },
    green:  { color: '#34d399', bg: 'rgba(16,185,129,0.1)' },
  }[tone];
  return {
    padding: '2px 8px',
    fontSize: 9, fontWeight: 700,
    color: colors.color, background: colors.bg,
    borderRadius: 'var(--radius-pill)',
    letterSpacing: '0.06em',
  };
};

// Inject dot keyframes once globally (defined inline with `<style>` in the component tree)
if (typeof document !== 'undefined' && !document.getElementById('mkt-bento-keyframes')) {
  const style = document.createElement('style');
  style.id = 'mkt-bento-keyframes';
  style.textContent = `
    @keyframes mkt-dot {
      0%, 80%, 100% { opacity: 0.2; transform: translateY(0); }
      40%           { opacity: 1;   transform: translateY(-2px); }
    }
  `;
  document.head.appendChild(style);
}
