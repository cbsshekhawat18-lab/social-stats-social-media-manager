/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * PricingPage — Social Stats marketing pricing.
 *
 * Sections:
 *   1. Hero with monthly/annual toggle
 *   2. 3-tier card grid (Free · Growth (popular) · Enterprise)
 *   3. ROI calculator widget
 *   4. Full feature comparison table
 *   5. FAQ accordion
 *   6. Final CTA
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Sparkles, Calculator } from 'lucide-react';

import MarketingLayout    from '../components/marketing/MarketingLayout';
import MeshGradient       from '../components/marketing/MeshGradient';
import ScrollReveal       from '../components/marketing/ScrollReveal';
import ComparisonTable    from '../components/marketing/ComparisonTable';
import FAQ                from '../components/marketing/FAQ';
import CTASection         from '../components/marketing/CTASection';
import MetricCounter      from '../components/marketing/MetricCounter';
import Button             from '../components/ui/Button';
import Meta               from '../components/Meta';
import { track }          from '../services/analytics';


export default function PricingPage() {
  const [annual, setAnnual] = useState(true);

  return (
    <MarketingLayout>
      <Meta
        title="Pricing — Social Stats"
        description="Simple, transparent pricing. Free forever for end users. Plans for agencies of every size. Annual billing saves 20%."
        noSuffix
      />
      <Hero annual={annual} setAnnual={setAnnual} />
      <PlanCards annual={annual} />
      <RoiCalculator />
      <FeatureMatrix />
      <FAQSection />
      <FinalCTA />
    </MarketingLayout>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Section 1 — Hero
// ─────────────────────────────────────────────────────────────────────────────
function Hero({ annual, setAnnual }) {
  return (
    <section style={{
      position: 'relative',
      paddingTop: 'clamp(140px, 18vh, 180px)',
      paddingBottom: 32,
      overflow: 'hidden',
      isolation: 'isolate',
    }}>
      <MeshGradient variant="hero" />
      <div style={{
        position: 'relative', zIndex: 1,
        maxWidth: 880, margin: '0 auto', padding: '0 24px',
        textAlign: 'center', color: '#fff',
      }}>
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
          <Sparkles size={11} /> Pricing
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          style={{
            margin: '20px 0 0',
            fontSize: 'clamp(36px, 5.4vw, 56px)',
            fontWeight: 600, lineHeight: 1.1,
            letterSpacing: '-0.02em', color: '#fff',
          }}
        >
          Simple, transparent pricing
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          style={{
            margin: '20px auto 0',
            fontSize: 'clamp(15px, 1.6vw, 18px)',
            lineHeight: 1.55,
            color: 'rgba(255,255,255,0.72)', maxWidth: 560,
          }}
        >
          Free forever for end users. Plans built for agencies of every size.
          Annual billing saves 20%. No surprise fees, no per-seat upcharges.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          style={{
            marginTop: 32,
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: 4,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 'var(--radius-pill)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <ToggleBtn active={!annual} onClick={() => setAnnual(false)} label="Monthly" />
          <ToggleBtn active={annual}  onClick={() => setAnnual(true)}  label="Annual" badge="Save 20%" />
        </motion.div>
      </div>
    </section>
  );
}

function ToggleBtn({ active, onClick, label, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: '8px 18px',
        fontSize: 13, fontWeight: 600,
        color: active ? '#0a0e14' : 'rgba(255,255,255,0.7)',
        background: active ? '#fff' : 'transparent',
        border: 'none',
        borderRadius: 'var(--radius-pill)',
        cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontFamily: 'inherit',
        transition: 'background 200ms, color 200ms',
      }}
    >
      {label}
      {badge && (
        <span style={{
          padding: '2px 7px', fontSize: 10, fontWeight: 700,
          background: 'rgba(0,204,245,0.20)',
          color: '#00A8D8',
          borderRadius: 'var(--radius-pill)',
          letterSpacing: '0.04em',
        }}>{badge}</span>
      )}
    </button>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Section 2 — 3-tier plan cards
// ─────────────────────────────────────────────────────────────────────────────
const PLAN_CONFIG = [
  {
    id: 'free',
    name: 'Free',
    tag: 'For end users',
    description: 'Run your own social — free forever. Upgrade only when you need more clients or features.',
    price: { monthly: 0, annual: 0 },
    cta: { label: 'Sign up free', to: '/signup' },
    bullets: [
      '1 workspace',
      'Up to 3 connected platforms',
      '30 AI generations / month',
      'Cross-platform analytics + inbox',
      'Basic AI assistant',
      'Email support',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    tag: 'Most popular',
    description: 'Built for agencies managing 25 clients with a team of 5.',
    price: { monthly: 7999, annual: 6399 },
    cta: { label: 'Start trial', to: '/signup' },
    bullets: [
      '25 client workspaces',
      'Team of 5 with role permissions',
      'Unlimited AI generations',
      'WhatsApp Business + Bot Builder',
      'White-label client portals',
      'Marketplace listing + inbound leads',
      'Priority support (Slack)',
    ],
    featured: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tag: 'For 100+ clients',
    description: 'Custom SLA, SSO, dedicated CSM. We handle onboarding.',
    price: { monthly: null, annual: null },
    cta: { label: 'Talk to sales', to: '/contact' },
    bullets: [
      'Unlimited client workspaces',
      'Unlimited team seats',
      '99.9% SLA + dedicated support',
      'SSO (SAML / OIDC)',
      'Onboarding included',
      'Healthcare DPA available',
      'Custom integrations',
    ],
  },
];


function PlanCards({ annual }) {
  return (
    <section style={{
      padding: '0 24px clamp(32px, 6vh, 64px)',
      background: 'var(--surface-page)',
    }}>
      <div style={{
        maxWidth: 1180, margin: '0 auto', position: 'relative', zIndex: 2,
      }}>
        <div style={{
          marginTop: -56,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 16, alignItems: 'stretch',
        }} className="mkt-pricing-grid">
          {PLAN_CONFIG.map((p, i) => (
            <ScrollReveal key={p.id} delay={i * 0.08}>
              <PlanCard plan={p} annual={annual} />
            </ScrollReveal>
          ))}
        </div>
        <p style={{
          marginTop: 24, textAlign: 'center',
          fontSize: 13, color: 'var(--text-tertiary)',
        }}>
          Prices in INR. 18% GST applies for Indian customers. International pricing in USD on request.
        </p>
        <style>{`
          @media (max-width: 900px) { .mkt-pricing-grid { grid-template-columns: 1fr !important; margin-top: -32px !important; } }
        `}</style>
      </div>
    </section>
  );
}


function PlanCard({ plan, annual }) {
  const price = plan.price[annual ? 'annual' : 'monthly'];
  const showPrice = price !== null;
  return (
    <div style={{
      padding: 28, height: '100%',
      background: 'var(--surface-card)',
      border: plan.featured ? '2px solid #00CCF5' : '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-xl)',
      position: 'relative',
      boxShadow: plan.featured
        ? '0 24px 64px rgba(0,204,245,0.20), 0 4px 24px rgba(0,0,0,0.06)'
        : '0 8px 24px rgba(0,0,0,0.05)',
      display: 'flex', flexDirection: 'column',
    }}>
      {plan.featured && (
        <span style={{
          position: 'absolute', top: -12, right: 24,
          padding: '4px 12px',
          fontSize: 11, fontWeight: 700,
          color: '#0a0e14',
          background: 'linear-gradient(135deg, #00CCF5, #00A8D8)',
          borderRadius: 'var(--radius-pill)', letterSpacing: '0.04em',
        }}>POPULAR</span>
      )}

      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
        textTransform: 'uppercase', color: 'var(--text-tertiary)',
      }}>{plan.tag}</div>

      <div style={{ marginTop: 4, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
        {plan.name}
      </div>

      <p style={{
        margin: '8px 0 0', fontSize: 13, lineHeight: 1.5,
        color: 'var(--text-secondary)',
      }}>{plan.description}</p>

      <div style={{ marginTop: 20 }}>
        {showPrice ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{
              fontSize: 38, fontWeight: 700, lineHeight: 1,
              color: 'var(--text-primary)', letterSpacing: '-0.02em',
            }}>
              {price === 0 ? '₹0' : `₹${price.toLocaleString('en-IN')}`}
            </span>
            <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>
              {price === 0 ? 'forever' : annual ? '/mo · billed yearly' : '/mo'}
            </span>
          </div>
        ) : (
          <div style={{
            fontSize: 28, fontWeight: 700,
            color: 'var(--text-primary)', letterSpacing: '-0.02em',
          }}>Let's talk</div>
        )}
      </div>

      <ul style={{ margin: '24px 0', padding: 0, listStyle: 'none', flex: 1 }}>
        {plan.bullets.map((b) => (
          <li key={b} style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            padding: '7px 0',
            fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5,
          }}>
            <Check size={13} style={{ color: '#00CCF5', flexShrink: 0, marginTop: 4 }} strokeWidth={2.5} />
            {b}
          </li>
        ))}
      </ul>

      <Button as={Link} to={plan.cta.to} size="md" fullWidth
              onClick={() => track('plan_selected', {
                plan: plan.id || plan.name,
                cta: plan.cta.label,
              })}
              variant={plan.featured ? 'primary' : 'secondary'}>
        {plan.cta.label} <ArrowRight size={14} />
      </Button>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Section 3 — ROI Calculator
// ─────────────────────────────────────────────────────────────────────────────
function RoiCalculator() {
  const [clients, setClients]       = useState(10);
  const [hoursPer, setHoursPer]     = useState(8);
  const [hourlyRate, setHourlyRate] = useState(800);

  // Social Stats saves ~55% of admin time per client (conservative customer survey avg)
  const result = useMemo(() => {
    const totalHoursWeek = clients * hoursPer;
    const totalHoursYear = totalHoursWeek * 52;
    const savedHoursYear = Math.round(totalHoursYear * 0.55);
    const savedRupees    = savedHoursYear * hourlyRate;
    const socialStatsCost     = 7999 * 12;
    const netSavings     = Math.max(0, savedRupees - socialStatsCost);
    const multiplier     = (savedRupees / socialStatsCost) || 0;
    return { savedHoursYear, savedRupees, netSavings, multiplier };
  }, [clients, hoursPer, hourlyRate]);

  return (
    <section style={{
      padding: 'clamp(56px, 9vh, 96px) 24px',
      background: 'var(--surface-card)',
      borderTop: '1px solid var(--border-subtle)',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <ScrollReveal>
          <div style={{ textAlign: 'center', maxWidth: 640, marginInline: 'auto' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 12px', marginBottom: 12,
              fontSize: 11, fontWeight: 700,
              color: 'var(--brand-primary-hover)',
              background: 'var(--brand-primary-soft)',
              borderRadius: 'var(--radius-pill)',
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              <Calculator size={11} /> ROI Calculator
            </span>
            <h2 style={{
              margin: 0, fontSize: 'clamp(24px, 3.4vw, 36px)',
              fontWeight: 700, color: 'var(--text-primary)',
              letterSpacing: '-0.02em', lineHeight: 1.18,
            }}>How much will Social Stats save you?</h2>
            <p style={{
              margin: '12px 0 0', fontSize: 15, lineHeight: 1.6,
              color: 'var(--text-secondary)',
            }}>
              Based on the average agency workflow — drag the sliders to match yours.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <div style={{
            marginTop: 36,
            padding: 28,
            background: 'var(--surface-page)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xl)',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 32, alignItems: 'center',
          }} className="mkt-roi-grid">
            <div>
              <Slider label="Clients you manage" value={clients} setValue={setClients}
                      min={1} max={100} step={1} />
              <Slider label="Hours per client per week" value={hoursPer} setValue={setHoursPer}
                      min={1} max={20} step={1} suffix=" hrs" />
              <Slider label="Hourly cost (your team)" value={hourlyRate} setValue={setHourlyRate}
                      min={200} max={3000} step={50} prefix="₹" suffix="/hr" />
            </div>

            <div style={{
              padding: 24,
              background: 'linear-gradient(135deg, rgba(0,204,245,0.08), rgba(139,92,246,0.06))',
              border: '1px solid rgba(0,204,245,0.20)',
              borderRadius: 'var(--radius-lg)',
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)',
                textTransform: 'uppercase', letterSpacing: '0.06em',
                marginBottom: 8,
              }}>Estimated annual savings</div>
              <div style={{
                fontSize: 'clamp(36px, 5vw, 56px)',
                fontWeight: 700, lineHeight: 1.1,
                color: 'var(--brand-primary-hover)',
                letterSpacing: '-0.02em',
                fontVariantNumeric: 'tabular-nums',
              }}>
                ₹<MetricCounter key={result.netSavings} value={result.netSavings}
                                 duration={0.6} />
              </div>
              <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>
                  {result.savedHoursYear.toLocaleString('en-IN')} hours
                </strong> reclaimed yearly
              </div>
              <div style={{
                marginTop: 14, padding: '10px 14px',
                background: 'var(--surface-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12, color: 'var(--text-tertiary)',
              }}>
                Compared to Growth at ₹95,988/year. ROI:{' '}
                <strong style={{ color: 'var(--success)' }}>{result.multiplier.toFixed(1)}×</strong>
              </div>
              <Button as={Link} to="/signup" size="md" fullWidth style={{ marginTop: 16 }}>
                Start free <ArrowRight size={14} />
              </Button>
            </div>
          </div>
          <p style={{
            marginTop: 12, textAlign: 'center',
            fontSize: 11, color: 'var(--text-tertiary)',
          }}>
            Estimates based on customer-survey averages. Real savings vary by workflow.
          </p>
          <style>{`
            @media (max-width: 880px) {
              .mkt-roi-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
            }
          `}</style>
        </ScrollReveal>
      </div>
    </section>
  );
}


function Slider({ label, value, setValue, min, max, step = 1, prefix = '', suffix = '' }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 8,
      }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          {label}
        </label>
        <span style={{
          fontSize: 14, fontWeight: 700,
          color: 'var(--brand-primary-hover)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {prefix}{value.toLocaleString('en-IN')}{suffix}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#00CCF5', cursor: 'pointer' }}
      />
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Section 4 — Full feature comparison
// ─────────────────────────────────────────────────────────────────────────────
function FeatureMatrix() {
  const columns = ['Free', 'Pro', 'Growth', 'Scale', 'Enterprise'];

  const rows = [
    { feature: 'Connected client workspaces',     cells: ['1', '5', '25', '100', 'Unlimited'] },
    { feature: 'Team seats',                       cells: ['1', '3', '5', 'Unlimited', 'Unlimited'] },
    { feature: 'Connected platforms',              cells: ['3', '5', '5', '5', '5+'] },
    { feature: 'Multi-platform composer',          cells: ['yes', 'yes', 'yes', 'yes', 'yes'] },
    { feature: 'Posts per month',                  cells: ['30', 'Unlimited', 'Unlimited', 'Unlimited', 'Unlimited'] },
    { feature: 'Approval workflows',               cells: ['no', 'no', 'yes', 'yes', 'yes'] },
    { feature: 'Brand voice training',             cells: ['no', 'yes', 'yes', 'yes', 'yes'] },
    { feature: 'Cross-platform analytics',         cells: ['yes', 'yes', 'yes', 'yes', 'yes'] },
    { feature: 'AI-narrated reports',              cells: ['no', 'yes', 'yes', 'yes', 'yes'] },
    { feature: 'White-label reports',              cells: ['no', 'no', 'yes', 'yes', 'yes'] },
    { feature: 'AI generations / month',           cells: ['10', '500', 'Unlimited', 'Unlimited', 'Unlimited'] },
    { feature: 'AI assistant (Cmd+J)',             cells: ['yes', 'yes', 'yes', 'yes', 'yes'] },
    { feature: 'Per-feature cost dashboard',       cells: ['no', 'yes', 'yes', 'yes', 'yes'] },
    { feature: 'WhatsApp Business',                cells: ['no', 'partial', 'yes', 'yes', 'yes'] },
    { feature: 'CTWA Bot Builder',                 cells: ['no', 'partial', 'yes', 'yes', 'yes'] },
    { feature: 'Lead-capture CRM',                 cells: ['no', 'yes', 'yes', 'yes', 'yes'] },
    { feature: 'Public marketplace listing',       cells: ['no', 'no', 'yes', 'yes', 'yes'] },
    { feature: 'Inbound lead inquiries',           cells: ['no', 'no', 'yes', 'yes', 'yes'] },
    { feature: 'Activity audit trail',             cells: ['yes', 'yes', 'yes', 'yes', 'yes'] },
    { feature: 'SSO (SAML / OIDC)',                cells: ['no', 'no', 'no', 'yes', 'yes'] },
    { feature: 'SLA',                               cells: ['no', 'no', '99.5%', '99.9%', '99.99%'] },
    { feature: 'Healthcare DPA',                    cells: ['no', 'no', 'no', 'yes', 'yes'] },
    { feature: 'Support',                           cells: ['Email', 'Email', 'Slack', 'Slack + phone', 'Dedicated CSM'] },
    { feature: 'Onboarding included',               cells: ['no', 'no', 'no', 'yes', 'yes'] },
    { feature: 'Starting price (annual)',           cells: ['Free', '₹399/mo', '₹6,399/mo', '₹15,999/mo', 'Custom'] },
  ];

  return (
    <section style={{ padding: 'clamp(56px, 9vh, 96px) 24px', background: 'var(--surface-page)' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <ScrollReveal>
          <div style={{ textAlign: 'center', maxWidth: 640, marginInline: 'auto' }}>
            <h2 style={{
              margin: 0, fontSize: 'clamp(24px, 3.4vw, 36px)',
              fontWeight: 700, color: 'var(--text-primary)',
              letterSpacing: '-0.02em', lineHeight: 1.18,
            }}>Compare every plan side-by-side</h2>
            <p style={{
              margin: '12px 0 0', fontSize: 15, lineHeight: 1.6,
              color: 'var(--text-secondary)',
            }}>
              Five plans cover everything from solo creators to 100+ client agencies.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <div style={{ marginTop: 36 }}>
            <ComparisonTable columns={columns} rows={rows} highlightIndex={2} />
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Section 5 — FAQ
// ─────────────────────────────────────────────────────────────────────────────
function FAQSection() {
  const items = [
    { q: 'Is the Free plan really free forever?',
      a: 'Yes. One workspace, three platforms, 30 AI generations a month, basic AI assistant — free forever. No credit card. No "trial expires" surprise. We make money when you grow into Pro or invite an agency.' },
    { q: 'Can I switch between monthly and annual?',
      a: 'Yes — switch any time. Annual saves 20%. If you switch from annual back to monthly mid-cycle, the unused portion is credited to your next invoice.' },
    { q: 'What counts as an "AI generation"?',
      a: 'Anything that uses Social Stats on your behalf — composer drafts, inbox-reply suggestions, AI insights, the bot builder\'s "Generate with AI" button, persona builder, lead scoring. Cached responses don\'t count.' },
    { q: 'Do agencies pay per client workspace?',
      a: 'No — agency plans bundle 5/25/100 client workspaces. Add more in 5-client packs at ₹1,499/mo or upgrade to Scale.' },
    { q: 'What if a client invites my agency? Who pays?',
      a: 'You — the agency — pay. End-user clients are free forever. They can invite an agency from the marketplace, and that agency\'s plan covers managing them.' },
    { q: 'Are payments handled by Razorpay?',
      a: 'Yes — Razorpay processes every transaction. PCI-DSS Level 1 certified. We never store card numbers ourselves. UPI, cards, net-banking, and wallets are all supported.' },
    { q: 'Is GST included?',
      a: 'Listed prices are exclusive of GST. 18% GST applies for Indian customers; we issue GST-compliant invoices automatically. International customers pay USD-equivalent on request, no GST.' },
    { q: 'Can I cancel anytime?',
      a: 'Yes — one-click cancellation from Settings → Billing. Annual plans get a pro-rata refund within 7 days of payment if you\'ve made minimal use of the platform.' },
    { q: 'Do you offer non-profit / education discounts?',
      a: 'Registered non-profits and educational institutions get 50% off any paid plan. Email sales@socialstats.app with your registration document to apply.' },
    { q: 'Is there a custom enterprise option?',
      a: 'Yes — Enterprise gets unlimited clients, SSO (SAML / OIDC), 99.99% SLA, dedicated CSM, healthcare DPA, custom integrations, and onboarding. Talk to sales for pricing.' },
  ];
  return (
    <section style={{
      padding: 'clamp(56px, 9vh, 96px) 24px',
      background: 'var(--surface-card)',
      borderTop: '1px solid var(--border-subtle)',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <ScrollReveal>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{
              margin: 0, fontSize: 'clamp(24px, 3.4vw, 36px)',
              fontWeight: 700, color: 'var(--text-primary)',
              letterSpacing: '-0.02em', lineHeight: 1.18,
            }}>Frequently asked questions</h2>
            <p style={{
              margin: '12px 0 0', fontSize: 15, lineHeight: 1.6,
              color: 'var(--text-secondary)',
            }}>
              Don't see your question?{' '}
              <Link to="/contact" style={{ color: 'var(--brand-primary-hover)', textDecoration: 'underline' }}>
                Talk to sales
              </Link>.
            </p>
          </div>
        </ScrollReveal>
        <ScrollReveal delay={0.1}>
          <div style={{ marginTop: 36 }}>
            <FAQ items={items} />
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Section 6 — Final CTA
// ─────────────────────────────────────────────────────────────────────────────
function FinalCTA() {
  return (
    <section style={{ padding: 'clamp(56px, 9vh, 96px) 24px', background: 'var(--surface-page)' }}>
      <CTASection
        title="Need something custom?"
        subtitle="Talk to our sales team — we'll build a plan around your team size, client roster, and compliance needs."
        primary={{ to: '/contact', label: 'Talk to sales' }}
        secondary={{ to: '/signup',  label: 'Start free' }}
        microCopy="Free forever for end users · Annual saves 20% · Cancel anytime"
        variant="cta"
      />
    </section>
  );
}
