/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useReducedMotion } from 'framer-motion';

/**
 * LogoCarousel — infinite horizontal scroll of customer logos.
 * Logos render in grayscale at 70% opacity; brighten on hover.
 * Edge fade-out gradient masks the loop seam.
 *
 *   <LogoCarousel logos={[
 *     { name: 'Acme', src: '/logos/acme.svg' },     // image
 *     { name: 'Beta', label: 'BetaCorp' },          // text fallback
 *   ]} />
 *
 * Honours `prefers-reduced-motion` (renders a static row).
 */
export default function LogoCarousel({ logos = [], speedSec = 32, height = 32 }) {
  const reduced = useReducedMotion();
  // Duplicate for seamless loop
  const list = reduced ? logos : [...logos, ...logos];

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        maskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
        WebkitMaskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 56,
          padding: '8px 0',
          width: reduced ? '100%' : 'max-content',
          animation: reduced ? 'none' : `mkt-logo-scroll ${speedSec}s linear infinite`,
          alignItems: 'center',
        }}
      >
        {list.map((logo, i) => (
          <LogoItem key={`${logo.name}-${i}`} logo={logo} height={height} />
        ))}
      </div>
      <style>{`
        @keyframes mkt-logo-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}


function LogoItem({ logo, height }) {
  const common = {
    flex: '0 0 auto',
    color: 'var(--text-tertiary)',
    opacity: 0.7,
    transition: 'opacity 200ms, color 200ms',
    cursor: 'default',
  };

  const onHover = (e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--text-primary)'; };
  const onLeave = (e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.color = 'var(--text-tertiary)'; };

  if (logo.src) {
    return (
      <img
        src={logo.src}
        alt={logo.name}
        style={{
          ...common,
          height,
          filter: 'grayscale(1)',
          objectFit: 'contain',
        }}
        onMouseOver={onHover}
        onMouseOut={onLeave}
      />
    );
  }

  // Text fallback — looks decent until real logos ship
  return (
    <span
      onMouseOver={onHover}
      onMouseOut={onLeave}
      style={{
        ...common,
        fontSize: 18,
        fontWeight: 700,
        letterSpacing: '-0.02em',
        whiteSpace: 'nowrap',
      }}
    >
      {logo.label || logo.name}
    </span>
  );
}
