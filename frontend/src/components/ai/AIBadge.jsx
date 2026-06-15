/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { Sparkles, Database } from 'lucide-react';

/**
 * AIBadge — universal "✨ AI-assisted" mark that goes wherever AI-generated
 * content shows up in the app.
 *
 * Variants:
 *   variant: 'pill' (default) — small inline pill chip
 *            'dot'             — tiny dot only (no text)
 *            'inline'          — text + sparkle, no background
 *
 * Sizes:
 *   size: 'sm' (default) | 'md'
 *
 * Props:
 *   cached: bool — if true, swap the sparkle for a cache mark and update the
 *                  tooltip to indicate the content was served from cache (no new AI cost).
 *
 * Props pass-through onto the wrapping span.
 */
export default function AIBadge({
  variant = 'pill',
  size = 'sm',
  cached = false,
  label,
  title,
  style,
  ...rest
}) {
  const resolvedLabel = label ?? (cached ? 'AI · cached' : 'AI-assisted');
  const resolvedTitle = title ?? (cached
    ? 'This was served from the AI cache — no new generation cost was incurred'
    : 'This content was generated with Social Stats assistance');
  const Icon = cached ? Database : Sparkles;
  if (variant === 'dot') {
    return (
      <span
        title={resolvedTitle}
        aria-label={resolvedTitle}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 14, height: 14,
          background: cached ? 'var(--surface-sunken)' : 'var(--brand-gradient)',
          border: cached ? '1px solid var(--border-default)' : 'none',
          borderRadius: '50%',
          color: cached ? 'var(--brand-primary-hover)' : '#fff',
          ...style,
        }}
        {...rest}
      >
        <Icon size={8} strokeWidth={2.6} />
      </span>
    );
  }

  if (variant === 'inline') {
    return (
      <span
        title={resolvedTitle}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: size === 'md' ? 12 : 11,
          fontWeight: 500,
          color: 'var(--brand-primary-hover)',
          ...style,
        }}
        {...rest}
      >
        <Icon size={size === 'md' ? 12 : 10} strokeWidth={2.4} />
        {resolvedLabel}
      </span>
    );
  }

  // pill (default)
  return (
    <span
      title={resolvedTitle}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: size === 'md' ? '3px 9px' : '2px 7px',
        fontSize: size === 'md' ? 11 : 10,
        fontWeight: 600,
        letterSpacing: '0.04em',
        color: 'var(--brand-primary-hover)',
        background: 'var(--brand-primary-soft)',
        border: '1px solid var(--brand-primary-glow)',
        borderRadius: 'var(--radius-pill)',
        textTransform: 'uppercase',
        ...style,
      }}
      {...rest}
    >
      <Icon size={size === 'md' ? 11 : 9} strokeWidth={2.4} />
      {resolvedLabel}
    </span>
  );
}
