/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { forwardRef } from 'react';

/**
 * Card — neutral surface wrapper.
 *
 * Props:
 *   padding:     'none' | 'sm' | 'md' | 'lg'    (default 'md')
 *   interactive: enables hover lift + cursor pointer
 *   elevated:    drops a stronger shadow
 *   as:          underlying element (default 'div')
 *
 * Subcomponents (composable):
 *   Card.Header — { title, subtitle, action }
 *   Card.Body   — wraps content with consistent padding
 *   Card.Footer — separator + action row
 */

const PADDINGS = { none: 0, sm: 12, md: 20, lg: 28 };

const Card = forwardRef(function Card(
  {
    padding = 'md',
    interactive = false,
    elevated = false,
    glass = false,
    as: Component = 'div',
    style,
    children,
    onMouseEnter,
    onMouseLeave,
    ...rest
  },
  ref,
) {
  const pad = PADDINGS[padding] ?? PADDINGS.md;

  const baseStyle = glass
    ? {
        background: 'var(--surface-glass)',
        backdropFilter: 'blur(14px) saturate(180%)',
        WebkitBackdropFilter: 'blur(14px) saturate(180%)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: elevated ? 'var(--shadow-lg)' : 'var(--shadow-md)',
        padding: pad,
        transition: 'var(--transition-default)',
        cursor: interactive ? 'pointer' : undefined,
        ...style,
      }
    : {
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: elevated ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        padding: pad,
        transition: 'var(--transition-default)',
        cursor: interactive ? 'pointer' : undefined,
        ...style,
      };

  return (
    <Component
      ref={ref}
      style={baseStyle}
      onMouseEnter={(e) => {
        if (interactive) {
          e.currentTarget.style.borderColor = 'var(--border-default)';
          e.currentTarget.style.boxShadow = 'var(--shadow-md)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        if (interactive) {
          Object.assign(e.currentTarget.style, baseStyle);
        }
        onMouseLeave?.(e);
      }}
      {...rest}
    >
      {children}
    </Component>
  );
});

function CardHeader({ title, subtitle, action, style, children }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: title || subtitle ? 12 : 0,
        ...style,
      }}
    >
      <div style={{ minWidth: 0 }}>
        {title && (
          <h3 style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '-0.01em',
          }}>
            {title}
          </h3>
        )}
        {subtitle && (
          <div style={{
            marginTop: 2,
            fontSize: 13,
            color: 'var(--text-secondary)',
          }}>
            {subtitle}
          </div>
        )}
        {children}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}

function CardBody({ children, style }) {
  return <div style={style}>{children}</div>;
}

function CardFooter({ children, style }) {
  return (
    <div
      style={{
        marginTop: 16,
        paddingTop: 16,
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 8,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

Card.Header = CardHeader;
Card.Body   = CardBody;
Card.Footer = CardFooter;

export default Card;
