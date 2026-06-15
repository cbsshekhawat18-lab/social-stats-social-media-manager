/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, LineChart, FileText, FileType, CalendarDays, Wand2, Lightbulb, Hash,
  TrendingUp, AlertCircle, FolderSync,
  Inbox, Send, Users2, ListChecks, Settings, Webhook,
  Rocket, ChevronDown, Building2, Search,
  PenSquare, Layers, Images,
  Star, AtSign,
  Zap, Film,
  Bell, ShieldCheck, ClipboardCheck,
  Mic, Sparkles,
  Bot, MessageSquare, Megaphone, UserPlus,
} from 'lucide-react';

import PermissionGate from '../ui/PermissionGate';
import { useAuth } from '../../hooks/useAuth';
import { useClients } from '../../hooks/useData';
import { useBadgeCount } from '../../stores/appStore';

/**
 * 240px feature sidebar; nav set varies by `module`.
 *
 * Props:
 *   module:        'analytics' | 'messaging' | 'ads'
 *   basePath:      '/admin' | '/dashboard'
 *   isAdmin:       bool — when true, show client switcher pill at the bottom
 *   selectedClient + onSelectClient: client switcher state (admin only)
 */
export default function FeatureSidebar({
  module,
  basePath,
  isAdmin = false,
  selectedClient,
  onSelectClient,
}) {
  const location = useLocation();

  const navSet = NAV_SETS[module] || NAV_SETS.analytics;

  return (
    <aside
      className="ds-feature-sidebar"
      aria-label={`${module} navigation`}
      style={{
        position: 'fixed',
        top: 0, bottom: 0,
        left: 'var(--module-rail-width)',
        width: 'var(--feature-sidebar-width)',
        zIndex: 90,
        background: 'var(--surface-card)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Module header */}
      <header style={{
        height: 'var(--topbar-height)',
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{
          width: 28, height: 28,
          borderRadius: 'var(--radius-sm)',
          background: 'var(--brand-primary-glow)',
          color: 'var(--brand-primary-hover)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {navSet.icon && <navSet.icon size={15} strokeWidth={2.4} />}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            {navSet.label}
          </div>
          {navSet.subtitle && (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {navSet.subtitle}
            </div>
          )}
        </div>
      </header>

      {/* Nav */}
      <div className="sidebar-scroll" style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 10px',
      }}>
        {navSet.empty ? (
          <EmptyModule message={navSet.empty} />
        ) : (
          navSet.sections.map((section) => (
            <Section key={section.title} title={section.title}>
              {section.items.map((item) => (
                <PermissionGate key={item.path} code={item.permission}>
                  <NavItem
                    to={item.path.startsWith('/admin/') ? item.path : `${basePath}/${module}${item.path}`}
                    icon={item.icon}
                    label={item.label}
                    end={item.end}
                    badge={item.badge}
                    badgeKey={item.badgeKey}
                    pathname={location.pathname}
                    disabled={item.disabled}
                  />
                </PermissionGate>
              ))}
            </Section>
          ))
        )}
      </div>

      {/* Client switcher (admin only) */}
      {isAdmin && (
        <ClientSwitcher selected={selectedClient} onSelect={onSelectClient} />
      )}
    </aside>
  );
}

function NavItem({ to, icon: Icon, label, end, badge, badgeKey, pathname, disabled }) {
  const liveBadge = useBadgeCount(badgeKey || '__none__');
  const effectiveBadge = badge ?? (badgeKey ? liveBadge : 0);
  const isActive = end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);

  if (disabled) {
    return (
      <div style={{
        ...navItemBase,
        color: 'var(--text-tertiary)',
        cursor: 'not-allowed',
        opacity: 0.55,
      }}>
        <Icon size={16} strokeWidth={2} />
        <span style={{ flex: 1 }}>{label}</span>
      </div>
    );
  }

  return (
    <NavLink
      to={to}
      end={end}
      style={{
        ...navItemBase,
        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
        background: isActive ? 'var(--brand-primary-glow)' : 'transparent',
        boxShadow: isActive ? 'inset 2px 0 0 var(--brand-primary)' : 'none',
        fontWeight: isActive ? 600 : 500,
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.background = 'var(--surface-hover)';
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.background = 'transparent';
      }}
    >
      <Icon size={16} strokeWidth={2} />
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      {!!effectiveBadge && effectiveBadge > 0 && (
        <span style={{
          minWidth: 18, padding: '0 5px',
          background: 'var(--brand-primary-hover)', color: '#fff',
          fontSize: 10, fontWeight: 700, lineHeight: '16px', height: 16,
          borderRadius: 999, textAlign: 'center',
        }}>
          {effectiveBadge > 99 ? '99+' : effectiveBadge}
        </span>
      )}
    </NavLink>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        color: 'var(--text-tertiary)',
        padding: '6px 10px 8px',
      }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {children}
      </div>
    </div>
  );
}

function EmptyModule({ message }) {
  return (
    <div style={{
      padding: '40px 16px',
      textAlign: 'center',
      color: 'var(--text-tertiary)',
      fontSize: 12,
    }}>
      <Rocket size={28} strokeWidth={1.5} style={{ marginBottom: 8 }} />
      <div>{message}</div>
    </div>
  );
}

function ClientSwitcher({ selected, onSelect }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { clients } = useClients();

  const filtered = (clients || []).filter((c) =>
    !search || (c.company || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ borderTop: '1px solid var(--border-subtle)', padding: 10, position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          width: '100%', padding: '8px 10px',
          background: 'var(--surface-sunken)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          transition: 'var(--transition-fast)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface-sunken)'; }}
      >
        <Building2 size={14} color="var(--text-tertiary)" />
        <span style={{
          flex: 1, minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'left',
        }}>
          {selected?.company || 'All clients'}
        </span>
        <ChevronDown size={14} color="var(--text-tertiary)" />
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute', bottom: 'calc(100% + 4px)', left: 10, right: 10,
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            // Cap at 320px AND viewport-height-minus-rail so we never overflow
            // off the top of short viewports.
            maxHeight: 'min(320px, calc(100vh - 96px))',
            overflow: 'auto',
            zIndex: 110,
          }}
        >
          <div style={{
            padding: 8,
            borderBottom: '1px solid var(--border-subtle)',
            position: 'sticky', top: 0, background: 'var(--surface-elevated)',
          }}>
            <div style={{ position: 'relative' }}>
              <Search size={12} color="var(--text-tertiary)"
                      style={{ position: 'absolute', top: 9, left: 8 }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search clients…"
                style={{
                  width: '100%', padding: '6px 10px 6px 26px',
                  background: 'var(--surface-sunken)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 12, color: 'var(--text-primary)',
                  outline: 'none',
                }}
                autoFocus
              />
            </div>
          </div>
          <div style={{ padding: 4 }}>
            <SwitcherRow
              label="All clients"
              active={!selected}
              onClick={() => { onSelect?.(null); setOpen(false); }}
            />
            {filtered.map((c) => (
              <SwitcherRow
                key={c.id}
                label={c.company}
                active={selected?.id === c.id}
                onClick={() => {
                  onSelect?.(c);
                  setOpen(false);
                  navigate(`/admin/client/${c.id}`);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SwitcherRow({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="option"
      aria-selected={active}
      style={{
        display: 'block', width: '100%',
        textAlign: 'left',
        padding: '7px 10px',
        background: active ? 'var(--brand-primary-glow)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        fontSize: 12, fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        transition: 'var(--transition-fast)',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--surface-hover)'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      {label}
    </button>
  );
}

const navItemBase = {
  display: 'flex', alignItems: 'center', gap: 10,
  height: 36, padding: '0 12px',
  borderRadius: 'var(--radius-md)',
  fontSize: 13, fontWeight: 500,
  textDecoration: 'none',
  cursor: 'pointer',
  transition: 'var(--transition-fast)',
};

const NAV_SETS = {
  analytics: {
    label: 'Analytics',
    subtitle: 'Social performance',
    icon: LineChart,
    sections: [
      {
        title: 'Publish',
        items: [
          { label: 'Composer',      icon: PenSquare,   path: '/composer',  permission: 'composer.view' },
          { label: 'Calendar',      icon: CalendarDays, path: '/calendar', permission: 'calendar.view' },
          { label: 'Queues',        icon: Layers,      path: '/queues',    permission: 'composer.view' },
          { label: 'Media Library', icon: Images,      path: '/media',     permission: 'composer.view' },
          { label: 'Video Studio',  icon: Film,        path: '/video',     permission: 'video.view' },
        ],
      },
      {
        title: 'Engage',
        items: [
          { label: 'Inbox',       icon: Inbox, path: '/inbox',       permission: 'inbox.view',
            badgeKey: 'unread_inbox' },
          { label: 'Reviews',     icon: Star,  path: '/reviews',     permission: 'inbox.view' },
          { label: 'Automations', icon: Zap,   path: '/automations', permission: 'automations.view' },
        ],
      },
      {
        title: 'Overview',
        items: [
          { label: 'Dashboard',  icon: LayoutDashboard, path: '/dashboard',  end: true, permission: 'dashboard.view' },
          { label: 'Analytics',  icon: LineChart,       path: '/analytics',                permission: 'analytics.view' },
          { label: 'Reports',    icon: FileText,        path: '/reports',                  permission: 'reports.view' },
        ],
      },
      {
        title: 'Content',
        items: [
          { label: 'Posts',          icon: FileType,     path: '/posts',                  permission: 'dashboard.posts_table' },
          { label: 'Caption Writer', icon: Wand2,        path: '/caption-writer' },
          { label: 'Post Ideas',     icon: Lightbulb,    path: '/post-ideas' },
          { label: 'Hashtags',       icon: Hash,         path: '/hashtags' },
          { label: 'AI Studio',      icon: Sparkles,     path: '/ai-studio' },
          { label: 'Brand Voice',    icon: Mic,          path: '/brand-voice',  permission: 'ai.brand_voice' },
          { label: 'AI Insights',    icon: Sparkles,     path: '/insights' },
          { label: 'AI Audit',       icon: ShieldCheck,  path: '/ai-audit' },
        ],
      },
      {
        title: 'Performance',
        items: [
          { label: 'ROI Calculator', icon: TrendingUp,  path: '/roi',       permission: 'roi.view' },
          { label: 'Alerts',         icon: AlertCircle, path: '/alerts',    permission: 'alerts.view' },
          { label: 'Sync Logs',      icon: FolderSync,  path: '/synclogs' },
        ],
      },
      {
        title: 'Grow',
        items: [
          { label: 'Audience',    icon: Users2,     path: '/audience',    permission: 'audience.view' },
          { label: 'Competitors', icon: TrendingUp, path: '/competitors', permission: 'competitors.view' },
        ],
      },
      {
        title: 'Setup',
        items: [
          { label: 'Approvals',     icon: ClipboardCheck, path: '/approvals',     permission: 'composer.approve',
            badgeKey: 'pending_approvals' },
          { label: 'Notifications', icon: Bell,           path: '/notifications',
            badgeKey: 'unread_notifications' },
          { label: 'Audit Log',     icon: ShieldCheck,    path: '/audit-log',     permission: 'audit.view' },
        ],
      },
    ],
  },

  messaging: {
    label: 'Messaging',
    subtitle: 'WhatsApp & SMS',
    icon: Inbox,
    sections: [
      {
        title: 'Inbox',
        items: [
          { label: 'All conversations', icon: Inbox, path: '/inbox', permission: 'whatsapp.view_inbox' },
        ],
      },
      {
        title: 'Outreach',
        items: [
          { label: 'Campaigns', icon: Send,       path: '/campaigns', permission: 'whatsapp.manage_campaigns' },
          { label: 'Templates', icon: FileType,   path: '/templates', permission: 'whatsapp.manage_templates' },
          { label: 'Contacts',  icon: Users2,     path: '/contacts',  permission: 'whatsapp.manage_contacts' },
          { label: 'Lists',     icon: ListChecks, path: '/lists',     permission: 'whatsapp.manage_contacts' },
        ],
      },
      {
        title: 'Conversational AI',
        items: [
          { label: 'Bot Flows',     icon: Bot,            path: '/admin/bot-flows',     permission: 'bot.view' },
          { label: 'Conversations', icon: MessageSquare,  path: '/admin/conversations', permission: 'bot.view' },
          { label: 'Handoff Queue', icon: UserPlus,       path: '/admin/handoff',       permission: 'bot.view' },
          { label: 'Leads',         icon: Users2,         path: '/admin/leads',         permission: 'leads.view',
            badgeKey: 'new_leads' },
          { label: 'CTWA Campaigns', icon: Megaphone,     path: '/admin/ctwa',          permission: 'ctwa.view' },
          { label: 'Templates',     icon: Sparkles,       path: '/admin/bot-templates', permission: 'bot.view' },
          { label: 'Bot Safety',    icon: ShieldCheck,    path: '/admin/bot-settings', permission: 'bot.view' },
        ],
      },
      {
        title: 'Setup',
        items: [
          { label: 'Account',  icon: Settings, path: '/account',                                  permission: 'whatsapp.manage_account' },
          { label: 'Webhooks', icon: Webhook,  path: '/account#webhooks', disabled: true },
        ],
      },
    ],
  },

  ads: {
    label: 'Ads',
    subtitle: 'Coming soon',
    icon: Rocket,
    empty: 'Ads management is coming soon. We\'re building it next.',
    sections: [],
  },
};
