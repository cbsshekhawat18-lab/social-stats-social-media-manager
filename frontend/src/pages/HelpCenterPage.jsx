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
import {
  Search, Rocket, Plug, PenSquare, Inbox, CreditCard, Wrench, Shield, BookOpen, ArrowRight, MessageCircle,
} from 'lucide-react';
import MarketingLayout from '../components/marketing/MarketingLayout';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import Meta from '../components/Meta';

const CATEGORIES = [
  { id: 'getting-started', icon: Rocket,    color: '#00CCF5', title: 'Getting started',     count: 12, body: 'Sign-up, workspace setup, inviting your team.' },
  { id: 'connections',     icon: Plug,      color: '#10b981', title: 'Connections',         count: 18, body: 'OAuth, manual tokens, troubleshooting reconnects.' },
  { id: 'composer',        icon: PenSquare, color: '#8b5cf6', title: 'Composer',            count: 14, body: 'Composing, scheduling, approvals, media library.' },
  { id: 'inbox',           icon: Inbox,     color: '#f59e0b', title: 'Inbox',               count: 9,  body: 'Unified inbox, AI replies, automation rules.' },
  { id: 'billing',         icon: CreditCard,color: '#3b82f6', title: 'Billing',             count: 11, body: 'Plans, payment methods, invoices, refunds.' },
  { id: 'troubleshooting', icon: Wrench,    color: '#ef4444', title: 'Troubleshooting',     count: 7,  body: 'Common issues, error codes, recovery steps.' },
  { id: 'security',        icon: Shield,    color: '#0891b2', title: 'Security & privacy',  count: 8,  body: 'Authentication, audit log, data retention.' },
  { id: 'api',             icon: BookOpen,  color: '#6366f1', title: 'API & developers',    count: 16, body: 'API keys, webhooks, rate limits.' },
];

const POPULAR = [
  'How do I connect a Facebook page?',
  'Why did my Meta token expire?',
  'How do I invite teammates and assign roles?',
  'How do approvals work in the Composer?',
  'Where do I download a client report as PDF?',
  'How do I cancel my subscription?',
];

export default function HelpCenterPage() {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    if (!query.trim()) return CATEGORIES;
    const q = query.toLowerCase();
    return CATEGORIES.filter((c) =>
      c.title.toLowerCase().includes(q) ||
      c.body.toLowerCase().includes(q) ||
      c.id.includes(q)
    );
  }, [query]);

  return (
    <MarketingLayout>
      <Meta
        title="Help Center"
        description="Setup guides, troubleshooting steps, FAQs, and answers to common questions about using Social Stats."
      />
      {/* Hero with search */}
      <section style={{ padding: '128px 32px 56px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0,
            background: 'var(--brand-mesh)',
            opacity: 0.30, filter: 'blur(80px) saturate(140%)',
          }}
        />
        <div style={{ position: 'relative', maxWidth: 720, margin: '0 auto' }}>
          <Badge variant="brand" size="md" icon={BookOpen}>Help Center</Badge>
          <h1 style={{
            margin: '20px 0 16px',
            fontSize: 'clamp(36px, 4.4vw, 48px)',
            lineHeight: 1.05,
            letterSpacing: '-0.025em',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}>
            How can we help?
          </h1>
          <p style={{ margin: '0 auto 28px', maxWidth: 560, fontSize: 16, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
            Search articles, guides, and troubleshooting steps — or browse by category.
          </p>

          <div style={{ maxWidth: 540, margin: '0 auto' }}>
            <Input
              size="lg"
              type="search"
              placeholder="Search articles, guides, error codes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              prefix={<Search size={16} />}
            />
          </div>

          {/* Popular searches */}
          <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', alignSelf: 'center' }}>Popular:</span>
            {POPULAR.slice(0, 3).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setQuery(t)}
                style={{
                  padding: '4px 12px',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  background: 'var(--surface-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-pill)',
                  cursor: 'pointer',
                  minHeight: 'auto', minWidth: 'auto',
                  fontFamily: 'inherit',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Category grid */}
      <section style={{ padding: '32px 32px 64px' }}>
        <div style={{ maxWidth: 'var(--container-xl)', margin: '0 auto' }}>
          <h2 style={{ margin: '0 0 24px', fontSize: 14, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
            Browse by category
          </h2>

          {filtered.length === 0 ? (
            <div
              style={{
                padding: 40,
                textAlign: 'center',
                background: 'var(--surface-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-xl)',
                color: 'var(--text-secondary)',
              }}
            >
              No categories match "{query}". Try a different search or{' '}
              <Link to="/contact" style={{ color: 'var(--text-link)', fontWeight: 500 }}>contact support</Link>.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: 16,
              }}
              className="help-grid"
            >
              {filtered.map((c) => (
                <Link
                  key={c.id}
                  to={`/help/${c.id}`}
                  style={{
                    display: 'flex', flexDirection: 'column',
                    padding: 24,
                    background: 'var(--surface-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-xl)',
                    boxShadow: 'var(--shadow-xs)',
                    textDecoration: 'none',
                    transition: 'var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-xs)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                >
                  <span style={{
                    display: 'inline-flex',
                    width: 36, height: 36,
                    borderRadius: 'var(--radius-md)',
                    background: c.color, color: '#fff',
                    alignItems: 'center', justifyContent: 'center',
                    marginBottom: 14,
                  }}>
                    <c.icon size={16} strokeWidth={2.2} />
                  </span>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{c.title}</div>
                  <p style={{ margin: '4px 0 12px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1 }}>
                    {c.body}
                  </p>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>{c.count} articles</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-link)', fontWeight: 600 }}>
                      Browse <ArrowRight size={12} />
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}

          <style>{`
            @media (max-width: 980px) { .help-grid { grid-template-columns: 1fr 1fr !important; } }
            @media (max-width: 560px) { .help-grid { grid-template-columns: 1fr !important; } }
          `}</style>
        </div>
      </section>

      {/* Still need help band */}
      <section style={{ padding: '64px 32px 120px' }}>
        <div
          style={{
            maxWidth: 720, margin: '0 auto',
            padding: 32,
            display: 'flex', gap: 20, alignItems: 'center',
            background: 'var(--surface-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-2xl)',
            boxShadow: 'var(--shadow-sm)',
          }}
          className="help-cta"
        >
          <span
            style={{
              flexShrink: 0,
              width: 48, height: 48,
              borderRadius: 'var(--radius-lg)',
              background: 'var(--brand-primary-soft)',
              color: 'var(--brand-primary-hover)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <MessageCircle size={22} strokeWidth={1.8} />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>
              Still need help?
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Our support team replies within one business day. Faster on Growth + Enterprise plans.
            </div>
          </div>
          <Button as={Link} to="/contact" size="md" iconRight={ArrowRight}>
            Contact support
          </Button>
          <style>{`
            @media (max-width: 640px) { .help-cta { flex-direction: column !important; align-items: flex-start !important; text-align: left; } }
          `}</style>
        </div>
      </section>
    </MarketingLayout>
  );
}
