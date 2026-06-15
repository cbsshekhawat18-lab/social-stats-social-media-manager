/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * Badge — small pill for status/labels.
 *
 * Variants: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'brand'
 * Optional dot prefix via `dot` prop.
 */
const VARIANT_STYLES = {
  default: { bg: 'var(--surface-sunken)',     color: 'var(--text-secondary)',       border: 'var(--border-subtle)' },
  success: { bg: 'var(--success-bg)',         color: 'var(--success)',              border: 'transparent' },
  warning: { bg: 'var(--warning-bg)',         color: 'var(--warning)',              border: 'transparent' },
  danger:  { bg: 'var(--danger-bg)',          color: 'var(--danger)',               border: 'transparent' },
  info:    { bg: 'var(--info-bg)',            color: 'var(--info)',                 border: 'transparent' },
  brand:   { bg: 'var(--brand-primary-glow)', color: 'var(--brand-primary-hover)',  border: 'transparent' },
  outline: { bg: 'transparent',               color: 'var(--text-secondary)',       border: 'var(--border-default)' },
};

const SIZES = {
  sm: { padding: '1px 6px',  fontSize: 10, dotSize: 5, iconSize: 10 },
  md: { padding: '2px 8px',  fontSize: 11, dotSize: 6, iconSize: 11 },
};

export default function Badge({
  variant = 'default',
  size = 'md',
  dot = false,
  icon: Icon,
  children,
  style,
  ...rest
}) {
  const v = VARIANT_STYLES[variant] || VARIANT_STYLES.default;
  const s = SIZES[size] || SIZES.md;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: s.padding,
        borderRadius: 'var(--radius-pill)',
        background: v.bg,
        color: v.color,
        border: `1px solid ${v.border}`,
        fontSize: s.fontSize,
        fontWeight: 500,
        letterSpacing: 0.1,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      {dot && (
        <span
          aria-hidden
          style={{
            width: s.dotSize, height: s.dotSize, borderRadius: '50%',
            background: 'currentColor', flexShrink: 0,
          }}
        />
      )}
      {Icon && <Icon size={s.iconSize} strokeWidth={2.4} aria-hidden />}
      {children}
    </span>
  );
}
