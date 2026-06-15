/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

import Logo from '../ui/Logo';
import ThemeToggle from '../ui/ThemeToggle';
import SkipLink from '../ui/SkipLink';

/**
 * AuthLayout — split-screen wrapper for every auth page.
 *
 *   ┌──────────────────────────────┬─────────────────────────────┐
 *   │  HERO PANEL (mesh gradient)  │  FORM PANEL                 │
 *   │  - Social Stats logo top-left      │  - Centered card             │
 *   │  - Eyebrow + headline        │  - children                 │
 *   │  - Rotating testimonials     │  - Footer link slot         │
 *   │  - Stat strip                │                             │
 *   └──────────────────────────────┴─────────────────────────────┘
 *
 * Mobile (<880px): single column, no hero. The card grows to fit.
 *
 * Props:
 *   children         — form panel content (typically a single <Card>-like form)
 *   eyebrow          — small uppercase tag at top of hero copy (default "Marketing OS")
 *   heroTitle        — large hero headline
 *   heroSub          — supporting paragraph
 *   testimonials     — [{ quote, name, role }]; rotates every 8s
 *   stats            — [{ value, label }]; small horizontal strip
 *   footer           — optional ReactNode rendered under the form card (e.g. "Don't have an account?")
 */
// Customer testimonials and live customer counts will appear here as we
// onboard the first wave of teams. Until then, we lead with what the product
// actually does, not who uses it.
const DEFAULT_TESTIMONIALS = [];

const DEFAULT_STATS = [
  { value: '5',    label: 'Platforms' },
  { value: 'AI',   label: 'Native' },
  { value: '24/7', label: 'Uptime target' },
];

