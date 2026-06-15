/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Heart, Compass, Layers, Globe, Linkedin, Twitter } from 'lucide-react';

import MarketingLayout from '../components/marketing/MarketingLayout';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Avatar from '../components/ui/Avatar';
import Meta from '../components/Meta';

const VALUES = [
  {
    icon: Compass,
    color: 'var(--module-analytics)',
    title: 'Honest by default',
    body:
      'No dark patterns, no surprise charges, no manipulative onboarding. We believe trust compounds — and so do good products.',
  },
  {
    icon: Layers,
    color: 'var(--module-ai)',
    title: 'Quality over scope',
    body:
      'Every feature ships only when it feels obvious in your hands. We\'d rather do five things beautifully than fifty halfway.',
  },
  {
    icon: Heart,
    color: '#ef4444',
    title: 'Customers at the center',
    body:
      'We talk to customers every week. The roadmap reflects what real teams need, not what board decks want.',
  },
  {
    icon: Globe,
    color: '#f59e0b',
    title: 'India-first, world-ready',
    body:
      'Built in India, for the world. Rupee billing, GST invoicing, DPDP compliance — and global infrastructure.',
  },
];

// Team roles and timeline are intentionally generic until we have real
// founders + milestones to feature publicly. We'd rather show nothing than
// invent it.
const TEAM = [];

const TIMELINE = [
  { date: '2024',  title: 'First prototype',    body: 'Social Stats started as a unified dashboard for analytics across the platforms agencies actually use.' },
  { date: '2025',  title: 'Composer + Inbox',   body: 'Content composer with per-platform formatting and a unified inbox across DMs, comments, and reviews.' },
  { date: '2026',  title: 'Marketing OS (you are here)', body: 'Unified control center across analytics, messaging, ads, AI, and automations.' },
];

