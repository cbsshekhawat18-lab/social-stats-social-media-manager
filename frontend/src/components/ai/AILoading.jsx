/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { Sparkles } from 'lucide-react';

/**
 * AILoading — the canonical "Social Stats is thinking…" shimmer used by every
 * AI surface that performs an async generation (chat, writer, insights, etc).
 *
 * Variants:
 *   variant: 'shimmer' (default) — a brand-gradient sweeping skeleton bar
 *            'dots'              — three pulsing dots beside a sparkle
 *            'inline'            — a small inline label "✨ Generating…"
 *
 * Props:
 *   label:    visible label (default "Social Stats is thinking…")
 *   height:   bar height in px (shimmer only) — default 18
 *   width:    bar width — default '100%'
 *
 * Honours `prefers-reduced-motion`: animation is replaced by a static fill.
 */
export default function AILoading({
  variant = 'shimmer',
  label = 'Social Stats is thinking…',
  height = 18,
  width = '100%',
  style,
  ...rest
}) {
  if (variant === 'inline') {
    return (
      <span
        role="status"
        aria-live="polite"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 12, fontWeight: 500,
          color: 'var(--brand-primary-hover)',
          ...style,
        }}
        {...rest}
      >
        <Sparkles size={11} strokeWidth={2.4} className="ai-loading-pulse" />
        {label}
        <style>{INLINE_KEYFRAMES}</style>
      </span>
    );
  }

  if (variant === 'dots') {
    return (
      <span
        role="status"
        aria-live="polite"
        aria-label={label}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, ...style }}
        {...rest}
      >
        <span style={{
          width: 22, height: 22,
          borderRadius: '50%',
          background: 'var(--brand-gradient)',
          color: '#fff',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Sparkles size={12} strokeWidth={2.4} />
        </span>
        <span style={{ display: 'inline-flex', gap: 3, alignItems: 'flex-end', height: 14 }}>
          {[0, 0.15, 0.3].map((d, i) => (
            <span
              key={i}
              className="ai-loading-dot"
              style={{ animationDelay: `${d}s` }}
            />
          ))}
        </span>
        <style>{DOTS_KEYFRAMES}</style>
      </span>
    );
  }

  // shimmer (default)
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      style={{
        position: 'relative',
        width,
        height,
        borderRadius: 'var(--radius-sm)',
        background: 'var(--surface-sunken)',
        overflow: 'hidden',
        ...style,
      }}
      {...rest}
    >
      <span className="ai-loading-shimmer" />
      <style>{SHIMMER_KEYFRAMES}</style>
    </div>
  );
}

const SHIMMER_KEYFRAMES = `
  .ai-loading-shimmer {
    position: absolute; inset: 0;
    background: linear-gradient(
      90deg,
      transparent 0%,
      var(--brand-primary-glow) 50%,
      transparent 100%
    );
    animation: ai-shimmer-sweep 1.4s linear infinite;
  }
  @keyframes ai-shimmer-sweep {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  @media (prefers-reduced-motion: reduce) {
    .ai-loading-shimmer { animation: none; opacity: 0.5; transform: none; }
  }
`;

const DOTS_KEYFRAMES = `
  .ai-loading-dot {
    width: 5px; height: 5px; border-radius: 50%;
    background: var(--brand-primary-hover);
    animation: ai-loading-bounce 1.2s ease-in-out infinite;
  }
  @keyframes ai-loading-bounce {
    0%,80%,100% { opacity: 0.3; transform: translateY(0); }
    40%         { opacity: 1;   transform: translateY(-3px); }
  }
  @media (prefers-reduced-motion: reduce) {
    .ai-loading-dot { animation: none; opacity: 0.7; }
  }
`;

const INLINE_KEYFRAMES = `
  .ai-loading-pulse { animation: ai-loading-pulse 1.6s ease-in-out infinite; }
  @keyframes ai-loading-pulse {
    0%,100% { opacity: 0.6; transform: scale(1); }
    50%     { opacity: 1;   transform: scale(1.18); }
  }
  @media (prefers-reduced-motion: reduce) {
    .ai-loading-pulse { animation: none; }
  }
`;
