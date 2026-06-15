/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff, Search, AlertCircle, Check } from 'lucide-react';

/**
 * Input — text/email/password/search/number primitive.
 *
 * Props (in addition to standard <input> props):
 *   label:       optional label text rendered above the field
 *   hint:        helper text shown beneath when no error
 *   error:       string — when truthy, shows red border + error text
 *   success:     boolean — when true, shows green check
 *   prefix:      ReactNode — rendered inside the field on the left (icon)
 *   suffix:      ReactNode — rendered inside the field on the right
 *   size:        'sm' | 'md' | 'lg'    (default 'md')
 *   fullWidth:   stretches to 100% (default true)
 *   showPasswordToggle: when type='password', show eye toggle
 *
 * For type='search', a magnifying glass icon is auto-injected as prefix.
 */
const Input = forwardRef(function Input(
  {
    type = 'text',
    label,
    hint,
    error,
    success = false,
    prefix,
    suffix,
    size = 'md',
    fullWidth = true,
    showPasswordToggle = true,
    id,
    className,
    style,
    onFocus,
    onBlur,
    ...rest
  },
  ref,
) {
  const reactId = useId();
  const fieldId = id || `inp-${reactId}`;
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const isPassword = type === 'password';
  const effectiveType = isPassword && revealed ? 'text' : type;

  const heights = { sm: 32, md: 40, lg: 48 };
  const fontSizes = { sm: 13, md: 14, lg: 15 };
  const h = heights[size] || heights.md;

  const autoPrefix = type === 'search' ? <Search size={15} aria-hidden /> : prefix;

  const borderColor = error
    ? 'var(--danger)'
    : focused
      ? 'var(--brand-primary)'
      : 'var(--border-default)';

  const ringShadow = error
    ? '0 0 0 4px rgba(239,68,68,0.16)'
    : focused
      ? 'var(--shadow-glow)'
      : 'var(--shadow-xs)';

  return (
    <div className={className} style={{ width: fullWidth ? '100%' : undefined, ...style }}>
      {label && (
        <label
          htmlFor={fieldId}
          style={{
            display: 'block',
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--text-secondary)',
            marginBottom: 6,
            letterSpacing: '0.01em',
          }}
        >
          {label}
        </label>
      )}

      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          height: h,
          background: 'var(--surface-card)',
          border: `1px solid ${borderColor}`,
          borderRadius: 'var(--radius-md)',
          boxShadow: ringShadow,
          transition: 'var(--transition-fast)',
          overflow: 'hidden',
        }}
      >
        {autoPrefix && (
          <span
            aria-hidden
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              paddingLeft: 12,
              color: 'var(--text-tertiary)',
            }}
          >
            {autoPrefix}
          </span>
        )}

        <input
          ref={ref}
          id={fieldId}
          type={effectiveType}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${fieldId}-msg` : undefined}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          style={{
            flex: 1,
            minWidth: 0,
            height: '100%',
            padding: `0 ${suffix || (isPassword && showPasswordToggle) || success || error ? 4 : 12}px 0 ${autoPrefix ? 8 : 12}px`,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontFamily: 'inherit',
            fontSize: fontSizes[size] || 14,
            color: 'var(--text-primary)',
          }}
          {...rest}
        />

        {success && !error && (
          <span aria-hidden style={{ display: 'inline-flex', paddingRight: 12, color: 'var(--success)' }}>
            <Check size={15} strokeWidth={2.4} />
          </span>
        )}
        {error && (
          <span aria-hidden style={{ display: 'inline-flex', paddingRight: 12, color: 'var(--danger)' }}>
            <AlertCircle size={15} strokeWidth={2.2} />
          </span>
        )}
        {isPassword && showPasswordToggle && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 12px',
              height: '100%',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              minHeight: 'auto',
              minWidth: 'auto',
            }}
          >
            {revealed ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
        {suffix && !isPassword && (
          <span style={{ display: 'inline-flex', paddingRight: 12, color: 'var(--text-tertiary)' }}>
            {suffix}
          </span>
        )}
      </div>

      {(error || hint) && (
        <div
          id={`${fieldId}-msg`}
          role={error ? 'alert' : undefined}
          aria-live={error ? 'polite' : undefined}
          style={{
            marginTop: 6,
            fontSize: 12,
            color: error ? 'var(--danger)' : 'var(--text-tertiary)',
            lineHeight: 1.4,
          }}
        >
          {error || hint}
        </div>
      )}
    </div>
  );
});

export default Input;