export default function AboutPage() {
  return (
    <MarketingLayout>
      <Meta
        title="About"
        description="Social Stats is the marketing OS for modern teams — unified analytics, content, messaging, and AI across the 5 platforms that matter."
      />
      {/* Hero */}
      <section style={{ padding: '128px 32px 64px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0,
            background: 'var(--brand-mesh)',
            opacity: 0.30, filter: 'blur(80px) saturate(140%)',
          }}
        />
        <div style={{ position: 'relative', maxWidth: 760, margin: '0 auto' }}>
          <Badge variant="brand" size="md">About</Badge>
          <h1 style={{
            margin: '20px 0 18px',
            fontSize: 'clamp(40px, 5vw, 56px)',
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}>
            We're building the marketing OS we wanted at our last company.
          </h1>
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
            Social Stats started with a frustrated founding team and a long list of broken
            marketing tools. We're building the unified product we wanted at our
            last company.
          </p>
        </div>
      </section>

      {/* Mission band */}
      <section style={{ padding: '64px 32px', background: 'var(--surface-card)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ maxWidth: 920, margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            display: 'inline-block',
            fontSize: 12, fontWeight: 600,
            letterSpacing: '0.10em', textTransform: 'uppercase',
            color: 'var(--brand-primary-hover)',
            marginBottom: 14,
          }}>
            Our mission
          </div>
          <p style={{
            margin: 0,
            fontSize: 'clamp(22px, 3vw, 32px)',
            fontWeight: 500,
            letterSpacing: '-0.015em',
            color: 'var(--text-primary)',
            lineHeight: 1.4,
          }}>
            Give every marketing team — from solo creators to global agencies — a single,
            beautiful platform to <span style={{ color: 'var(--brand-primary-hover)' }}>understand, create, and grow</span>.
          </p>
        </div>
      </section>

      {/* Values */}
      <section style={{ padding: '96px 32px' }}>
        <div style={{ maxWidth: 'var(--container-xl)', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 style={{ margin: 0, fontSize: 'clamp(28px, 3.4vw, 40px)', fontWeight: 600, letterSpacing: '-0.025em', color: 'var(--text-primary)' }}>
              How we work.
            </h2>
            <p style={{ margin: '12px auto 0', maxWidth: 540, fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Four values that show up in every product decision.
            </p>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 20,
            }}
            className="about-values-grid"
          >
            {VALUES.map((v, i) => (
              <motion.div
                key={v.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
                style={{
                  padding: 24,
                  background: 'var(--surface-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-xl)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <span style={{
                  display: 'inline-flex',
                  width: 38, height: 38,
                  borderRadius: 'var(--radius-md)',
                  background: v.color, color: '#fff',
                  alignItems: 'center', justifyContent: 'center',
                  marginBottom: 14,
                }}>
                  <v.icon size={18} strokeWidth={2.2} />
                </span>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {v.title}
                </h3>
                <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                  {v.body}
                </p>
              </motion.div>
            ))}
          </div>
          <style>{`
            @media (max-width: 980px) { .about-values-grid { grid-template-columns: 1fr 1fr !important; } }
            @media (max-width: 560px) { .about-values-grid { grid-template-columns: 1fr !important; } }
          `}</style>
        </div>
      </section>

      {/* Team */}
      <section style={{ padding: '96px 32px', background: 'var(--surface-card)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ maxWidth: 'var(--container-xl)', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <Badge variant="brand" size="md">Team</Badge>
            <h2 style={{ margin: '14px 0 12px', fontSize: 'clamp(28px, 3.4vw, 40px)', fontWeight: 600, letterSpacing: '-0.025em', color: 'var(--text-primary)' }}>
              The humans behind Social Stats.
            </h2>
            <p style={{ margin: '0 auto', maxWidth: 540, fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              We're a small, experienced team based in Bangalore and remote.
            </p>
          </div>

          {TEAM.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 16,
              }}
              className="about-team-grid"
            >
              {TEAM.map((m, i) => (
                <motion.div
                  key={m.name}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.5, delay: i * 0.05 }}
                  style={{
                    padding: 24,
                    background: 'var(--surface-page)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-xl)',
                    display: 'flex', alignItems: 'center', gap: 14,
                  }}
                >
                  <Avatar name={m.name} size="lg" />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--brand-primary-hover)', fontWeight: 500, marginBottom: 2 }}>{m.role}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{m.bio}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <SocialChip icon={Linkedin} label={`${m.name} on LinkedIn`} />
                    <SocialChip icon={Twitter}  label={`${m.name} on Twitter`} />
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div style={{
              padding: '32px 24px',
              background: 'var(--surface-page)',
              border: '1px dashed var(--border-default)',
              borderRadius: 'var(--radius-xl)',
              textAlign: 'center',
              maxWidth: 560, margin: '0 auto',
            }}>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                Individual team profiles will appear here as we go public.
                In the meantime, the easiest way to reach us is over email at{' '}
                <a href="mailto:hello@socialstats.app" style={{ color: 'var(--text-link)', fontWeight: 600 }}>
                  hello@socialstats.app
                </a>.
              </p>
            </div>
          )}

          <p style={{ marginTop: 32, textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>
            We're hiring across engineering, design, and customer success.{' '}
            <Link to="/contact" style={{ color: 'var(--text-link)', fontWeight: 600, textDecoration: 'none' }}>Get in touch →</Link>
          </p>

          <style>{`
            @media (max-width: 980px) { .about-team-grid { grid-template-columns: 1fr 1fr !important; } }
            @media (max-width: 560px) { .about-team-grid { grid-template-columns: 1fr !important; } }
          `}</style>
        </div>
      </section>

      {/* Timeline */}
      <section style={{ padding: '96px 32px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <Badge variant="brand" size="md">Journey</Badge>
            <h2 style={{ margin: '14px 0 12px', fontSize: 'clamp(28px, 3.4vw, 40px)', fontWeight: 600, letterSpacing: '-0.025em', color: 'var(--text-primary)' }}>
              How we got here.
            </h2>
          </div>

          <ol style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            position: 'relative',
          }}>
            <span
              aria-hidden
              style={{
                position: 'absolute',
                top: 8, bottom: 8, left: 9,
                width: 2,
                background: 'linear-gradient(180deg, var(--brand-primary), transparent)',
                opacity: 0.4,
              }}
            />
            {TIMELINE.map((t) => (
              <li key={t.date} style={{ position: 'relative', paddingLeft: 36, marginBottom: 32 }}>
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: 0, top: 6,
                    width: 20, height: 20,
                    borderRadius: '50%',
                    background: 'var(--brand-gradient)',
                    boxShadow: '0 0 0 4px var(--brand-primary-glow)',
                  }}
                />
                <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--brand-primary-hover)' }}>
                  {t.date}
                </div>
                <h3 style={{ margin: '4px 0 6px', fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                  {t.title}
                </h3>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                  {t.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '0 32px 120px', textAlign: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 'clamp(28px, 3.4vw, 40px)', fontWeight: 600, letterSpacing: '-0.025em', color: 'var(--text-primary)' }}>
          Want to build with us?
        </h2>
        <p style={{ margin: '12px auto 28px', maxWidth: 480, fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          We're hiring across the stack. Or just say hi.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button as={Link} to="/contact" size="lg" iconRight={ArrowRight}>Say hello</Button>
          <Button as={Link} to="/signup"  variant="secondary" size="lg">Try Social Stats free</Button>
        </div>
      </section>
    </MarketingLayout>
  );
}

function SocialChip({ icon: Icon, label }) {
  return (
    <span
      aria-label={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center',
        width: 22, height: 22,
        borderRadius: 'var(--radius-xs)',
        background: 'var(--surface-sunken)',
        color: 'var(--text-tertiary)',
      }}
    >
      <Icon size={11} strokeWidth={2} />
    </span>
  );
}
