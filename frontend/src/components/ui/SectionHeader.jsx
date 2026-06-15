/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * SectionHeader — title + description + optional right-side actions.
 *
 * Props:
 *   title:       string
 *   description: string (optional)
 *   actions:     ReactNode (optional)
 *   level:       1 (page) | 2 (section, default) | 3 (sub-section)
 *   eyebrow:     small uppercase tag rendered above the title (optional)
 *   align:       'left' (default) | 'center'
 */
const STYLES = {
  1: { titleSize: 28, titleWeight: 600, gap: 4, descSize: 14 },
  2: { titleSize: 18, titleWeight: 600, gap: 2, descSize: 13 },
  3: { titleSize: 15, titleWeight: 600, gap: 2, descSize: 12 },
};

export default function SectionHeader({
  title,
  description,
  actions,
  level = 2,
  eyebrow,
  align = 'left',
  style,
  className,
}) {
  const Tag = `h${Math.min(Math.max(level, 1), 6)}`;
  const s = STYLES[level] || STYLES[2];

  return (
    <header
      className={className}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: align === 'center' ? 'center' : 'space-between',
        gap: 16,
        textAlign: align,
        ...style,
      }}
    >
      <div style={{ minWidth: 0, flex: align === 'center' ? '0 0 auto' : 1 }}>
        {eyebrow && (
          <div style={{
            display: 'inline-block',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--brand-primary-hover)',
            marginBottom: 6,
          }}>
            {eyebrow}
          </div>
        )}
        {title && (
          <Tag style={{
            margin: 0,
            fontSize: s.titleSize,
            fontWeight: s.titleWeight,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
            lineHeight: 1.2,
          }}>
            {title}
          </Tag>
        )}
        {description && (
          <p style={{
            margin: `${s.gap}px 0 0`,
            fontSize: s.descSize,
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            maxWidth: align === 'center' ? 600 : undefined,
          }}>
            {description}
          </p>
        )}
      </div>

      {actions && align !== 'center' && (
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          {actions}
        </div>
      )}
    </header>
  );
}
