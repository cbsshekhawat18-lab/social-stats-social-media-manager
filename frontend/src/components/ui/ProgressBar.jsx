/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * ProgressBar — determinate (value/max) or indeterminate.
 *
 * Props:
 *   value:    number (0..max). Omit for indeterminate.
 *   max:      number (default 100)
 *   size:     'sm' (4) | 'md' (6) | 'lg' (10)    track height
 *   variant:  'brand' (default) | 'success' | 'warning' | 'danger' | 'info'
 *   gradient: when true, uses brand-gradient for the fill
 *   showLabel: render a "% complete" label above the bar
 *   label:    override label text
 */
const HEIGHTS = { sm: 4, md: 6, lg: 10 };
const COLORS = {
  brand:   { fill: 'var(--brand-primary)', gradient: 'var(--brand-gradient)' },
  success: { fill: 'var(--success)',       gradient: 'linear-gradient(90deg,#34d399,#10b981)' },
  warning: { fill: 'var(--warning)',       gradient: 'linear-gradient(90deg,#fcd34d,#f59e0b)' },
  danger:  { fill: 'var(--danger)',        gradient: 'linear-gradient(90deg,#f87171,#ef4444)' },
  info:    { fill: 'var(--info)',          gradient: 'linear-gradient(90deg,#60a5fa,#3b82f6)' },
};

export default function ProgressBar({
  value,
  max = 100,
  size = 'md',
  variant = 'brand',
  gradient = false,
  showLabel = false,
  label,
  style,
  ...rest
}) {
  const indeterminate = typeof value !== 'number';
  const pct = indeterminate ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  const h = HEIGHTS[size] || HEIGHTS.md;
  const c = COLORS[variant] || COLORS.brand;
  const fill = gradient ? c.gradient : c.fill;

  return (
    <div style={{ width: '100%', ...style }} {...rest}>
      {showLabel && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 12,
          marginBottom: 6,
          color: 'var(--text-secondary)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          <span>{label || 'Progress'}</span>
          <span>{indeterminate ? '' : `${Math.round(pct)}%`}</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={indeterminate ? 'Loading' : `${Math.round(pct)} percent`}
        style={{
          position: 'relative',
          height: h,
          width: '100%',
          background: 'var(--surface-sunken)',
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, bottom: 0,
            width: indeterminate ? '40%' : `${pct}%`,
            background: fill,
            borderRadius: 999,
            transition: indeterminate ? undefined : 'width var(--transition-default)',
            animation: indeterminate ? 'ds-progress-indet 1.4s ease-in-out infinite' : undefined,
          }}
        />
      </div>
      <style>{`
        @keyframes ds-progress-indet {
          0%   { left: -40%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
}
