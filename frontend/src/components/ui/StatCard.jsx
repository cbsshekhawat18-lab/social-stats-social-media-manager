/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { fmt } from '../../services/platforms';

/**
 * Restyled with the new design tokens (). Public API unchanged:
 * <StatCard label value icon color sub trend />
 *
 * The `color` prop drives an icon-tile gradient; the card surface itself
 * uses the surface tokens (light + dark mode aware).
 */

const ICON_THEMES = {
  '#6366f1': { gradient: 'linear-gradient(135deg,#818cf8,#6366f1)', glow: 'rgba(99,102,241,0.20)' },
  '#22c55e': { gradient: 'linear-gradient(135deg,#4ade80,#22c55e)', glow: 'rgba(34,197,94,0.20)'  },
  '#2563eb': { gradient: 'linear-gradient(135deg,#60a5fa,#2563eb)', glow: 'rgba(37,99,235,0.20)'  },
  '#ef4444': { gradient: 'linear-gradient(135deg,#f87171,#ef4444)', glow: 'rgba(239,68,68,0.20)'  },
  '#f59e0b': { gradient: 'linear-gradient(135deg,#fcd34d,#f59e0b)', glow: 'rgba(245,158,11,0.20)' },
  '#8b5cf6': { gradient: 'linear-gradient(135deg,#a78bfa,#8b5cf6)', glow: 'rgba(139,92,246,0.20)' },
  '#0891b2': { gradient: 'linear-gradient(135deg,#22d3ee,#0891b2)', glow: 'rgba(8,145,178,0.20)'  },
  '#059669': { gradient: 'linear-gradient(135deg,#34d399,#059669)', glow: 'rgba(5,150,105,0.20)'  },
  '#00CCF5': { gradient: 'var(--brand-gradient)',                   glow: 'var(--brand-primary-glow)' },
};

const DEFAULT_THEME = {
  gradient: 'linear-gradient(135deg,#94a3b8,#64748b)',
  glow: 'rgba(100,116,139,0.18)',
};

export default function StatCard({ label, value, icon: Icon, color = '#00CCF5', sub, trend }) {
  const theme = ICON_THEMES[color] || DEFAULT_THEME;
  const isPositive = trend > 0;

  return (
    <div
      className="ds-statcard"
      style={{
        position: 'relative',
        flex: 1,
        minWidth: 140,
        padding: 20,
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        transition: 'var(--transition-default)',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column', gap: 10,
        cursor: 'default',
      }}
    >
      {/* Top: icon tile + label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32,
          borderRadius: 'var(--radius-sm)',
          background: theme.gradient,
          boxShadow: `0 2px 8px ${theme.glow}`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {Icon && <Icon size={15} color="#fff" strokeWidth={2.4} />}
        </div>
        <span style={{
          fontSize: 12, fontWeight: 500,
          color: 'var(--text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          lineHeight: 1.3,
        }}>
          {label}
        </span>
      </div>

      {/* Value */}
      <div style={{
        fontSize: 28, fontWeight: 600,
        letterSpacing: '-0.03em',
        lineHeight: 1.05,
        color: 'var(--text-primary)',
      }}>
        {fmt(value)}
      </div>

      {/* Trend + sub */}
      {(typeof trend === 'number' && trend !== 0) || sub ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {typeof trend === 'number' && trend !== 0 && (
            <span style={{
              fontSize: 11, fontWeight: 500,
              padding: '2px 8px', borderRadius: 'var(--radius-pill)',
              background: isPositive ? 'var(--success-bg)' : 'var(--danger-bg)',
              color:      isPositive ? 'var(--success)'    : 'var(--danger)',
            }}>
              {isPositive ? '↑' : '↓'} {Math.abs(trend)}%
            </span>
          )}
          {sub && (
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>
              {sub}
            </span>
          )}
        </div>
      ) : null}

      <style>{`
        .ds-statcard:hover {
          border-color: var(--border-default);
          box-shadow: var(--shadow-md);
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
}
