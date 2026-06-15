/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import Button from './Button';

/**
 * Modal — accessible dialog with focus trap, Esc-to-close, backdrop blur.
 *
 * Props:
 *   open:        boolean
 *   onClose:     () => void
 *   title:       string (rendered in header; required for a11y unless ariaLabel set)
 *   description: optional secondary line under title
 *   ariaLabel:   alternative when title is non-text
 *   size:        'sm' (420) | 'md' (560) | 'lg' (760) | 'xl' (960)
 *   children:    body content
 *   footer:      ReactNode rendered in a sticky footer row
 *   closeOnBackdrop: default true
 *   showClose:   show the X button in header (default true)
 */
const SIZES = { sm: 420, md: 560, lg: 760, xl: 960 };

export default function Modal({
  open,
  onClose,
  title,
  description,
  ariaLabel,
  size = 'md',
  children,
  footer,
  closeOnBackdrop = true,
  showClose = true,
}) {
  const dialogRef = useRef(null);
  const lastFocusRef = useRef(null);

  // Esc to close + lock body scroll + restore focus
  useEffect(() => {
    if (!open) return;
    lastFocusRef.current = document.activeElement;

    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus the first focusable element inside the dialog
    const t = setTimeout(() => {
      const root = dialogRef.current;
      if (!root) return;
      const focusable = root.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      (focusable || root).focus?.();
    }, 0);

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(t);
      lastFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  // Focus trap (Tab cycle within the dialog)
  function onKeyDown(e) {
    if (e.key !== 'Tab') return;
    const root = dialogRef.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ));
    if (items.length === 0) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  if (!open) return null;

  const node = (
    <div
      style={{
        position: 'fixed', inset: 0,
        zIndex: 'var(--z-modal)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'var(--overlay-backdrop)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        animation: 'ds-modal-fade 200ms var(--ease-out)',
      }}
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={title ? 'ds-modal-title' : undefined}
        aria-describedby={description ? 'ds-modal-desc' : undefined}
        onKeyDown={onKeyDown}
        tabIndex={-1}
        style={{
          width: '100%',
          maxWidth: SIZES[size] || SIZES.md,
          maxHeight: 'calc(100vh - 32px)',
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-xl)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'ds-modal-scale 240ms var(--ease-out)',
        }}
      >
        {(title || showClose) && (
          <header style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            padding: '20px 24px 12px',
            borderBottom: title ? '1px solid var(--border-subtle)' : 'none',
          }}>
            <div style={{ minWidth: 0 }}>
              {title && (
                <h2 id="ds-modal-title" style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.01em',
                }}>
                  {title}
                </h2>
              )}
              {description && (
                <p id="ds-modal-desc" style={{
                  margin: '4px 0 0',
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                }}>
                  {description}
                </p>
              )}
            </div>
            {showClose && (
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                icon={X}
                aria-label="Close dialog"
                onClick={onClose}
              />
            )}
          </header>
        )}

        <div style={{
          padding: '20px 24px',
          overflowY: 'auto',
          flex: 1,
          color: 'var(--text-primary)',
        }}>
          {children}
        </div>

        {footer && (
          <footer style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '12px 24px 20px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--surface-elevated)',
          }}>
            {footer}
          </footer>
        )}
      </div>

      <style>{`
        @keyframes ds-modal-fade  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ds-modal-scale { from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(node, document.body)
    : node;
}
