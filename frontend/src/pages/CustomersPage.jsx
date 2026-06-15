/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  Stethoscope,
  ShoppingBag,
  Utensils,
  Users,
  Sparkles,
  MessageCircle,
  PenSquare,
  TrendingUp,
} from 'lucide-react';

import MarketingLayout from '../components/marketing/MarketingLayout';
import MeshGradient from '../components/marketing/MeshGradient';
import ScrollReveal from '../components/marketing/ScrollReveal';
import Button from '../components/ui/Button';
import Meta from '../components/Meta';

/**
 * CustomersPage — /customers
 *
 * We don't have customer testimonials, named case studies, or customer logos
 * to feature yet. This page intentionally leads with the workflows the
 * product is built for, not who's already using it. Real customer stories
 * will replace the example workflows as we onboard the first cohort of
 * launch partners.
 *
 * Sections:
 *   1. Hero — "Customer stories — coming soon" + "Become a launch partner" CTA
 *   2. Example workflows — industry-only descriptions of how Social Stats is
 *      designed to be used. Clearly labeled as example workflows, not real
 *      customer stories.
 *   3. CTA to sign up or talk to sales.
 */

const EXAMPLE_WORKFLOWS = [
  {
    industry: 'Real estate',
    icon: Building2,
    accent: '#00CCF5',
    headline: 'Capture and qualify property leads via WhatsApp',
    body: 'Run click-to-WhatsApp ads, route enquiries through a bot that asks for budget and locality, then push qualified leads to your CRM. Schedule property reels and Instagram posts from the same Composer.',
    bullets: [
      'CTWA campaigns with platform-native lead forms',
      'Visual bot builder for qualification flows',
      'Brand-voice AI captions per listing',
    ],
  },
  {
    industry: 'Healthcare',
    icon: Stethoscope,
    accent: '#8b5cf6',
    headline: 'Cut no-shows with WhatsApp reminders + a unified inbox',
    body: 'Send appointment reminders 24h and 2h before the slot via WhatsApp templates. Reschedule requests land in the same inbox as Instagram DMs and Google reviews — your team works from one queue.',
    bullets: [
      'Approved WhatsApp template campaigns',
      'Unified inbox across DMs, reviews, comments',
      'Per-clinic workspaces with shared brand voice',
    ],
  },
  {
    industry: 'Agencies',
    icon: Users,
    accent: '#f472b6',
    headline: 'Manage many clients without losing the thread',
    body: 'A small agency can manage many client workspaces from one Social Stats tenant. Approval flows, white-label reports, and per-client brand voice mean the work scales without a proportional headcount increase.',
    bullets: [
      'Per-client workspace + brand voice',
      'Approval flows for posts and replies',
      'White-label reports on a schedule',
    ],
  },
  {
    industry: 'Restaurants',
    icon: Utensils,
    accent: '#f59e0b',
    headline: 'CTWA bots that take orders and bookings',
    body: 'Run Click-to-WhatsApp ads that drop the user into a bot for menu, location, and booking. Route confirmed orders to your POS via webhook. Update Instagram and Google Business with daily specials from one Composer.',
    bullets: [
      'Menu + booking bots out of the box',
      'Google Business posts auto-synced',
      'Per-location workspaces',
    ],
  },
  {
    industry: 'E-commerce',
    icon: ShoppingBag,
    accent: '#10b981',
    headline: 'Catalogue ads + WhatsApp checkout',
    body: 'Pull products from Shopify or Woo into Composer. Run carousel ads on Instagram and Facebook with deep links into a WhatsApp catalogue checkout. Reply to inbound messages with AI-suggested replies in your brand voice.',
    bullets: [
      'Shopify + Woo product feed',
      'WhatsApp catalogue + checkout',
      'AI reply suggestions in brand voice',
    ],
  },
  {
    industry: 'Creators',
    icon: Sparkles,
    accent: '#a78bfa',
    headline: 'Plan, generate, and ship content across platforms',
    body: 'Train Social Stats on five posts in your voice. Generate caption variants for Instagram, Facebook, LinkedIn, and YouTube descriptions from one prompt. Schedule once; the Composer formats per platform.',
    bullets: [
      'One Composer, five-platform output',
      'Brand-voice training in 3 minutes',
      'AI-narrated monthly recap',
    ],
  },
];

