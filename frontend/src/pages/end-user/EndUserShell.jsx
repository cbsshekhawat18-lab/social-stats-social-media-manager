/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * EndUserShell — layout wrapper for the end-user (B2C) experience under /u.
 *
 * Distinct from the agency-side AppShell: lighter sidebar, friendlier copy,
 * and only the navigation that's relevant to a workspace owner. Pages that
 * are not yet built (later marketplace stages) are listed with `comingSoon`.
 */
import { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileType, PenSquare, CalendarDays, Inbox, LineChart,
  Building2, Plug, ShieldCheck, ClipboardCheck, Search,
  Settings, CreditCard, Sparkles, Bell, Menu, X,
} from 'lucide-react';

import { useAuth } from '../../hooks/useAuth';
import { approvalAPI } from '../../services/api';

const SECTIONS = [
  {
    title: 'My workspace',
    items: [
      { to: '/u',             label: 'Dashboard',  icon: LayoutDashboard, end: true },
      { to: '/u/posts',       label: 'Posts',      icon: FileType,        comingSoon: true },
      { to: '/u/composer',    label: 'Composer',   icon: PenSquare,       comingSoon: true },
      { to: '/u/calendar',    label: 'Calendar',   icon: CalendarDays,    comingSoon: true },
      { to: '/u/inbox',       label: 'Inbox',      icon: Inbox,           comingSoon: true },
      { to: '/u/analytics',   label: 'Analytics',  icon: LineChart,       comingSoon: true },
    ],
  },
  {
    title: 'Manage',
    items: [
      { to: '/u/agency',      label: 'My agency',   icon: Building2 },
      { to: '/u/connections', label: 'Connections', icon: Plug },
      { to: '/u/approvals',   label: 'Approvals',   icon: ClipboardCheck, badgeKey: 'pendingApprovals' },
      { to: '/u/activity',    label: 'Activity log', icon: ShieldCheck },
    ],
  },
  {
    title: 'Discover',
    items: [
      { to: '/u/agency/find', label: 'Find an agency', icon: Search },
    ],
  },
  {
    title: 'Account',
    items: [
      { to: '/u/settings',      label: 'Settings',      icon: Settings,    comingSoon: true },
      { to: '/u/notifications', label: 'Notifications', icon: Bell },
      { to: '/u/billing',       label: 'Billing',       icon: CreditCard },
    ],
  },
];

