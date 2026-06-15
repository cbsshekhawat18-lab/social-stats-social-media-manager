/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useState } from 'react';
import LegalPageLayout from '../components/marketing/LegalPageLayout';
import Switch from '../components/ui/Switch';
import Button from '../components/ui/Button';
import toast from '../components/ui/toast';

const CATEGORIES = [
  {
    id: 'essential',
    name: 'Essential',
    required: true,
    description:
      'Required for the site to function — auth tokens, session state, CSRF protection. Cannot be disabled.',
  },
  {
    id: 'functional',
    name: 'Functional',
    required: false,
    description:
      'Remember preferences like theme, language, and recently-viewed clients. Improve your experience.',
  },
  {
    id: 'analytics',
    name: 'Analytics',
    required: false,
    description:
      'Aggregate usage metrics that help us understand which features are useful (Plausible, no third-party trackers).',
  },
  {
    id: 'marketing',
    name: 'Marketing',
    required: false,
    description:
      'Conversion attribution from ads + retargeting pixels. We do not sell your data.',
  },
];

export default function CookiePolicyPage() {
  const [prefs, setPrefs] = useState({
    essential: true,
    functional: true,
    analytics: true,
    marketing: false,
  });

  function toggle(id) {
    if (CATEGORIES.find((c) => c.id === id)?.required) return;
    setPrefs((p) => ({ ...p, [id]: !p[id] }));
  }

  function savePrefs() {
    try {
      localStorage.setItem('socialstats_cookie_prefs', JSON.stringify(prefs));
      toast.success('Cookie preferences saved');
    } catch {
      toast.error('Could not save preferences. Try again.');
    }
  }

  return (
    <LegalPageLayout
      eyebrow="Cookies"
      title="Cookie Policy"
      effectiveDate="2026-01-01"
      lastUpdated="2026-04-15"
      intro="We use cookies (and similar technologies) to keep you signed in, remember your preferences, and learn what's working. This page explains exactly what we use and lets you choose."
      sections={[
        {
          id: 'what-are-cookies',
          title: '1. What are cookies?',
          body: (
            <p>
              Cookies are small files that websites store on your device. They let us remember things across page
              loads — like your sign-in state — and they give us aggregate signal about which features get used.
            </p>
          ),
        },
        {
          id: 'categories',
          title: '2. Categories we use',
          body: (
            <>
              <p>We group cookies into four categories. Toggle the optional ones below.</p>
              <CategoryTable categories={CATEGORIES} prefs={prefs} onToggle={toggle} />
              <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button onClick={savePrefs} size="md">Save preferences</Button>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setPrefs({ essential: true, functional: true, analytics: true, marketing: true })}
                >
                  Accept all
                </Button>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setPrefs({ essential: true, functional: false, analytics: false, marketing: false })}
                >
                  Reject optional
                </Button>
              </div>
            </>
          ),
        },
        {
          id: 'third-party',
          title: '3. Third-party cookies',
          body: (
            <>
              <p>
                We deliberately keep third-party cookies to a minimum. The ones we do use:
              </p>
              <ul>
                <li><strong>Razorpay</strong> — payment processing (essential, only on billing pages).</li>
                <li><strong>Plausible Analytics</strong> — privacy-friendly aggregate analytics (no personal data, no cross-site tracking).</li>
                <li><strong>Sentry</strong> — error reporting (essential, no personal content).</li>
              </ul>
            </>
          ),
        },
        {
          id: 'opt-out',
          title: '4. How to opt out',
          body: (
            <p>
              Toggle categories above and click <strong>Save preferences</strong>. Your choices are stored locally
              and respected on every visit. You can also block cookies entirely via your browser settings — note
              that doing so will prevent you from signing in.
            </p>
          ),
        },
        {
          id: 'changes',
          title: '5. Changes to this policy',
          body: (
            <p>
              We'll update this page if our cookie usage changes, and we'll alert returning users with a banner.
              Material changes are emailed to account owners 30 days in advance.
            </p>
          ),
        },
        {
          id: 'contact',
          title: '6. Contact',
          body: (
            <p>
              Questions? Email <a href="mailto:privacy@socialstats.app">privacy@socialstats.app</a> or visit our{' '}
              <a href="/privacy">privacy policy</a>.
            </p>
          ),
        },
      ]}
    />
  );
}

function CategoryTable({ categories, prefs, onToggle }) {
  return (
    <div
      style={{
        marginTop: 12,
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}
    >
      {categories.map((c, i) => (
        <div
          key={c.id}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            padding: '16px 18px',
            borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none',
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</span>
              {c.required && (
                <span
                  style={{
                    fontSize: 10, fontWeight: 600,
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                    color: 'var(--text-tertiary)',
                    padding: '2px 6px',
                    background: 'var(--surface-sunken)',
                    borderRadius: 'var(--radius-pill)',
                  }}
                >
                  Always on
                </span>
              )}
            </div>
            <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              {c.description}
            </div>
          </div>
          <Switch
            checked={!!prefs[c.id]}
            disabled={c.required}
            onChange={() => onToggle(c.id)}
            aria-label={`Toggle ${c.name} cookies`}
          />
        </div>
      ))}
    </div>
  );
}
