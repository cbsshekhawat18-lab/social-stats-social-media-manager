/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useEffect, useState } from 'react';
import MarketingLayout from './MarketingLayout';
import Badge from '../ui/Badge';
import Meta from '../Meta';

/**
 * LegalPageLayout — shared chrome for long-form legal/policy/support pages.
 *
 * Props:
 *   eyebrow:       short label rendered as a Badge (e.g. "Privacy")
 *   title:         page H1
 *   effectiveDate: optional Date / ISO string
 *   lastUpdated:   optional Date / ISO string
 *   intro:         optional short paragraph rendered above the TOC/body
 *   sections:      [{ id, title, body, items?: ReactNode[] }] — body is ReactNode
 *   children:      optional custom content rendered AFTER the sections
 *                  (e.g. cookie toggle table, GDPR request form)
 *
 * Layout: sticky table-of-contents on the left, body on the right.
 * Active TOC link is tracked via IntersectionObserver.
 */
export default function LegalPageLayout({
  eyebrow,
  title,
  effectiveDate,
  lastUpdated,
  intro,
  sections = [],
  children,
}) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    if (sections.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); });
      },
      { rootMargin: '-30% 0px -55% 0px', threshold: 0 }
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [sections]);

  return (
    <MarketingLayout>
      <Meta
        title={title}
        description={intro || `${title} — Social Stats legal and support documentation.`}
      />

      {/* Hero */}
      <section style={{ padding: '128px 32px 48px', position: 'relative', overflow: 'hidden' }}>
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0,
            background: 'var(--brand-mesh)',
            opacity: 0.20, filter: 'blur(80px) saturate(140%)',
          }}
        />
        <div style={{ position: 'relative', maxWidth: 'var(--container-xl)', margin: '0 auto', textAlign: 'center' }}>
          {eyebrow && <Badge variant="brand" size="md">{eyebrow}</Badge>}
          <h1 style={{
            margin: '20px 0 12px',
            fontSize: 'clamp(36px, 4.4vw, 48px)',
            lineHeight: 1.05,
            letterSpacing: '-0.025em',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}>
            {title}
          </h1>
          {(effectiveDate || lastUpdated) && (
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
              {effectiveDate && <>Effective: {formatDate(effectiveDate)}</>}
              {effectiveDate && lastUpdated && ' · '}
              {lastUpdated && <>Last updated: {formatDate(lastUpdated)}</>}
            </div>
          )}
          {intro && (
            <p style={{ margin: '20px auto 0', maxWidth: 660, fontSize: 16, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
              {intro}
            </p>
          )}
        </div>
      </section>

      {/* Body: TOC + content */}
      <section style={{ padding: '32px 32px 96px' }}>
        <div
          style={{
            maxWidth: 'var(--container-xl)',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: '220px minmax(0, 1fr)',
            gap: 56,
            alignItems: 'flex-start',
          }}
          className="legal-grid"
        >
          {/* Sticky TOC */}
          <aside
            style={{
              position: 'sticky',
              top: 96,
              padding: 12,
              background: 'var(--surface-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-xs)',
            }}
            className="legal-toc"
          >
            <div style={{
              fontSize: 11, fontWeight: 600,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
              padding: '4px 8px 10px',
            }}>
              Contents
            </div>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  style={{
                    padding: '8px 10px',
                    fontSize: 12,
                    fontWeight: active === s.id ? 600 : 500,
                    color: active === s.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                    background: active === s.id ? 'var(--brand-primary-soft)' : 'transparent',
                    boxShadow: active === s.id ? 'inset 2px 0 0 var(--brand-primary)' : 'none',
                    borderRadius: 'var(--radius-sm)',
                    textDecoration: 'none',
                    lineHeight: 1.4,
                    transition: 'var(--transition-fast)',
                  }}
                >
                  {s.title}
                </a>
              ))}
            </nav>
          </aside>

          {/* Content card */}
          <article
            style={{
              padding: '40px 48px',
              background: 'var(--surface-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-sm)',
              color: 'var(--text-primary)',
              lineHeight: 1.7,
              fontSize: 15,
            }}
            className="legal-article"
          >
            {sections.map((s) => (
              <Section key={s.id} section={s} />
            ))}
            {children}
          </article>
        </div>

        <style>{`
          .legal-article h2 { font-size: 22px; font-weight: 600; letter-spacing: -0.015em; color: var(--text-primary); margin: 0 0 12px; }
          .legal-article h3 { font-size: 17px; font-weight: 600; color: var(--text-primary); margin: 24px 0 8px; }
          .legal-article p  { margin: 0 0 16px; color: var(--text-secondary); }
          .legal-article ul, .legal-article ol { margin: 0 0 16px; padding-left: 22px; color: var(--text-secondary); }
          .legal-article li { margin-bottom: 6px; }
          .legal-article strong { color: var(--text-primary); font-weight: 600; }
          .legal-article a { color: var(--text-link); text-decoration: none; }
          .legal-article a:hover { text-decoration: underline; }

          @media (max-width: 980px) {
            .legal-grid { grid-template-columns: 1fr !important; }
            .legal-toc  { position: static !important; }
            .legal-article { padding: 28px 24px !important; }
          }
        `}</style>
      </section>
    </MarketingLayout>
  );
}

function Section({ section }) {
  return (
    <section id={section.id} style={{ scrollMarginTop: 96, marginBottom: 36 }}>
      <h2>{section.title}</h2>
      {typeof section.body === 'string'
        ? <p>{section.body}</p>
        : section.body /* ReactNode */}
      {section.items && section.items.length > 0 && (
        <ul>
          {section.items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      )}
    </section>
  );
}

function formatDate(d) {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}
