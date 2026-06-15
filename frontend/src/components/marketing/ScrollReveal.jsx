/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';

/**
 * ScrollReveal — fades + lifts children into view on first intersection.
 *
 *   <ScrollReveal>
 *     <h2>Headline</h2>
 *   </ScrollReveal>
 *
 * Honours `prefers-reduced-motion`: renders children unchanged when set.
 *
 * Props:
 *   delay     seconds to wait before animation starts (stagger across siblings)
 *   y         pixels to lift from (default 24)
 *   duration  seconds (default 0.6)
 *   once      animate only on first intersection (default true)
 *   amount    intersection threshold 0-1 (default 0.2)
 *   as        wrapper element (default 'div')
 */
export default function ScrollReveal({
  children,
  delay = 0,
  y = 24,
  duration = 0.6,
  once = true,
  amount = 0.2,
  as = 'div',
  style,
  ...rest
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once, amount });
  const reduced = useReducedMotion();

  const Comp = motion[as] || motion.div;

  if (reduced) {
    const Plain = as;
    return <Plain ref={ref} style={style} {...rest}>{children}</Plain>;
  }

  return (
    <Comp
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}
      style={style}
      {...rest}
    >
      {children}
    </Comp>
  );
}
