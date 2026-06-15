/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useState, useRef, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';

export default function PullToRefresh({ onRefresh, children }) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const containerRef = useRef(null);

  const onTouchStart = useCallback((e) => {
    if (containerRef.current?.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      setPulling(true);
    }
  }, []);

  const onTouchMove = useCallback((e) => {
    if (!pulling || refreshing) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0 && dy < 120) {
      setPullDistance(dy);
    }
  }, [pulling, refreshing]);

  const onTouchEnd = useCallback(async () => {
    if (pullDistance > 60 && onRefresh) {
      setRefreshing(true);
      setPullDistance(50);
      try { await onRefresh(); } catch {}
      setRefreshing(false);
    }
    setPulling(false);
    setPullDistance(0);
  }, [pullDistance, onRefresh]);

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ position: 'relative' }}
    >
      <div style={{
        height: pullDistance,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', transition: pulling ? 'none' : 'height 0.2s ease',
      }}>
        <RefreshCw
          size={20}
          style={{
            color: '#00B8DA',
            transform: `rotate(${pullDistance * 3}deg)`,
            animation: refreshing ? 'spin 0.8s linear infinite' : 'none',
          }}
        />
      </div>
      {children}
    </div>
  );
}
