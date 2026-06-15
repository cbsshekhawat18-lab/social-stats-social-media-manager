/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useRef, useCallback } from 'react';

export default function useSwipe({ onSwipeLeft, onSwipeRight, onSwipeDown, threshold = 60 }) {
  const startRef = useRef(null);

  const onTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    startRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  }, []);

  const onTouchEnd = useCallback((e) => {
    if (!startRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - startRef.current.x;
    const dy = touch.clientY - startRef.current.y;
    const dt = Date.now() - startRef.current.time;
    startRef.current = null;

    if (dt > 500) return; // too slow

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
      if (dx > 0 && onSwipeRight) onSwipeRight();
      if (dx < 0 && onSwipeLeft) onSwipeLeft();
    }
    if (dy > threshold && Math.abs(dy) > Math.abs(dx) && onSwipeDown) {
      onSwipeDown();
    }
  }, [onSwipeLeft, onSwipeRight, onSwipeDown, threshold]);

  return { onTouchStart, onTouchEnd };
}