export default function EndUserShell() {
  const { user } = useAuth();
  const location = useLocation();
  const [badges, setBadges] = useState({ pendingApprovals: 0 });
  const [mobileOpen, setMobileOpen] = useState(false);

  // Light poll of pending approvals so the sidebar badge stays current.
  // 60s is plenty — the page itself refetches on focus.
  useEffect(() => {
    let cancelled = false;
    function refresh() {
      approvalAPI.pending()
        .then((r) => { if (!cancelled) setBadges((b) => ({ ...b, pendingApprovals: r.data?.count || 0 })); })
        .catch(() => {});
    }
    refresh();
    const t = setInterval(refresh, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--surface-page)' }} className="eu-shell">
      {/* Mobile top-bar — visible only at narrow widths */}
      <header className="eu-mobile-bar" style={{
        position: 'sticky', top: 0, zIndex: 50,
        display: 'none',
        alignItems: 'center', gap: 10,
        padding: '10px 14px',
        background: 'var(--surface-card)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <button
          type="button" onClick={() => setMobileOpen(true)} aria-label="Open menu"
          style={{
            width: 36, height: 36, padding: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', color: 'var(--text-primary)',
            border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
          }}
        >
          <Menu size={18} />
        </button>
        <span style={{
          width: 26, height: 26, background: 'var(--brand-gradient)', color: '#fff',
          borderRadius: 'var(--radius-sm)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Sparkles size={13} strokeWidth={2.4} />
        </span>
        <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>Social Stats</strong>
      </header>

      {/* Backdrop */}
      {mobileOpen && (
        <div
          className="eu-mobile-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden
          style={{
            position: 'fixed', inset: 0, zIndex: 60,
            background: 'rgba(10,14,20,0.45)', backdropFilter: 'blur(2px)',
            display: 'none',
          }}
        />
      )}

      <aside
        aria-label="End-user navigation"
        className={mobileOpen ? 'eu-sidebar eu-sidebar-open' : 'eu-sidebar'}
        style={{
          width: 220,
          background: 'var(--surface-card)',
          borderRight: '1px solid var(--border-subtle)',
          padding: 14,
          display: 'flex', flexDirection: 'column', gap: 16,
          position: 'sticky', top: 0, height: '100vh',
        }}
      >
        {/* Mobile-only close button */}
        <button
          type="button" onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
          className="eu-sidebar-close"
          style={{
            display: 'none', position: 'absolute', top: 10, right: 10,
            width: 32, height: 32, padding: 0,
            background: 'transparent', color: 'var(--text-tertiary)',
            border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={16} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 14, borderBottom: '1px solid var(--border-subtle)' }}>
          <span style={{
            width: 28, height: 28,
            background: 'var(--brand-gradient)',
            borderRadius: 'var(--radius-sm)',
            color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={14} strokeWidth={2.4} />
          </span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Social Stats
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              Personal account
            </div>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', flex: 1 }}>
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <div style={{
                fontSize: 10, fontWeight: 600,
                letterSpacing: '0.06em', textTransform: 'uppercase',
                color: 'var(--text-tertiary)',
                padding: '4px 8px 6px',
              }}>
                {section.title}
              </div>
              {section.items.map((item) => (
                <NavRow key={item.to} {...item} badge={item.badgeKey ? badges[item.badgeKey] : 0} />
              ))}
            </div>
          ))}
        </nav>

        {user && (
          <div style={{
            padding: 10,
            background: 'var(--surface-sunken)',
            borderRadius: 'var(--radius-md)',
            fontSize: 12,
          }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {user.first_name || user.email}
            </div>
            <div style={{ color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.email}
            </div>
          </div>
        )}
      </aside>

      <main style={{ flex: 1, minWidth: 0, padding: 28 }} className="eu-main">
        <Outlet />
      </main>

      <style>{`
        @media (max-width: 880px) {
          .eu-shell { flex-direction: column; }
          .eu-mobile-bar { display: flex !important; }
          .eu-main { padding: 18px 14px !important; }
          .eu-sidebar {
            position: fixed !important;
            top: 0; left: 0;
            height: 100vh !important;
            transform: translateX(-100%);
            transition: transform 0.22s ease-out;
            z-index: 70;
            box-shadow: var(--shadow-xl);
          }
          .eu-sidebar-open { transform: translateX(0); }
          .eu-sidebar-close { display: inline-flex !important; }
          .eu-mobile-backdrop { display: block !important; }
        }
      `}</style>
    </div>
  );
}

function NavRow({ to, label, icon: Icon, end, comingSoon, badge }) {
  if (comingSoon) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px',
        color: 'var(--text-tertiary)',
        fontSize: 13, fontWeight: 500,
        cursor: 'not-allowed',
        opacity: 0.55,
      }}>
        <Icon size={15} strokeWidth={2} />
        <span style={{ flex: 1 }}>{label}</span>
        <span style={{
          fontSize: 9, fontWeight: 600,
          letterSpacing: '0.04em', textTransform: 'uppercase',
          color: 'var(--text-tertiary)',
          padding: '2px 6px',
          background: 'var(--surface-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-pill)',
        }}>
          Soon
        </span>
      </div>
    );
  }
  return (
    <NavLink
      to={to}
      end={end}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px',
        textDecoration: 'none',
        borderRadius: 'var(--radius-sm)',
        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
        background: isActive ? 'var(--brand-primary-glow)' : 'transparent',
        fontSize: 13, fontWeight: isActive ? 600 : 500,
        boxShadow: isActive ? 'inset 2px 0 0 var(--brand-primary)' : 'none',
      })}
    >
      <Icon size={15} strokeWidth={2} />
      <span style={{ flex: 1 }}>{label}</span>
      {badge > 0 && (
        <span style={{
          minWidth: 18, padding: '0 5px',
          background: 'var(--brand-primary-hover)', color: '#fff',
          fontSize: 10, fontWeight: 700, lineHeight: '16px', height: 16,
          borderRadius: 999, textAlign: 'center',
        }}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </NavLink>
  );
}
