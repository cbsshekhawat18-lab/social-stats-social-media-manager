/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

/**
 * AnimatedChat — typewriter-style chat box that types out an assistant reply
 * character-by-character once the component scrolls into view.
 *
 *   <AnimatedChat
 *     userMessage="How are we doing on Instagram?"
 *     assistantReply="This week your reach grew 23% vs last week..."
 *     speedMs={18}
 *     loop={false}
 *   />
 *
 * Honours `prefers-reduced-motion` (renders the full text immediately).
 */
export default function AnimatedChat({
  userMessage,
  assistantReply,
  speedMs = 18,
  loop = false,
  startDelay = 200,
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: !loop, amount: 0.4 });
  const reduced = useReducedMotion();

  const [typed, setTyped] = useState(reduced ? assistantReply : '');
  const [done, setDone] = useState(reduced);

  useEffect(() => {
    if (reduced) return;
    if (!inView) return;
    setTyped('');
    setDone(false);

    let i = 0;
    let timer;
    const startTimer = setTimeout(() => {
      timer = setInterval(() => {
        i += 1;
        setTyped(assistantReply.slice(0, i));
        if (i >= assistantReply.length) {
          clearInterval(timer);
          setDone(true);
        }
      }, speedMs);
    }, startDelay);

    return () => {
      clearTimeout(startTimer);
      clearInterval(timer);
    };
  }, [inView, assistantReply, speedMs, startDelay, reduced]);

  return (
    <div
      ref={ref}
      style={{
        background: 'var(--surface-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        padding: 18,
        boxShadow: '0 12px 36px rgba(0, 204, 245, 0.08)',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        paddingBottom: 12,
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <span style={{
          width: 24, height: 24,
          background: 'linear-gradient(135deg, #00CCF5, #8b5cf6)',
          borderRadius: '50%',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff',
        }}>
          <Sparkles size={12} />
        </span>
        <span style={{
          fontSize: 13, fontWeight: 700,
          letterSpacing: '-0.01em',
          color: 'var(--text-primary)',
        }}>
          Social Stats
        </span>
        <span style={{
          marginLeft: 'auto',
          fontSize: 10, fontWeight: 600,
          padding: '2px 8px',
          color: 'var(--success)',
          background: 'var(--success-bg)',
          borderRadius: 'var(--radius-pill)',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>online</span>
      </div>

      <div style={{ paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* User bubble */}
        <div style={{
          alignSelf: 'flex-end',
          maxWidth: '78%',
          padding: '10px 14px',
          background: 'var(--brand-primary-soft)',
          color: 'var(--brand-primary-hover)',
          borderRadius: '14px 14px 2px 14px',
          fontSize: 13.5, lineHeight: 1.5,
        }}>
          {userMessage}
        </div>

        {/* Assistant bubble */}
        <div style={{
          alignSelf: 'flex-start',
          maxWidth: '90%',
          padding: '10px 14px',
          background: 'var(--surface-sunken)',
          color: 'var(--text-primary)',
          borderRadius: '14px 14px 14px 2px',
          fontSize: 13.5, lineHeight: 1.65,
          minHeight: 24,
        }}>
          {typed}
          {!done && <BlinkCursor />}
        </div>
      </div>
    </div>
  );
}

function BlinkCursor() {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: 7, height: 14,
        marginLeft: 2,
        background: 'var(--brand-primary-hover)',
        borderRadius: 1,
        verticalAlign: 'text-bottom',
        animation: 'mkt-cursor-blink 1s steps(2) infinite',
      }}
    >
      <style>{`
        @keyframes mkt-cursor-blink { 50% { opacity: 0; } }
      `}</style>
    </span>
  );
}
