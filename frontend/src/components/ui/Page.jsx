/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

import SectionHeader from './SectionHeader';

/**
 * Page — page-level wrapper that handles container width, padding, breadcrumb,
 * page header, and slotted content.
 *
 * Props:
 *   title:        string                  page H1
 *   description:  string                  page subtitle
 *   actions:      ReactNode               right-side header actions
 *   breadcrumb:   [{ label, to? }]        last entry shown without link
 *   maxWidth:     'md' | 'lg' | 'xl' | '2xl' | 'full'   (default 'xl')
 *   padding:      'sm' | 'md' | 'lg'      content padding (default 'md')
 *   children:     page body
 */
const MAX_WIDTHS = {
  md:   'var(--container-md)',
  lg:   'var(--container-lg)',
  xl:   'var(--container-xl)',
  '2xl':'var(--container-2xl)',
  full: '100%',
};

const PADDINGS = {
  sm: '16px 16px 24px',
  md: '24px 24px 40px',
  lg: '32px 32px 56px',
};

export default function Page({
  title,
  description,
  actions,
  breadcrumb,
  maxWidth = 'xl',
  padding = 'md',
  children,
  className,
  style,
}) {
  return (
    <div
      className={className}
      style={{
        width: '100%',
        minHeight: '100%',
        background: 'var(--surface-page)',
        ...style,
      }}
    >
      <div
        style={{
          maxWidth: MAX_WIDTHS[maxWidth] || MAX_WIDTHS.xl,
          margin: '0 auto',
          padding: PADDINGS[padding] || PADDINGS.md,
          color: 'var(--text-primary)',
        }}
      >
        {breadcrumb && breadcrumb.length > 0 && (
          <nav
            aria-label="Breadcrumb"
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 4,
              fontSize: 12,
              color: 'var(--text-tertiary)',
              marginBottom: 12,
            }}
          >
            {breadcrumb.map((c, i) => {
              const isLast = i === breadcrumb.length - 1;
              return (
                <span key={`${c.label}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {c.to && !isLast ? (
                    <Link
                      to={c.to}
                      style={{
                        color: 'var(--text-tertiary)',
                        textDecoration: 'none',
                        transition: 'var(--transition-fast)',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
                    >
                      {c.label}
                    </Link>
                  ) : (
                    <span style={{ color: isLast ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: isLast ? 500 : 400 }}>
                      {c.label}
                    </span>
                  )}
                  {!isLast && (
                    <ChevronRight size={12} aria-hidden style={{ color: 'var(--text-quaternary)' }} />
                  )}
                </span>
              );
            })}
          </nav>
        )}

        {(title || description || actions) && (
          <SectionHeader
            title={title}
            description={description}
            actions={actions}
            level={1}
            style={{ marginBottom: 24 }}
          />
        )}

        {children}
      </div>
    </div>
  );
}
