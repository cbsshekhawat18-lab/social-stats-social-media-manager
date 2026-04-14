import { NavLink, useLocation } from 'react-router-dom';
import {
  AlertCircle,
  CalendarDays,
  FileText,
  LayoutDashboard,
  Menu,
  Settings,
  TrendingUp,
  Users,
  Wand2,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export default function BottomNav({ onMenuOpen, alertCount = 0 }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'superadmin' || user?.role === 'staff';
  const location = useLocation();

  const adminItems = [
    { to: '/admin',          icon: LayoutDashboard, label: 'Home',     end: true },
    { to: '/admin/clients',  icon: Users,           label: 'Users' },
    { to: '/admin/alerts',   icon: AlertCircle,     label: 'Alerts',  badge: alertCount || null },
    { to: '/admin/calendar', icon: CalendarDays,    label: 'Calendar' },
  ];

  const clientItems = [
    { to: '/dashboard',                  icon: LayoutDashboard, label: 'Home',     end: true },
    { to: '/dashboard/posts',            icon: FileText,        label: 'Posts',    end: true },
    { to: '/dashboard/calendar',         icon: CalendarDays,    label: 'Calendar', end: true },
    { to: '/dashboard/caption-writer',   icon: Wand2,           label: 'AI',       end: true },
    { to: '/dashboard/settings',         icon: Settings,        label: 'Connect',  end: true },
  ];

  const items = isAdmin ? adminItems : clientItems;

  function isActive(to, end) {
    if (end) return location.pathname === to;
    return location.pathname === to || location.pathname.startsWith(to + '/');
  }

  return (
    <nav className="mobile-bottom-nav" style={styles.nav}>
      {items.map(({ to, icon: Icon, label, end, badge }) => {
        const active = isActive(to, end);
        return (
          <NavLink
            key={to}
            to={to}
            end={end}
            style={{ ...styles.tab, ...(active ? styles.tabActive : {}) }}
          >
            <div style={{ ...styles.iconWrap, ...(active ? styles.iconWrapActive : {}) }}>
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              {badge ? <span style={styles.badge}>{badge > 99 ? '99+' : badge}</span> : null}
            </div>
            <span style={{ ...styles.label, ...(active ? styles.labelActive : {}) }}>
              {label}
            </span>
            {active && <span style={styles.activePill} />}
          </NavLink>
        );
      })}

      {/* More / full menu — admin only (5-item cap) */}
      {isAdmin && (
        <button type="button" style={styles.tab} onClick={onMenuOpen}>
          <div style={styles.iconWrap}>
            <Menu size={21} strokeWidth={1.8} />
          </div>
          <span style={styles.label}>More</span>
        </button>
      )}
    </nav>
  );
}

const styles = {
  nav: {
    position: 'fixed',
    bottom: 0, left: 0, right: 0,
    zIndex: 200,
    height: 72,
    background: 'rgba(255,255,255,0.95)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderTop: '1px solid rgba(226,232,240,0.8)',
    boxShadow: '0 -8px 32px rgba(15,23,42,0.08)',
    display: 'flex',
    alignItems: 'stretch',
    paddingBottom: 'env(safe-area-inset-bottom)',
  },
  tab: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    textDecoration: 'none',
    color: '#94a3b8',
    padding: '6px 4px 4px',
    position: 'relative',
    transition: 'color 0.2s ease',
    fontFamily: 'inherit',
    WebkitTapHighlightColor: 'transparent',
  },
  tabActive: { color: '#00B8DA' },
  iconWrap: {
    position: 'relative',
    width: 44,
    height: 30,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    transition: 'background 0.2s ease',
  },
  iconWrapActive: {
    background: 'rgba(0,204,245,0.12)',
  },
  badge: {
    position: 'absolute',
    top: -2, right: -4,
    minWidth: 16, height: 16,
    padding: '0 4px',
    borderRadius: 999,
    background: '#ef4444',
    color: '#fff',
    fontSize: 9, fontWeight: 800,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '2px solid #fff',
  },
  label: {
    fontSize: 10, fontWeight: 600,
    color: 'inherit', letterSpacing: '0.01em',
  },
  labelActive: { fontWeight: 700 },
  activePill: {
    position: 'absolute',
    top: 0, left: '50%',
    transform: 'translateX(-50%)',
    width: 32, height: 3,
    borderRadius: '0 0 6px 6px',
    background: 'linear-gradient(90deg, #00CCF5, #00A8D8)',
    boxShadow: '0 2px 8px rgba(0,204,245,0.5)',
  },
};
