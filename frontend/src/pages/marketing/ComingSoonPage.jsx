/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';

import MarketingLayout from '../../components/marketing/MarketingLayout';
import MeshGradient from '../../components/marketing/MeshGradient';
import Button from '../../components/ui/Button';
import Meta from '../../components/Meta';

/**
 * ComingSoonPage — placeholder for /product/* and /solutions/* routes
 * that get their full content in + 4 of the marketing build.
 *
 * Each route gets its own pretty placeholder so visitors who land via the
 * mega-menu don't see "404" — they see a polite "this page is shipping
 * shortly" with the right title pulled from the URL + a CTA back to the
 * surfaces that ARE complete.
 */

const TITLES = {
  // /product/*
  '/product/analytics':           { kind: 'product', title: 'Analytics',     blurb: 'Cross-platform metrics in one dashboard.' },
  '/product/composer':            { kind: 'product', title: 'Composer',      blurb: 'Write once, publish to every platform.' },
  '/product/inbox':               { kind: 'product', title: 'Unified Inbox', blurb: 'Every conversation in one place.' },
  '/product/whatsapp':            { kind: 'product', title: 'WhatsApp Business', blurb: 'Campaigns + two-way chat at scale.' },
  '/product/bot-builder':         { kind: 'product', title: 'CTWA Bot Builder', blurb: 'Visual flow editor for ad funnels.' },
  '/product/ai':                  { kind: 'product', title: 'AI Studio',     blurb: 'Social Stats in every corner.' },
  '/product/ai-assistant':        { kind: 'product', title: 'AI Assistant',  blurb: 'Cmd+J — talk to your marketing data.' },
  '/product/reports':             { kind: 'product', title: 'Reports',       blurb: 'Reports that write themselves.' },
  '/product/automations':         { kind: 'product', title: 'Automations',   blurb: 'IF this happens, do that.' },
  '/product/marketplace-product': { kind: 'product', title: 'Marketplace',   blurb: 'Two-sided agency-client marketplace.' },

  // /solutions/*
  '/solutions/agencies':    { kind: 'solution', title: 'For Agencies',   blurb: 'Manage 100+ clients without losing your mind.' },
  '/solutions/businesses':  { kind: 'solution', title: 'For Businesses', blurb: 'Take control of your social media.' },
  '/solutions/creators':    { kind: 'solution', title: 'For Creators',   blurb: 'Track your creator economy.' },
  '/solutions/real-estate': { kind: 'solution', title: 'Real Estate',    blurb: 'Sell more properties on social media.' },
  '/solutions/clinics':     { kind: 'solution', title: 'Healthcare',     blurb: 'Engage patients across every platform.' },
  '/solutions/restaurants': { kind: 'solution', title: 'Restaurants',    blurb: 'Fill more tables with social.' },
  '/solutions/ecommerce':   { kind: 'solution', title: 'E-commerce',     blurb: 'Drive sales from social.' },
  '/solutions/education':   { kind: 'solution', title: 'Education',      blurb: 'Reach more students online.' },
};


export default function ComingSoonPage() {
  const { pathname } = useLocation();
  const meta = TITLES[pathname] || { kind: 'product', title: 'Coming soon', blurb: 'This page is shipping shortly.' };

  return (
    <MarketingLayout>
      <Meta
        title={`${meta.title} — coming soon`}
        description={meta.blurb}
      />
      <section style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '120px 24px 80px',
        textAlign: 'center',
        overflow: 'hidden',
      }}>
        <MeshGradient variant="hero" />
        <div style={{ position: 'relative', maxWidth: 640 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', marginBottom: 24,
            fontSize: 12, fontWeight: 600,
            color: '#00CCF5',
            background: 'rgba(0,204,245,0.10)',
            border: '1px solid rgba(0,204,245,0.25)',
            borderRadius: 'var(--radius-pill)',
          }}>
            <Sparkles size={12} />
            {meta.kind === 'solution' ? 'Solution page' : 'Product page'} — shipping soon
          </span>

          <h1 style={{
            margin: 0,
            fontSize: 'clamp(36px, 6vw, 56px)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#fff',
            lineHeight: 1.1,
          }}>
            {meta.title}
          </h1>

          <p style={{
            margin: '20px auto 0',
            fontSize: 'clamp(16px, 1.8vw, 19px)',
            color: 'rgba(255,255,255,0.75)',
            lineHeight: 1.55,
            maxWidth: 540,
          }}>
            {meta.blurb}
          </p>

          <p style={{
            margin: '24px auto 0',
            fontSize: 14,
            color: 'rgba(255,255,255,0.55)',
            maxWidth: 540, lineHeight: 1.6,
          }}>
            We're building this page right now. In the meantime, sign up for a free account and explore the live product — every feature on the menu is already shipping.
          </p>

          <div style={{
            marginTop: 32,
            display: 'flex', gap: 12,
            justifyContent: 'center', flexWrap: 'wrap',
          }}>
            <Button as={Link} to="/signup" size="lg"
                    style={{
                      background: 'linear-gradient(135deg, #00CCF5, #00A8D8)',
                      color: '#0a0e14', border: 'none',
                    }}>
              Start free <ArrowRight size={15} />
            </Button>
            <Button as={Link} to="/" size="lg" variant="ghost"
                    style={{
                      color: '#fff',
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.18)',
                    }}>
              <ArrowLeft size={15} /> Back to home
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
