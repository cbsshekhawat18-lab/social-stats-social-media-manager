/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * Skeleton — shimmer placeholder for loading states.
 *
 * Props:
 *   variant: 'text' | 'card' | 'avatar' | 'image' | 'rect'    (default 'rect')
 *   width:   number | string         CSS width (text/avatar pick sensible defaults)
 *   height:  number | string
 *   lines:   number   for variant='text', number of stacked lines
 *   radius:  CSS radius            override
 *   style:   extra style
 */
const VARIANT_DEFAULTS = {
  text:   { width: '100%', height: 12, radius: 'var(--radius-sm)' },
  card:   { width: '100%', height: 120, radius: 'var(--radius-lg)' },
  avatar: { width: 40,    height: 40,  radius: '50%' },
  image:  { width: '100%', height: 200, radius: 'var(--radius-md)' },
  rect:   { width: '100%', height: 16,  radius: 'var(--radius-sm)' },
};

export default function Skeleton({
  variant = 'rect',
  width,
  height,
  lines = 1,
  radius,
  style,
  ...rest
}) {
  const d = VARIANT_DEFAULTS[variant] || VARIANT_DEFAULTS.rect;
  const w = width ?? d.width;
  const h = height ?? d.height;
  const r = radius ?? d.radius;

  if (variant === 'text' && lines > 1) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }} {...rest}>
        {Array.from({ length: lines }).map((_, i) => (
          <span
            key={i}
            aria-hidden
            className="ds-skeleton"
            style={{
              display: 'block',
              width: i === lines - 1 ? '70%' : w,
              height: h,
              borderRadius: r,
            }}
          />
        ))}
        <style>{SKELETON_KEYFRAMES}</style>
      </div>
    );
  }

  return (
    <span
      aria-hidden
      className="ds-skeleton"
      style={{
        display: 'inline-block',
        width: w, height: h,
        borderRadius: r,
        ...style,
      }}
      {...rest}
    >
      <style>{SKELETON_KEYFRAMES}</style>
    </span>
  );
}

const SKELETON_KEYFRAMES = `
  .ds-skeleton {
    background: linear-gradient(90deg,
      var(--surface-sunken) 25%,
      var(--surface-hover)  50%,
      var(--surface-sunken) 75%);
    background-size: 200% 100%;
    animation: ds-skeleton-shimmer 1.5s ease-in-out infinite;
  }
  @keyframes ds-skeleton-shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position:  200% 0; }
  }
`;
