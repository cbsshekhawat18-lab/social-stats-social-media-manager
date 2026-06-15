/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

/**
 * Binary theme toggle (light ↔ dark). Shows the icon for the destination
 * state — Moon when in light mode (clicking takes you to dark), Sun when
 * in dark mode. The 3-way Light/Dark/System chooser lives on the Settings
 * → Appearance page.
 */
export default function ThemeToggle({ size = 'md', className }) {
  const { theme, toggle } = useTheme();

  const isDark = theme === 'dark';
  const Icon = isDark ? Sun : Moon;
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  const dim = size === 'sm' ? 32 : size === 'lg' ? 44 : 36;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={className}
      style={{
        width: dim, height: dim,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-default)',
        background: 'var(--surface-card)',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'var(--transition-fast)',
        padding: 0,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface-card)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
    >
      <Icon size={16} strokeWidth={2} />
    </button>
  );
}
