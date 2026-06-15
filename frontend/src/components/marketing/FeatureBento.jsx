/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * FeatureBento — bento-grid feature showcase.
 *
 * Items shape:
 *   {
 *     id, title, description,
 *     to,          // optional link target — wraps the tile in <Link>
 *     span: { col, row },  // grid spans (default {col:1,row:1})
 *     tone: 'cyan'|'purple'|'pink'|'green'|'amber',
 *     icon: LucideIcon,
 *     preview: ReactNode,  // animated mini preview
 *     accentBg: bool,       // big tile gets subtle gradient bg
 *   }
 *
 *   <FeatureBento items={items} columns={4} />
 */
export default function FeatureBento({ items = [], columns = 4 }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridAutoRows: 'minmax(220px, auto)',
        gap: 16,
      }}
      className="mkt-bento"
    >
      {items.map((it) => <BentoTile key={it.id} {...it} />)}
      <style>{`
        @media (max-width: 1024px) {
          .mkt-bento { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .mkt-bento > * { grid-column: span 1 !important; grid-row: span 1 !important; }
        }
        @media (max-width: 640px) {
          .mkt-bento { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function BentoTile({
  id, title, description, to,
  span = { col: 1, row: 1 },
  tone = 'cyan',
  icon: Icon,
  preview,
  accentBg = false,
}) {
  const reduced = useReducedMotion();

  const toneStyles = {
    cyan:   { accent: '#00CCF5', soft: 'rgba(0,204,245,0.08)',  glow: 'rgba(0,204,245,0.20)' },
    purple: { accent: '#a78bfa', soft: 'rgba(139,92,246,0.08)', glow: 'rgba(139,92,246,0.20)' },
    pink:   { accent: '#f472b6', soft: 'rgba(236,72,153,0.08)', glow: 'rgba(236,72,153,0.20)' },
    green:  { accent: '#34d399', soft: 'rgba(16,185,129,0.08)', glow: 'rgba(16,185,129,0.20)' },
    amber:  { accent: '#fbbf24', soft: 'rgba(245,158,11,0.08)', glow: 'rgba(245,158,11,0.20)' },
  }[tone] || {};

  const bg = accentBg
    ? `radial-gradient(ellipse at top right, ${toneStyles.soft}, transparent 70%), var(--surface-card)`
    : 'var(--surface-card)';

  const Wrapper = to ? Link : 'div';
  const wrapperProps = to ? { to } : {};

  return (
    <motion.div
      whileHover={reduced ? {} : { y: -4 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      style={{
        gridColumn: `span ${span.col}`,
        gridRow:    `span ${span.row}`,
      }}
    >
      <Wrapper
        {...wrapperProps}
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          padding: 24,
          background: bg,
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          textDecoration: 'none',
          color: 'var(--text-primary)',
          transition: 'border-color 200ms, box-shadow 200ms',
          position: 'relative',
          overflow: 'hidden',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.borderColor = toneStyles.accent;
          e.currentTarget.style.boxShadow = `0 12px 40px ${toneStyles.glow}`;
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-subtle)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          {Icon && (
            <span style={{
              width: 32, height: 32, flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: toneStyles.soft,
              color: toneStyles.accent,
              borderRadius: 'var(--radius-sm)',
            }}>
              <Icon size={16} strokeWidth={2.2} />
            </span>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{
              margin: 0, fontSize: 17, fontWeight: 700,
              color: 'var(--text-primary)', letterSpacing: '-0.01em',
            }}>{title}</h3>
            {description && (
              <p style={{
                margin: '4px 0 0',
                fontSize: 13, lineHeight: 1.5,
                color: 'var(--text-secondary)',
              }}>{description}</p>
            )}
          </div>
        </div>

        {/* Preview */}
        {preview && (
          <div style={{ marginTop: 18, flex: 1, minHeight: 0 }}>
            {preview}
          </div>
        )}
      </Wrapper>
    </motion.div>
  );
}
