/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { Link } from 'react-router-dom';
import { Sparkles, Wrench, Bug, ArrowRight } from 'lucide-react';
import MarketingLayout from '../components/marketing/MarketingLayout';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Meta from '../components/Meta';

const RELEASES = [
  {
    version: 'v3.2.0',
    date: '2026-04-30',
    title: 'Marketing OS visual refresh',
    entries: [
      { tag: 'new', text: 'Brand-new design system: tokens, dark mode, full component library.' },
      { tag: 'new', text: 'Public site redesign — landing page, features, pricing, customers, about, contact.' },
      { tag: 'improved', text: 'Auth pages share a unified split-screen layout with rotating testimonials.' },
      { tag: 'improved', text: 'Help Center, Status, and Security pages get full content and improved visuals.' },
    ],
  },
  {
    version: 'v3.1.4',
    date: '2026-04-12',
    title: 'WhatsApp Pinbot stability + AI improvements',
    entries: [
      { tag: 'new', text: 'AI brand-voice training now supports up to 20 sample posts (was 10).' },
      { tag: 'improved', text: 'WhatsApp inbound webhook resilience: automatic retry on transient Pinbot errors.' },
      { tag: 'fixed', text: 'Inbox filter "unassigned" no longer leaks across clients.' },
    ],
  },
  {
    version: 'v3.1.0',
    date: '2026-03-21',
    title: 'Permissions overhaul + audit log',
    entries: [
      { tag: 'new', text: 'Granular permission codes per page and action (composer, inbox, video, automations, audience, competitors, audit).' },
      { tag: 'new', text: 'Audit log searchable across all account actions for 1 year on Growth, custom on Enterprise.' },
      { tag: 'improved', text: 'Approval workflow now sends in-app + email notifications to designated approvers.' },
    ],
  },
  {
    version: 'v3.0.0',
    date: '2026-02-14',
    title: 'Unified Marketing OS launch',
    entries: [
      { tag: 'new', text: 'Composer: cross-platform publishing with per-platform overrides.' },
      { tag: 'new', text: 'Unified inbox with sentiment + AI reply suggestions.' },
      { tag: 'new', text: 'Automations engine — visual rule builder for keyword, schedule, and sentiment triggers.' },
      { tag: 'new', text: 'Video Studio: trim, resize, watermark, and publish.' },
    ],
  },
  {
    version: 'v2.8.2',
    date: '2026-01-18',
    title: 'Reporting + integrations polish',
    entries: [
      { tag: 'new', text: 'Scheduled report delivery (weekly + monthly) via email.' },
      { tag: 'improved', text: 'GMB integration handles location-based metrics with new APIs.' },
      { tag: 'fixed', text: 'YouTube watch-time pulled correctly across reauthentications.' },
    ],
  },
];

const TAGS = {
  new:      { label: 'New',      bg: 'var(--brand-primary-soft)', color: 'var(--brand-primary-hover)', icon: Sparkles },
  improved: { label: 'Improved', bg: 'var(--info-bg)',            color: 'var(--info)',                 icon: Wrench },
  fixed:    { label: 'Fixed',    bg: 'var(--success-bg)',         color: 'var(--success)',              icon: Bug },
};

export default function ChangelogPage() {
  return (
    <MarketingLayout>
      <Meta
        title="Changelog"
        description="Every release, every fix. The latest features, improvements, and bug fixes shipped to Social Stats."
      />
      {/* Hero */}
      <section style={{ padding: '128px 32px 56px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0,
            background: 'var(--brand-mesh)',
            opacity: 0.25, filter: 'blur(80px) saturate(140%)',
          }}
        />
        <div style={{ position: 'relative', maxWidth: 720, margin: '0 auto' }}>
          <Badge variant="brand" size="md">Changelog</Badge>
          <h1 style={{
            margin: '20px 0 16px',
            fontSize: 'clamp(36px, 4.4vw, 48px)',
            lineHeight: 1.05,
            letterSpacing: '-0.025em',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}>
            What's new in Social Stats.
          </h1>
          <p style={{ margin: '0 auto', maxWidth: 560, fontSize: 16, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
            Every release, every fix. Subscribe to <a href="mailto:hello@socialstats.app?subject=Subscribe%20to%20changelog" style={{ color: 'var(--text-link)', fontWeight: 500 }}>get it in your inbox</a> monthly.
          </p>
        </div>
      </section>

      {/* Timeline */}
      <section style={{ padding: '32px 32px 96px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', position: 'relative' }}>
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: 12, bottom: 12, left: 19,
              width: 2,
              background: 'linear-gradient(180deg, var(--brand-primary), transparent)',
              opacity: 0.4,
            }}
          />
          {RELEASES.map((r) => (
            <article
              key={r.version}
              style={{
                position: 'relative',
                paddingLeft: 56,
                marginBottom: 40,
              }}
            >
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  left: 4, top: 6,
                  width: 32, height: 32,
                  borderRadius: '50%',
                  background: 'var(--surface-card)',
                  border: '2px solid var(--brand-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 0 6px var(--brand-primary-glow)',
                }}
              >
                <Sparkles size={14} style={{ color: 'var(--brand-primary-hover)' }} strokeWidth={2.4} />
              </span>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: 'var(--brand-primary-hover)',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {r.version}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {new Date(r.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>

              <h2 style={{
                margin: 0,
                fontSize: 'clamp(20px, 2.4vw, 26px)',
                fontWeight: 600,
                letterSpacing: '-0.015em',
                color: 'var(--text-primary)',
              }}>
                {r.title}
              </h2>

              <ul style={{
                margin: '14px 0 0',
                padding: 0,
                listStyle: 'none',
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                {r.entries.map((entry, i) => {
                  const t = TAGS[entry.tag] || TAGS.improved;
                  const Icon = t.icon;
                  return (
                    <li
                      key={i}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: 'var(--text-primary)' }}
                    >
                      <span
                        style={{
                          flexShrink: 0,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                          padding: '2px 8px',
                          background: t.bg,
                          color: t.color,
                          borderRadius: 'var(--radius-pill)',
                          fontSize: 10, fontWeight: 600,
                          letterSpacing: '0.04em', textTransform: 'uppercase',
                          marginTop: 2,
                        }}
                      >
                        <Icon size={10} strokeWidth={2.4} />
                        {t.label}
                      </span>
                      <span style={{ lineHeight: 1.55, color: 'var(--text-secondary)' }}>
                        {entry.text}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </article>
          ))}

          {/* Older releases CTA */}
          <div style={{ paddingLeft: 56, marginTop: 32 }}>
            <Button as={Link} to="/contact" variant="secondary" size="md" iconRight={ArrowRight}>
              Looking for older releases?
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
