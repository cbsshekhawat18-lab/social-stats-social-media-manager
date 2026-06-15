/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';

/**
 * MetricCounter — counts from 0 to value when scrolled into view.
 * Use for stat bands ("50,000+ accounts managed").
 *
 *   <MetricCounter value={50000} suffix="+" />
 *   <MetricCounter value={99.9}  suffix="%" decimals={1} />
 *   <MetricCounter value={10}    suffix="M+" />
 *
 * Honours `prefers-reduced-motion` (snaps to value).
 */
export default function MetricCounter({
  value,
  suffix = '',
  prefix = '',
  decimals = 0,
  duration = 1.4,
  format = true,
  className,
  style,
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduced = useReducedMotion();

  const [display, setDisplay] = useState(reduced ? value : 0);

  useEffect(() => {
    if (reduced) { setDisplay(value); return; }
    if (!inView) return;
    let raf;
    const start = performance.now();
    const ms = duration * 1000;

    const tick = (now) => {
      const t = Math.min(1, (now - start) / ms);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(value * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setDisplay(value);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration, reduced]);

  const formatted = format
    ? display.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : display.toFixed(decimals);

  return (
    <span
      ref={ref}
      className={className}
      style={{ fontVariantNumeric: 'tabular-nums', ...style }}
    >
      {prefix}{formatted}{suffix}
    </span>
  );
}
