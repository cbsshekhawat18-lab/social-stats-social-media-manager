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
 * Drawer — side-sliding panel from any edge.
 *
 * Props:
 *   open:     boolean
 *   onClose:  () => void
 *   side:     'right' | 'left' | 'top' | 'bottom'   (default 'right')
 *   width:    width in px (right/left, default 420)
 *   height:   height in px (top/bottom, default 360)
 *   title:    string
 *   description: optional secondary line
 *   footer:   optional ReactNode rendered in a footer row
 *   showClose: default true
 *
 * Mobile note: pass side='bottom' for native-feel sheets — height grows to
 * fit content and inherits safe-area insets via the wrapping CSS.
 */
export default function Drawer({
  open,
  onClose,
  side = 'right',
  width = 420,
  height = 360,
  title,
  description,
  children,
  footer,
  showClose = true,
}) {
  const ref = useRef(null);
  const lastFocusRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    lastFocusRef.current = document.activeElement;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => {
      const root = ref.current;
      const f = root?.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      (f || root)?.focus?.();
    }, 0);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      clearTimeout(t);
      lastFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const isHoriz = side === 'left' || side === 'right';
  const placement = {
    right:  { top: 0, right: 0,  bottom: 0, width, height: '100%' },
    left:   { top: 0, left: 0,   bottom: 0, width, height: '100%' },
    top:    { top: 0, left: 0,   right: 0,  height, width: '100%' },
    bottom: { bottom: 0, left: 0, right: 0, height, width: '100%' },
  }[side];

  const slideAnim = `ds-drawer-${side}`;

  const node = (
    <div
      style={{
        position: 'fixed', inset: 0,
        zIndex: 'var(--z-modal)',
        background: 'var(--overlay-backdrop)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        animation: 'ds-drawer-fade 200ms var(--ease-out)',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <aside
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'ds-drawer-title' : undefined}
        tabIndex={-1}
        style={{
          position: 'fixed',
          ...placement,
          background: 'var(--surface-elevated)',
          borderRadius: side === 'bottom' ? 'var(--radius-xl) var(--radius-xl) 0 0'
                       : side === 'top'    ? '0 0 var(--radius-xl) var(--radius-xl)'
                       : 0,
          boxShadow: 'var(--shadow-xl)',
          display: 'flex',
          flexDirection: 'column',
          animation: `${slideAnim} 280ms var(--ease-out)`,
          overflow: 'hidden',
        }}
      >
        {(title || showClose) && (
          <header style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            padding: '18px 20px 14px',
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            <div style={{ minWidth: 0 }}>
              {title && (
                <h2 id="ds-drawer-title" style={{
                  margin: 0, fontSize: 16, fontWeight: 600,
                  color: 'var(--text-primary)', letterSpacing: '-0.01em',
                }}>
                  {title}
                </h2>
              )}
              {description && (
                <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {description}
                </p>
              )}
            </div>
            {showClose && (
              <Button variant="ghost" size="sm" iconOnly icon={X} aria-label="Close" onClick={onClose} />
            )}
          </header>
        )}

        <div style={{
          flex: 1, padding: 20, overflowY: 'auto',
          color: 'var(--text-primary)',
        }}>
          {children}
        </div>

        {footer && (
          <footer style={{
            display: 'flex', justifyContent: 'flex-end', gap: 8,
            padding: '12px 20px 18px',
            borderTop: '1px solid var(--border-subtle)',
          }}>
            {footer}
          </footer>
        )}
      </aside>

      <style>{`
        @keyframes ds-drawer-fade   { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ds-drawer-right  { from { transform: translateX(100%); }  to { transform: translateX(0); } }
        @keyframes ds-drawer-left   { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        @keyframes ds-drawer-top    { from { transform: translateY(-100%); } to { transform: translateY(0); } }
        @keyframes ds-drawer-bottom { from { transform: translateY(100%); }  to { transform: translateY(0); } }
      `}</style>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(node, document.body) : node;
}
