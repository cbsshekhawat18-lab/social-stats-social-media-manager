/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * SolutionPage — generic, data-driven vertical / role solution page.
 *
 * One template renders all 7 solution pages from `solutionPages.js`. The
 * page picks its content via the URL slug (`/solutions/:slug`).
 *
 * Layout:
 *   1. Hero (eyebrow + H1 + subhead + CTAs + animated demo)
 *   2. Pain points (3-4 cards: "you're tired of …")
 *   3. Feature highlights (alternating image/text stripes)
 *   4. Industry-specific templates (3-tile gallery — optional)
 *   5. Customer quote
 *   6. Final CTA
 */
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Sparkles, AlertTriangle } from 'lucide-react';

import MarketingLayout    from '../../components/marketing/MarketingLayout';
import MeshGradient       from '../../components/marketing/MeshGradient';
import ScrollReveal       from '../../components/marketing/ScrollReveal';
import CTASection         from '../../components/marketing/CTASection';
import Button             from '../../components/ui/Button';
import Meta               from '../../components/Meta';

import { solutionPages, getSolutionPage } from './solutionPages';
import ComingSoonPage from './ComingSoonPage';


export default function SolutionPage() {
  const { slug } = useParams();
  const data = getSolutionPage(slug);
  if (!data) return <ComingSoonPage />;

  return (
    <MarketingLayout>
      <Meta
        noSuffix
        title={`${data.title} — Social Stats`}
        description={data.description}
      />
      <Hero data={data} />
      {data.painPoints && <PainPoints data={data.painPoints} />}
      {data.stripes?.map((s, i) => (
        <FeatureStripe key={i} data={s} reverse={i % 2 === 1} />
      ))}
      {data.templates && <TemplatesGallery data={data.templates} />}
      {data.quote && <CustomerQuote data={data.quote} />}
      <FinalCTA data={data} />
    </MarketingLayout>
  );
}

