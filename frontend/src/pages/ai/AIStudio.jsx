/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * AIStudio — central hub for every AI feature in Social Stats.
 *
 * Card grid linking to:
 *   - Brand Voice
 *   - AI Insights
 *   - AI Chat history
 *   - Caption Writer (existing)
 *   - Post Ideas (existing)
 *   - Hashtag Research (existing)
 *   - AI Usage (admin only)
 *
 * Each card has a "Try" button + a one-line description.
 */
import { Link } from 'react-router-dom';
import {
  Sparkles, Mic, BarChart3, MessageSquare, Wand2, Lightbulb, Hash,
  Inbox, Activity, ArrowRight, Image, Video, AlertTriangle,
} from 'lucide-react';

import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import { useAuth } from '../../hooks/useAuth';

const FEATURE_GROUPS = [
  {
    label: 'Create',
    items: [
      { id: 'compose',      title: 'Smart Composer',   icon: Wand2,        body: 'Generate platform-tailored posts in seconds.', to: '/composer',        accent: 'var(--brand-primary)' },
      { id: 'caption',      title: 'Caption Writer',   icon: Wand2,        body: 'Generate captions across platforms.',          to: '/caption-writer',  accent: 'var(--module-ai)' },
      { id: 'post-ideas',   title: 'Post Ideas',       icon: Lightbulb,    body: 'AI-built monthly content calendar.',           to: '/post-ideas',      accent: '#f59e0b' },
      { id: 'hashtags',     title: 'Hashtag Research', icon: Hash,         body: 'Research hashtags with reach + competition.',   to: '/hashtags',        accent: '#10b981' },
    ],
  },
  {
    label: 'Engage',
    items: [
      { id: 'inbox',        title: 'AI Reply Suggestions', icon: Inbox,    body: 'Three-tone reply candidates for any message.', to: '/inbox',     accent: '#0891b2' },
    ],
  },
  {
    label: 'Understand',
    items: [
      { id: 'insights',     title: 'AI Insights',          icon: BarChart3, body: 'Actionable insights from your data.',         to: '/insights',     accent: 'var(--brand-primary)' },
      { id: 'brand-voice',  title: 'Brand Voice',          icon: Mic,       body: 'Train Social Stats on your past posts.',            to: '/brand-voice',  accent: '#8b5cf6' },
    ],
  },
  {
    label: 'Chat',
    items: [
      { id: 'chat-history', title: 'Chat History',         icon: MessageSquare, body: 'Past conversations with Social Stats.',     to: '/chat-history', accent: 'var(--brand-primary-hover)' },
    ],
  },
];

const ADMIN_ITEMS = [
  { id: 'ai-usage', title: 'AI Usage', icon: Activity, body: 'Cost dashboards, per-client + per-user breakdown.', to: '/ai-usage', accent: 'var(--warning)' },
];


export default function AIStudio() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'superadmin' || user?.role === 'staff';
  const basePath = isAdmin ? '/admin/analytics' : '/dashboard/analytics';

  return (
    <div className="app-page app-page--lg">
      <PageHeader
        title="Social Stats Studio"
        subtitle="Every Social Stats surface in one place"
        eyebrow="✨ Powered by Social Stats"
      />

      {FEATURE_GROUPS.map((group) => (
        <section key={group.label} style={{ marginBottom: 24 }}>
          <h2 style={sectionLabelStyle}>{group.label}</h2>
          <div style={gridStyle} className="ai-studio-grid">
            {group.items.map((it) => (
              <FeatureCard key={it.id} item={it} basePath={basePath} />
            ))}
          </div>
        </section>
      ))}

      {isAdmin && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={sectionLabelStyle}>Admin</h2>
          <div style={gridStyle} className="ai-studio-grid">
            {ADMIN_ITEMS.map((it) => (
              <FeatureCard key={it.id} item={it} basePath={basePath} />
            ))}
          </div>
        </section>
      )}

      <Card padding="md" style={{ marginTop: 28 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            width: 38, height: 38,
            background: 'var(--brand-gradient)',
            borderRadius: 'var(--radius-md)',
            color: '#fff',
          }}>
            <Sparkles size={18} strokeWidth={2.4} />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              Press <kbd style={kbdStyle}>⌘ J</kbd> from anywhere to chat with Social Stats
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              The chat assistant can pull your metrics, draft posts, search your inbox, and schedule actions —
              all with confirmation gates on anything that touches live data.
            </p>
          </div>
        </div>
      </Card>

      <style>{`
        @media (max-width: 980px) { .ai-studio-grid { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 560px) { .ai-studio-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}


function FeatureCard({ item, basePath }) {
  const Icon = item.icon;
  return (
    <Link
      to={`${basePath}${item.to}`}
      style={{
        display: 'flex', flexDirection: 'column',
        padding: 18,
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-xs)',
        textDecoration: 'none',
        transition: 'var(--transition-fast)',
        gap: 8,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
        e.currentTarget.style.borderColor = 'var(--border-default)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'var(--shadow-xs)';
        e.currentTarget.style.borderColor = 'var(--border-subtle)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36,
          background: item.accent, color: '#fff',
          borderRadius: 'var(--radius-md)',
        }}>
          <Icon size={16} strokeWidth={2.2} />
        </span>
        <ArrowRight size={14} style={{ color: 'var(--text-tertiary)' }} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
        {item.title}
      </div>
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
        {item.body}
      </p>
    </Link>
  );
}


const sectionLabelStyle = {
  margin: '0 0 12px',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text-tertiary)',
};

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 14,
};

const kbdStyle = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  padding: '0 6px', minWidth: 22, height: 20,
  background: 'var(--surface-sunken)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-xs)',
  fontSize: 11, fontWeight: 600,
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-secondary)',
  lineHeight: 1,
  margin: '0 2px',
};
