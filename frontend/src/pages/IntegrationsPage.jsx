/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search, Sparkles, ArrowRight, CheckCircle2,
  MessageSquare, BarChart3, Megaphone, Workflow, CreditCard, ShoppingBag,
  Database, Zap, Mail, Calendar, Image, Brain,
} from 'lucide-react';

import MarketingLayout from '../components/marketing/MarketingLayout';
import MeshGradient    from '../components/marketing/MeshGradient';
import ScrollReveal    from '../components/marketing/ScrollReveal';
import Button          from '../components/ui/Button';
import Meta            from '../components/Meta';
import { track }       from '../services/analytics';

/**
 * IntegrationsPage — /integrations
 *
 *  1. Hero with search
 *  2. Category pills
 *  3. Featured 3-card row (Meta · Google · WhatsApp)
 *  4. Full grid (filterable + searchable)
 *  5. "Don't see it?" custom-integration CTA
 *  6. Bottom CTA
 *
 * No external API. The integration list lives in this file as static data —
 * easy to add new entries without touching the layout.
 */

// ── Categories ────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'all',         label: 'All',          icon: Sparkles  },
  { id: 'social',      label: 'Social',       icon: Megaphone },
  { id: 'messaging',   label: 'Messaging',    icon: MessageSquare },
  { id: 'analytics',   label: 'Analytics',    icon: BarChart3 },
  { id: 'crm',         label: 'CRM',          icon: Database  },
  { id: 'commerce',    label: 'Commerce',     icon: ShoppingBag },
  { id: 'automation',  label: 'Automation',   icon: Workflow  },
  { id: 'ai',          label: 'AI',           icon: Brain     },
  { id: 'productivity',label: 'Productivity', icon: Calendar  },
  { id: 'billing',     label: 'Billing',      icon: CreditCard },
];

