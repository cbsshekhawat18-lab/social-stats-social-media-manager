/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { Component } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, RefreshCw, Activity, MessageCircle } from 'lucide-react';

import Button from './Button';

/**
 * App-level error boundary. Catches render errors in any descendant and
 * shows a friendly fallback that mirrors the /500 page — without
 * navigating away. Reload + Go-to-status + Report links always work.
 *
 * Wrap once at the top of the tree (App.js).
 *
 * Props:
 *   children — the tree to guard
 *   onError  — optional callback (logs to Sentry / etc.)
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null, ref: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    // Generate a short reference id so support can correlate
    const ref = Date.now().toString(36).toUpperCase();
    this.setState({ errorInfo, ref });
    if (typeof this.props.onError === 'function') {
      try { this.props.onError(error, errorInfo, ref); } catch {}
    }
    // Useful in development; harmless in prod (the bundler may strip)
    if (typeof console !== 'undefined') console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleReload = () => {
    try { window.location.reload(); } catch {}
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 24px',
          background: 'var(--surface-page)',
          color: 'var(--text-primary)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(at center, rgba(239,68,68,0.10), transparent 60%)',
            filter: 'blur(80px)',
          }}
        />
        <div style={{ position: 'relative', maxWidth: 520, textAlign: 'center' }}>
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
            Render error
          </div>
          <h1 style={{
            margin: 0,
            fontSize: 'clamp(24px, 3vw, 32px)',
            fontWeight: 600,
            letterSpacing: '-0.025em',
          }}>
            Something went wrong on this page.
          </h1>
          <p style={{
            margin: '12px auto 24px',
            maxWidth: 440,
            fontSize: 15, lineHeight: 1.65,
            color: 'var(--text-secondary)',
          }}>
            A problem broke this view. The rest of the app is still fine — try reloading.
            If the issue keeps happening, our status page will tell you if it's something on our end.
          </p>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button onClick={this.handleReload} size="lg" icon={RefreshCw}>Reload</Button>
            <Button as={Link} to="/status"  variant="secondary" size="lg" icon={Activity}>Check status</Button>
            <Button as={Link} to="/contact" variant="ghost" size="lg" icon={MessageCircle}>Report it</Button>
          </div>

          {this.state.ref && (
            <p style={{ marginTop: 28, fontSize: 12, color: 'var(--text-tertiary)' }}>
              Reference ID: <span style={{ fontFamily: 'var(--font-mono)' }}>{this.state.ref}</span>
            </p>
          )}

          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details
              style={{
                marginTop: 24, textAlign: 'left',
                padding: 16,
                background: 'var(--surface-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-secondary)',
                maxWidth: 720,
                margin: '24px auto 0',
              }}
            >
              <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--text-primary)' }}>
                Stack trace (dev only)
              </summary>
              <pre style={{ marginTop: 12, whiteSpace: 'pre-wrap', overflow: 'auto' }}>
                {String(this.state.error?.stack || this.state.error)}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}
