/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/tokens.css';
import './styles/common.css';
import { bootstrapTheme } from './hooks/useTheme';

// Apply persisted theme before React paints, to avoid flash of wrong theme.
bootstrapTheme();

// ── Google Fonts: Inter ──────────────────────────────────────────────────────
const fontLink = document.createElement('link');
fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap';
fontLink.rel = 'stylesheet';
document.head.appendChild(fontLink);

// ── Global styles ────────────────────────────────────────────────────────────
const style = document.createElement('style');
style.textContent = `
  * {
    -webkit-tap-highlight-color: transparent;
    box-sizing: border-box;
  }
  *, *::before, *::after { box-sizing: border-box; }

  :root {
    /* Surfaces */
    --bg:            #f0f4f9;
    --surface:       #ffffff;
    --surface-2:     #f8fafc;
    --border:        #e2e8f0;
    --border-light:  #f1f5f9;

    /* Text */
    --text-primary:   #0f172a;
    --text-secondary: #475569;
    --text-muted:     #94a3b8;

    /* Brand — Social Stats (Cyan + Black) */
    --blue:          #00B8DA;
    --blue-hover:    #009EC0;
    --blue-light:    #E0F9FF;
    --blue-glow:     rgba(0, 204, 245, 0.18);
    --brand-cyan:    #00CCF5;
    --brand-black:   #0D0D0D;

    /* Sidebar (dark) */
    --sidebar-bg:       #0f172a;
    --sidebar-surface:  #1e293b;
    --sidebar-border:   rgba(255,255,255,0.06);
    --sidebar-text:     #cbd5e1;
    --sidebar-muted:    #475569;
    --sidebar-active-bg: rgba(37,99,235,0.18);
    --sidebar-active-border: #3b82f6;

    /* Radii */
    --radius-sm: 8px;
    --radius:    12px;
    --radius-lg: 16px;
    --radius-xl: 20px;

    /* Shadows */
    --shadow-xs: 0 1px 2px rgba(0,0,0,.05);
    --shadow-sm: 0 1px 4px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
    --shadow-md: 0 4px 16px rgba(0,0,0,.08), 0 2px 6px rgba(0,0,0,.04);
    --shadow-lg: 0 10px 32px rgba(0,0,0,.1),  0 4px 12px rgba(0,0,0,.06);
    --shadow-xl: 0 20px 60px rgba(0,0,0,.14), 0 8px 24px rgba(0,0,0,.08);

    /* Transitions */
    --ease: cubic-bezier(0.4, 0, 0.2, 1);
    --transition: all 0.18s var(--ease);
    --transition-fast: all 0.12s var(--ease);
  }

  html { scroll-behavior: smooth; }

  body {
    margin: 0;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: var(--bg);
    color: var(--text-primary);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    font-feature-settings: 'cv02','cv03','cv04','cv11';
    line-height: 1.5;
    overscroll-behavior: none;
  }

  a { color: inherit; }
  button { font-family: inherit; }

  /* ── Scrollbar ────────────────────────────────────────────────────────── */
  ::-webkit-scrollbar            { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track      { background: transparent; }
  ::-webkit-scrollbar-thumb      { background: #cbd5e1; border-radius: 99px; }
  ::-webkit-scrollbar-thumb:hover{ background: #94a3b8; }

  .sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
  .sidebar-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

  /* ── Keyframes ────────────────────────────────────────────────────────── */
  @keyframes spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes fadeInScale {
    from { opacity: 0; transform: scale(0.97) translateY(6px); }
    to   { opacity: 1; transform: scale(1)    translateY(0); }
  }

  @keyframes shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position:  200% 0; }
  }

  @keyframes gradientShift {
    0%   { background-position: 0%   50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0%   50%; }
  }

  @keyframes pulse-dot {
    0%, 100% { opacity: 1;   transform: scale(1); }
    50%       { opacity: 0.6; transform: scale(1.3); }
  }

  @keyframes mesh-move {
    0%   { transform: translate(0, 0)   rotate(0deg);  }
    33%  { transform: translate(3%, 2%) rotate(120deg); }
    66%  { transform: translate(-2%, 3%) rotate(240deg); }
    100% { transform: translate(0, 0)   rotate(360deg); }
  }

  @keyframes slideUp {
    from { transform: translateY(100%); }
    to   { transform: translateY(0); }
  }

  @keyframes slideDown {
    from { transform: translateY(0); }
    to   { transform: translateY(100%); }
  }

  /* ── Page enter animation ─────────────────────────────────────────────── */
  .page-enter { animation: fadeIn 0.22s var(--ease) forwards; }

  /* ── Card hover lift ──────────────────────────────────────────────────── */
  .card-hover {
    transition: var(--transition);
    cursor: pointer;
  }
  .card-hover:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg) !important;
  }

  /* ── Input / Select focus rings ───────────────────────────────────────── */
  input:focus, select:focus, textarea:focus {
    outline: none;
    border-color: var(--blue) !important;
    box-shadow: 0 0 0 3px var(--blue-glow) !important;
  }

  /* ── Skeleton shimmer ─────────────────────────────────────────────────── */
  .skeleton {
    background: linear-gradient(
      90deg,
      #f1f5f9 25%,
      #e2e8f0 50%,
      #f1f5f9 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 8px;
  }

  /* ── Gradient text ────────────────────────────────────────────────────── */
  .gradient-text {
    background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  /* ── Button base reset ────────────────────────────────────────────────── */
  button:disabled { opacity: 0.6; cursor: not-allowed; }

  /* ══════════════════════════════════════════════════════════════════════
     MOBILE RESPONSIVE — app-like PWA layout
     ══════════════════════════════════════════════════════════════════════ */

  /* Touch optimisations */
  * { touch-action: manipulation; -webkit-touch-callout: none; }
  a, button, [role="button"] { touch-action: manipulation; }

  /* Minimum tap targets (Apple HIG: 44px) */
  button, a, [role="button"] {
    min-height: 44px;
    min-width: 44px;
  }
  input:not([type="checkbox"]):not([type="radio"]), select, textarea {
    min-height: 44px;
    font-size: 16px;
  }

  /* Button press micro-interaction */
  button:active:not(:disabled), [role="button"]:active {
    transform: scale(0.97);
    transition: transform 0.08s ease;
  }

  /* Card tap lift */
  .card-tap:active {
    transform: scale(0.98);
    box-shadow: var(--shadow-sm) !important;
    transition: all 0.1s ease;
  }

  /* Desktop: show sidebar, hide bottom nav and mobile header */
  @media (min-width: 769px) {
    .mobile-bottom-nav { display: none !important; }
    .mobile-header { display: none !important; }
  }

  /* Bottom nav: hidden on desktop, flex on mobile */
  .mobile-bottom-nav { display: none !important; }
  /* Mobile header: hidden on desktop */
  .mobile-header     { display: none !important; }
  /* Sidebar overlay backdrop: hidden on desktop */
  .sidebar-overlay   { display: none !important; }

  /* ── Mobile-drawer backdrop ────────────────────────────────────────── */
  .mobile-drawer-backdrop {
    position: fixed; inset: 0; z-index: 299;
    background: rgba(0,0,0,0.4);
    backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
    opacity: 0; pointer-events: none;
    transition: opacity 0.25s ease;
  }
  .mobile-drawer-backdrop.open { opacity: 1; pointer-events: auto; }

  /* ── Bottom sheet ──────────────────────────────────────────────────── */
  .bottom-sheet-overlay {
    position: fixed; inset: 0; z-index: 400;
    background: rgba(0,0,0,0.4);
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    opacity: 0; pointer-events: none;
    transition: opacity 0.2s ease;
  }
  .bottom-sheet-overlay.open { opacity: 1; pointer-events: auto; }

  /* ── Pull-to-refresh ───────────────────────────────────────────────── */
  .pull-indicator {
    display: flex; align-items: center; justify-content: center;
    height: 0; overflow: hidden;
    transition: height 0.2s ease;
  }
  .pull-indicator.pulling { height: 50px; }
  .pull-indicator.refreshing { height: 50px; }

  /* ── Skeleton loader ───────────────────────────────────────────────── */
  .skeleton-card {
    background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: var(--radius);
    min-height: 80px;
  }

  /* ── Glassmorphism card ────────────────────────────────────────────── */
  .glass-card {
    background: rgba(255,255,255,0.72);
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.3);
    border-radius: var(--radius-lg);
    box-shadow: 0 4px 20px rgba(0,0,0,0.06);
  }

  @media (max-width: 768px) {
    /* Show mobile chrome */
    .mobile-bottom-nav { display: flex !important; }
    .mobile-header     { display: flex !important; }

    /* Hide the desktop sidebar by default */
    .desktop-sidebar { transform: translateX(-100%); }
    .desktop-sidebar.sidebar-open { transform: translateX(0); }
    .sidebar-overlay.sidebar-open { display: block !important; }

    /* Content: no left margin, top padding for header, bottom for tab bar */
    .sidebar { display: none !important; }
    .main-content {
      margin-left: 0 !important;
      padding-top: 56px !important;
      padding-bottom: 80px !important;
    }

    /* Page header */
    h1 { font-size: 22px !important; }

    /* ── Utility: force any grid/flex to stack ──────────────────────── */
    .m-stack { flex-direction: column !important; }
    .m-grid-1 { grid-template-columns: 1fr !important; }
    .m-grid-2 { grid-template-columns: 1fr 1fr !important; }
    .m-wrap { flex-wrap: wrap !important; }
    .m-full { width: 100% !important; min-width: 0 !important; flex: 1 1 100% !important; }
    .m-hide { display: none !important; }
    .m-gap-sm { gap: 8px !important; }
    .m-p-sm { padding: 14px !important; }
    .m-text-sm { font-size: 13px !important; }

    /* ── Grids: Stack on mobile ─────────────────────────────────────── */
    .stat-grid { grid-template-columns: 1fr 1fr !important; }
    .dashboard-grid { grid-template-columns: 1fr !important; }

    /* ── AdminOverview ──────────────────────────────────────────────── */
    .admin-hero-top { flex-direction: column !important; align-items: flex-start !important; gap: 16px !important; }
    .admin-signal-grid { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }
    .admin-summary-bar { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
    .admin-dashboard-grid { grid-template-columns: 1fr !important; gap: 14px !important; }
    .admin-stat-cards { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }
    .admin-goal-form { flex-direction: column !important; }
    .admin-goal-form > * { flex: 1 1 100% !important; min-width: 0 !important; width: 100% !important; }
    .admin-goal-form input, .admin-goal-form select { width: 100% !important; }
    .admin-table-wrap { padding: 14px !important; border-radius: 14px !important; }
    .admin-panel-wrap { border-radius: 14px !important; }
    .admin-panel-body { padding: 14px !important; }

    /* ── PageHeader ──────────────────────────────────────────────────── */
    .page-enter > div:first-child {
      padding: 16px 14px 14px !important;
      border-radius: 16px !important;
    }
    .page-enter h1 { font-size: 22px !important; }
    .page-enter > div:first-child > div:first-child {
      flex-direction: column !important;
      align-items: flex-start !important;
      gap: 12px !important;
    }
    /* Header action buttons: stack and go full-width */
    .page-enter > div:first-child > div:first-child > div:last-child {
      width: 100% !important;
      flex-wrap: wrap !important;
    }
    .page-enter > div:first-child > div:first-child > div:last-child > button,
    .page-enter > div:first-child > div:first-child > div:last-child > a {
      flex: 1 1 auto !important;
      justify-content: center !important;
      font-size: 12px !important;
      padding: 8px 12px !important;
    }

    /* ── ClientDashboard ────────────────────────────────────────────── */
    .client-control-bar { padding: 12px !important; border-radius: 12px !important; }
    .client-control-bar > div:first-child { flex-direction: column !important; align-items: stretch !important; gap: 10px !important; }
    .client-highlight-strip { gap: 8px !important; }
    .client-highlight-strip > * { flex: 1 1 calc(50% - 4px) !important; min-width: 0 !important; }
    .client-analytics-grid { grid-template-columns: 1fr !important; }
    .client-kpi-grid { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
    .client-kpi-grid > * { min-width: 0 !important; }
    .client-charts-grid { grid-template-columns: 1fr !important; }
    .client-chart-card { padding: 12px !important; border-radius: 12px !important; }
    .client-section-heading { flex-direction: column !important; align-items: flex-start !important; gap: 8px !important; }

    /* Profile strip: tags wrap */
    .client-control-bar + div,
    div[style*="profileStrip"] { flex-wrap: wrap !important; }

    /* Segmented tabs: scrollable on mobile */
    .segmented-tabs { overflow-x: auto !important; -webkit-overflow-scrolling: touch !important; flex-wrap: nowrap !important; }
    .segmented-tabs > * { white-space: nowrap !important; flex-shrink: 0 !important; }

    /* ── AnalyticsPage ──────────────────────────────────────────────── */
    .analytics-kpi-grid { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
    .analytics-kpi-grid > * { min-width: 0 !important; flex: unset !important; }
    .analytics-two-col { grid-template-columns: 1fr !important; }
    .analytics-controls { flex-direction: column !important; align-items: stretch !important; gap: 10px !important; }

    /* ── UserSettingsPage ────────────────────────────────────────────── */
    .settings-body { flex-direction: column !important; }
    .settings-sidebar {
      flex-direction: row !important;
      overflow-x: auto !important;
      -webkit-overflow-scrolling: touch !important;
      gap: 4px !important;
      padding: 8px !important;
      width: 100% !important;
      position: static !important;
    }
    /* Hide group headings on mobile — flatten to a single horizontal strip */
    .settings-sidebar > div { display: contents !important; }
    .settings-sidebar > div > div:first-child { display: none !important; }
    .settings-sidebar button {
      white-space: nowrap !important;
      padding: 8px 14px !important;
      font-size: 13px !important;
      box-shadow: none !important;
      flex-shrink: 0 !important;
    }
    .settings-panel { padding: 0 !important; border-radius: var(--radius-lg) !important; }
    .settings-field-grid { grid-template-columns: 1fr !important; }
    .settings-avatar-row { flex-direction: column !important; align-items: center !important; gap: 12px !important; }

    /* ── SettingsPage (OAuth) ────────────────────────────────────────── */
    .oauth-hero { flex-direction: column !important; }
    .oauth-platform-grid { grid-template-columns: 1fr !important; }
    .oauth-platform-card { padding: 16px !important; }
    .oauth-btn-row { flex-direction: column !important; gap: 8px !important; }
    .oauth-btn-row button, .oauth-btn-row a { width: 100% !important; text-align: center !important; justify-content: center !important; }

    /* ── CalendarPage ───────────────────────────────────────────────── */
    .calendar-toolbar { flex-direction: column !important; align-items: stretch !important; gap: 10px !important; }
    .calendar-toolbar > * { flex: 1 1 100% !important; }
    .calendar-month-grid { grid-template-columns: repeat(7, 1fr) !important; gap: 2px !important; }
    .calendar-day-cell { min-height: 60px !important; padding: 4px !important; font-size: 11px !important; }

    /* ── CaptionWriterPage / PostIdeasPage ───────────────────────────── */
    .ai-form-row { flex-direction: column !important; gap: 10px !important; }
    .ai-form-row > * { flex: 1 1 100% !important; width: 100% !important; }
    .ai-result-grid { grid-template-columns: 1fr !important; }
    .ai-tab-row { overflow-x: auto !important; }

    /* ── ROICalculatorPage ──────────────────────────────────────────── */
    .roi-form-grid { grid-template-columns: 1fr !important; }
    .roi-result-grid { grid-template-columns: 1fr 1fr !important; }
    .roi-chart-grid { grid-template-columns: 1fr !important; }

    /* ── ReportsPage ────────────────────────────────────────────────── */
    .report-card { padding: 14px !important; }
    .report-card-header { flex-direction: column !important; align-items: flex-start !important; gap: 8px !important; }

    /* ── Tables: always horizontal scroll ───────────────────────────── */
    .table-wrap, .admin-table-wrap { overflow-x: auto !important; -webkit-overflow-scrolling: touch !important; }
    table { min-width: 500px; }
    th, td { padding: 10px 8px !important; font-size: 12px !important; white-space: nowrap !important; }

    /* ── General responsive fixes ───────────────────────────────────── */
    .desktop-only { display: none !important; }
    .mobile-full-width { width: 100% !important; }
    .app-surface, .app-surface--panel { padding: 16px !important; }
    .app-surface--compact { padding: 12px !important; }
    .card-hover:hover { transform: none !important; box-shadow: var(--shadow-sm) !important; }
    .page-header-row { flex-direction: column !important; align-items: flex-start !important; gap: 12px !important; }

    /* Invite panel */
    .all-clients-invite-panel { padding: 16px !important; }
    .all-clients-invite-form { flex-direction: column !important; }
    .all-clients-form-field { flex: 1 1 100% !important; }
    .all-clients-form-action { align-self: stretch !important; }
    .all-clients-form-action button { width: 100% !important; }
    .all-clients-stats-row { flex-direction: column !important; gap: 10px !important; }
    .all-clients-section { padding: 16px !important; }
    .all-clients-section-header { flex-wrap: wrap; gap: 8px; }
    .all-clients-invite-header { flex-direction: column !important; align-items: flex-start !important; gap: 10px !important; }

    /* Notification dropdown → bottom sheet on mobile */
    .notif-dropdown {
      top: auto !important; bottom: 0 !important;
      left: 0 !important; right: 0 !important;
      width: 100% !important;
      max-height: 80vh !important;
      border-radius: 20px 20px 0 0 !important;
      animation: slideUp 0.25s ease forwards !important;
    }

    /* Modal → bottom sheet on mobile */
    .modal-content {
      position: fixed !important; bottom: 0 !important; left: 0 !important; right: 0 !important;
      top: auto !important; max-width: 100% !important;
      border-radius: 20px 20px 0 0 !important; max-height: 85vh !important; overflow-y: auto !important;
    }
  }

  @media (max-width: 480px) {
    .stat-grid, .admin-stat-cards, .admin-signal-grid, .admin-summary-bar,
    .client-kpi-grid, .analytics-kpi-grid, .roi-result-grid {
      grid-template-columns: 1fr !important;
    }
    h1 { font-size: 20px !important; }
    .app-page, .app-page--content { padding: 16px 12px 24px !important; }
    .metric-row { flex-wrap: wrap; gap: 6px; }
    table { min-width: 420px; }
  }

  /* ── Safe area insets for notched phones ──────────────────────────── */
  @supports (padding-top: env(safe-area-inset-top)) {
    .mobile-header {
      padding-top: env(safe-area-inset-top) !important;
    }
    .mobile-bottom-nav {
      padding-bottom: env(safe-area-inset-bottom) !important;
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     DARK MODE BRIDGE — flips LEGACY variable names so existing components
     respect data-theme="dark" without rewriting them. New components
     should reference the tokens.css names directly.
     ══════════════════════════════════════════════════════════════════════ */
  [data-theme="dark"] {
    --bg:            #0a0e14;
    --surface:       #11161e;
    --surface-2:     #161c26;
    --border:        rgba(255,255,255,0.10);
    --border-light:  rgba(255,255,255,0.06);

    --text-primary:   #f1f5f9;
    --text-secondary: #94a3b8;
    --text-muted:     #64748b;

    --blue-light:    rgba(0, 204, 245, 0.12);
    --blue-glow:     rgba(0, 204, 245, 0.22);

    --shadow-xs: 0 1px 2px rgba(0,0,0,0.45);
    --shadow-sm: 0 1px 4px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.30);
    --shadow-md: 0 4px 16px rgba(0,0,0,0.50), 0 2px 6px rgba(0,0,0,0.30);
    --shadow-lg: 0 10px 32px rgba(0,0,0,0.55), 0 4px 12px rgba(0,0,0,0.35);
    --shadow-xl: 0 20px 60px rgba(0,0,0,0.60), 0 8px 24px rgba(0,0,0,0.40);
  }

  [data-theme="dark"] body { background: var(--bg); color: var(--text-primary); }

  [data-theme="dark"] ::-webkit-scrollbar-thumb        { background: rgba(255,255,255,0.12); }
  [data-theme="dark"] ::-webkit-scrollbar-thumb:hover  { background: rgba(255,255,255,0.22); }

  [data-theme="dark"] .skeleton,
  [data-theme="dark"] .skeleton-card {
    background: linear-gradient(90deg, #1a212c 25%, #232c39 50%, #1a212c 75%);
    background-size: 200% 100%;
  }
`;
document.head.appendChild(style);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);

// ── Service Worker Registration (PWA) ───────────────────────────────────────
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
