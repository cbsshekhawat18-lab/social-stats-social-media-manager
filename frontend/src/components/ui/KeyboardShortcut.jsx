/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useMemo } from 'react';

/**
 * KeyboardShortcut — visual key hint, e.g. ⌘ K or Ctrl + Shift + P.
 *
 * Props:
 *   keys:    string  ("cmd+k", "ctrl+shift+p", "esc", "enter", "/")
 *   variant: 'default' (light card) | 'inverted' (dark pill)
 *   size:    'sm' | 'md'
 *
 * The platform-aware mapping shows ⌘ on macOS and Ctrl on others.
 */
const KEY_LABELS = {
  cmd:    { mac: '⌘',  win: 'Ctrl' },
  ctrl:   { mac: '⌃',  win: 'Ctrl' },
  alt:    { mac: '⌥',  win: 'Alt' },
  option: { mac: '⌥',  win: 'Alt' },
  shift:  { mac: '⇧',  win: 'Shift' },
  meta:   { mac: '⌘',  win: 'Win' },
  enter:  { mac: '⏎',  win: 'Enter' },
  return: { mac: '⏎',  win: 'Enter' },
  esc:    { mac: 'Esc', win: 'Esc' },
  escape: { mac: 'Esc', win: 'Esc' },
  tab:    { mac: '⇥',  win: 'Tab' },
  space:  { mac: '␣',  win: 'Space' },
  up:     { mac: '↑',  win: '↑' },
  down:   { mac: '↓',  win: '↓' },
  left:   { mac: '←',  win: '←' },
  right:  { mac: '→',  win: '→' },
};

function isMac() {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
}

function labelFor(token, mac) {
  const t = (token || '').trim().toLowerCase();
  const map = KEY_LABELS[t];
  if (map) return mac ? map.mac : map.win;
  return token.length === 1 ? token.toUpperCase() : token;
}

export default function KeyboardShortcut({ keys, variant = 'default', size = 'sm', style, className }) {
  const mac = useMemo(isMac, []);
  const tokens = (keys || '').split('+').map((k) => k.trim()).filter(Boolean);

  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    color: variant === 'inverted' ? 'rgba(255,255,255,0.85)' : 'var(--text-tertiary)',
    fontSize: size === 'md' ? 12 : 11,
    ...style,
  };

  const keyStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: size === 'md' ? 22 : 18,
    height: size === 'md' ? 22 : 18,
    padding: '0 5px',
    borderRadius: 'var(--radius-xs)',
    border: variant === 'inverted'
      ? '1px solid rgba(255,255,255,0.18)'
      : '1px solid var(--border-default)',
    background: variant === 'inverted'
      ? 'rgba(255,255,255,0.10)'
      : 'var(--surface-card)',
    color: variant === 'inverted' ? '#fff' : 'var(--text-secondary)',
    fontSize: size === 'md' ? 12 : 11,
    fontWeight: 500,
    boxShadow: variant === 'inverted' ? 'none' : 'var(--shadow-xs)',
    lineHeight: 1,
  };

  return (
    <span aria-label={tokens.map((t) => labelFor(t, mac)).join(' ')} className={className} style={baseStyle}>
      {tokens.map((t, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <kbd style={keyStyle}>{labelFor(t, mac)}</kbd>
          {i < tokens.length - 1 && <span aria-hidden style={{ opacity: 0.5 }}>+</span>}
        </span>
      ))}
    </span>
  );
}
