/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/* Social Stats Design System — shared constants for inline styles */

export const colors = {
  primary: '#00B8DA',
  primaryHover: '#009EC0',
  primaryLight: '#E0F9FF',
  primaryGlow: 'rgba(0, 204, 245, 0.18)',
  indigo: '#4F46E5',
  indigoLight: '#EEF2FF',
  surface: '#ffffff',
  bg: '#f0f4f9',
  border: '#e2e8f0',
  text: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  success: '#16a34a',
  warning: '#f59e0b',
  danger: '#dc2626',
  sidebarBg: '#0f172a',
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
  card: 16,
  button: 12,
  modal: 24,
};

export const shadows = {
  xs: '0 1px 2px rgba(0,0,0,.05)',
  sm: '0 1px 4px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)',
  md: '0 4px 16px rgba(0,0,0,.08), 0 2px 6px rgba(0,0,0,.04)',
  lg: '0 10px 32px rgba(0,0,0,.1), 0 4px 12px rgba(0,0,0,.06)',
  soft: '0 4px 20px rgba(0,0,0,0.06)',
  glass: '0 8px 32px rgba(0,0,0,.07)',
};

export const glass = {
  background: 'rgba(255,255,255,0.72)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.3)',
  borderRadius: radii.lg,
  boxShadow: shadows.soft,
};

export const spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32,
  pagePadding: 36, pagePaddingMobile: 16,
};

export const typography = {
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  h1: { fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2 },
  h2: { fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.3 },
  h3: { fontSize: 17, fontWeight: 700, lineHeight: 1.4 },
  body: { fontSize: 14, fontWeight: 400, lineHeight: 1.6 },
  caption: { fontSize: 12, fontWeight: 500, lineHeight: 1.4 },
  small: { fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' },
};
