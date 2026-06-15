/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

import Button from '../ui/Button';
import MeshGradient from './MeshGradient';

/**
 * CTASection — reusable bottom-of-page CTA with mesh gradient backdrop.
 *
 *   <CTASection
 *     title="Ready to upgrade your marketing?"
 *     subtitle="Start free in 2 minutes — no credit card required."
 *     primary={{ to: '/signup', label: 'Start free' }}
 *     secondary={{ to: '/contact', label: 'Talk to sales' }}
 *     showEmail
 *   />
 *
 * `showEmail` renders an email input → /signup deep-link with the email
 * pre-filled (sign-up wizard reads the query param).
 */
export default function CTASection({
  title = 'Ready to upgrade your marketing?',
  subtitle = 'Start free in 2 minutes — no credit card required.',
  primary = { to: '/signup', label: 'Start free' },
  secondary = null,
  showEmail = false,
  microCopy = 'No credit card · Free forever · Setup in 2 minutes',
  variant = 'cta',
}) {
  return (
    <section style={{
      position: 'relative',
      padding: '80px 24px',
      overflow: 'hidden',
      borderRadius: 'var(--radius-xl)',
      margin: '0 auto',
      maxWidth: 'calc(var(--container-2xl) - 64px)',
    }}>
      <MeshGradient variant={variant} />
      <div style={{
        position: 'relative',
        textAlign: 'center',
        maxWidth: 680,
        margin: '0 auto',
        color: '#fff',
      }}>
        <h2 style={{
          margin: 0,
          fontSize: 'clamp(28px, 4vw, 44px)',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: '#fff',
          lineHeight: 1.15,
        }}>{title}</h2>
        {subtitle && (
          <p style={{
            margin: '14px auto 0',
            fontSize: 'clamp(15px, 1.6vw, 17px)',
            color: 'rgba(255,255,255,0.75)',
            lineHeight: 1.55,
            maxWidth: 540,
          }}>{subtitle}</p>
        )}

        {showEmail && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const email = (fd.get('email') || '').toString().trim();
              if (!email) return;
              window.location.href = `/signup?email=${encodeURIComponent(email)}`;
            }}
            style={{
              marginTop: 28,
              display: 'flex', gap: 8,
              maxWidth: 480, marginInline: 'auto',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <input
              type="email" name="email" required
              placeholder="you@company.com"
              aria-label="Email"
              style={{
                flex: '1 1 220px', minWidth: 0,
                padding: '14px 16px',
                fontSize: 15,
                color: '#fff',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: 'var(--radius-md)',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
            <button
              type="submit"
              style={{
                padding: '14px 22px',
                fontSize: 15, fontWeight: 600,
                color: '#0a0e14',
                background: 'linear-gradient(135deg, #00CCF5, #00A8D8)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontFamily: 'inherit',
              }}
            >
              {primary.label} <ArrowRight size={15} />
            </button>
          </form>
        )}

        {!showEmail && (
          <div style={{
            marginTop: 28,
            display: 'flex', gap: 12,
            justifyContent: 'center', flexWrap: 'wrap',
          }}>
            <Button as={Link} to={primary.to} size="lg" variant="primary"
                    style={{
                      background: 'linear-gradient(135deg, #00CCF5, #00A8D8)',
                      color: '#0a0e14',
                      border: 'none',
                    }}>
              {primary.label} <ArrowRight size={15} />
            </Button>
            {secondary && (
              <Button as={Link} to={secondary.to} size="lg"
                      variant="ghost"
                      style={{
                        color: '#fff',
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.18)',
                      }}>
                {secondary.label}
              </Button>
            )}
          </div>
        )}

        {microCopy && (
          <p style={{
            margin: '18px 0 0',
            fontSize: 12, color: 'rgba(255,255,255,0.55)',
          }}>{microCopy}</p>
        )}
      </div>
    </section>
  );
}
