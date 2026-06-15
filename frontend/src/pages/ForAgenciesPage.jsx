/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * /for-agencies — landing page targeted at agencies (B2B).
 *
 * Counterpart to /for-businesses. Hammers ROI + the marketplace exposure
 * benefit (the marketplace is the new hook agencies didn't have before).
 */
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, Sparkles, Building2, TrendingUp, Star, Inbox, Wand2,
  ShieldCheck, Check, Users2,
} from 'lucide-react';

import MarketingLayout from '../components/marketing/MarketingLayout';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Meta from '../components/Meta';


export default function ForAgenciesPage() {
  return (
    <MarketingLayout>
      <Meta
        title="Social Stats for agencies — manage 100+ clients from one place"
        description="One dashboard for analytics, content, inbox, ads, and WhatsApp campaigns across every client. Marketplace listing brings inbound leads. Trust + permissions built into the foundation."
      />
      <Hero />
      <ROIBand />
      <MarketplaceExposure />
      <FeatureBlocks />
      <FinalCTA />
    </MarketingLayout>
  );
}


function Hero() {
  return (
    <section style={{ position: 'relative', overflow: 'hidden', padding: '128px 32px 72px' }}>
      <div aria-hidden style={meshBg} />
      <div style={{ position: 'relative', maxWidth: 880, margin: '0 auto', textAlign: 'center' }}>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Badge variant="brand" icon={Building2} size="md">For agencies · marketplace included</Badge>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          style={{
            margin: '20px 0 16px',
            fontSize: 'clamp(36px, 5.2vw, 60px)',
            lineHeight: 1.06, letterSpacing: '-0.03em',
            fontWeight: 600, color: 'var(--text-primary)',
          }}
        >
          Manage 100+ clients from{' '}
          <span style={{ backgroundImage: 'var(--brand-gradient)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
            one place.
          </span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          style={{ margin: '0 auto', maxWidth: 640, fontSize: 18, lineHeight: 1.6, color: 'var(--text-secondary)' }}
        >
          Analytics, content, inbox, WhatsApp campaigns, ads, AI — every client in one beautiful dashboard.
          List in our marketplace and get inbound leads. Built on trust: every action logged, every permission revocable.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          style={{ marginTop: 28, display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}
        >
          <Button as={Link} to="/signup" size="xl" iconRight={ArrowRight}>
            Start free trial
          </Button>
          <Button as={Link} to="/agencies" size="xl" variant="secondary" icon={Building2}>
            See the marketplace
          </Button>
        </motion.div>
        <p style={{ marginTop: 14, fontSize: 13, color: 'var(--text-tertiary)' }}>
          14-day free trial · No credit card · 5 connected platforms per client
        </p>
      </div>
    </section>
  );
}


function ROIBand() {
  const items = [
    { stat: '15+ hrs',      label: 'saved per agency-week vs juggling 5 platforms' },
    { stat: '40% faster',   label: 'inbox response time with AI suggestions' },
    { stat: '3× clients',   label: 'manageable per AM with the unified workflow' },
    { stat: '0 logins',     label: 'shared with clients — they keep their accounts' },
  ];
  return (
    <section style={{ padding: '40px 32px', background: 'var(--surface-card)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ maxWidth: 'var(--container-2xl)', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        {items.map((it) => (
          <div key={it.label} style={{ textAlign: 'center', padding: '14px 12px' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {it.stat}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>{it.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}


function MarketplaceExposure() {
  return (
    <section style={{ padding: '72px 32px' }}>
      <div style={{ maxWidth: 920, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'center' }} className="fa-grid">
        <div>
          <Badge variant="brand" icon={Star} size="md">New: Marketplace</Badge>
          <h2 style={{ margin: '14px 0 10px', fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Inbound leads, not cold-emailing.
          </h2>
          <p style={{ margin: '0 0 20px', fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
            List your agency in the Social Stats marketplace. Verified businesses search by industry, location, and rating —
            then send you a manage-request directly. Reviews come from clients with real, verified relationships.
          </p>
          <Button as={Link} to="/agencies" variant="secondary" size="md" icon={Building2}>
            See the marketplace
          </Button>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            'Verified badge after our team checks your registration',
            'Filterable by industry, services, location, price, rating',
            'Reviews from real, relation-verified clients (no fake reviews)',
            'Public profile with services, pricing, portfolio (live editor)',
            'Featured placement for verified agencies with 4.5+ stars',
          ].map((s) => (
            <li key={s} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, color: 'var(--text-primary)' }}>
              <Check size={16} style={{ color: 'var(--success)', flexShrink: 0, marginTop: 2 }} />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </div>
      <style>{`@media (max-width: 880px) { .fa-grid { grid-template-columns: 1fr !important; gap: 28px !important; } }`}</style>
    </section>
  );
}


function FeatureBlocks() {
  const items = [
    { icon: TrendingUp,  title: 'Unified analytics',     body: 'One dashboard across Facebook, Instagram, YouTube, LinkedIn, GMB. Cross-client benchmarking. White-label exports.' },
    { icon: Inbox,       title: 'Unified inbox',         body: 'DMs, comments, and reviews on one screen. AI-suggested replies tuned to each client\'s brand voice. Approval rules where the client wants them.' },
    { icon: Wand2,       title: 'Composer + scheduler',  body: 'Draft once, post everywhere. Per-platform overrides. AI image alt-text, hashtag research, optimal-time recommendations.' },
    { icon: Users2,      title: 'WhatsApp campaigns',    body: 'Pinbot-powered campaigns with consented contacts, templates, scheduling, and full delivery analytics.' },
    { icon: ShieldCheck, title: 'Trust by design',       body: 'Every action logged. Permissions you and the client both see. End-user-disconnect always works — no lock-in stories.' },
    { icon: Sparkles,    title: 'AI Studio across the board', body: 'Brand voice training, post writer, insight generation, anomaly detection, report narration. The whole AI stack we ship sits inside your dashboard.' },
  ];
  return (
    <section style={{ padding: '64px 32px', background: 'var(--surface-card)' }}>
      <div style={{ maxWidth: 'var(--container-2xl)', margin: '0 auto' }}>
        <h2 style={sectionH}>Everything an agency needs, in one place</h2>
        <p style={sectionSub}>No more 5-tab switching, no more spreadsheet exports, no more shared client logins.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginTop: 32 }}>
          {items.map((it) => (
            <article key={it.title} style={featureCard}>
              <span style={{
                width: 36, height: 36, borderRadius: 'var(--radius-md)',
                background: 'var(--brand-primary-glow)', color: 'var(--brand-primary-hover)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
              }}>
                <it.icon size={18} strokeWidth={2.2} />
              </span>
              <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{it.title}</h3>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{it.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}


function FinalCTA() {
  return (
    <section style={{ padding: '72px 32px', background: 'var(--surface-card)', borderTop: '1px solid var(--border-subtle)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 30, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          See how much time you'll get back.
        </h2>
        <p style={{ margin: '8px 0 22px', fontSize: 15, color: 'var(--text-secondary)' }}>
          Free and open source. Bring your real clients — self-host with no per-seat fees.
        </p>
        <Button as={Link} to="/signup" size="xl" iconRight={ArrowRight}>
          Get started free
        </Button>
      </div>
    </section>
  );
}


const sectionH = {
  margin: 0,
  fontSize: 32, fontWeight: 700,
  color: 'var(--text-primary)', letterSpacing: '-0.025em',
  textAlign: 'center',
};
const sectionSub = {
  margin: '8px auto 0', maxWidth: 580,
  fontSize: 15, color: 'var(--text-secondary)',
  textAlign: 'center', lineHeight: 1.6,
};
const featureCard = {
  padding: 20,
  background: 'var(--surface-page)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-lg)',
};
const meshBg = {
  position: 'absolute', inset: 0,
  background: 'var(--brand-mesh)',
  opacity: 0.45, filter: 'blur(80px) saturate(140%)', zIndex: 0,
};