// ── Integrations ──────────────────────────────────────────────────────
// `live: true` = fully shipped; otherwise shows a "Coming soon" badge.
const INTEGRATIONS = [
  // Social
  { slug: 'facebook',   name: 'Facebook',   tagline: 'Pages, posts, ads, comments.',          category: 'social',     live: true,  badge: 'Native', accent: '#1877F2', initial: 'f' },
  { slug: 'instagram',  name: 'Instagram',  tagline: 'Posts, reels, stories, DMs.',           category: 'social',     live: true,  badge: 'Native', accent: '#E4405F', initial: 'I' },
  { slug: 'youtube',    name: 'YouTube',    tagline: 'Uploads, comments, analytics.',         category: 'social',     live: true,  badge: 'Native', accent: '#FF0000', initial: 'Y' },
  { slug: 'linkedin',   name: 'LinkedIn',   tagline: 'Pages, posts, lead-gen forms.',         category: 'social',     live: true,  badge: 'Native', accent: '#0A66C2', initial: 'in' },

  // Messaging
  { slug: 'whatsapp',   name: 'WhatsApp Business', tagline: 'Two-way chat, campaigns, CTWA.', category: 'messaging',  live: true,  badge: 'Native', accent: '#25D366', initial: 'W' },
  { slug: 'pinbot',     name: 'Pinbot.ai',  tagline: 'WhatsApp Business API gateway.',         category: 'messaging',  live: true,                   accent: '#22c55e', initial: 'pb' },
  { slug: 'messenger',  name: 'Messenger',  tagline: 'Conversations from Facebook.',          category: 'messaging',  live: true,                   accent: '#0084FF', initial: 'M' },
  { slug: 'telegram',   name: 'Telegram',   tagline: 'Channels and bot replies.',             category: 'messaging',  live: false,                  accent: '#26A5E4', initial: 'tg' },
  { slug: 'slack',      name: 'Slack',      tagline: 'Notifications, approvals, alerts.',     category: 'messaging',  live: true,                   accent: '#4A154B', initial: 'S' },
  { slug: 'discord',    name: 'Discord',    tagline: 'Server announcements via webhook.',     category: 'messaging',  live: false,                  accent: '#5865F2', initial: 'D' },

  // Analytics
  { slug: 'ga4',        name: 'Google Analytics 4', tagline: 'Sessions, conversions, paths.', category: 'analytics',  live: true,                   accent: '#E37400', initial: 'GA' },
  { slug: 'gsc',        name: 'Search Console',     tagline: 'SEO performance and queries.',  category: 'analytics',  live: true,                   accent: '#4285F4', initial: 'SC' },
  { slug: 'gmb',        name: 'Google Business',    tagline: 'Reviews, posts, local insights.',category: 'analytics',  live: true,  badge: 'Native', accent: '#34A853', initial: 'GB' },
  { slug: 'ga-meta-ads',name: 'Meta Ads',           tagline: 'Spend, ROAS, creative scoring.',category: 'analytics',  live: true,  badge: 'Native', accent: '#1877F2', initial: 'MA' },
  { slug: 'google-ads', name: 'Google Ads',         tagline: 'Campaigns, keywords, spend.',   category: 'analytics',  live: false,                  accent: '#4285F4', initial: 'gA' },

  // CRM
  { slug: 'hubspot',    name: 'HubSpot',    tagline: 'Sync contacts and conversations.',     category: 'crm',         live: true,                   accent: '#FF7A59', initial: 'H' },
  { slug: 'salesforce', name: 'Salesforce', tagline: 'Lead, contact, and deal sync.',        category: 'crm',         live: false,                  accent: '#00A1E0', initial: 'sf' },
  { slug: 'zoho',       name: 'Zoho CRM',   tagline: 'Two-way sync — leads + activities.',   category: 'crm',         live: true,                   accent: '#C8202C', initial: 'Z' },
  { slug: 'freshsales', name: 'Freshsales', tagline: 'Pipeline and contact sync.',           category: 'crm',         live: false,                  accent: '#21B573', initial: 'fs' },

  // Commerce
  { slug: 'shopify',    name: 'Shopify',    tagline: 'Products, orders, customers.',          category: 'commerce',    live: true,                   accent: '#96BF48', initial: 'sh' },
  { slug: 'woocommerce',name: 'WooCommerce',tagline: 'WordPress + WooCommerce sync.',         category: 'commerce',    live: true,                   accent: '#7F54B3', initial: 'W' },
  { slug: 'magento',    name: 'Magento',    tagline: 'Adobe Commerce sync.',                  category: 'commerce',    live: false,                  accent: '#EE672F', initial: 'm' },

  // Automation
  { slug: 'zapier',     name: 'Zapier',     tagline: '5,000+ apps via Zapier triggers.',      category: 'automation',  live: true,                   accent: '#FF4F00', initial: 'Z' },
  { slug: 'make',       name: 'Make',       tagline: 'Visual automation, deep flows.',        category: 'automation',  live: true,                   accent: '#6D00CC', initial: 'M' },
  { slug: 'n8n',        name: 'n8n',        tagline: 'Self-hosted automation.',               category: 'automation',  live: false,                  accent: '#EA4B71', initial: 'n8' },
  { slug: 'webhook',    name: 'Webhooks',   tagline: 'Bring your own — outbound + inbound.', category: 'automation',  live: true,                   accent: '#6b7280', initial: 'wh' },

  // AI
  { slug: 'anthropic',  name: 'Anthropic Claude', tagline: 'Bring your own Anthropic API key (Enterprise).', category: 'ai',         live: false,                  accent: '#D97706', initial: 'C' },
  { slug: 'openai',     name: 'OpenAI',      tagline: 'Bring your own GPT key (Enterprise).',category: 'ai',         live: false,                  accent: '#10a37f', initial: 'o' },
  { slug: 'gemini',     name: 'Google Gemini', tagline: 'Bring your own Gemini API key (Enterprise).', category: 'ai',         live: false,                  accent: '#4285F4', initial: 'G' },

  // Productivity
  { slug: 'gcal',       name: 'Google Calendar', tagline: 'Sync content calendar.',           category: 'productivity',live: true,                   accent: '#4285F4', initial: 'gc' },
  { slug: 'gmail',      name: 'Gmail',       tagline: 'Send replies and digests.',            category: 'productivity',live: true,                   accent: '#EA4335', initial: 'gm' },
  { slug: 'gdrive',     name: 'Google Drive',tagline: 'Pull media into Composer.',            category: 'productivity',live: true,                   accent: '#0F9D58', initial: 'gd' },
  { slug: 'dropbox',    name: 'Dropbox',     tagline: 'Pull media into Composer.',            category: 'productivity',live: false,                  accent: '#0061FF', initial: 'db' },
  { slug: 'notion',     name: 'Notion',      tagline: 'Push briefs to Notion pages.',         category: 'productivity',live: false,                  accent: '#000000', initial: 'N' },
  { slug: 'figma',      name: 'Figma',       tagline: 'Pull designs into the Composer.',      category: 'productivity',live: false,                  accent: '#F24E1E', initial: 'F' },
  { slug: 'canva',      name: 'Canva',       tagline: 'Push to Canva for design.',            category: 'productivity',live: true,                   accent: '#00C4CC', initial: 'cv' },

  // Billing
  { slug: 'razorpay',   name: 'Razorpay',    tagline: 'Indian payments + subscriptions.',     category: 'billing',     live: true,  badge: 'Built-in',accent: '#3395FF', initial: 'R' },
  { slug: 'stripe',     name: 'Stripe',      tagline: 'Global card processing.',              category: 'billing',     live: false,                  accent: '#635BFF', initial: 'S' },
  { slug: 'paypal',     name: 'PayPal',      tagline: 'PayPal payment links.',                category: 'billing',     live: false,                  accent: '#003087', initial: 'pp' },
];

