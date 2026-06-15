/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { forwardRef, useEffect, useId, useRef, useState } from 'react';

/**
 * Textarea — auto-resizing text area with optional char counter and error state.
 *
 * Props:
 *   label, hint, error          — same semantics as Input
 *   minRows, maxRows            — auto-resize bounds (default 3 / 12)
 *   maxLength                   — when set, a counter "n / max" is shown
 *   showCount                   — force counter even without maxLength
 *   autoResize                  — default true; set false for fixed height
 */
const Textarea = forwardRef(function Textarea(
  {
    label,
    hint,
    error,
    minRows = 3,
    maxRows = 12,
    maxLength,
    showCount = false,
    autoResize = true,
    id,
    value,
    defaultValue,
    onChange,
    onFocus,
    onBlur,
    style,
    className,
    ...rest
  },
  ref,
) {
  const reactId = useId();
  const fieldId = id || `ta-${reactId}`;
  const innerRef = useRef(null);
  const [focused, setFocused] = useState(false);
  const [count, setCount] = useState(() => (typeof value === 'string' ? value.length : (defaultValue?.length || 0)));

  // Forward our internal ref to the parent's ref prop
  function setRefs(node) {
    innerRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  }

  // Auto-resize on content change
  useEffect(() => {
    if (!autoResize || !innerRef.current) return;
    const el = innerRef.current;
    el.style.height = 'auto';
    const lineH = 20; // approx ~14px font * 1.45
    const min = minRows * lineH + 16;
    const max = maxRows * lineH + 16;
    const next = Math.min(max, Math.max(min, el.scrollHeight));
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
  }, [value, count, autoResize, minRows, maxRows]);

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

  const showCounter = showCount || typeof maxLength === 'number';

  return (
    <div className={className} style={{ width: '100%', ...style }}>
      {label && (
        <label
          htmlFor={fieldId}
          style={{
            display: 'block',
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--text-secondary)',
            marginBottom: 6,
          }}
        >
          {label}
        </label>
      )}

      <div
        style={{
          background: 'var(--surface-card)',
          border: `1px solid ${borderColor}`,
          borderRadius: 'var(--radius-md)',
          boxShadow: ringShadow,
          transition: 'var(--transition-fast)',
        }}
      >
        <textarea
          ref={setRefs}
          id={fieldId}
          value={value}
          defaultValue={defaultValue}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${fieldId}-msg` : undefined}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          onChange={(e) => {
            setCount(e.target.value.length);
            onChange?.(e);
          }}
          style={{
            display: 'block',
            width: '100%',
            minHeight: minRows * 20 + 16,
            padding: '10px 12px',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            resize: autoResize ? 'none' : 'vertical',
            fontFamily: 'inherit',
            fontSize: 14,
            lineHeight: 1.5,
            color: 'var(--text-primary)',
            boxSizing: 'border-box',
          }}
          {...rest}
        />
      </div>

      {(error || hint || showCounter) && (
        <div
          style={{
            marginTop: 6,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 12,
            color: 'var(--text-tertiary)',
          }}
        >
          <span
            id={`${fieldId}-msg`}
            role={error ? 'alert' : undefined}
            aria-live={error ? 'polite' : undefined}
            style={{ color: error ? 'var(--danger)' : 'var(--text-tertiary)' }}
          >
            {error || hint || ''}
          </span>
          {showCounter && (
            <span style={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
              {count}{typeof maxLength === 'number' ? ` / ${maxLength}` : ''}
            </span>
          )}
        </div>
      )}
    </div>
  );
});

export default Textarea;
