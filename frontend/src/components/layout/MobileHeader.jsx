import { Menu } from 'lucide-react';
import { StatoxLogoHorizontal } from '../ui/StatoxLogo';

/**
 * Sticky top bar shown only on mobile (hidden on desktop via CSS).
 * Displays the brand logo on the left and a hamburger button on the right
 * to open the slide-out sidebar drawer.
 */
export default function MobileHeader({ onMenuOpen }) {
  return (
    <header className="mobile-header" style={styles.header}>
      {/* Brand */}
      <div style={styles.brand}>
        <StatoxLogoHorizontal height={28} />
      </div>

      {/* Hamburger */}
      <button type="button" style={styles.menuBtn} onClick={onMenuOpen} aria-label="Open menu">
        <Menu size={22} strokeWidth={2} color="#0f172a" />
      </button>
    </header>
  );
}

const styles = {
  header: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 150,
    height: 56,
    background: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    boxShadow: '0 2px 12px rgba(15,23,42,0.06)',
    /* flex applied via CSS class */
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    paddingTop: 'env(safe-area-inset-top)',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
  },
  menuBtn: {
    width: 40,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    background: '#f8fafc',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
};
