/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { motion, useReducedMotion } from 'framer-motion';

/**
 * FloatingUICard — drifts slowly in 3D space with a subtle rotation.
 * Used on the hero to surround the dashboard mockup with peeks of
 * different product surfaces.
 *
 *   <FloatingUICard top="10%" left="-6%" delay={0.5} drift={[0, -10, 0, 10, 0]}>
 *     <InboxNotificationCard />
 *   </FloatingUICard>
 *
 * Honours `prefers-reduced-motion`.
 *
 * Props:
 *   top/left/right/bottom  CSS positioning
 *   width      explicit width (number or string)
 *   delay      stagger entry (seconds)
 *   duration   one drift cycle (default 14s)
 *   rotate     subtle rotation degrees ([startEnd, mid] tuple)
 *   tone       'cyan' | 'purple' | 'pink' | 'green' — accent for shadow glow
 */
export default function FloatingUICard({
  children,
  top, left, right, bottom,
  width = 240,
  delay = 0,
  duration = 14,
  rotate = [-2, 2],
  tone = 'cyan',
  zIndex = 2,
}) {
  const reduced = useReducedMotion();

  const glowColor = {
    cyan:   'rgba(0, 204, 245, 0.30)',
    purple: 'rgba(139, 92, 246, 0.28)',
    pink:   'rgba(236, 72, 153, 0.25)',
    green:  'rgba(16, 185, 129, 0.25)',
  }[tone] || 'rgba(0, 204, 245, 0.30)';

  const driftAnim = reduced
    ? { y: 0, rotate: 0 }
    : {
        y: [0, -8, 0, 8, 0],
        rotate: [rotate[0], rotate[1], rotate[0], rotate[1], rotate[0]],
      };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.4 + delay, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'absolute',
        top, left, right, bottom,
        width,
        zIndex,
        willChange: 'transform',
      }}
    >
      <motion.div
        animate={driftAnim}
        transition={{
          duration,
          repeat: reduced ? 0 : Infinity,
          ease: 'easeInOut',
          delay: 0.6 + delay,
        }}
        style={{
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: `0 24px 60px ${glowColor}, 0 8px 24px rgba(0,0,0,0.3)`,
          padding: 14,
          color: 'var(--text-primary)',
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
