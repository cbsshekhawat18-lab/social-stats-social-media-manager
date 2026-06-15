/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * EmptyState — used in place of "No data" messages.
 *
 * Props:
 *   icon:        Lucide icon component (rendered in a 48px gradient circle)
 *   title:       headline (16px / 500)
 *   description: secondary copy (13px, --text-secondary)
 *   action:      ReactNode (typically a <Button> CTA)
 *   compact:     reduces vertical padding for use inside small cards
 *
 * Empty states tell stories — never use bare "No data" text in a list.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  style,
  ...rest
}) {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 12,
        padding: compact ? '24px 16px' : '48px 24px',
        color: 'var(--text-secondary)',
        ...style,
      }}
      {...rest}
    >
      {Icon && (
        <div
          aria-hidden
          style={{
            width: 48,
            height: 48,
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, var(--surface-sunken), var(--surface-hover))',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-tertiary)',
            marginBottom: 4,
          }}
        >
          <Icon size={22} strokeWidth={1.8} />
        </div>
      )}
      {title && (
        <div style={{
          fontSize: 16,
          fontWeight: 500,
          color: 'var(--text-primary)',
          letterSpacing: '-0.01em',
        }}>
          {title}
        </div>
      )}
      {description && (
        <div style={{
          fontSize: 13,
          color: 'var(--text-secondary)',
          maxWidth: 380,
          lineHeight: 1.5,
        }}>
          {description}
        </div>
      )}
      {action && <div style={{ marginTop: 4 }}>{action}</div>}
    </div>
  );
}
