/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useEffect, useId, useRef, useState } from 'react';
import { motion } from 'framer-motion';

/**
 * Tabs — accessible segmented control with a sliding active indicator.
 *
 * Props:
 *   tabs:    [{ value, label, icon?, badge? }]
 *   value:   currently selected value (controlled)
 *   onChange: (value) => void
 *   variant: 'pill' | 'underline'   (default 'pill')
 *   size:    'sm' | 'md'
 *   fullWidth: stretches each tab equally
 *
 * The underline variant is right for in-page navigation rows; pill is right
 * for filters and segmented controls.
 */
export default function Tabs({
  tabs = [],
  value,
  onChange,
  variant = 'pill',
  size = 'md',
  fullWidth = false,
  ariaLabel,
  style,
  className,
}) {
  const reactId = useId();
  const layoutId = `tabs-${reactId}`;
  const listRef = useRef(null);

  function onKeyDown(e) {
    const idx = tabs.findIndex((t) => t.value === value);
    if (idx < 0) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = tabs[(idx + 1) % tabs.length];
      onChange?.(next.value);
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = tabs[(idx - 1 + tabs.length) % tabs.length];
      onChange?.(next.value);
    }
    if (e.key === 'Home') { e.preventDefault(); onChange?.(tabs[0].value); }
    if (e.key === 'End')  { e.preventDefault(); onChange?.(tabs[tabs.length - 1].value); }
  }

  const heights = { sm: 30, md: 36 };
  const fontSizes = { sm: 12, md: 13 };
  const h = heights[size] || heights.md;

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={className}
      style={{
        display: 'inline-flex',
        gap: variant === 'underline' ? 4 : 2,
        padding: variant === 'pill' ? 3 : 0,
        background: variant === 'pill' ? 'var(--surface-sunken)' : 'transparent',
        borderRadius: variant === 'pill' ? 'var(--radius-md)' : 0,
        borderBottom: variant === 'underline' ? '1px solid var(--border-subtle)' : 'none',
        width: fullWidth ? '100%' : undefined,
        ...style,
      }}
    >
      {tabs.map((t) => {
        const isActive = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange?.(t.value)}
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              height: h,
              minHeight: 'auto',
              minWidth: 'auto',
              padding: variant === 'pill' ? '0 12px' : '0 4px',
              flex: fullWidth ? 1 : undefined,
              border: 'none',
              background: 'transparent',
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontFamily: 'inherit',
              fontSize: fontSizes[size] || 13,
              fontWeight: isActive ? 600 : 500,
              cursor: 'pointer',
              transition: 'color var(--transition-fast)',
              whiteSpace: 'nowrap',
            }}
          >
            {/* Sliding indicator (framer-motion shared layout) */}
            {isActive && variant === 'pill' && (
              <motion.span
                layoutId={layoutId}
                aria-hidden
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'var(--surface-card)',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: 'var(--shadow-sm)',
                  zIndex: 0,
                }}
              />
            )}
            {isActive && variant === 'underline' && (
              <motion.span
                layoutId={layoutId}
                aria-hidden
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                style={{
                  position: 'absolute',
                  bottom: -1, left: 4, right: 4,
                  height: 2,
                  background: 'var(--brand-gradient)',
                  borderRadius: 999,
                  zIndex: 0,
                }}
              />
            )}

            {t.icon && <t.icon size={14} aria-hidden style={{ position: 'relative', zIndex: 1 }} />}
            <span style={{ position: 'relative', zIndex: 1 }}>{t.label}</span>
            {!!t.badge && t.badge > 0 && (
              <span
                style={{
                  position: 'relative',
                  zIndex: 1,
                  minWidth: 16, padding: '0 5px', height: 16,
                  background: 'var(--brand-primary-hover)',
                  color: '#fff',
                  fontSize: 10, fontWeight: 700, lineHeight: '16px',
                  borderRadius: 999, textAlign: 'center',
                }}
              >
                {t.badge > 99 ? '99+' : t.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
