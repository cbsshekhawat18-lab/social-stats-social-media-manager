/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { forwardRef, useId } from 'react';
import { Check, Minus } from 'lucide-react';

/**
 * Checkbox — accessible custom checkbox built on a hidden native input.
 *
 * Props (in addition to standard <input type="checkbox">):
 *   label:        text rendered to the right of the box
 *   description:  smaller secondary text under the label
 *   indeterminate: shows the "minus" indicator
 *   size:         'sm' | 'md'  (default 'md')
 *
 * Pass `checked` + `onChange` for controlled use.
 */
const Checkbox = forwardRef(function Checkbox(
  {
    label,
    description,
    indeterminate = false,
    checked,
    disabled,
    size = 'md',
    id,
    style,
    className,
    ...rest
  },
  ref,
) {
  const reactId = useId();
  const fieldId = id || `cb-${reactId}`;
  const dim = size === 'sm' ? 16 : 18;

  return (
    <label
      htmlFor={fieldId}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: description ? 'flex-start' : 'center',
        gap: 10,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        ...style,
      }}
    >
      <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, marginTop: description ? 1 : 0 }}>
        <input
          ref={ref}
          id={fieldId}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-checked={indeterminate ? 'mixed' : !!checked}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            opacity: 0, margin: 0, cursor: 'inherit',
          }}
          {...rest}
        />
        <span
          aria-hidden
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: dim, height: dim,
            borderRadius: 'var(--radius-xs)',
            background: (checked || indeterminate)
              ? 'var(--brand-gradient)'
              : 'var(--surface-card)',
            border: `1px solid ${(checked || indeterminate) ? 'transparent' : 'var(--border-default)'}`,
            color: '#fff',
            transition: 'var(--transition-fast)',
            boxShadow: (checked || indeterminate) ? '0 1px 3px rgba(0,168,216,0.30)' : 'var(--shadow-xs)',
          }}
        >
          {indeterminate
            ? <Minus size={dim - 6} strokeWidth={3} />
            : checked
              ? <Check size={dim - 6} strokeWidth={3} />
              : null}
        </span>
      </span>

      {(label || description) && (
        <span style={{ minWidth: 0 }}>
          {label && (
            <span style={{
              display: 'block',
              fontSize: 13, fontWeight: 500,
              color: 'var(--text-primary)',
              lineHeight: 1.4,
            }}>
              {label}
            </span>
          )}
          {description && (
            <span style={{
              display: 'block',
              fontSize: 12,
              color: 'var(--text-tertiary)',
              marginTop: 2,
              lineHeight: 1.4,
            }}>
              {description}
            </span>
          )}
        </span>
      )}
    </label>
  );
});

export default Checkbox;
