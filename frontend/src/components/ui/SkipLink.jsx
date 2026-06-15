/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * SkipLink — visually-hidden anchor that becomes visible on keyboard focus.
 *
 * Lets keyboard / screen-reader users jump past nav and module rails straight
 * to the page's main content. WCAG 2.1 SC 2.4.1 — Bypass Blocks.
 *
 * Usage:
 *   <SkipLink targetId="main-content" />
 *
 * Pair with a matching `<main id="main-content" tabIndex="-1">` (or any
 * element that accepts focus) further down the tree. The target must
 * have either `tabindex="-1"` or be naturally focusable for the skip to
 * actually move focus on click.
 */
export default function SkipLink({ targetId = 'main-content', label = 'Skip to main content' }) {
  return (
    <a
      href={`#${targetId}`}
      className="ds-skip-link"
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        zIndex: 9999,
        padding: '10px 16px',
        background: 'var(--brand-gradient)',
        color: 'var(--text-on-brand)',
        fontSize: 13,
        fontWeight: 600,
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)',
        textDecoration: 'none',
        // Hidden by default — visible only when focused (keyboard tab)
        transform: 'translateY(-200%)',
        transition: 'transform var(--transition-default)',
      }}
      onFocus={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
      onBlur={(e) => { e.currentTarget.style.transform = 'translateY(-200%)'; }}
    >
      {label}
    </a>
  );
}
