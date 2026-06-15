/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * StarRating — display + interactive variants.
 *
 * Pass `onChange` to make it interactive (5 buttons). Pass `value` only for
 * read-only display. `size` is the icon size in px.
 */
import { Star } from 'lucide-react';

export default function StarRating({
  value = 0,
  onChange,
  size = 16,
  showNumber = false,
  ariaLabel = 'Rating',
}) {
  const isInteractive = typeof onChange === 'function';

  return (
    <span
      role={isInteractive ? 'radiogroup' : 'img'}
      aria-label={isInteractive ? ariaLabel : `${value} out of 5 stars`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}
    >
      {Array.from({ length: 5 }).map((_, i) => {
        const active = i < Math.round(value);
        const inner = (
          <Star
            size={size}
            fill={active ? 'var(--warning)' : 'transparent'}
            stroke="var(--warning)"
            strokeWidth={2}
          />
        );
        if (!isInteractive) return <span key={i}>{inner}</span>;
        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={value === i + 1}
            aria-label={`${i + 1} star${i ? 's' : ''}`}
            onClick={() => onChange(i + 1)}
            style={{
              width: size + 6, height: size + 6,
              padding: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none',
              cursor: 'pointer',
            }}
          >
            {inner}
          </button>
        );
      })}
      {showNumber && value > 0 && (
        <span style={{ marginLeft: 4, fontSize: 12, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
          {Number(value).toFixed(1)}
        </span>
      )}
    </span>
  );
}
