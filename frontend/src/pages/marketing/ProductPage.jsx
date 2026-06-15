/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * ProductPage — generic, data-driven product feature page.
 *
 * One template renders all 10 product pages from `productPages.js`. The
 * page picks its content via the URL slug (`/product/:slug`).
 *
 * Layout:
 *   1. Hero (eyebrow + H1 + subhead + CTAs + animated demo)
 *   2. Feature stripes (alternating image/text rows)
 *   3. Capability grid (small tiles)
 *   4. Customer quote
 *   5. Final CTA
 */
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Sparkles } from 'lucide-react';

import MarketingLayout    from '../../components/marketing/MarketingLayout';
import MeshGradient       from '../../components/marketing/MeshGradient';
import ScrollReveal       from '../../components/marketing/ScrollReveal';
import CTASection         from '../../components/marketing/CTASection';
import Button             from '../../components/ui/Button';
import Meta               from '../../components/Meta';
import JsonLd, {
  buildSoftwareApplication, buildBreadcrumbs, SITE_URL,
} from '../../components/JsonLd';

import { productPages, getProductPage } from './productPages';
import ComingSoonPage from './ComingSoonPage';


export default function ProductPage() {
  const { slug } = useParams();
  const data = getProductPage(slug);

  if (!data) return <ComingSoonPage />;

  return (
    <MarketingLayout>
      <Meta
        noSuffix
        title={`${data.title} — Social Stats`}
        description={data.description}
      />
      <JsonLd
        id="software"
        data={buildSoftwareApplication({
          name: data.title,
          description: data.description,
          ratingValue: 4.9,
          ratingCount: 1200,
        })}
      />
      <JsonLd
        id="breadcrumbs"
        data={buildBreadcrumbs([
          { name: 'Home',     url: `${SITE_URL}/` },
          { name: 'Product',  url: `${SITE_URL}/product/${slug}` },
          { name: data.title, url: `${SITE_URL}/product/${slug}` },
        ])}
      />
      <Hero data={data} />
      {data.stripes?.map((s, i) => (
        <FeatureStripe key={i} data={s} reverse={i % 2 === 1} />
      ))}
      {data.capabilities && <CapabilityGrid data={data.capabilities} />}
      {data.quote && <CustomerQuote data={data.quote} />}
      <FinalCTA data={data} />
    </MarketingLayout>
  );
}

// Re-export the slug list so the router can register every page individually
export const productSlugs = Object.keys(productPages);


// ─────────────────────────────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────────────────────────────
function Hero({ data }) {
  const Demo = data.heroDemo;
  return (
    <section style={{
      position: 'relative',
      paddingTop: 'clamp(140px, 18vh, 180px)',
      paddingBottom: 'clamp(60px, 8vh, 96px)',
      overflow: 'hidden',
      isolation: 'isolate',
    }}>
      <MeshGradient variant="hero" />
      <div style={{
        position: 'relative', zIndex: 1,
        maxWidth: 1180, margin: '0 auto',
        padding: '0 24px',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 1fr)',
        gap: 56,
        alignItems: 'center',
      }} className="mkt-product-hero">
        <div>
          <motion.span
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 12px',
              fontSize: 11, fontWeight: 700,
              color: '#00CCF5',
              background: 'rgba(0,204,245,0.10)',
              border: '1px solid rgba(0,204,245,0.25)',
              borderRadius: 'var(--radius-pill)',
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}
          >
            <Sparkles size={11} />
            {data.eyebrow}
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            style={{
              margin: '20px 0 0',
              fontSize: 'clamp(36px, 5.4vw, 56px)',
              fontWeight: 600,
              lineHeight: 1.08,
              letterSpacing: '-0.02em',
              color: '#fff',
            }}
          >
            {data.heroTitle}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            style={{
              margin: '20px 0 0',
              fontSize: 'clamp(15px, 1.6vw, 18px)',
              lineHeight: 1.55,
              color: 'rgba(255,255,255,0.72)',
              maxWidth: 480,
            }}
          >
            {data.heroSubtitle}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            style={{ marginTop: 28, display: 'flex', gap: 12, flexWrap: 'wrap' }}
          >
            <Button as={Link} to="/signup" size="lg"
                    style={{
                      background: 'linear-gradient(135deg, #00CCF5, #00A8D8)',
                      color: '#0a0e14', border: 'none', fontWeight: 600,
                    }}>
              Start free <ArrowRight size={15} />
            </Button>
            <Button as={Link} to="/features" size="lg" variant="ghost"
                    style={{
                      color: '#fff',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.18)',
                    }}>
              Explore features
            </Button>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          style={{
            padding: 18,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 'var(--radius-xl)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            boxShadow: '0 32px 80px rgba(0,204,245,0.18), 0 8px 32px rgba(0,0,0,0.35)',
          }}
        >
          {Demo ? <Demo /> : null}
        </motion.div>
      </div>
      <style>{`
        @media (max-width: 960px) {
          .mkt-product-hero { grid-template-columns: 1fr !important; gap: 36px !important; }
        }
      `}</style>
    </section>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Feature stripe (image + text alternating rows)
