/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useState, useRef, useCallback } from 'react';

export default function SwipeableCard({ children, onSwipeLeft, onSwipeRight, leftLabel, rightLabel, style: extraStyle }) {
  const [offset, setOffset] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startX = useRef(0);

  const onTouchStart = useCallback((e) => {
    startX.current = e.touches[0].clientX;
    setSwiping(true);
  }, []);

  const onTouchMove = useCallback((e) => {
    if (!swiping) return;
    const dx = e.touches[0].clientX - startX.current;
    if (Math.abs(dx) < 120) setOffset(dx);
  }, [swiping]);

  const onTouchEnd = useCallback(() => {
    setSwiping(false);
    if (offset > 80 && onSwipeRight) onSwipeRight();
    else if (offset < -80 && onSwipeLeft) onSwipeLeft();
    setOffset(0);
  }, [offset, onSwipeLeft, onSwipeRight]);

  const bgColor = offset > 40 ? '#dcfce7' : offset < -40 ? '#fee2e2' : 'transparent';

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 12, background: bgColor, ...extraStyle }}>
      {/* Background labels */}
      {offset > 20 && rightLabel && (
        <div style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#16a34a', fontWeight: 600, fontSize: 13 }}>
          {rightLabel}
        </div>
      )}
      {offset < -20 && leftLabel && (
        <div style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: '#dc2626', fontWeight: 600, fontSize: 13 }}>
          {leftLabel}
        </div>
      )}
      {/* Card content */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: `translateX(${offset}px)`,
          transition: swiping ? 'none' : 'transform 0.25s ease',
          background: '#fff',
          position: 'relative', zIndex: 1,
        }}
      >
        {children}
      </div>
    </div>
  );
}
