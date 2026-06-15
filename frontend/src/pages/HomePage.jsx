/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * HomePage — Social Stats marketing site front door.
 *
 * 15-section long-scroll structure (from the marketing-website spec):
 *   1.  Hero (above fold)
 *   2.  Platform strip (channels we cover)
 *   3.  3 pillars — Analyze · Engage · Convert
 *   4.  Bento grid (8 features)
 *   5.  Use-case tabs (Agencies · Real Estate · Clinics · Restaurants · Creators)
 *   6.  How it works (4-step)
 *   7.  AI everywhere (animated chat demo)
 *   8.  Comparison table vs Hootsuite / Sprout / Buffer (feature parity only)
 *   9.  Agency marketplace teaser
 *   10. Capability stats band
 *   11. Final CTA (email capture)
 *   12. Footer (provided by MarketingLayout)
 *
 * Customer testimonials, fabricated case studies, and customer-count claims
 * are intentionally absent until we have real customers to feature.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight, PlayCircle, Sparkles, Check,
  BarChart3, MessageCircle, Zap, Bot, Inbox, PenSquare,
  Briefcase, Building2, Stethoscope, UtensilsCrossed, Palette,
  TrendingUp,
} from 'lucide-react';

import MarketingLayout      from '../components/marketing/MarketingLayout';
import MeshGradient         from '../components/marketing/MeshGradient';
import AnimatedDashboardMockup from '../components/marketing/AnimatedDashboardMockup';
import FloatingUICard       from '../components/marketing/FloatingUICard';
import ParallaxTilt         from '../components/marketing/ParallaxTilt';
import ScrollReveal         from '../components/marketing/ScrollReveal';
import FeatureBento         from '../components/marketing/FeatureBento';
import AnimatedChat         from '../components/marketing/AnimatedChat';
import ComparisonTable      from '../components/marketing/ComparisonTable';
import MetricCounter        from '../components/marketing/MetricCounter';
import CTASection           from '../components/marketing/CTASection';
import {
  AIAssistantPreview, ComposerPreview, InboxPreview, BotBuilderPreview,
  AIInsightPreview, AutomationsPreview, AnalyticsPreview, ReportsPreview,
} from '../components/marketing/BentoPreviews';

import Button from '../components/ui/Button';
import Meta   from '../components/Meta';
import JsonLd, { buildOrganization, buildWebSite } from '../components/JsonLd';
import { track } from '../services/analytics';

// ─────────────────────────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <MarketingLayout>
      <Meta
        noSuffix
        title="Social Stats — The AI marketing OS for modern agencies"
        description="Manage analytics, content, conversations, and ads for every client — across 5 platforms — in one place. AI-powered, built for modern teams."
      />
      <JsonLd id="organization" data={buildOrganization()} />
      <JsonLd id="website"      data={buildWebSite()} />
      <Hero />
      <TrustStrip />
      <ThreePillars />
      <BentoSection />
      <UseCaseTabs />
      <HowItWorks />
      <AIEverywhere />
      <ComparisonSection />
      <MarketplaceTeaser />
      <StatsBand />
      <FinalCTA />
    </MarketingLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 1 — HERO
