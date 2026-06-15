/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Wrench, RefreshCw, Activity, Mail } from 'lucide-react';

import Logo from '../components/ui/Logo';
import Button from '../components/ui/Button';

/**
 * MaintenancePage — full-screen, no MarketingLayout chrome.
 *
 * Pass `expectedReturn` (Date or ISO string) to render a live countdown.
 * Auto-refreshes every 60s while open so visitors don't have to.
 */
export default function MaintenancePage({ expectedReturn }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    const refresh = setInterval(() => window.location.reload(), 60_000);
    return () => { clearInterval(tick); clearInterval(refresh); };
  }, []);

  const target = expectedReturn ? new Date(expectedReturn) : null;
  const remaining = target ? Math.max(0, target.getTime() - now.getTime()) : null;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--surface-page)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0,
          background: 'var(--brand-mesh)',
          opacity: 0.30, filter: 'blur(80px) saturate(140%)',
        }}
      />

      <div style={{ position: 'relative', textAlign: 'center', maxWidth: 480, width: '100%' }}>
        <div style={{ marginBottom: 32 }}>
          <Logo variant="horizontal" height={32} />
        </div>

        <motion.div
          aria-hidden
          initial={{ rotate: -8 }}
          animate={{ rotate: 8 }}
          transition={{ duration: 1.4, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' }}
          style={{
            width: 72, height: 72,
            margin: '0 auto 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 'var(--radius-2xl)',
            background: 'var(--brand-primary-soft)',
            color: 'var(--brand-primary-hover)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <Wrench size={32} strokeWidth={1.8} />
        </motion.div>

        <h1 style={{
          margin: 0,
          fontSize: 'clamp(28px, 4vw, 40px)',
          fontWeight: 600,
          letterSpacing: '-0.025em',
          color: 'var(--text-primary)',
        }}>
          We're upgrading Social Stats.
        </h1>
        <p style={{ margin: '12px auto 24px', maxWidth: 380, fontSize: 15, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
          We're making things faster and smoother. Sit tight — we'll be back shortly.
        </p>

        {remaining != null && (
          <div
            style={{
              display: 'inline-flex',
              gap: 12,
              padding: '14px 20px',
              background: 'var(--surface-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-sm)',
              marginBottom: 24,
            }}
          >
            <Countdown ms={remaining} label="Min" unit={60_000} />
            <span style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-quaternary)' }}>:</span>
            <Countdown ms={remaining} label="Sec" unit={1_000} mod={60} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button onClick={() => window.location.reload()} size="md" icon={RefreshCw}>Refresh</Button>
          <Button as="a" href="/status" variant="secondary" size="md" icon={Activity}>Check status</Button>
          <Button as="a" href="mailto:hello@socialstats.app" variant="ghost" size="md" icon={Mail}>Email us</Button>
        </div>

        <p style={{ marginTop: 24, fontSize: 12, color: 'var(--text-tertiary)' }}>
          This page auto-refreshes every minute.
        </p>
      </div>
    </div>
  );
}

function Countdown({ ms, label, unit, mod }) {
  let value = Math.floor(ms / unit);
  if (typeof mod === 'number') value = value % mod;
  const display = String(Math.max(0, value)).padStart(2, '0');
  return (
    <div style={{ minWidth: 60 }}>
      <div style={{
        fontSize: 32, fontWeight: 600,
        letterSpacing: '-0.02em',
        color: 'var(--text-primary)',
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.05,
      }}>
        {display}
      </div>
      <div style={{
        fontSize: 10, fontWeight: 600,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        color: 'var(--text-tertiary)',
        marginTop: 2,
      }}>
        {label}
      </div>
    </div>
  );
}
