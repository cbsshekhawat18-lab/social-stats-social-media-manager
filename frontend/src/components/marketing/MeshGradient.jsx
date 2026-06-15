/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * MeshGradient — animated multi-blob backdrop for hero + CTA sections.
 *
 * Pure CSS — three radial-gradient blobs drift slowly via @keyframes.
 * GPU-friendly (translate-only, no layout thrash). Honours
 * `prefers-reduced-motion` by halting the drift but keeping the static blobs.
 *
 *   <MeshGradient variant="hero" />
 *
 * Variants:
 *   - 'hero'   cyan → purple, vibrant (dark sections)
 *   - 'soft'   muted, for light sections
 *   - 'cta'    saturated for the final CTA
 */
export default function MeshGradient({ variant = 'hero', className, style }) {
  const palettes = {
    hero: {
      bg: '#0a0e14',
      blobs: [
        { color: 'rgba(0, 204, 245, 0.50)', x: '15%',  y: '20%',  size: 520 },
        { color: 'rgba(139, 92, 246, 0.36)', x: '78%',  y: '25%',  size: 460 },
        { color: 'rgba(0, 168, 216, 0.32)',  x: '45%',  y: '85%',  size: 600 },
      ],
    },
    soft: {
      bg: 'transparent',
      blobs: [
        { color: 'rgba(0, 204, 245, 0.15)', x: '20%',  y: '15%',  size: 500 },
        { color: 'rgba(139, 92, 246, 0.12)', x: '80%',  y: '70%',  size: 480 },
      ],
    },
    cta: {
      bg: '#0a0e14',
      blobs: [
        { color: 'rgba(0, 204, 245, 0.55)',  x: '20%',  y: '50%',  size: 560 },
        { color: 'rgba(139, 92, 246, 0.42)', x: '80%',  y: '40%',  size: 520 },
        { color: 'rgba(236, 72, 153, 0.18)', x: '50%',  y: '90%',  size: 480 },
      ],
    },
  };
  const p = palettes[variant] || palettes.hero;

  return (
    <div
      aria-hidden
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background: p.bg,
        ...style,
      }}
    >
      {p.blobs.map((b, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: `calc(${b.y} - ${b.size / 2}px)`,
            left: `calc(${b.x} - ${b.size / 2}px)`,
            width: b.size,
            height: b.size,
            borderRadius: '50%',
            background: `radial-gradient(circle at center, ${b.color}, transparent 70%)`,
            filter: 'blur(40px)',
            animation: `mkt-mesh-drift-${i % 3} ${22 + i * 4}s ease-in-out infinite`,
            willChange: 'transform',
          }}
        />
      ))}
      {/* Faint dotted grid overlay for tech feel */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          opacity: variant === 'soft' ? 0 : 0.6,
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
        }}
      />
      <style>{`
        @keyframes mkt-mesh-drift-0 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(40px, -30px) scale(1.08); }
        }
        @keyframes mkt-mesh-drift-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(-50px, 20px) scale(0.95); }
        }
        @keyframes mkt-mesh-drift-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(20px, 40px) scale(1.05); }
        }
        @media (prefers-reduced-motion: reduce) {
          [class*="mkt-mesh"], div[style*="mkt-mesh-drift"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
