/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { forwardRef, useId } from 'react';

/**
 * Radio — single radio button (use within a group sharing a `name`).
 *
 * Use <RadioGroup> for the labelled multi-option pattern; this primitive is
 * useful when you need a custom layout per-option.
 *
 * Props:
 *   label, description, size, disabled, checked, onChange, name, value
 */
const Radio = forwardRef(function Radio(
  {
    label,
    description,
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
  const fieldId = id || `rb-${reactId}`;
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
          type="radio"
          checked={checked}
          disabled={disabled}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
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
            borderRadius: '50%',
            background: 'var(--surface-card)',
            border: `1px solid ${checked ? 'var(--brand-primary)' : 'var(--border-default)'}`,
            transition: 'var(--transition-fast)',
            boxShadow: checked ? 'var(--shadow-glow)' : 'var(--shadow-xs)',
          }}
        >
          <span
            style={{
              width: checked ? dim / 2 : 0,
              height: checked ? dim / 2 : 0,
              borderRadius: '50%',
              background: 'var(--brand-gradient)',
              transition: 'var(--transition-fast)',
            }}
          />
        </span>
      </span>

      {(label || description) && (
        <span style={{ minWidth: 0 }}>
          {label && (
            <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>
              {label}
            </span>
          )}
          {description && (
            <span style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, lineHeight: 1.4 }}>
              {description}
            </span>
          )}
        </span>
      )}
    </label>
  );
});

export default Radio;