export default function AuthLayout({
  children,
  eyebrow = 'Marketing OS',
  heroTitle = 'The marketing OS for modern agencies.',
  heroSub = 'Manage analytics, messaging, and ads for every client — from one beautiful dashboard.',
  testimonials = DEFAULT_TESTIMONIALS,
  stats = DEFAULT_STATS,
  footer,
}) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window === 'undefined' ? false : window.innerWidth < 880
  );
  const [tIndex, setTIndex] = useState(0);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 880);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (testimonials.length < 2) return;
    const id = setInterval(() => setTIndex((i) => (i + 1) % testimonials.length), 8000);
    return () => clearInterval(id);
  }, [testimonials.length]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1.05fr 0.95fr',
        background: 'var(--surface-page)',
        color: 'var(--text-primary)',
      }}
    >
      <SkipLink targetId="auth-form" />

      {/* ─── Hero panel ────────────────────────────────────── */}
      {!isMobile && (
        <aside
          style={{
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '40px 56px 48px',
            background: 'var(--surface-card)',
            borderRight: '1px solid var(--border-subtle)',
          }}
        >
          {/* Mesh gradient bg */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              background: 'var(--brand-mesh)',
              opacity: 0.55,
              filter: 'blur(60px) saturate(140%)',
              animation: 'auth-mesh-drift 24s var(--ease-in-out) infinite',
            }}
          />
          {/* Subtle grid overlay */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `
                linear-gradient(var(--border-subtle) 1px, transparent 1px),
                linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px)
              `,
              backgroundSize: '56px 56px',
              maskImage: 'radial-gradient(at center, rgba(0,0,0,0.6), transparent 70%)',
              WebkitMaskImage: 'radial-gradient(at center, rgba(0,0,0,0.6), transparent 70%)',
              opacity: 0.6,
            }}
          />

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link to="/" style={{ display: 'inline-flex' }}>
              <Logo variant="horizontal" height={32} />
            </Link>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--brand-primary-hover)',
                background: 'var(--brand-primary-soft)',
                border: '1px solid var(--brand-primary-glow)',
                borderRadius: 'var(--radius-pill)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <Sparkles size={11} strokeWidth={2.4} />
              {eyebrow}
            </div>
          </div>

          <div style={{ position: 'relative', maxWidth: 540 }}>
            <h1
              style={{
                margin: '0 0 16px',
                fontSize: 'clamp(36px, 4.4vw, 56px)',
                lineHeight: 1.05,
                letterSpacing: '-0.03em',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              {heroTitle}
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: 16,
                color: 'var(--text-secondary)',
                lineHeight: 1.65,
                maxWidth: 480,
              }}
            >
              {heroSub}
            </p>

            {/* Rotating testimonial */}
            {testimonials.length > 0 && (
              <div
                style={{
                  marginTop: 36,
                  padding: 20,
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--surface-glass)',
                  backdropFilter: 'blur(14px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(14px) saturate(180%)',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: 'var(--shadow-md)',
                  position: 'relative',
                  minHeight: 140,
                }}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={tIndex}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <blockquote
                      style={{
                        margin: 0,
                        fontSize: 14,
                        lineHeight: 1.6,
                        color: 'var(--text-primary)',
                        fontStyle: 'normal',
                      }}
                    >
                      "{testimonials[tIndex].quote}"
                    </blockquote>
                    <footer style={{ marginTop: 10, fontSize: 12, color: 'var(--text-tertiary)' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {testimonials[tIndex].name}
                      </span>
                      {' · '}
                      {testimonials[tIndex].role}
                    </footer>
                  </motion.div>
                </AnimatePresence>

                {testimonials.length > 1 && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 14 }}>
                    {testimonials.map((_, i) => (
                      <button
                        type="button"
                        key={i}
                        aria-label={`Show testimonial ${i + 1}`}
                        onClick={() => setTIndex(i)}
                        style={{
                          width: i === tIndex ? 18 : 6,
                          height: 6,
                          padding: 0,
                          minHeight: 'auto',
                          minWidth: 'auto',
                          borderRadius: 999,
                          border: 'none',
                          background: i === tIndex ? 'var(--brand-primary)' : 'var(--border-strong)',
                          transition: 'var(--transition-default)',
                          cursor: 'pointer',
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Stat strip */}
          {stats.length > 0 && (
            <div
              style={{
                position: 'relative',
                display: 'grid',
                gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))`,
                gap: 16,
                paddingTop: 24,
                borderTop: '1px solid var(--border-subtle)',
                maxWidth: 540,
              }}
            >
              {stats.map((s) => (
                <div key={s.label}>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 600,
                      letterSpacing: '-0.02em',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {s.value}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--text-tertiary)',
                      marginTop: 2,
                    }}
                  >
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          )}

          <style>{`
            @keyframes auth-mesh-drift {
              0%   { transform: translate(0%,   0%)   scale(1.05); }
              33%  { transform: translate(2%,   1.5%) scale(1.08); }
              66%  { transform: translate(-1.5%,2%)   scale(1.05); }
              100% { transform: translate(0%,   0%)   scale(1.05); }
            }
          `}</style>
        </aside>
      )}

      {/* ─── Form panel ────────────────────────────────────── */}
      <main
        id="auth-form"
        tabIndex={-1}
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: isMobile ? '32px 20px 48px' : '48px 56px',
          background: 'var(--surface-page)',
          outline: 'none',
        }}
      >
        {/* Mobile-only top bar with logo + theme toggle */}
        {isMobile && (
          <header
            style={{
              width: '100%',
              maxWidth: 460,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 28,
            }}
          >
            <Link to="/" style={{ display: 'inline-flex' }}>
              <Logo variant="horizontal" height={28} />
            </Link>
            <ThemeToggle size="sm" />
          </header>
        )}

        {/* Desktop-only theme toggle pinned top-right */}
        {!isMobile && (
          <div style={{ position: 'absolute', top: 24, right: 32 }}>
            <ThemeToggle size="sm" />
          </div>
        )}

        <div style={{ width: '100%', maxWidth: 420 }}>
          {children}

          {footer && (
            <div
              style={{
                marginTop: 24,
                textAlign: 'center',
                fontSize: 13,
                color: 'var(--text-secondary)',
              }}
            >
              {footer}
            </div>
          )}

          {/* Bottom legal row */}
          <div
            style={{
              marginTop: 32,
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 14,
              fontSize: 11,
              color: 'var(--text-tertiary)',
            }}
          >
            <Link to="/privacy" style={legalLinkStyle}>Privacy</Link>
            <Link to="/terms"   style={legalLinkStyle}>Terms</Link>
            <a href="mailto:support@socialstats.app" style={legalLinkStyle}>Support</a>
          </div>
        </div>
      </main>
    </div>
  );
}

const legalLinkStyle = {
  color: 'var(--text-tertiary)',
  textDecoration: 'none',
  transition: 'var(--transition-fast)',
};
