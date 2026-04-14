import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, Bell } from 'lucide-react';
import { StatoxLogoHorizontal } from '../ui/StatoxLogo';
import { useAuth } from '../../hooks/useAuth';

const ROUTE_TITLES = {
  '/admin': 'Dashboard',
  '/admin/analytics': 'Analytics',
  '/admin/calendar': 'Calendar',
  '/admin/alerts': 'Alerts',
  '/admin/reports': 'Reports',
  '/admin/roi': 'ROI Calculator',
  '/admin/synclogs': 'Sync Logs',
  '/admin/clients': 'Clients',
  '/admin/caption-writer': 'Caption Writer',
  '/admin/post-ideas': 'Post Ideas',
  '/admin/management': 'Access Management',
  '/admin/account-settings': 'Account Settings',
  '/dashboard': 'Dashboard',
  '/dashboard/posts': 'My Posts',
  '/dashboard/calendar': 'Calendar',
  '/dashboard/roi': 'ROI Calculator',
  '/dashboard/settings': 'Connected Accounts',
  '/dashboard/caption-writer': 'Caption Writer',
  '/dashboard/post-ideas': 'Post Ideas',
  '/dashboard/account-settings': 'Account Settings',
};

/**
 * Sticky top bar shown only on mobile (hidden on desktop via CSS).
 * Translucent with backdrop-blur on scroll, dynamic route title.
 */
export default function MobileHeader({ onMenuOpen }) {
  const location = useLocation();
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const title = ROUTE_TITLES[location.pathname] || '';

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <header className="mobile-header" style={{
      ...styles.header,
      ...(scrolled ? styles.headerScrolled : {}),
    }}>
      {/* Left: hamburger + title */}
      <div style={styles.left}>
        <button type="button" style={styles.menuBtn} onClick={onMenuOpen} aria-label="Open menu">
          <Menu size={20} strokeWidth={2} color="#0f172a" />
        </button>
        {title ? (
          <span style={styles.title}>{title}</span>
        ) : (
          <StatoxLogoHorizontal height={26} />
        )}
      </div>

      {/* Right: avatar */}
      <div style={styles.right}>
        <div style={styles.avatar}>
          {(user?.name || user?.email || 'U')[0].toUpperCase()}
        </div>
      </div>
    </header>
  );
}

const styles = {
  header: {
    position: 'fixed',
    top: 0, left: 0, right: 0,
    zIndex: 150,
    height: 56,
    background: 'rgba(255,255,255,0.95)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(226,232,240,0.8)',
    boxShadow: '0 2px 16px rgba(15,23,42,0.06)',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    paddingTop: 'env(safe-area-inset-top)',
    transition: 'background 0.2s ease, box-shadow 0.2s ease',
  },
  headerScrolled: {
    background: 'rgba(255,255,255,0.98)',
    boxShadow: '0 2px 16px rgba(15,23,42,0.08)',
  },
  brand: {
    display: 'flex', alignItems: 'center', gap: 8,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  menuBtn: {
    width: 38,
    height: 38,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    background: '#f8fafc',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    WebkitTapHighlightColor: 'transparent',
    flexShrink: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    color: '#0f172a',
    letterSpacing: '-0.01em',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 999,
    background: 'linear-gradient(135deg, #00B8DA, #4F46E5)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
};
