/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Button — design-system primitive.
 *
 * Props:
 *   variant: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'   (default: 'primary')
 *   size:    'sm' | 'md' | 'lg'                                          (default: 'md')
 *   icon:    Lucide icon component (rendered on the left)
 *   iconRight: Lucide icon component (rendered on the right)
 *   iconOnly: render as a square icon-only button (children omitted)
 *   loading: replaces content with a spinner; auto-disables clicks
 *   fullWidth: stretches to 100%
 *   as:      'button' (default) | 'a' | React component (e.g. Link)
 *
 * Pass any other DOM props (onClick, href, type, etc.) — they're forwarded.
 */
const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    icon: Icon,
    iconRight: IconRight,
    iconOnly = false,
    loading = false,
    disabled = false,
    fullWidth = false,
    as: Component = 'button',
    type,
    children,
    style,
    ...rest
  },
  ref,
) {
  const heights   = { xs: 24, sm: 28, md: 36, lg: 44, xl: 52 };
  const fontSizes = { xs: 11, sm: 12, md: 13, lg: 14, xl: 15 };
  const iconSizes = { xs: 12, sm: 14, md: 16, lg: 18, xl: 20 };
  const padding   = { xs: '0 10px', sm: '0 12px', md: '0 14px', lg: '0 18px', xl: '0 22px' };

  const h = heights[size] || heights.md;
  const variantStyles = VARIANTS[variant] || VARIANTS.primary;
  const isDisabled = disabled || loading;

  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: h,
    width: iconOnly ? h : (fullWidth ? '100%' : undefined),
    minWidth: iconOnly ? h : undefined,
    padding: iconOnly ? 0 : (padding[size] || padding.md),
    borderRadius: 'var(--radius-md)',
    fontSize: fontSizes[size] || 13,
    fontWeight: 500,
    fontFamily: 'inherit',
    lineHeight: 1,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.6 : 1,
    transition: 'var(--transition-fast)',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    userSelect: 'none',
    ...variantStyles.base,
    ...style,
  };

  // Native <button> needs a default type to avoid accidental form submits.
  const nativeType = Component === 'button' ? (type || 'button') : type;

  return (
    <Component
      ref={ref}
      type={nativeType}
      disabled={Component === 'button' ? isDisabled : undefined}
      aria-disabled={isDisabled || undefined}
      aria-busy={loading || undefined}
      style={baseStyle}
      onMouseEnter={(e) => {
        if (isDisabled) return;
        Object.assign(e.currentTarget.style, variantStyles.hover);
        rest.onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        if (isDisabled) return;
        Object.assign(e.currentTarget.style, variantStyles.base);
        // re-apply user-supplied style overrides
        if (style) Object.assign(e.currentTarget.style, style);
        rest.onMouseLeave?.(e);
      }}
      {...rest}
    >
      {loading
        ? <Loader2 size={iconSizes[size]} className="ds-button-spin" aria-hidden />
        : (Icon && <Icon size={iconSizes[size]} strokeWidth={2} aria-hidden />)
      }
      {!iconOnly && !loading && children}
      {!iconOnly && !loading && IconRight && <IconRight size={iconSizes[size]} strokeWidth={2} aria-hidden />}

      <style>{`
        .ds-button-spin { animation: ds-button-spin 0.9s linear infinite; }
        @keyframes ds-button-spin { to { transform: rotate(360deg); } }
      `}</style>
    </Component>
  );
});

const VARIANTS = {
  primary: {
    base: {
      background: 'var(--brand-gradient)',
      color: 'var(--text-on-brand)',
      border: '1px solid transparent',
      boxShadow: 'var(--shadow-sm)',
    },
    hover: {
      boxShadow: 'var(--shadow-md), var(--shadow-glow)',
      transform: 'translateY(-1px)',
    },
  },
  secondary: {
    base: {
      background: 'var(--surface-card)',
      color: 'var(--text-primary)',
      border: '1px solid var(--border-default)',
      boxShadow: 'var(--shadow-sm)',
    },
    hover: {
      background: 'var(--surface-hover)',
      borderColor: 'var(--border-strong)',
    },
  },
  ghost: {
    base: {
      background: 'transparent',
      color: 'var(--text-secondary)',
      border: '1px solid transparent',
      boxShadow: 'none',
    },
    hover: {
      background: 'var(--surface-hover)',
      color: 'var(--text-primary)',
    },
  },
  outline: {
    base: {
      background: 'transparent',
      color: 'var(--brand-primary-hover)',
      border: '1px solid var(--brand-primary)',
      boxShadow: 'none',
    },
    hover: {
      background: 'var(--brand-primary-soft)',
      color: 'var(--brand-primary-hover)',
      borderColor: 'var(--brand-primary-hover)',
    },
  },
  danger: {
    base: {
      background: 'var(--danger)',
      color: '#fff',
      border: '1px solid transparent',
      boxShadow: 'var(--shadow-sm)',
    },
    hover: {
      background: '#dc2626',
      boxShadow: 'var(--shadow-md)',
    },
  },
  success: {
    base: {
      background: 'var(--success)',
      color: '#fff',
      border: '1px solid transparent',
      boxShadow: 'var(--shadow-sm)',
    },
    hover: {
      background: '#059669',
      boxShadow: 'var(--shadow-md)',
    },
  },
};

export default Button;
