import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// ── Google Fonts: Inter ──────────────────────────────────────────────────────
const fontLink = document.createElement('link');
fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap';
fontLink.rel = 'stylesheet';
document.head.appendChild(fontLink);

// ── Global styles ────────────────────────────────────────────────────────────
const style = document.createElement('style');
style.textContent = `
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

    /* Brand — STATOX (Cyan + Black) */
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
`;
document.head.appendChild(style);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);
