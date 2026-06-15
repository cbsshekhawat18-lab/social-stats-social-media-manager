/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * CountUp — animated number that ticks from 0 (or `from`) to `value` once.
 *
 * Props:
 *   value:    final number (required)
 *   from:     start value (default 0)
 *   duration: ms (default 700)
 *   format:   (n) => string  — formatter (default: toLocaleString)
 *   prefix, suffix:  decorations applied around the formatted number
 *
 * Honours prefers-reduced-motion (renders the final number immediately).
 *
 * Re-runs the animation when `value` changes — useful for "+ updated" cases.
 */
export default function CountUp({
  value,
  from = 0,
  duration = 700,
  format,
  prefix = '',
  suffix = '',
  className,
  style,
}) {
  const reduced = useReducedMotion();
  const [n, setN] = useState(reduced ? value : from);
  const startRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (reduced) { setN(value); return; }
    cancelAnimationFrame(rafRef.current);
    startRef.current = performance.now();
    const startVal = n;
    const delta = value - startVal;

    const tick = (t) => {
      const elapsed = t - startRef.current;
      const p = Math.min(1, elapsed / duration);
      // ease-out-quart for a more organic settle
      const eased = 1 - Math.pow(1 - p, 4);
      const next = startVal + delta * eased;
      setN(next);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else setN(value);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-line — we don't include `n` to avoid restarting mid-animation
  }, [value, duration, reduced]);

  const formatted = format
    ? format(n)
    : Math.round(n).toLocaleString();

  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums', ...style }}>
      {prefix}{formatted}{suffix}
    </span>
  );
}