// ─────────────────────────────────────────────────────────────────────────────
function Hero() {
  const reduced = useReducedMotion();
  return (
    <section style={{
      position: 'relative',
      paddingTop: 'clamp(120px, 18vh, 180px)',
      paddingBottom: 'clamp(80px, 12vh, 120px)',
      overflow: 'hidden',
      isolation: 'isolate',
    }}>
      <MeshGradient variant="hero" />

      <div style={{
        position: 'relative', zIndex: 1,
        maxWidth: 1180, margin: '0 auto',
        padding: '0 24px',
        textAlign: 'center',
        color: '#fff',
      }}>
        {/* Eyebrow */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Link to="/changelog" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 14px',
            fontSize: 12, fontWeight: 600,
            color: '#fff',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 'var(--radius-pill)',
            textDecoration: 'none',
            backdropFilter: 'blur(10px)',
          }}>
            <Sparkles size={12} style={{ color: '#00CCF5' }} />
            <span style={{ color: 'rgba(255,255,255,0.65)' }}>NEW</span>
            CTWA Bot Builder is live
            <ArrowRight size={11} style={{ opacity: 0.6 }} />
          </Link>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          style={{
            margin: '24px 0 0',
            fontSize: 'clamp(40px, 7vw, 72px)',
            fontWeight: 600, lineHeight: 1.05, letterSpacing: '-0.03em',
            color: '#fff', maxWidth: 900, marginInline: 'auto',
          }}
        >
          The{' '}
          <span style={{
            background: 'linear-gradient(135deg, #00CCF5 0%, #8b5cf6 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            AI marketing OS
          </span>
          <br />for modern agencies
        </motion.h1>

        {/* Subheading */}
        <motion.p
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          style={{
            margin: '24px auto 0',
            fontSize: 'clamp(16px, 1.8vw, 19px)',
            color: 'rgba(255,255,255,0.72)', lineHeight: 1.55,
            maxWidth: 640,
          }}
        >
          Manage analytics, content, conversations, and ads for every client —
          across 5 platforms — in one place.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          style={{
            marginTop: 32, display: 'flex', gap: 12,
            justifyContent: 'center', flexWrap: 'wrap',
          }}
        >
          <Button as={Link} to="/signup" size="lg"
                  onClick={() => track('signup_click', { source: 'home_hero' })}
                  style={{
                    background: 'linear-gradient(135deg, #00CCF5, #00A8D8)',
                    color: '#0a0e14', border: 'none', fontWeight: 600,
                  }}>
            Start free <ArrowRight size={15} />
          </Button>
          <Button as={Link} to="/customers" size="lg" variant="ghost"
                  style={{
                    color: '#fff',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.18)',
                  }}>
            <PlayCircle size={15} /> Watch 90s demo
          </Button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          style={{ marginTop: 14, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}
        >
          No credit card · Free forever · Setup in 2 minutes
        </motion.p>

        {/* Hero mockup with floating cards */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginTop: 64, position: 'relative', maxWidth: 1080, marginInline: 'auto' }}
        >
          <ParallaxTilt max={reduced ? 0 : 4}>
            <AnimatedDashboardMockup />
          </ParallaxTilt>

          <div className="mkt-hero-floats">
            <FloatingUICard top="6%"  left="-4%"  delay={0.6} tone="cyan"   width={220}>
              <NotificationCard />
            </FloatingUICard>
            <FloatingUICard top="58%" left="-7%"  delay={0.9} tone="green"  width={220}>
              <LeadCapturedCard />
            </FloatingUICard>
            <FloatingUICard top="14%" right="-4%" delay={0.7} tone="purple" width={230}>
              <CampaignMetricCard />
            </FloatingUICard>
            <FloatingUICard top="62%" right="-6%" delay={1.0} tone="pink"   width={230}>
              <AIPopupCard />
            </FloatingUICard>
          </div>
        </motion.div>

        <style>{`
          @media (max-width: 1100px) {
            .mkt-hero-floats { display: none !important; }
          }
        `}</style>
      </div>
    </section>
  );
}

// ── Floating-card contents ──────────────────────────────────────────────────
function NotificationCard() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={floatIconStyle('rgba(0,204,245,0.15)', '#00CCF5')}>
          <Inbox size={11} />
        </span>
        <span style={floatLabel}>NEW MESSAGE · IG</span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Priya Sharma</div>
      <div style={{ marginTop: 2, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
        Is the 3BHK still available? Can I visit on Saturday?
      </div>
    </div>
  );
}

function CampaignMetricCard() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={floatIconStyle('rgba(139,92,246,0.15)', '#a78bfa')}>
          <BarChart3 size={11} />
        </span>
        <span style={floatLabel}>WEEKLY REACH</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
        248,392
      </div>
      <div style={{ marginTop: 2, fontSize: 11, color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        <TrendingUp size={11} /> +23% vs last week
      </div>
    </div>
  );
}

function LeadCapturedCard() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={floatIconStyle('rgba(16,185,129,0.15)', '#34d399')}>
          <Check size={12} strokeWidth={3} />
        </span>
        <span style={floatLabel}>LEAD CAPTURED</span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Rahul Verma</div>
      <div style={{ marginTop: 2, fontSize: 11, color: 'var(--text-secondary)' }}>
        Source: <strong style={{ color: '#34d399' }}>CTWA · Diwali campaign</strong>
      </div>
    </div>
  );
}