export default function CustomersPage() {
  return (
    <MarketingLayout>
      <Meta
        title="Customer stories"
        description="Customer stories will appear here as Social Stats launches publicly. In the meantime, here's how the product is built to be used — by industry."
      />

      {/* ╭───────────╮
          │  1. HERO  │
          ╰───────────╯ */}
      <section style={{
        position: 'relative',
        padding: '120px 24px 80px',
        overflow: 'hidden',
      }}>
        <MeshGradient variant="hero" />

        <div style={{ position: 'relative', maxWidth: 880, margin: '0 auto', textAlign: 'center' }}>
          <span style={{
            display: 'inline-block',
            padding: '4px 12px', marginBottom: 18,
            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
            color: '#fff',
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 'var(--radius-pill)',
            textTransform: 'uppercase',
          }}>Coming soon</span>

          <h1 style={{
            margin: 0,
            fontSize: 'clamp(36px, 6vw, 56px)',
            fontWeight: 700, letterSpacing: '-0.025em',
            lineHeight: 1.1,
            color: '#fff',
          }}>
            Customer stories — coming soon
          </h1>

          <p style={{
            margin: '20px auto 0', maxWidth: 620,
            fontSize: 'clamp(15px, 1.6vw, 17px)',
            lineHeight: 1.55,
            color: 'rgba(255,255,255,0.78)',
          }}>
            We're rolling out Social Stats to a first cohort of launch partners.
            Real customer stories, with named teams and real numbers, will
            appear here as those partners go public. Until then, here's how
            the product is built to be used.
          </p>

          <div style={{
            marginTop: 32, display: 'inline-flex', gap: 12, flexWrap: 'wrap',
            justifyContent: 'center',
          }}>
            <Button as={Link} to="/signup" size="lg"
                    style={{
                      background: 'linear-gradient(135deg, #00CCF5, #00A8D8)',
                      color: '#0a0e14',
                      border: 'none',
                    }}>
              Become a launch partner <ArrowRight size={15} />
            </Button>
            <Button as={Link} to="/contact" size="lg" variant="ghost"
                    style={{
                      color: '#fff',
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.18)',
                    }}>
              Talk to the team
            </Button>
          </div>
        </div>
      </section>

      {/* ╭──────────────────────────╮
          │  2.  EXAMPLE WORKFLOWS   │
          ╰──────────────────────────╯ */}
      <section style={{
        padding: 'clamp(64px, 10vh, 120px) 24px',
        background: 'var(--surface-page)',
      }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <ScrollReveal>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <span style={{
                display: 'inline-block',
                padding: '3px 10px', marginBottom: 14,
                fontSize: 11, fontWeight: 700,
                color: 'var(--brand-primary-hover)',
                background: 'var(--brand-primary-soft)',
                borderRadius: 'var(--radius-pill)',
                letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>Example workflows · illustrative</span>
              <h2 style={{
                margin: 0, fontSize: 'clamp(28px, 4vw, 40px)',
                fontWeight: 700, letterSpacing: '-0.02em',
                color: 'var(--text-primary)', lineHeight: 1.15,
              }}>How Social Stats is built to be used</h2>
              <p style={{
                margin: '14px auto 0', maxWidth: 620,
                fontSize: 16, lineHeight: 1.55,
                color: 'var(--text-secondary)',
              }}>
                These are example workflows, not real customer stories.
                Each describes a typical setup for that industry — the
                channels, AI features, and approval flows that fit.
              </p>
            </div>
          </ScrollReveal>

          <div style={{
            display: 'grid', gap: 16,
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          }}>
            {EXAMPLE_WORKFLOWS.map((w, i) => {
              const Icon = w.icon;
              return (
                <ScrollReveal key={w.industry} delay={i * 0.05}>
                  <article style={{
                    height: '100%',
                    padding: 24,
                    background: 'var(--surface-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-lg)',
                    display: 'flex', flexDirection: 'column', gap: 14,
                  }}>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 40, height: 40, borderRadius: 'var(--radius-md)',
                      background: `${w.accent}1A`,
                      color: w.accent,
                    }}>
                      <Icon size={20} strokeWidth={2} />
                    </div>

                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                                  textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                      {w.industry}
                    </div>

                    <h3 style={{
                      margin: 0, fontSize: 17, fontWeight: 700,
                      color: 'var(--text-primary)', lineHeight: 1.3,
                      letterSpacing: '-0.01em',
                    }}>{w.headline}</h3>

                    <p style={{
                      margin: 0, fontSize: 13, lineHeight: 1.55,
                      color: 'var(--text-secondary)',
                    }}>{w.body}</p>

                    <ul style={{
                      margin: 'auto 0 0', padding: 0, listStyle: 'none',
                      display: 'flex', flexDirection: 'column', gap: 6,
                    }}>
                      {w.bullets.map((b) => (
                        <li key={b} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 8,
                          fontSize: 12, color: 'var(--text-secondary)',
                        }}>
                          <span style={{
                            marginTop: 6,
                            width: 4, height: 4, borderRadius: 999,
                            flexShrink: 0,
                            background: w.accent,
                          }} />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </article>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ╭──────────────╮
          │  3. CTA      │
          ╰──────────────╯ */}
      <section style={{ padding: 'clamp(64px, 10vh, 120px) 24px' }}>
        <div style={{
          maxWidth: 720, margin: '0 auto',
          padding: '48px 32px',
          background: 'var(--surface-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          textAlign: 'center',
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            gap: 10, padding: '6px 12px', marginBottom: 16,
            fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
            color: 'var(--brand-primary-hover)',
            background: 'var(--brand-primary-soft)',
            borderRadius: 'var(--radius-pill)', textTransform: 'uppercase',
          }}>
            <Sparkles size={12} /> Launch partner programme
          </div>
          <h2 style={{
            margin: 0,
            fontSize: 'clamp(24px, 3.6vw, 32px)',
            fontWeight: 700, letterSpacing: '-0.02em',
            color: 'var(--text-primary)', lineHeight: 1.2,
          }}>
            Be the first customer story on this page
          </h2>
          <p style={{
            margin: '14px auto 0', maxWidth: 520,
            fontSize: 15, lineHeight: 1.55,
            color: 'var(--text-secondary)',
          }}>
            Launch-partner teams get hands-on onboarding, a direct line to
            the team, and a feature spot here when they're ready to share
            their numbers.
          </p>
          <div style={{
            marginTop: 28, display: 'inline-flex', gap: 12,
            justifyContent: 'center', flexWrap: 'wrap',
          }}>
            <Button as={Link} to="/signup" size="lg" variant="primary">
              Start free <ArrowRight size={15} />
            </Button>
            <Button as={Link} to="/contact" size="lg" variant="ghost">
              Talk to the team
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
