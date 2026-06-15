/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Inbox, Zap, MessageCircle, BarChart3, Sparkles } from 'lucide-react';

/**
 * DashboardMockup — stylised hero visual.
 *
 * Renders a fake Social Stats dashboard panel + three floating UI cards drifting
 * around it. The dashboard panel tilts slightly with the cursor on desktop;
 * on touch / reduced-motion it stays still. Pure CSS + framer-motion;
 * no real data.
 */
export default function DashboardMockup() {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const wrapRef = useRef(null);

  function onMouseMove(e) {
    if (!wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    const x = (e.clientX - r.left - r.width / 2)  / r.width;
    const y = (e.clientY - r.top  - r.height / 2) / r.height;
    setTilt({ x, y });
  }
  function onMouseLeave() { setTilt({ x: 0, y: 0 }); }

  return (
    <div
      ref={wrapRef}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 720,
        aspectRatio: '5 / 4',
        perspective: 1200,
      }}
      aria-hidden
    >
      {/* Decorative blurred halo behind the panel */}
      <div
        style={{
          position: 'absolute',
          inset: '-10% -10% -10% -10%',
          background: 'var(--brand-mesh)',
          opacity: 0.55,
          filter: 'blur(72px) saturate(140%)',
          zIndex: 0,
        }}
      />

      {/* Main dashboard panel */}
      <motion.div
        animate={{
          rotateX: tilt.y * -6,
          rotateY: tilt.x *  6,
        }}
        transition={{ type: 'spring', stiffness: 80, damping: 20 }}
        style={{
          position: 'absolute',
          inset: '6% 10% 8% 6%',
          background: 'var(--surface-card)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
          transformStyle: 'preserve-3d',
          zIndex: 1,
        }}
      >
        <PanelHeader />
        <PanelStats />
        <PanelChart />
      </motion.div>

      {/* Floating cards */}
      <FloatingCard
        style={{ top: '4%', right: '2%', maxWidth: 220 }}
        delay={0.1}
        amplitude={6}
        icon={Inbox}
        color="var(--module-messaging)"
        title="3 new replies"
        body="Anika and Rahul replied in your inbox."
      />
      <FloatingCard
        style={{ bottom: '4%', left: '0%', maxWidth: 240 }}
        delay={0.4}
        amplitude={8}
        icon={Sparkles}
        color="var(--module-ai)"
        title="AI suggestion"
        body="Post around 6 PM Thursday for +18% reach."
      />
      <FloatingCard
        style={{ bottom: '22%', right: '-3%', maxWidth: 200 }}
        delay={0.7}
        amplitude={5}
        icon={Zap}
        color="var(--brand-primary-hover)"
        title="Automation ran"
        body="Replied to 12 mentions in 2 minutes."
      />
    </div>
  );
}

// ── Panel pieces ────────────────────────────────────────────────────────
function PanelHeader() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 14px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--surface-sunken)',
      }}
    >
      <span style={dotStyle('#ef4444')} />
      <span style={dotStyle('#f59e0b')} />
      <span style={dotStyle('#10b981')} />
      <div style={{ flex: 1 }} />
      <div
        style={{
          fontSize: 10,
          fontWeight: 500,
          color: 'var(--text-tertiary)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        socialstats.app/dashboard
      </div>
    </div>
  );
}

function PanelStats() {
  const STATS = [
    { label: 'Followers',  value: '128,540', delta: '+8.2%', icon: TrendingUp, color: 'var(--success)' },
    { label: 'Engagement', value: '24.7K',   delta: '+14%',  icon: BarChart3,  color: 'var(--brand-primary-hover)' },
    { label: 'Inbox',      value: '12 new',  delta: 'Today', icon: MessageCircle, color: 'var(--module-messaging)' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, padding: 14 }}>
      {STATS.map((s) => (
        <div
          key={s.label}
          style={{
            padding: 12,
            background: 'var(--surface-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <s.icon size={11} style={{ color: s.color }} strokeWidth={2.4} />
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--text-tertiary)',
              }}
            >
              {s.label}
            </span>
          </div>
          <div style={{ marginTop: 6, fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
            {s.value}
          </div>
          <div style={{ marginTop: 2, fontSize: 10, color: s.color, fontWeight: 500 }}>{s.delta}</div>
        </div>
      ))}
    </div>
  );
}

function PanelChart() {
  return (
    <div style={{ padding: '0 14px 14px' }}>
      <div
        style={{
          padding: 14,
          borderRadius: 'var(--radius-md)',
          background: 'var(--surface-card)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>Performance</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {['1D', '7D', '30D'].map((p, i) => (
              <span
                key={p}
                style={{
                  fontSize: 9,
                  fontWeight: 500,
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-xs)',
                  color: i === 1 ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  background: i === 1 ? 'var(--surface-hover)' : 'transparent',
                }}
              >
                {p}
              </span>
            ))}
          </div>
        </div>
        <svg width="100%" height={80} viewBox="0 0 240 80" preserveAspectRatio="none">
          <defs>
            <linearGradient id="dm-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00CCF5" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#00CCF5" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {/* Faint grid lines */}
          {[0, 25, 50, 75].map((y) => (
            <line key={y} x1="0" x2="240" y1={y + 4} y2={y + 4} stroke="var(--border-subtle)" strokeDasharray="2 4" />
          ))}
          {/* Animated path draw */}
          <motion.path
            d="M0 60 L20 52 L40 56 L60 40 L80 44 L100 30 L120 36 L140 24 L160 28 L180 18 L200 22 L220 14 L240 10"
            fill="none"
            stroke="#00CCF5"
            strokeWidth="2.4"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
          />
          <motion.path
            d="M0 60 L20 52 L40 56 L60 40 L80 44 L100 30 L120 36 L140 24 L160 28 L180 18 L200 22 L220 14 L240 10 L240 80 L0 80 Z"
            fill="url(#dm-fill)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          />
        </svg>
      </div>
    </div>
  );
}

function FloatingCard({ style, delay = 0, amplitude = 6, icon: Icon, color, title, body }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{
        opacity: 1,
        y: [0, -amplitude, 0, amplitude * 0.8, 0],
      }}
      transition={{
        opacity: { duration: 0.6, delay },
        y: { duration: 7, ease: 'easeInOut', repeat: Infinity, delay: delay + 0.4 },
      }}
      style={{
        position: 'absolute',
        zIndex: 2,
        padding: '12px 14px',
        background: 'var(--surface-glass)',
        backdropFilter: 'blur(14px) saturate(180%)',
        WebkitBackdropFilter: 'blur(14px) saturate(180%)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-md)',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22, height: 22,
            background: color,
            borderRadius: 'var(--radius-sm)',
            color: '#fff',
          }}
        >
          <Icon size={12} strokeWidth={2.4} />
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{body}</div>
    </motion.div>
  );
}

const dotStyle = (color) => ({
  width: 8, height: 8, borderRadius: '50%', background: color, opacity: 0.7,
});