export const solutionSlugs = Object.keys(solutionPages);


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
        maxWidth: 1180, margin: '0 auto', padding: '0 24px',
        display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 1fr)',
        gap: 56, alignItems: 'center',
      }} className="mkt-solution-hero">
        <div>
          <motion.span
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 12px',
              fontSize: 11, fontWeight: 700,
              color: '#00CCF5', background: 'rgba(0,204,245,0.10)',
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
              fontWeight: 600, lineHeight: 1.08,
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
              lineHeight: 1.55, color: 'rgba(255,255,255,0.72)',
              maxWidth: 520,
            }}
          >
            {data.heroSubtitle}
          </motion.p>

          {data.heroPriceLine && (
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              style={{
                margin: '14px 0 0',
                fontSize: 13, color: 'rgba(255,255,255,0.55)',
              }}
            >
              {data.heroPriceLine}
            </motion.p>
          )}

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
              {data.ctaPrimary || 'Try free'} <ArrowRight size={15} />
            </Button>
            <Button as={Link} to="/pricing" size="lg" variant="ghost"
                    style={{
                      color: '#fff', background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.18)',
                    }}>
              View pricing
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
          .mkt-solution-hero { grid-template-columns: 1fr !important; gap: 36px !important; }
        }
      `}</style>
    </section>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Pain points — 3-4 cards "what you're currently dealing with"
// ─────────────────────────────────────────────────────────────────────────────
function PainPoints({ data }) {
  return (
    <section style={{ padding: 'clamp(56px, 9vh, 96px) 24px', background: 'var(--surface-page)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <ScrollReveal>
          <div style={{ textAlign: 'center', maxWidth: 640, marginInline: 'auto' }}>
            <span style={{
              display: 'inline-block', marginBottom: 12,
              padding: '4px 12px',
              fontSize: 11, fontWeight: 700,
              color: 'var(--warning)', background: 'var(--warning-bg)',
              borderRadius: 'var(--radius-pill)',
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              Sound familiar?
            </span>
            <h2 style={{
              margin: 0,
              fontSize: 'clamp(24px, 3.4vw, 36px)',
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
          gridTemplateColumns: `repeat(${data.items.length}, minmax(0, 1fr))`,
          gap: 14,
        }} className="mkt-pain-grid">
          {data.items.map((p, i) => (
            <ScrollReveal key={p.title} delay={i * 0.08}>
              <div style={{
                padding: 22, height: '100%',
                background: 'var(--surface-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
              }}>
                <span style={{
                  width: 32, height: 32,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--warning-bg)', color: 'var(--warning)',
                  borderRadius: 'var(--radius-sm)', marginBottom: 12,
                }}>
                  <AlertTriangle size={15} strokeWidth={2.2} />
                </span>
                <h3 style={{
                  margin: 0, fontSize: 15, fontWeight: 700,
                  color: 'var(--text-primary)',
                }}>{p.title}</h3>
                <p style={{
                  margin: '6px 0 0',
                  fontSize: 13, lineHeight: 1.55,
                  color: 'var(--text-secondary)',
                }}>{p.description}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
        <style>{`
          @media (max-width: 880px) { .mkt-pain-grid { grid-template-columns: 1fr 1fr !important; } }
          @media (max-width: 560px) { .mkt-pain-grid { grid-template-columns: 1fr !important; } }
        `}</style>
      </div>
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
          gap: 56, alignItems: 'center',
          direction: reverse ? 'rtl' : 'ltr',
        }} className="mkt-stripe-grid">
          <div style={{ direction: 'ltr' }}>
            <ScrollReveal>
              {data.eyebrow && (
                <span style={{
                  display: 'inline-block', marginBottom: 12,
                  fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
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
// Industry templates gallery (3 cards)
// ─────────────────────────────────────────────────────────────────────────────
function TemplatesGallery({ data }) {
  return (
    <section style={{
      padding: 'clamp(56px, 9vh, 96px) 24px',
      background: 'var(--surface-page)',
    }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <ScrollReveal>
          <div style={{ textAlign: 'center', maxWidth: 640, marginInline: 'auto' }}>
            <span style={{
              display: 'inline-block', marginBottom: 12,
              fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--brand-primary-hover)',
            }}>Templates ready to use</span>
            <h2 style={{
              margin: 0,
              fontSize: 'clamp(24px, 3.4vw, 36px)',
              fontWeight: 700, color: 'var(--text-primary)',
              letterSpacing: '-0.02em', lineHeight: 1.18,
            }}>{data.title}</h2>
            {data.subtitle && (
              <p style={{
                margin: '12px 0 0', fontSize: 15, lineHeight: 1.6,
                color: 'var(--text-secondary)',
              }}>{data.subtitle}</p>
            )}
          </div>
        </ScrollReveal>

        <div style={{
          marginTop: 36,
          display: 'grid',
          gridTemplateColumns: `repeat(${data.items.length}, minmax(0, 1fr))`,
          gap: 16,
        }} className="mkt-tpl-grid">
          {data.items.map((t, i) => (
            <ScrollReveal key={t.title} delay={i * 0.08}>
              <div style={{
                padding: 22, height: '100%',
                background: 'var(--surface-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
              }}>
                <div style={{
                  width: '100%', height: 120,
                  marginBottom: 16,
                  borderRadius: 'var(--radius-md)',
                  background: t.gradient || 'linear-gradient(135deg, rgba(0,204,245,0.15), rgba(139,92,246,0.15))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative', overflow: 'hidden',
                }}>
                  {t.icon ? (
                    <t.icon size={42} style={{ color: 'rgba(255,255,255,0.95)', strokeWidth: 1.5 }} />
                  ) : null}
                </div>
                <h3 style={{
                  margin: 0, fontSize: 15, fontWeight: 700,
                  color: 'var(--text-primary)',
                }}>{t.title}</h3>
                <p style={{
                  margin: '6px 0 0', fontSize: 13, lineHeight: 1.55,
                  color: 'var(--text-secondary)',
                }}>{t.description}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
        <style>{`
          @media (max-width: 880px) { .mkt-tpl-grid { grid-template-columns: 1fr 1fr !important; } }
          @media (max-width: 560px) { .mkt-tpl-grid { grid-template-columns: 1fr !important; } }
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
            lineHeight: 0.5, fontFamily: 'serif',
          }}>"</span>
          <p style={{
            margin: '8px 0 0',
            fontSize: 'clamp(20px, 2.4vw, 28px)',
            fontWeight: 600, lineHeight: 1.4,
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
        primary={{ to: '/signup', label: data.ctaPrimary || 'Start free' }}
        secondary={{ to: '/pricing', label: 'View pricing' }}
        microCopy="No credit card · Free forever · Setup in 2 minutes"
        variant="cta"
      />
    </section>
  );
}
