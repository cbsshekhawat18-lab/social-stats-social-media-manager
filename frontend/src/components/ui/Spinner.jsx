/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * Spinner — brand-colored indeterminate loader.
 *
 * Props:
 *   size:   'xs' (12) | 'sm' (16) | 'md' (20) | 'lg' (28)   default 'md'
 *   color:  CSS color   (default brand cyan)
 *   label:  visually hidden a11y label   (default "Loading")
 */
const SIZES = { xs: 12, sm: 16, md: 20, lg: 28 };

export default function Spinner({ size = 'md', color = 'var(--brand-primary)', label = 'Loading', style }) {
  const dim = SIZES[size] || SIZES.md;
  const stroke = Math.max(2, Math.round(dim / 9));

  return (
    <span
      role="status"
      aria-live="polite"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: dim, height: dim,
        ...style,
      }}
    >
      <svg
        viewBox="0 0 50 50"
        width={dim}
        height={dim}
        aria-hidden
        style={{ animation: 'ds-spinner-rotate 0.9s linear infinite' }}
      >
        <circle
          cx="25" cy="25" r="20"
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray="90 150"
          strokeDashoffset="0"
        />
      </svg>
      <span style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
        {label}
      </span>
      <style>{`
        @keyframes ds-spinner-rotate { to { transform: rotate(360deg); } }
      `}</style>
    </span>
  );
}
