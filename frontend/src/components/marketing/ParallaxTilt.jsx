/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';

/**
 * ParallaxTilt — wraps children with mouse-move parallax tilt.
 * Intended for hero mockups + feature showcases. Uses springy motion
 * so the tilt eases naturally rather than tracking mouse rigidly.
 *
 *   <ParallaxTilt max={8}><img ... /></ParallaxTilt>
 *
 * Honours `prefers-reduced-motion`: renders children unchanged.
 *
 * Props:
 *   max       maximum tilt angle in degrees (default 8)
 *   perspective   CSS perspective in px (default 1200)
 *   reset     return to flat on mouse leave (default true)
 */
export default function ParallaxTilt({
  children,
  max = 8,
  perspective = 1200,
  reset = true,
  style,
  ...rest
}) {
  const ref = useRef(null);
  const reduced = useReducedMotion();

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const sx = useSpring(x, { stiffness: 80, damping: 14, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 80, damping: 14, mass: 0.5 });

  // Map [-0.5, 0.5] → [-max, max] degrees
  const rotateY = useTransform(sx, [-0.5, 0.5], [-max, max]);
  const rotateX = useTransform(sy, [-0.5, 0.5], [max, -max]);

  if (reduced) {
    return <div ref={ref} style={style} {...rest}>{children}</div>;
  }

  function onMove(e) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top)  / rect.height;
    x.set(px - 0.5);
    y.set(py - 0.5);
  }

  function onLeave() {
    if (reset) { x.set(0); y.set(0); }
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ perspective: `${perspective}px`, ...style }}
      {...rest}
    >
      <motion.div
        style={{
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
          willChange: 'transform',
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
