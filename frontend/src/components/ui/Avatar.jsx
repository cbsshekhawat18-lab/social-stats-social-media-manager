/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useMemo, useState } from 'react';

/**
 * Avatar — image with initials fallback, optional status dot.
 *
 * Props:
 *   src:       optional image URL
 *   name:      used for alt + initials + gradient hash fallback
 *   size:      'xs' | 'sm' | 'md' | 'lg' | 'xl'  (default 'md')
 *   status:    'online' | 'offline' | 'busy' | 'away'   shows a small dot
 *   shape:     'circle' (default) | 'rounded'
 */
const SIZES = {
  xs: { dim: 20, font: 9,  status: 6  },
  sm: { dim: 28, font: 11, status: 8  },
  md: { dim: 36, font: 13, status: 10 },
  lg: { dim: 48, font: 16, status: 12 },
  xl: { dim: 72, font: 24, status: 16 },
};

const STATUS_COLORS = {
  online:  '#10b981',
  offline: '#94a3b8',
  busy:    '#ef4444',
  away:    '#f59e0b',
};

function hashHue(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({
  src,
  name = '',
  size = 'md',
  status,
  shape = 'circle',
  style,
  ...rest
}) {
  const s = SIZES[size] || SIZES.md;
  const [imgError, setImgError] = useState(false);

  const gradient = useMemo(() => {
    const hue = hashHue(name);
    return `linear-gradient(135deg, hsl(${hue} 70% 60%), hsl(${(hue + 30) % 360} 65% 50%))`;
  }, [name]);

  const radius = shape === 'rounded' ? 'var(--radius-md)' : '50%';

  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: s.dim, height: s.dim,
        borderRadius: radius,
        background: gradient,
        color: '#fff',
        fontSize: s.font,
        fontWeight: 600,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
        flexShrink: 0,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-xs)',
        ...style,
      }}
      role={src && !imgError ? 'img' : undefined}
      aria-label={name || undefined}
      {...rest}
    >
      {src && !imgError ? (
        <img
          src={src}
          alt={name || ''}
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}

      {status && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            bottom: 0, right: 0,
            width: s.status, height: s.status,
            background: STATUS_COLORS[status] || STATUS_COLORS.offline,
            border: '2px solid var(--surface-card)',
            borderRadius: '50%',
          }}
        />
      )}
    </span>
  );
}
