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
 * Switch — animated toggle. Built on a hidden native checkbox for a11y.
 *
 * Props:
 *   label, description     — optional (rendered to the right)
 *   checked, onChange      — controlled toggle
 *   size: 'sm' | 'md'      — track height (default 'md' = 22px)
 *   disabled
 */
const Switch = forwardRef(function Switch(
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
  const fieldId = id || `sw-${reactId}`;
  const dims = size === 'sm'
    ? { trackW: 32, trackH: 18, thumb: 14, gap: 2 }
    : { trackW: 38, trackH: 22, thumb: 18, gap: 2 };

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
      <span
        role="presentation"
        style={{
          position: 'relative',
          flexShrink: 0,
          width: dims.trackW,
          height: dims.trackH,
          background: checked ? 'var(--brand-gradient)' : 'var(--surface-sunken)',
          borderRadius: 999,
          border: `1px solid ${checked ? 'transparent' : 'var(--border-default)'}`,
          transition: 'var(--transition-default)',
          boxShadow: checked ? '0 2px 8px rgba(0,168,216,0.30)' : 'var(--shadow-xs)',
          marginTop: description ? 2 : 0,
        }}
      >
        <input
          ref={ref}
          id={fieldId}
          type="checkbox"
          role="switch"
          aria-checked={!!checked}
          checked={!!checked}
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
            position: 'absolute',
            top: dims.gap - 1,
            left: checked ? dims.trackW - dims.thumb - dims.gap - 1 : dims.gap - 1,
            width: dims.thumb,
            height: dims.thumb,
            background: '#fff',
            borderRadius: '50%',
            boxShadow: '0 1px 3px rgba(0,0,0,0.18), 0 1px 2px rgba(0,0,0,0.12)',
            transition: 'left var(--transition-default)',
          }}
        />
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

export default Switch;