// Featured trio — always pinned at the top.
const FEATURED_SLUGS = ['facebook', 'whatsapp', 'gmb'];

export default function IntegrationsPage() {
  const [filter, setFilter] = useState('all');
  const [query, setQuery]   = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return INTEGRATIONS
      .filter((i) => filter === 'all' || i.category === filter)
      .filter((i) => !q || i.name.toLowerCase().includes(q) || i.tagline.toLowerCase().includes(q));
  }, [filter, query]);

  const featured = FEATURED_SLUGS.map((s) => INTEGRATIONS.find((i) => i.slug === s)).filter(Boolean);

  return (
    <MarketingLayout>
      <Meta
        noSuffix
        title="Integrations — Social Stats"
        description="40+ native integrations across social, messaging, analytics, CRM, commerce, AI and more. Plug Social Stats into your existing stack in minutes."
      />

      {/* ╭──────────────╮
          │   1.  HERO   │
          ╰──────────────╯ */}
      <section style={{
        position: 'relative',
        padding: '120px 24px 64px',
        textAlign: 'center',
        overflow: 'hidden',
      }}>
        <MeshGradient variant="hero" />

        <div style={{ position: 'relative', maxWidth: 720, margin: '0 auto' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', marginBottom: 20,
            fontSize: 12, fontWeight: 600,
            color: '#00CCF5',
            background: 'rgba(0,204,245,0.10)',
            border: '1px solid rgba(0,204,245,0.25)',
            borderRadius: 'var(--radius-pill)',
          }}>
            <Sparkles size={12} /> Integrations
          </span>

          <h1 style={{
            margin: 0,
            fontSize: 'clamp(40px, 6vw, 64px)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#fff',
            lineHeight: 1.05,
          }}>
            Plug Social Stats into the<br />
            <span style={{ background: 'linear-gradient(135deg, #00CCF5, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              tools you already use
            </span>
          </h1>

          <p style={{
            margin: '20px auto 32px',
            maxWidth: 560,
            fontSize: 'clamp(16px, 1.8vw, 19px)',
            color: 'rgba(255,255,255,0.75)',
            lineHeight: 1.55,
          }}>
            40+ native integrations across social, messaging, analytics, CRM, commerce, AI and more. Native means &quot;built and maintained by us, not Zapier.&quot;
          </p>

          {/* Search */}
          <label style={{
            display: 'flex', alignItems: 'center', gap: 10,
            maxWidth: 480, margin: '0 auto',
            padding: '12px 16px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 'var(--radius-pill)',
            backdropFilter: 'blur(12px)',
          }}>
            <Search size={16} color="rgba(255,255,255,0.55)" />
            <input
              type="search"
              aria-label="Search integrations"
              placeholder="Search integrations…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                flex: 1, minWidth: 0,
                background: 'transparent',
                border: 'none', outline: 'none',
                color: '#fff',
                fontSize: 15,
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                style={{
                  background: 'transparent', border: 'none',
                  color: 'rgba(255,255,255,0.55)',
                  cursor: 'pointer', fontSize: 14,
                }}
              >
                ×
              </button>
            )}
          </label>
        </div>
      </section>

      {/* ╭──────────────────────╮
          │   2 + 3.  FEATURED   │
          ╰──────────────────────╯ */}
      {!query && filter === 'all' && (
        <section style={{ padding: '32px 24px 48px' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <ScrollReveal>
              <div style={{
                fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.55)', marginBottom: 16,
                textAlign: 'center',
              }}>
                Featured
              </div>
            </ScrollReveal>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 16,
            }}>
              {featured.map((i, idx) => (
                <ScrollReveal key={i.slug} delay={idx * 0.06}>
                  <FeaturedCard i={i} />
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ╭──────────────────────╮
          │   4.  CATEGORY GRID  │
          ╰──────────────────────╯ */}
      <section style={{ padding: '40px 24px 100px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {/* Filter pills */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            justifyContent: 'center',
            marginBottom: 36,
          }}>
            {CATEGORIES.map(({ id, label, icon: Icon }) => {
              const count = id === 'all' ? INTEGRATIONS.length : INTEGRATIONS.filter((i) => i.category === id).length;
              const active = filter === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px',
                    fontSize: 13,
                    fontWeight: 600,
                    color: active ? '#0a0e14' : '#fff',
                    background: active ? 'linear-gradient(135deg, #00CCF5, #00A8D8)' : 'rgba(255,255,255,0.06)',
                    border: active ? '1px solid transparent' : '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 'var(--radius-pill)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <Icon size={13} />
                  {label}
                  <span style={{ opacity: 0.6, fontSize: 11 }}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Grid */}
          {filtered.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 12,
            }}>
              {filtered.map((i, idx) => (
                <IntegrationCard key={i.slug} i={i} index={idx} />
              ))}
            </div>
          ) : (
            <div style={{
              padding: 56, textAlign: 'center',
              color: 'rgba(255,255,255,0.55)',
              border: '1px dashed rgba(255,255,255,0.12)',
              borderRadius: 'var(--radius-xl)',
            }}>
              <p style={{ margin: 0, fontSize: 15 }}>
                No integrations match &quot;{query}&quot;.
              </p>
              <p style={{ margin: '8px 0 16px', fontSize: 13 }}>
                Try a different keyword — or request it below.
              </p>
              <Button as={Link} to="/contact" size="sm" variant="ghost"
                style={{
                  color: '#fff',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.18)',
                }}>
                Request integration
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* ╭──────────────────────────╮
          │   5.  CUSTOM / API CTA   │
          ╰──────────────────────────╯ */}
      <section style={{ padding: '80px 24px', background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
          }}>
            <Tile
              icon={Zap}
              title="Build your own"
              body="Public REST API + outbound webhooks + Zapier/Make. Build any integration we haven't shipped yet."
              cta={{ to: '/contact?topic=api', label: 'Get API access' }}
            />
            <Tile
              icon={Mail}
              title="Don't see your tool?"
              body="Tell us what you use. We ship 2–3 new native integrations every quarter, and customer requests jump the queue."
              cta={{ to: '/contact', label: 'Request integration' }}
            />
            <Tile
              icon={Image}
              title="Enterprise integrations"
              body="SCIM provisioning, SSO (SAML / OIDC), private webhooks. Available on Enterprise plans."
              cta={{ to: '/contact?topic=enterprise', label: 'Talk to sales' }}
            />
          </div>
        </div>
      </section>

      {/* ╭──────────────╮
          │   6.  CTA    │
          ╰──────────────╯ */}
      <section style={{
        position: 'relative',
        padding: '120px 24px',
        textAlign: 'center',
        overflow: 'hidden',
      }}>
        <MeshGradient variant="cta" />

        <div style={{ position: 'relative', maxWidth: 640, margin: '0 auto' }}>
          <h2 style={{
            margin: 0,
            fontSize: 'clamp(32px, 4.5vw, 48px)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#fff',
            lineHeight: 1.1,
          }}>
            Connect your stack<br />
            <span style={{ background: 'linear-gradient(135deg, #00CCF5, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              in under 10 minutes
            </span>
          </h2>

          <p style={{
            margin: '20px auto 32px',
            maxWidth: 480,
            fontSize: 17,
            color: 'rgba(255,255,255,0.75)',
            lineHeight: 1.55,
          }}>
            Most customers connect 4-6 platforms before they finish their morning coffee. Free plan, no card.
          </p>

          <div style={{
            display: 'flex', gap: 12,
            justifyContent: 'center', flexWrap: 'wrap',
          }}>
            <Button as={Link} to="/signup" size="lg"
              onClick={() => track('signup_click', { source: 'integrations_cta' })}
              style={{
                background: 'linear-gradient(135deg, #00CCF5, #00A8D8)',
                color: '#0a0e14', border: 'none',
              }}>
              Start free <ArrowRight size={15} />
            </Button>
            <Button as={Link} to="/contact" size="lg" variant="ghost"
              style={{
                color: '#fff',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.18)',
              }}>
              Talk to sales
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}

// ── card components ────────────────────────────────────────────────────
function FeaturedCard({ i }) {
  return (
    <motion.article
      whileHover={{ y: -4 }}
      style={{
        position: 'relative',
        padding: 24,
        borderRadius: 'var(--radius-xl)',
        background: `linear-gradient(135deg, ${i.accent}1A, rgba(255,255,255,0.04))`,
        border: `1px solid ${i.accent}40`,
        overflow: 'hidden',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        marginBottom: 14,
      }}>
        <Logo i={i} size={44} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>{i.name}</div>
          {i.badge && (
            <div style={{ fontSize: 11, fontWeight: 600, color: i.accent }}>{i.badge}</div>
          )}
        </div>
      </div>

      <p style={{
        margin: 0, flex: 1,
        fontSize: 14,
        color: 'rgba(255,255,255,0.75)',
        lineHeight: 1.55,
      }}>
        {i.tagline}
      </p>

      <div style={{
        marginTop: 18, paddingTop: 14,
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', gap: 4,
        fontSize: 12, fontWeight: 600,
        color: '#00CCF5',
      }}>
        <CheckCircle2 size={13} /> Live now
      </div>
    </motion.article>
  );
}

function IntegrationCard({ i }) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      style={{
        position: 'relative',
        padding: 18,
        borderRadius: 'var(--radius-lg)',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        cursor: 'default',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'border-color 0.2s, background 0.2s',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 10,
      }}>
        <Logo i={i} size={34} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 14, fontWeight: 600, color: '#fff',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {i.name}
          </div>
        </div>
        {i.live ? (
          <span style={{
            fontSize: 10, fontWeight: 600,
            color: '#10b981',
            padding: '2px 7px',
            background: 'rgba(16,185,129,0.10)',
            border: '1px solid rgba(16,185,129,0.30)',
            borderRadius: 'var(--radius-pill)',
            whiteSpace: 'nowrap',
          }}>
            Live
          </span>
        ) : (
          <span style={{
            fontSize: 10, fontWeight: 600,
            color: 'rgba(255,255,255,0.55)',
            padding: '2px 7px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 'var(--radius-pill)',
            whiteSpace: 'nowrap',
          }}>
            Soon
          </span>
        )}
      </div>

      <p style={{
        margin: 0, flex: 1,
        fontSize: 12,
        color: 'rgba(255,255,255,0.65)',
        lineHeight: 1.5,
      }}>
        {i.tagline}
      </p>
    </motion.div>
  );
}

function Logo({ i, size = 36 }) {
  return (
    <div style={{
      flexShrink: 0,
      width: size, height: size,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 8,
      background: `${i.accent}22`,
      color: i.accent,
      fontWeight: 700,
      fontSize: size <= 34 ? 12 : 15,
      letterSpacing: '-0.02em',
    }}>
      {i.initial}
    </div>
  );
}

function Tile({ icon: Icon, title, body, cta }) {
  return (
    <ScrollReveal>
      <div style={{
        padding: 28,
        borderRadius: 'var(--radius-xl)',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.10)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          width: 40, height: 40,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 10,
          background: 'rgba(0,204,245,0.12)',
          color: '#00CCF5',
          marginBottom: 14,
        }}>
          <Icon size={20} strokeWidth={1.6} />
        </div>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: '#fff' }}>
          {title}
        </h3>
        <p style={{
          margin: '8px 0 16px', flex: 1,
          fontSize: 14,
          color: 'rgba(255,255,255,0.65)',
          lineHeight: 1.55,
        }}>
          {body}
        </p>
        <Link to={cta.to} style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 13, fontWeight: 600,
          color: '#00CCF5',
          textDecoration: 'none',
        }}>
          {cta.label} <ArrowRight size={13} />
        </Link>
      </div>
    </ScrollReveal>
  );
}
