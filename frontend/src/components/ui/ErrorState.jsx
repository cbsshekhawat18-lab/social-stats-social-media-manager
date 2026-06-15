/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { AlertTriangle, RefreshCw } from 'lucide-react';

import Button from './Button';

/**
 * ErrorState — companion to EmptyState for failed loads.
 *
 * Props:
 *   icon:        Lucide icon component  (default AlertTriangle)
 *   title:       headline
 *   description: secondary copy
 *   onRetry:     when set, renders a "Try again" button
 *   retryLabel:  override button copy
 *   action:      override the entire CTA (renders instead of retry button)
 *   compact:     reduce padding for inline use
 */
export default function ErrorState({
  icon: Icon = AlertTriangle,
  title = 'Something went wrong',
  description = 'We couldn\'t load this just now. Please try again.',
  onRetry,
  retryLabel = 'Try again',
  action,
  compact = false,
  style,
  ...rest
}) {
  return (
    <div
      role="alert"
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
            width: 48, height: 48,
            borderRadius: 'var(--radius-lg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--danger-bg)',
            color: 'var(--danger)',
            marginBottom: 4,
          }}
        >
          <Icon size={22} strokeWidth={1.8} />
        </div>
      )}
      <div style={{
        fontSize: 16,
        fontWeight: 500,
        color: 'var(--text-primary)',
        letterSpacing: '-0.01em',
      }}>
        {title}
      </div>
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
      <div style={{ marginTop: 4 }}>
        {action || (onRetry && (
          <Button variant="secondary" icon={RefreshCw} onClick={onRetry}>
            {retryLabel}
          </Button>
        ))}
      </div>
    </div>
  );
}
