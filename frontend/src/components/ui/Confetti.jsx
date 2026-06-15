/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * Confetti — one-shot celebratory particle burst.
 *
 * Pure framer-motion (no canvas-confetti dep). Renders a fixed-position
 * overlay full of small colored shapes that drift downward + outward and
 * fade to zero in ~2.4s.
 *
 * Props:
 *   count:    number of particles (default 60)
 *   duration: seconds (default 2.4)
 *   colors:   palette to randomly draw from
 *   onDone:   callback after the longest particle lifecycle
 *   active:   bool — false unmounts immediately (lets you toggle)
 *
 * Honours prefers-reduced-motion (renders nothing).
 */
const DEFAULT_COLORS = [
  '#00CCF5', '#00A8D8', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6',
];

export default function Confetti({
  count = 60,
  duration = 2.4,
  colors = DEFAULT_COLORS,
  onDone,
  active = true,
}) {
  const reduced = useReducedMotion();

  // Pre-compute random offsets, sizes, rotations once per mount
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const startX = 50 + (Math.random() - 0.5) * 16;       // start near horizontal center
        const angle = (Math.random() - 0.5) * Math.PI * 1.2;  // -108°..+108° spread
        const distance = 30 + Math.random() * 50;             // vh of travel
        const dx = Math.sin(angle) * distance;
        const dy = -Math.abs(Math.cos(angle)) * distance * 0.6 + (Math.random() * 80 + 30);
        const size = 6 + Math.random() * 8;
        const rotate = (Math.random() - 0.5) * 720;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const isCircle = Math.random() < 0.4;
        const delay = Math.random() * 0.15;
        return { id: i, startX, dx, dy, size, rotate, color, isCircle, delay };
      }),
    [count, colors]
  );

  if (!active || reduced) return null;

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 999,
      }}
    >
      {particles.map((p) => (
        <motion.span
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 0, rotate: 0 }}
          animate={{
            x: `${p.dx}vw`,
            y: `${p.dy}vh`,
            rotate: p.rotate,
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration,
            delay: p.delay,
            ease: [0.16, 1, 0.3, 1],
            opacity: { duration, times: [0, 0.05, 0.7, 1] },
          }}
          onAnimationComplete={p.id === particles.length - 1 ? onDone : undefined}
          style={{
            position: 'absolute',
            top: '20vh',
            left: `${p.startX}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.isCircle ? '50%' : 2,
            boxShadow: `0 1px 3px rgba(0,0,0,0.18)`,
          }}
        />
      ))}
    </div>
  );
}
