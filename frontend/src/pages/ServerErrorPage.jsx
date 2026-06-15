/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { Link } from 'react-router-dom';
import { AlertTriangle, RefreshCw, Activity, MessageCircle } from 'lucide-react';
import MarketingLayout from '../components/marketing/MarketingLayout';
import Button from '../components/ui/Button';
import Meta from '../components/Meta';

export default function ServerErrorPage() {
  return (
    <MarketingLayout>
      <Meta
        title="Server error"
        description="Something went wrong on our end. We've been notified and are looking into it."
      />
      <section
        style={{
          padding: '160px 32px 120px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
          minHeight: 'calc(100vh - 200px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(at center, rgba(239,68,68,0.12), transparent 60%)',
            filter: 'blur(80px)',
          }}
        />

        <div style={{ position: 'relative', maxWidth: 520, margin: '0 auto' }}>
          <div
            aria-hidden
            style={{
              width: 80, height: 80,
              margin: '0 auto 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 'var(--radius-2xl)',
              background: 'var(--danger-bg)',
              color: 'var(--danger)',
              border: '1px solid var(--danger)',
            }}
          >
            <AlertTriangle size={36} strokeWidth={1.8} />
          </div>

          <div style={{
            fontSize: 11, fontWeight: 700,
            letterSpacing: '0.10em', textTransform: 'uppercase',
            color: 'var(--danger)',
            marginBottom: 8,
          }}>
            Error 500
          </div>
          <h1 style={{
            margin: 0,
            fontSize: 'clamp(28px, 3.4vw, 36px)',
            fontWeight: 600,
            letterSpacing: '-0.025em',
            color: 'var(--text-primary)',
          }}>
            Something went wrong on our end.
          </h1>
          <p style={{ margin: '12px auto 24px', maxWidth: 440, fontSize: 15, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
            We've been notified and are looking into it. In most cases, refreshing the page resolves it.
            If it keeps happening, check our status page or get in touch.
          </p>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button onClick={() => window.location.reload()} size="lg" icon={RefreshCw}>Try again</Button>
            <Button as={Link} to="/status"  variant="secondary" size="lg" icon={Activity}>Check status</Button>
            <Button as={Link} to="/contact" variant="ghost" size="lg" icon={MessageCircle}>Report it</Button>
          </div>

          <p style={{ marginTop: 28, fontSize: 12, color: 'var(--text-tertiary)' }}>
            Reference ID: <span style={{ fontFamily: 'var(--font-mono)' }}>{Date.now().toString(36).toUpperCase()}</span>
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
}