// ─────────────────────────────────────────────────────────────────────────────
function FeatureStripe({ data, reverse }) {
  const Demo = data.demo;
  return (
    <section style={{
      padding: 'clamp(56px, 9vh, 96px) 24px',
      background: reverse ? 'var(--surface-card)' : 'var(--surface-page)',
      borderTop: reverse ? '1px solid var(--border-subtle)' : 'none',
      borderBottom: reverse ? '1px solid var(--border-subtle)' : 'none',
    }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 56,
          alignItems: 'center',
          direction: reverse ? 'rtl' : 'ltr',
        }} className="mkt-stripe-grid">
          <div style={{ direction: 'ltr' }}>
            <ScrollReveal>
              {data.eyebrow && (
                <span style={{
                  display: 'inline-block', marginBottom: 12,
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--brand-primary-hover)',
                }}>{data.eyebrow}</span>
              )}
              <h2 style={{
                margin: 0,
                fontSize: 'clamp(24px, 3.4vw, 36px)',
                fontWeight: 700, lineHeight: 1.18,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
              }}>{data.title}</h2>
              <p style={{
                margin: '14px 0 0',
                fontSize: 16, lineHeight: 1.6,
                color: 'var(--text-secondary)',
                maxWidth: 460,
              }}>{data.description}</p>
              {data.bullets && (
                <ul style={{ margin: '20px 0 0', padding: 0, listStyle: 'none' }}>
                  {data.bullets.map((b) => (
                    <li key={b} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '7px 0',
                      fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55,
                    }}>
                      <Check size={14} style={{ color: '#00CCF5', flexShrink: 0, marginTop: 4 }}
                             strokeWidth={2.5} />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollReveal>
          </div>
          <div style={{ direction: 'ltr' }}>
            <ScrollReveal delay={0.1}>
              <div style={{
                padding: 16,
                background: 'var(--surface-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: '0 16px 40px rgba(0,0,0,0.06)',
              }}>
                {Demo ? <Demo /> : null}
              </div>
            </ScrollReveal>
          </div>
        </div>
        <style>{`
          @media (max-width: 880px) {
            .mkt-stripe-grid { grid-template-columns: 1fr !important; gap: 28px !important; direction: ltr !important; }
          }
        `}</style>
      </div>
    </section>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Capability grid (small tiles)
// ─────────────────────────────────────────────────────────────────────────────
function CapabilityGrid({ data }) {
  return (
    <section style={{ padding: 'clamp(56px, 9vh, 96px) 24px', background: 'var(--surface-page)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <ScrollReveal>
          <div style={{ textAlign: 'center', maxWidth: 640, marginInline: 'auto' }}>
            <h2 style={{
              margin: 0, fontSize: 'clamp(24px, 3.4vw, 36px)',
              fontWeight: 700, color: 'var(--text-primary)',
              letterSpacing: '-0.02em', lineHeight: 1.18,
            }}>{data.title}</h2>
            {data.subtitle && (
              <p style={{
                margin: '12px 0 0',
                fontSize: 15, lineHeight: 1.6,
                color: 'var(--text-secondary)',
              }}>{data.subtitle}</p>
            )}
          </div>
        </ScrollReveal>

        <div style={{
          marginTop: 36,
          display: 'grid',
          gridTemplateColumns: `repeat(${data.columns || 3}, minmax(0, 1fr))`,
          gap: 14,
        }} className="mkt-cap-grid">
          {data.items.map((item, i) => (
            <ScrollReveal key={item.title} delay={i * 0.06}>
              <div style={{
                padding: 20, height: '100%',
                background: 'var(--surface-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                {item.icon && (
                  <span style={{
                    width: 32, height: 32,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--brand-primary-soft)',
                    color: 'var(--brand-primary-hover)',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: 4,
                  }}>
                    <item.icon size={16} strokeWidth={2.2} />
                  </span>
                )}
                <h3 style={{
                  margin: 0, fontSize: 15, fontWeight: 700,
                  color: 'var(--text-primary)',
                }}>{item.title}</h3>
                <p style={{
                  margin: 0, fontSize: 13, lineHeight: 1.55,
                  color: 'var(--text-secondary)',
                }}>{item.description}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
        <style>{`
          @media (max-width: 880px) { .mkt-cap-grid { grid-template-columns: 1fr 1fr !important; } }
          @media (max-width: 560px) { .mkt-cap-grid { grid-template-columns: 1fr !important; } }
        `}</style>
      </div>
    </section>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Customer quote
// ─────────────────────────────────────────────────────────────────────────────
function CustomerQuote({ data }) {
  return (
    <section style={{
      padding: 'clamp(56px, 9vh, 96px) 24px',
      background: 'var(--surface-card)',
      borderTop: '1px solid var(--border-subtle)',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
        <ScrollReveal>
          <span style={{
            fontSize: 'clamp(40px, 6vw, 64px)',
            color: 'var(--brand-primary)',
            lineHeight: 0.5,
            fontFamily: 'serif',
          }}>"</span>
          <p style={{
            margin: '8px 0 0',
            fontSize: 'clamp(20px, 2.4vw, 28px)',
            fontWeight: 600,
            lineHeight: 1.4,
            color: 'var(--text-primary)',
            letterSpacing: '-0.01em',
          }}>{data.quote}</p>
          <div style={{
            marginTop: 24,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 12, flexWrap: 'wrap',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: data.gradient || 'linear-gradient(135deg, #00CCF5, #8b5cf6)',
            }} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{data.author}</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{data.role}</div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Final CTA
// ─────────────────────────────────────────────────────────────────────────────
function FinalCTA({ data }) {
  return (
    <section style={{ padding: 'clamp(56px, 9vh, 96px) 24px', background: 'var(--surface-page)' }}>
      <CTASection
        title={data.ctaTitle || 'Try Social Stats free'}
        subtitle={data.ctaSubtitle || 'Start in 2 minutes. No credit card. Cancel anytime.'}
        primary={{ to: '/signup', label: 'Start free' }}
        secondary={{ to: '/features', label: 'Explore features' }}
        microCopy="Free & open source · Self-host · Setup in 2 minutes"
        variant="cta"
      />
    </section>
  );
}
