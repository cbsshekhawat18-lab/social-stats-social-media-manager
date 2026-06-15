/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { cloneElement, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

/**
 * Tooltip — lightweight, accessible hover/focus tooltip.
 *
 * Wraps a single child element and shows the `content` in a dark pill on
 * hover or keyboard focus. Closes on Escape, mouseout, or blur.
 *
 * Props:
 *   content:    string | ReactNode  — required
 *   side:       'top' | 'bottom' | 'left' | 'right'    (default 'top')
 *   delay:      ms before showing (default 200)
 *   children:   single React element (must accept onMouseEnter/onFocus)
 *
 * Position uses a measured-then-portal-free layout (the popover is rendered
 * inside a relative wrapper around the child). Good enough for most needs;
 * if you need clip-escaping, swap to a portal in a future iteration.
 */
export default function Tooltip({ content, side = 'top', delay = 200, children, disabled = false }) {
  const reactId = useId();
  const popId = `tt-${reactId}`;
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ left: 0, top: 0 });
  const [popDims, setPopDims] = useState({ w: 0, h: 0 });
  const wrapperRef = useRef(null);
  const popRef = useRef(null);
  const timerRef = useRef(null);

  function show() {
    if (disabled || !content) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(true), delay);
  }
  function hide() {
    clearTimeout(timerRef.current);
    setOpen(false);
  }
  useEffect(() => () => clearTimeout(timerRef.current), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Measure popover after it mounts to position it without flicker
  useLayoutEffect(() => {
    if (!open || !wrapperRef.current || !popRef.current) return;
    const wrapper = wrapperRef.current.getBoundingClientRect();
    const pop = popRef.current.getBoundingClientRect();
    setPopDims({ w: pop.width, h: pop.height });
    let left = 0, top = 0;
    const gap = 8;
    if (side === 'top')    { left = (wrapper.width - pop.width) / 2; top = -pop.height - gap; }
    if (side === 'bottom') { left = (wrapper.width - pop.width) / 2; top = wrapper.height + gap; }
    if (side === 'left')   { left = -pop.width - gap; top = (wrapper.height - pop.height) / 2; }
    if (side === 'right')  { left = wrapper.width + gap; top = (wrapper.height - pop.height) / 2; }
    setCoords({ left, top });
  }, [open, side, content]);

  // Inject ARIA + handlers onto the single child
  const child = cloneElement(children, {
    'aria-describedby': open ? popId : children.props['aria-describedby'],
    onMouseEnter: (e) => { show(); children.props.onMouseEnter?.(e); },
    onMouseLeave: (e) => { hide(); children.props.onMouseLeave?.(e); },
    onFocus:      (e) => { show(); children.props.onFocus?.(e); },
    onBlur:       (e) => { hide(); children.props.onBlur?.(e); },
  });

  return (
    <span
      ref={wrapperRef}
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseLeave={hide}
    >
      {child}
      {open && (
        <span
          ref={popRef}
          id={popId}
          role="tooltip"
          style={{
            position: 'absolute',
            left: coords.left, top: coords.top,
            zIndex: 'var(--z-popover)',
            padding: '6px 10px',
            background: 'var(--text-primary)',
            color: 'var(--surface-card)',
            fontSize: 12,
            fontWeight: 500,
            lineHeight: 1.4,
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow-md)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            opacity: popDims.w === 0 ? 0 : 1,
            transition: 'opacity var(--transition-fast)',
          }}
        >
          {content}
        </span>
      )}
    </span>
  );
}
