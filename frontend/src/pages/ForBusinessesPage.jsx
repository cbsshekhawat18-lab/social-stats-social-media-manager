/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * /for-businesses — landing page for end-users (B2C side of the marketplace).
 *
 * Counterpart to /for-agencies. Promotes self-serve signup and the "your
 * data stays yours" trust story. Reuses the existing MarketingLayout so
 * nav + footer match the rest of the marketing site.
 */
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, Sparkles, ShieldCheck, Plug, BarChart3, Users2,
  Check, Building2, Search, Bot,
} from 'lucide-react';

import MarketingLayout from '../components/marketing/MarketingLayout';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Meta from '../components/Meta';


export default function ForBusinessesPage() {
  return (
    <MarketingLayout>
      <Meta
        title="Social Stats for businesses — take control of your social media"
        description="Free forever for individuals and small businesses. Connect Instagram, Facebook, YouTube, LinkedIn and Google My Business in 5 minutes. Bring an agency on-board (or don't) — you stay in control."
      />
      <Hero />
      <ValueProps />
      <AgencyOptional />
      <PrivacyTrust />
      <FinalCTA />
    </MarketingLayout>
  );
}


function Hero() {
  return (
    <section style={{ position: 'relative', overflow: 'hidden', padding: '128px 32px 72px' }}>
      <div aria-hidden style={meshBg} />
      <div style={{ position: 'relative', maxWidth: 880, margin: '0 auto', textAlign: 'center' }}>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Badge variant="brand" icon={Sparkles} size="md">For business owners · free forever</Badge>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          style={{
            margin: '20px 0 16px',
            fontSize: 'clamp(36px, 5.2vw, 60px)',
            lineHeight: 1.06, letterSpacing: '-0.03em',
            fontWeight: 600, color: 'var(--text-primary)',
          }}
        >
          Take control of your{' '}
          <span style={{ backgroundImage: 'var(--brand-gradient)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
            social media.
          </span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          style={{ margin: '0 auto', maxWidth: 640, fontSize: 18, lineHeight: 1.6, color: 'var(--text-secondary)' }}
        >
          Real-estate agents, clinics, restaurants, creators — connect your accounts in 5 minutes
          and start posting, replying, and tracking what's working. Free forever for individuals.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          style={{ marginTop: 28, display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}
        >
          <Button as={Link} to="/auth/end-user/signup" size="xl" iconRight={ArrowRight}>
            Get started — it's free
          </Button>
          <Button as={Link} to="/agencies" size="xl" variant="secondary" icon={Search}>
            Browse agencies
          </Button>
        </motion.div>
        <p style={{ marginTop: 14, fontSize: 13, color: 'var(--text-tertiary)' }}>
          No credit card · 5 platforms · ✨ AI-assisted from day one
        </p>
      </div>
    </section>
  );
}


function ValueProps() {
  const items = [
    { icon: Plug,       title: 'Connect in 5 minutes',  body: 'OAuth into Instagram, Facebook, YouTube, LinkedIn and Google My Business. We handle token refresh and platform quirks.' },
    { icon: BarChart3,  title: 'See what\'s working',   body: 'Unified analytics across every platform — so you stop tab-hopping and start making decisions.' },
    { icon: Bot,        title: 'AI built-in',           body: 'Draft posts, suggest replies, and surface the best time to post — without copying anything into a separate tool.' },
    { icon: ShieldCheck,title: 'Your data, your rules', body: 'Disconnect anytime. Export anytime. Audit log of every action — by you, by AI, by an agency if you bring one on.' },
  ];
  return (
    <section style={{ padding: '64px 32px', background: 'var(--surface-card)' }}>
      <div style={{ maxWidth: 'var(--container-2xl)', margin: '0 auto' }}>
        <h2 style={sectionH}>Built for the way you actually work</h2>
        <p style={sectionSub}>Five connected platforms. One dashboard. Zero spreadsheets.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 32 }}>
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


function AgencyOptional() {
  return (
    <section style={{ padding: '72px 32px' }}>
      <div style={{ maxWidth: 920, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'center' }} className="fb-grid">
        <div>
          <Badge variant="brand" icon={Users2} size="md">Agency-friendly</Badge>
          <h2 style={{ margin: '14px 0 10px', fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Already work with an agency? They can join you for free.
          </h2>
          <p style={{ margin: '0 0 20px', fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
            Invite them by email — they get an account on Social Stats at no cost. You set the permissions, mark sensitive actions
            "ask me first", and revoke access in a single click. No more shared logins.
          </p>
          <Button as={Link} to="/agencies" variant="secondary" size="md" icon={Search}>
            Browse the agency marketplace
          </Button>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            'Permissions matrix — toggle what they can and can\'t do',
            '"Ask me first" approvals for risky actions (publishing, ad spend, deletions)',
            'Activity log — every agency action is logged for audit',
            'Pause access for vacations; revoke entirely when you part ways',
          ].map((s) => (
            <li key={s} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, color: 'var(--text-primary)' }}>
              <Check size={16} style={{ color: 'var(--success)', flexShrink: 0, marginTop: 2 }} />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </div>
      <style>{`@media (max-width: 880px) { .fb-grid { grid-template-columns: 1fr !important; gap: 28px !important; } }`}</style>
    </section>
  );
}


function PrivacyTrust() {
  return (
    <section style={{ padding: '64px 32px', background: 'var(--surface-sunken)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
        <span style={{
          width: 48, height: 48, margin: '0 auto 16px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--brand-primary-glow)', color: 'var(--brand-primary-hover)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ShieldCheck size={22} strokeWidth={2.2} />
        </span>
        <h2 style={{ margin: '0 0 10px', fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Your data stays yours.
        </h2>
        <p style={{ margin: 0, fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
          We never sell your data. We never train on your private posts. Disconnecting a platform takes one click —
          even if an agency is managing your account. Export anytime. Delete anytime.
        </p>
      </div>
    </section>
  );
}


function FinalCTA() {
  return (
    <section style={{ padding: '72px 32px', background: 'var(--surface-card)', borderTop: '1px solid var(--border-subtle)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 30, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Ready in 5 minutes.
        </h2>
        <p style={{ margin: '8px 0 22px', fontSize: 15, color: 'var(--text-secondary)' }}>
          No credit card. No agency required. Bring one when you want.
        </p>
        <Button as={Link} to="/auth/end-user/signup" size="xl" iconRight={ArrowRight}>
          Create my account
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
