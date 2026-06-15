/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useState } from 'react';
import { Rocket, Target, BarChart2, Wand2, Mail, CheckCircle2 } from 'lucide-react';

import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import api from '../../services/api';

export default function AdsComingSoon() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function notify() {
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/notify-ads/', { email });
      setSubmitted(true);
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not save your email. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ paddingBottom: 32 }}>
      <PageHeader title="Ads" subtitle="Cross-channel ad management" />

      <div style={{
        padding: '32px 24px 60px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      }}>
        {/* Animated rocket */}
        <div
          aria-hidden
          style={{
            width: 88, height: 88,
            borderRadius: 'var(--radius-xl)',
            background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-primary-hover))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 28px var(--brand-primary-glow)',
            marginBottom: 24,
            animation: 'ds-rocket-bounce 2.4s ease-in-out infinite',
          }}
        >
          <Rocket size={40} color="#fff" strokeWidth={1.8} />
        </div>

        <h2 style={{
          margin: 0,
          fontSize: 26, fontWeight: 600,
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
        }}>
          Ads management is coming soon
        </h2>
        <p style={{
          marginTop: 12, marginBottom: 28,
          maxWidth: 540,
          fontSize: 14, lineHeight: 1.6,
          color: 'var(--text-secondary)',
        }}>
          Run Meta and Google ad campaigns alongside your social analytics and
          WhatsApp outreach. All in one place. Get notified when it ships.
        </p>

        {/* Signup */}
        {submitted ? (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 16px',
            background: 'var(--success-bg)', color: 'var(--success)',
            borderRadius: 'var(--radius-pill)',
            fontSize: 13, fontWeight: 600,
          }}>
            <CheckCircle2 size={14} /> You're on the list — we'll email you when it's ready.
          </div>
        ) : (
          <Card padding="sm" style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: 6,
            maxWidth: 460, width: '100%',
          }}>
            <Mail size={16} color="var(--text-tertiary)" style={{ marginLeft: 8 }} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && notify()}
              placeholder="you@company.com"
              style={{
                flex: 1, padding: '10px 6px',
                background: 'transparent', border: 'none', outline: 'none',
                fontSize: 14, color: 'var(--text-primary)',
                minHeight: 'unset',
              }}
            />
            <Button onClick={notify} loading={submitting}>
              Notify me
            </Button>
          </Card>
        )}
        {error && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--danger)' }}>{error}</div>
        )}

        {/* Feature previews */}
        <div style={{
          marginTop: 56,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          maxWidth: 800, width: '100%',
        }}>
          <FeatureCard
            icon={Target}
            title="Audience Builder"
            body="Create lookalike audiences from your contact lists and post engagement."
          />
          <FeatureCard
            icon={BarChart2}
            title="Cross-channel Reports"
            body="Combine social analytics with paid ad spend to see true ROI."
          />
          <FeatureCard
            icon={Wand2}
            title="Auto-optimization"
            body="AI-powered budget shifts to your best-performing creative, daily."
          />
        </div>
      </div>

      <style>{`
        @keyframes ds-rocket-bounce {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, body }) {
  return (
    <Card padding="md" style={{ textAlign: 'left' }}>
      <div style={{
        width: 32, height: 32,
        borderRadius: 'var(--radius-sm)',
        background: 'var(--surface-sunken)',
        color: 'var(--text-secondary)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 12,
      }}>
        <Icon size={16} strokeWidth={2} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        {body}
      </div>
    </Card>
  );
}
