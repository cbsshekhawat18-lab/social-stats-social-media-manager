/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';

export default function BottomSheet({ open, onClose, title, children }) {
  const sheetRef = useRef(null);
  const startY = useRef(0);

  const handleTouchStart = useCallback((e) => {
    startY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e) => {
    const dy = e.changedTouches[0].clientY - startY.current;
    if (dy > 100) onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div style={styles.backdrop} onClick={onClose} />
      <div
        ref={sheetRef}
        style={styles.sheet}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div style={styles.handle} />
        {title && (
          <div style={styles.header}>
            <h3 style={styles.title}>{title}</h3>
            <button onClick={onClose} style={styles.closeBtn}><X size={20} /></button>
          </div>
        )}
        <div style={styles.body}>{children}</div>
      </div>
    </>
  );
}

const styles = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 400,
    background: 'rgba(0,0,0,0.4)',
    backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
  },
  sheet: {
    position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 401,
    background: '#fff',
    borderRadius: '20px 20px 0 0',
    maxHeight: '85vh',
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    boxShadow: '0 -8px 40px rgba(0,0,0,0.12)',
    animation: 'slideUp 0.25s ease forwards',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    background: '#cbd5e1', margin: '10px auto 4px',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 20px 12px', borderBottom: '1px solid #e2e8f0',
  },
  title: { fontSize: 17, fontWeight: 700, margin: 0, color: '#0f172a' },
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer', padding: 8,
    color: '#64748b', borderRadius: 8, display: 'flex',
  },
  body: { padding: '16px 20px 32px' },
};
