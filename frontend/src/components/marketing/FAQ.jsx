/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

/**
 * FAQ — accessible accordion. Smooth expand/collapse with framer-motion.
 *
 *   <FAQ items={[{ q: '...', a: '...'}]} />
 *
 * Each item has a button (toggle) and a region (panel). Multiple items can
 * be open at once OR set `singleOpen` to enforce one-at-a-time.
 */
export default function FAQ({ items = [], singleOpen = false }) {
  const [open, setOpen] = useState(() => singleOpen ? null : new Set());
  const reduced = useReducedMotion();

  function toggle(idx) {
    if (singleOpen) {
      setOpen((cur) => cur === idx ? null : idx);
    } else {
      setOpen((cur) => {
        const next = new Set(cur);
        next.has(idx) ? next.delete(idx) : next.add(idx);
        return next;
      });
    }
  }

  const isOpen = (idx) => singleOpen ? open === idx : open.has(idx);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      borderTop: '1px solid var(--border-subtle)',
    }}>
      {items.map((item, idx) => (
        <div key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <button
            type="button"
            aria-expanded={isOpen(idx)}
            onClick={() => toggle(idx)}
            style={{
              width: '100%',
              padding: '20px 0',
              textAlign: 'left',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              gap: 16,
              fontSize: 16, fontWeight: 600,
              color: 'var(--text-primary)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <span style={{ flex: 1 }}>{item.q}</span>
            <ChevronDown
              size={18}
              style={{
                color: 'var(--text-tertiary)',
                flexShrink: 0,
                transform: isOpen(idx) ? 'rotate(180deg)' : 'rotate(0)',
                transition: 'transform 200ms var(--ease-out)',
              }}
            />
          </button>
          <AnimatePresence initial={false}>
            {isOpen(idx) && (
              <motion.div
                initial={reduced ? false : { height: 0, opacity: 0 }}
                animate={reduced ? {} : { height: 'auto', opacity: 1 }}
                exit={reduced ? {} : { height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{
                  paddingBottom: 20,
                  fontSize: 14, lineHeight: 1.65,
                  color: 'var(--text-secondary)',
                  maxWidth: 720,
                }}>
                  {item.a}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}