function AIPopupCard() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={floatIconStyle('rgba(236,72,153,0.15)', '#f472b6')}>
          <Sparkles size={11} />
        </span>
        <span style={floatLabel}>AI SUGGESTION</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>
        Try posting Reels on Tue 7pm — your audience is 2.4× more active.
      </div>
    </div>
  );
}

const floatLabel = {
  fontSize: 9, fontWeight: 700,
  color: 'var(--text-tertiary)',
  letterSpacing: '0.06em', textTransform: 'uppercase',
};
const floatIconStyle = (bg, color) => ({
  width: 22, height: 22,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: bg, color, borderRadius: 'var(--radius-sm)',
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 2 — PLATFORM STRIP
// Customer-logo carousel intentionally omitted until we have real customers.
// ─────────────────────────────────────────────────────────────────────────────
function TrustStrip() {
  const platforms = ['Facebook', 'Instagram', 'YouTube', 'LinkedIn', 'Google Business', 'WhatsApp Business'];
  return (
    <section style={{
      padding: '40px 24px 32px',
      background: 'var(--surface-card)',
      borderTop: '1px solid var(--border-subtle)',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', textAlign: 'center' }}>
        <p style={{
          margin: '0 0 18px',
          fontSize: 11, fontWeight: 700,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          color: 'var(--text-tertiary)',
        }}>
          One platform, every channel that matters
        </p>
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '20px 32px',
          justifyContent: 'center', alignItems: 'center',
        }}>
          {platforms.map((label) => (
            <span key={label} style={{
              fontSize: 14, fontWeight: 600,
              color: 'var(--text-secondary)',
              letterSpacing: '0.01em',
            }}>{label}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 3 — THREE PILLARS
// ─────────────────────────────────────────────────────────────────────────────
function ThreePillars() {
  const pillars = [
    { icon: BarChart3, tone: '#00CCF5', toneSoft: 'rgba(0,204,245,0.10)', label: 'ANALYZE',
      title: 'Track everything',
      blurb: 'Reach, engagement, and revenue across 5 platforms in one dashboard.',
      preview: <AnalyticsPreview /> },
    { icon: MessageCircle, tone: '#a78bfa', toneSoft: 'rgba(139,92,246,0.10)', label: 'ENGAGE',
      title: 'Reply in one place',
      blurb: 'Every DM, comment, and review across platforms — sorted, AI-prioritised, replyable.',
      preview: <InboxPreview /> },
    { icon: Bot, tone: '#34d399', toneSoft: 'rgba(16,185,129,0.10)', label: 'CONVERT',
      title: 'Capture more leads',
      blurb: 'Run CTWA ads with AI bots that qualify customers 24/7 and route them to your CRM.',
      preview: <BotBuilderPreview /> },
  ];
  return (
    <section style={{ padding: 'clamp(64px, 10vh, 120px) 24px', background: 'var(--surface-page)' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <ScrollReveal>
          <SectionHeading
            eyebrow="What is Social Stats"
            title="One product, three superpowers"
            subtitle="Stop juggling 5 different SaaS tools. Social Stats is the single dashboard that runs your client's marketing end-to-end."
          />
        </ScrollReveal>

        <div style={{
          marginTop: 48,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 16,
        }} className="mkt-pillars-grid">
          {pillars.map((p, i) => (
            <ScrollReveal key={p.title} delay={0.1 * i}>
              <div style={{
                padding: 24, height: '100%',
                background: 'var(--surface-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                display: 'flex', flexDirection: 'column', gap: 18,
              }}>
                <div>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 36, height: 36,
                    background: p.toneSoft, color: p.tone,
                    borderRadius: 'var(--radius-md)', marginBottom: 12,
                  }}>
                    <p.icon size={18} strokeWidth={2.2} />
                  </span>
                  <span style={{
                    display: 'block', marginBottom: 4,
                    fontSize: 11, fontWeight: 700, color: p.tone,
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                  }}>{p.label}</span>
                  <h3 style={{
                    margin: 0, fontSize: 20, fontWeight: 700,
                    color: 'var(--text-primary)', letterSpacing: '-0.01em',
                  }}>{p.title}</h3>
                  <p style={{
                    margin: '8px 0 0',
                    fontSize: 14, lineHeight: 1.55,
                    color: 'var(--text-secondary)',
                  }}>{p.blurb}</p>
                </div>
                <div style={{ marginTop: 'auto', minHeight: 140 }}>{p.preview}</div>
              </div>
            </ScrollReveal>
          ))}
        </div>
        <style>{`
          @media (max-width: 900px) { .mkt-pillars-grid { grid-template-columns: 1fr !important; } }
        `}</style>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 4 — BENTO GRID
// ─────────────────────────────────────────────────────────────────────────────
function BentoSection() {
  const items = [
    { id: 'ai-assistant', title: 'AI Assistant',
      description: 'Talk to your marketing data. Cmd+J anywhere.',
      to: '/product/ai-assistant', tone: 'cyan', accentBg: true,
      icon: Sparkles, span: { col: 2, row: 1 },
      preview: <AIAssistantPreview /> },
    { id: 'composer', title: 'Composer',
      description: 'Write once, publish 5x.',
      to: '/product/composer', tone: 'purple', icon: PenSquare,
      preview: <ComposerPreview /> },
    { id: 'inbox', title: 'Unified Inbox',
      description: 'Every conversation in one place.',
      to: '/product/inbox', tone: 'green', icon: Inbox,
      preview: <InboxPreview /> },
    { id: 'bot-builder', title: 'Bot Builder',
      description: 'Visual flow editor for CTWA ads.',
      to: '/product/bot-builder', tone: 'pink', icon: Bot,
      preview: <BotBuilderPreview /> },
    { id: 'ai-insights', title: 'AI Insights',
      description: 'Spot trends + drops before they hurt.',
      to: '/product/ai', tone: 'amber', icon: TrendingUp,
      preview: <AIInsightPreview /> },
    { id: 'automations', title: 'Automations',
      description: 'IF this happens, do that.',
      to: '/product/automations', tone: 'cyan', accentBg: true,
      icon: Zap, span: { col: 2, row: 1 },
      preview: <AutomationsPreview /> },
    { id: 'analytics', title: 'Analytics',
      description: 'Cross-platform metrics, demystified.',
      to: '/product/analytics', tone: 'cyan', icon: BarChart3,
      preview: <AnalyticsPreview /> },
    { id: 'reports', title: 'Reports',
      description: 'Reports that write themselves.',
      to: '/product/reports', tone: 'purple', icon: BarChart3,
      preview: <ReportsPreview /> },
  ];
  return (
    <section style={{
      padding: 'clamp(64px, 10vh, 120px) 24px',
      background: 'var(--surface-card)',
      borderTop: '1px solid var(--border-subtle)',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <ScrollReveal>
          <SectionHeading
            eyebrow="Every surface, polished"
            title="Eight features that make every team faster"
            subtitle="Hover any tile to see it move. Click for the deep dive."
          />
        </ScrollReveal>
        <div style={{ marginTop: 48 }}>
          <ScrollReveal>
            <FeatureBento items={items} columns={4} />
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 5 — USE CASE TABS
// ─────────────────────────────────────────────────────────────────────────────
function UseCaseTabs() {
  const tabs = [
    { id: 'agencies', label: 'Agencies', icon: Briefcase,
      headline: 'Manage 100+ clients without losing your mind.',
      bullets: [
        'Multi-client workspaces with one-click switcher',
        'Team collaboration with role permissions',
        'White-label client portals + branded reports',
        'Approval workflows for every action',
        'AI assistant tuned to each client\'s brand voice',
      ],
      cta: { label: 'Read agency case study', to: '/customers' } },
    { id: 'real-estate', label: 'Real Estate', icon: Building2,
      headline: 'Sell more properties on social media.',
      bullets: [
        'Property listing carousels for Instagram + Facebook',
        'Site-visit reminders via WhatsApp',
        'Lead capture from CTWA ads — directly to CRM',
        'AI-written property descriptions',
        'Open-house promo automation',
      ],
      cta: { label: 'Real estate playbook', to: '/solutions/real-estate' } },
    { id: 'clinics', label: 'Healthcare', icon: Stethoscope,
      headline: 'Engage patients across every platform.',
      bullets: [
        'Appointment reminders via WhatsApp Business',
        'Lab-report delivery with end-to-end audit trail',
        'Pre-built health-awareness content calendar',
        'HIPAA-aligned content checker',
        'Review management with AI-suggested replies',
      ],
      cta: { label: 'Healthcare playbook', to: '/solutions/clinics' } },
    { id: 'restaurants', label: 'Restaurants', icon: UtensilsCrossed,
      headline: 'Fill more tables with social.',
      bullets: [
        'Reservation bots that integrate with your POS',
        'Daily-specials posting on auto-pilot',
        'Review management for Zomato + Google',
        'Influencer outreach + tracking',
        'Festival campaigns (Diwali, Eid, Christmas) ready to go',
      ],
      cta: { label: 'Restaurant playbook', to: '/solutions/restaurants' } },
    { id: 'creators', label: 'Creators', icon: Palette,
      headline: 'Track your creator economy.',
      bullets: [
        'YouTube + Instagram + LinkedIn analytics in one view',
        'Brand-deal tracking + invoicing',
        'Audience insights — what your fans actually want',
        'Posting optimization with AI predictions',
        'Content calendar tuned to your schedule',
      ],
      cta: { label: 'Creator playbook', to: '/solutions/creators' } },
  ];
  const [active, setActive] = useState(tabs[0].id);
  const current = tabs.find((t) => t.id === active) || tabs[0];

  return (
    <section style={{ padding: 'clamp(64px, 10vh, 120px) 24px', background: 'var(--surface-page)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <ScrollReveal>
          <SectionHeading eyebrow="Made for every kind of marketer" title="Whoever you are, Social Stats fits" />
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <div role="tablist" style={{
            marginTop: 36, display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center',
          }}>
            {tabs.map((t) => (
              <button
                key={t.id} role="tab" aria-selected={active === t.id}
                onClick={() => setActive(t.id)}
                style={{
                  padding: '10px 16px',
                  fontSize: 13, fontWeight: 600,
                  color: active === t.id ? '#0a0e14' : 'var(--text-secondary)',
                  background: active === t.id
                    ? 'linear-gradient(135deg, #00CCF5, #00A8D8)' : 'var(--surface-card)',
                  border: '1px solid',
                  borderColor: active === t.id ? 'transparent' : 'var(--border-default)',
                  borderRadius: 'var(--radius-pill)',
                  cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontFamily: 'inherit', transition: 'var(--transition-fast)',
                }}
              >
                <t.icon size={13} />
                {t.label}
              </button>
            ))}
          </div>

          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            style={{
              marginTop: 32, padding: 32,
              background: 'var(--surface-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 36,
              alignItems: 'center',
            }}
            className="mkt-usecase-grid"
          >
            <div>
              <h3 style={{
                margin: 0, fontSize: 24, fontWeight: 700,
                color: 'var(--text-primary)', letterSpacing: '-0.01em', lineHeight: 1.25,
              }}>{current.headline}</h3>
              <ul style={{ margin: '20px 0 0', padding: 0, listStyle: 'none' }}>
                {current.bullets.map((b) => (
                  <li key={b} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '8px 0',
                    fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55,
                  }}>
                    <Check size={14} style={{ color: '#00CCF5', flexShrink: 0, marginTop: 4 }} strokeWidth={2.5} />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: 20 }}>
                <Button as={Link} to={current.cta.to} size="md" variant="ghost"
                        style={{ color: 'var(--brand-primary-hover)', padding: 0 }}>
                  {current.cta.label} <ArrowRight size={14} />
                </Button>
              </div>
            </div>

            <div style={{
              minHeight: 280, borderRadius: 'var(--radius-lg)', overflow: 'hidden',
              border: '1px solid var(--border-subtle)',
            }}>
              <AnimatedDashboardMockup />
            </div>
          </motion.div>
          <style>{`
            @media (max-width: 880px) { .mkt-usecase-grid { grid-template-columns: 1fr !important; } }
          `}</style>
        </ScrollReveal>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 6 — HOW IT WORKS
// ─────────────────────────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    { n: 1, title: 'Sign up free',     blurb: 'Email + password. 5-second flow. No credit card.' },
    { n: 2, title: 'Connect accounts', blurb: 'Paste tokens or OAuth — Meta + Google + LinkedIn supported.' },
    { n: 3, title: 'Create with AI',   blurb: 'Generate posts, replies, and reports tuned to your brand voice.' },
    { n: 4, title: 'Track results',    blurb: 'Cross-platform analytics + AI-narrated PDF reports for clients.' },
  ];
  return (
    <section style={{
      padding: 'clamp(64px, 10vh, 120px) 24px',
      background: 'var(--surface-card)',
      borderTop: '1px solid var(--border-subtle)',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <ScrollReveal>
          <SectionHeading eyebrow="From zero to live" title="Get up and running in 4 steps" />
        </ScrollReveal>

        <div style={{
          marginTop: 48, position: 'relative',
          display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16,
        }} className="mkt-steps-grid">
          <div aria-hidden style={{
            position: 'absolute', top: 26, left: '12.5%', right: '12.5%',
            height: 2, background: 'linear-gradient(90deg, #00CCF5, #8b5cf6)',
            opacity: 0.3, zIndex: 0,
          }} className="mkt-steps-connector" />
          {steps.map((s, i) => (
            <ScrollReveal key={s.n} delay={i * 0.1}>
              <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                <div style={{
                  width: 52, height: 52, margin: '0 auto 16px',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--surface-page)',
                  border: '2px solid #00CCF5', borderRadius: '50%',
                  fontSize: 18, fontWeight: 700, color: 'var(--text-primary)',
                  boxShadow: '0 0 0 6px var(--surface-card), 0 12px 32px rgba(0, 204, 245, 0.18)',
                }}>{s.n}</div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{s.title}</h3>
                <p style={{
                  margin: '6px 0 0',
                  fontSize: 13, lineHeight: 1.55,
                  color: 'var(--text-secondary)',
                  maxWidth: 220, marginInline: 'auto',
                }}>{s.blurb}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
        <style>{`
          @media (max-width: 800px) {
            .mkt-steps-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
            .mkt-steps-connector { display: none !important; }
          }
        `}</style>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 7 — AI EVERYWHERE
// ─────────────────────────────────────────────────────────────────────────────
function AIEverywhere() {
  const features = [
    'Brand voice tuned to your business',
    'Generates posts, replies, and reports',
    'Predicts best posting times',
    'Detects PR crises before they spread',
    'Captures leads with conversational ads',
  ];
  return (
    <section style={{ padding: 'clamp(64px, 10vh, 120px) 24px', background: 'var(--surface-page)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'center' }} className="mkt-ai-grid">
          <ScrollReveal>
            <span style={{
              display: 'inline-block',
              padding: '4px 10px', marginBottom: 16,
              fontSize: 11, fontWeight: 700,
              color: '#00CCF5', background: 'rgba(0,204,245,0.10)',
              borderRadius: 'var(--radius-pill)', letterSpacing: '0.06em',
            }}>POWERED BY SOCIAL STATE AI</span>
            <h2 style={{
              margin: 0, fontSize: 'clamp(28px, 4vw, 40px)',
              fontWeight: 700, letterSpacing: '-0.02em',
              color: 'var(--text-primary)', lineHeight: 1.15,
            }}>AI in every corner</h2>
            <p style={{
              margin: '14px 0 0',
              fontSize: 16, lineHeight: 1.6,
              color: 'var(--text-secondary)', maxWidth: 480,
            }}>
              Social Stats isn't an "AI feature". It's an AI-native product — Social Stats shows up wherever you're stuck.
            </p>
            <ul style={{ margin: '24px 0 0', padding: 0, listStyle: 'none' }}>
              {features.map((f) => (
                <li key={f} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 0',
                  fontSize: 14, color: 'var(--text-secondary)',
                }}>
                  <Sparkles size={14} style={{ color: '#00CCF5', flexShrink: 0 }} />
                  {f}
                </li>
              ))}
            </ul>
            <div style={{ marginTop: 24 }}>
              <Button as={Link} to="/product/ai" size="md">
                Explore AI features <ArrowRight size={14} />
              </Button>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.15}>
            <AnimatedChat
              userMessage="How are we doing on Instagram this week?"
              assistantReply="Your reach grew 23% vs last week — mostly driven by your Reel about the Acme Heights property tour (had 3.2× normal saves). I'd suggest posting 2 more Reels this week. Want me to draft the captions?"
              speedMs={16}
            />
          </ScrollReveal>
        </div>
        <style>{`
          @media (max-width: 880px) { .mkt-ai-grid { grid-template-columns: 1fr !important; gap: 32px !important; } }
        `}</style>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 8 — COMPARISON
// ─────────────────────────────────────────────────────────────────────────────
function ComparisonSection() {
  const columns = ['Social Stats', 'Hootsuite', 'Sprout Social', 'Buffer'];
  const rows = [
    { feature: 'Multi-platform analytics',     cells: ['yes',          'yes',     'yes',     'partial'] },
    { feature: 'Deep AI assistant',            cells: ['Social Stats',    'partial', 'partial', 'no'] },
    { feature: 'WhatsApp Business API',        cells: ['yes',          'no',      'no',      'no'] },
    { feature: 'Click-to-WhatsApp bots',       cells: ['yes',          'no',      'no',      'no'] },
    { feature: 'Visual bot builder',           cells: ['yes',          'no',      'no',      'no'] },
    { feature: 'Lead-capture CRM',             cells: ['yes',          'no',      'partial', 'no'] },
    { feature: 'Two-sided agency marketplace', cells: ['yes',          'no',      'no',      'no'] },
    { feature: 'Activity audit trail',         cells: ['yes',          'partial', 'yes',     'no'] },
    { feature: 'Free for end users',           cells: ['yes',          'no',      'no',      'partial'] },
    { feature: 'Indian payment + GST',         cells: ['yes',          'no',      'no',      'no'] },
  ];
  return (
    <section style={{
      padding: 'clamp(64px, 10vh, 120px) 24px',
      background: 'var(--surface-card)',
      borderTop: '1px solid var(--border-subtle)',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <ScrollReveal>
          <SectionHeading
            eyebrow="Honest comparison"
            title="How Social Stats stacks up"
            subtitle="We're not for everyone. We're built for agencies + businesses serious about AI + WhatsApp."
          />
        </ScrollReveal>
        <ScrollReveal delay={0.1}>
          <div style={{ marginTop: 36 }}>
            <ComparisonTable columns={columns} rows={rows} highlightIndex={0} />
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 11 — MARKETPLACE TEASER
// ─────────────────────────────────────────────────────────────────────────────
function MarketplaceTeaser() {
  // Explainer cards for the two-sided marketplace.
  // We don't list specific agencies until we've onboarded them and they've
  // opted into being featured.
  const steps = [
    { title: 'Browse verified agencies',  body: 'Search by industry, language, budget, and platform.' },
    { title: 'Match by fit',              body: 'See pricing ranges, specialities, and example workflows up front.' },
    { title: 'Manage from one inbox',     body: 'Approvals, scheduled posts, and reporting flow through Social Stats.' },
  ];
  return (
    <section style={{ padding: 'clamp(64px, 10vh, 120px) 24px', background: 'var(--surface-page)' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <ScrollReveal>
          <SectionHeading
            eyebrow="Built-in marketplace"
            title="Need an agency to help?"
            subtitle="A two-sided marketplace where verified agencies match with businesses by industry and budget. Onboarding the first cohort of agencies now."
            cta={{ to: '/agencies', label: 'Browse the marketplace' }}
          />
        </ScrollReveal>

        <div style={{
          marginTop: 36,
          display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14,
        }} className="mkt-marketplace-grid">
          {steps.map((s, i) => (
            <ScrollReveal key={s.title} delay={i * 0.07}>
              <div style={{
                height: '100%',
                padding: 22,
                background: 'var(--surface-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
              }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28, borderRadius: 'var(--radius-pill)',
                  background: 'var(--brand-primary-soft)',
                  color: 'var(--brand-primary-hover)',
                  fontSize: 13, fontWeight: 700,
                }}>{i + 1}</div>
                <h3 style={{
                  margin: '14px 0 6px',
                  fontSize: 16, fontWeight: 700,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.01em',
                }}>{s.title}</h3>
                <p style={{
                  margin: 0, fontSize: 13, lineHeight: 1.55,
                  color: 'var(--text-secondary)',
                }}>{s.body}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
        <style>{`
          @media (max-width: 1024px) { .mkt-marketplace-grid { grid-template-columns: 1fr 1fr !important; } }
          @media (max-width: 600px)  { .mkt-marketplace-grid { grid-template-columns: 1fr !important; } }
        `}</style>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 12 — STATS BAND
// ─────────────────────────────────────────────────────────────────────────────
function StatsBand() {
  // Capability stats — every claim below is a feature of the product, not
  // a customer-volume metric. We swap to real usage numbers once they're
  // real and verifiable.
  const stats = [
    { value: 5,    suffix: '',   label: 'platforms' },
    { value: 14,   suffix: '+',  label: 'languages supported' },
    { value: 2,    suffix: 'min',label: 'time to first post' },
    { value: 99.9, suffix: '%',  label: 'uptime target', decimals: 1 },
  ];
  return (
    <section style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{
        padding: 'clamp(48px, 8vh, 88px) 24px',
        background: 'linear-gradient(135deg, #00CCF5 0%, #00A8D8 50%, #8b5cf6 100%)',
        color: '#fff',
      }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 24, textAlign: 'center',
          }} className="mkt-stats-grid">
            {stats.map((s) => (
              <div key={s.label}>
                <div style={{
                  fontSize: 'clamp(28px, 5vw, 48px)',
                  fontWeight: 700, letterSpacing: '-0.02em',
                  lineHeight: 1.05, color: '#fff',
                }}>
                  <MetricCounter value={s.value} suffix={s.suffix}
                                 decimals={s.decimals || 0} duration={1.6} />
                </div>
                <div style={{
                  marginTop: 8, fontSize: 13, fontWeight: 600,
                  color: 'rgba(255,255,255,0.78)',
                  letterSpacing: '0.04em', textTransform: 'uppercase',
                }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
        <style>{`
          @media (max-width: 720px) {
            .mkt-stats-grid { grid-template-columns: 1fr 1fr !important; gap: 32px !important; }
          }
        `}</style>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 14 — FINAL CTA
// ─────────────────────────────────────────────────────────────────────────────
function FinalCTA() {
  return (
    <section style={{ padding: 'clamp(64px, 10vh, 120px) 24px', background: 'var(--surface-page)' }}>
      <CTASection
        title="Ready to upgrade your marketing?"
        subtitle="Start free in 2 minutes — no credit card required."
        primary={{ to: '/signup', label: 'Start free' }}
        showEmail
        microCopy="No credit card · Free forever · Setup in 2 minutes"
        variant="cta"
      />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable section heading
// ─────────────────────────────────────────────────────────────────────────────
function SectionHeading({ eyebrow, title, subtitle, cta }) {
  return (
    <div style={{ textAlign: 'center', maxWidth: 720, marginInline: 'auto' }}>
      {eyebrow && (
        <span style={{
          display: 'inline-block',
          padding: '4px 12px', marginBottom: 14,
          fontSize: 11, fontWeight: 700,
          color: 'var(--brand-primary-hover)',
          background: 'var(--brand-primary-soft)',
          borderRadius: 'var(--radius-pill)',
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>{eyebrow}</span>
      )}
      <h2 style={{
        margin: 0,
        fontSize: 'clamp(28px, 4vw, 44px)',
        fontWeight: 700, color: 'var(--text-primary)',
        letterSpacing: '-0.02em', lineHeight: 1.15,
      }}>{title}</h2>
      {subtitle && (
        <p style={{
          margin: '14px auto 0',
          fontSize: 'clamp(15px, 1.5vw, 17px)',
          lineHeight: 1.6,
          color: 'var(--text-secondary)', maxWidth: 600,
        }}>{subtitle}</p>
      )}
      {cta && (
        <div style={{ marginTop: 16 }}>
          <Button as={Link} to={cta.to} size="md" variant="ghost"
                  style={{ color: 'var(--brand-primary-hover)', padding: 0 }}>
            {cta.label} <ArrowRight size={14} />
          </Button>
        </div>
      )}
    </div>
  );
}
