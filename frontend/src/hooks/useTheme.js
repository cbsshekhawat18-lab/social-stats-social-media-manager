/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Theme management.
 *
 *  - User preference: 'light' | 'dark' | 'system' (persisted to localStorage)
 *  - Resolved value:  'light' | 'dark' (what's actually applied)
 *
 * The resolved value is written to <html data-theme="..."> so the CSS in
 * tokens.css and the dark-mode bridge in index.js can react.
 *
 * Default preference is 'light'. The TopBar/MarketingNav toggle is binary
 * (light ↔ dark); the 3-way Light/Dark/System chooser is exposed via
 * `setTheme(value)` for the Settings → Appearance page.
 */

const STORAGE_KEY = 'theme';
const DEFAULT_PREFERENCE = 'light';
const VALID_PREFS = new Set(['light', 'dark', 'system']);

function readPref() {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCE;
  const v = window.localStorage?.getItem(STORAGE_KEY);
  return VALID_PREFS.has(v) ? v : DEFAULT_PREFERENCE;
}

function systemTheme() {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolve(pref) {
  return pref === 'system' ? systemTheme() : pref;
}

function apply(resolved) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.style.colorScheme = resolved;
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(readPref);
  const [resolved,   setResolved]   = useState(() => resolve(readPref()));

  useEffect(() => {
    const next = resolve(preference);
    setResolved(next);
    apply(next);
    try { window.localStorage.setItem(STORAGE_KEY, preference); } catch {}
  }, [preference]);

  // Track OS theme changes when preference is "system"
  useEffect(() => {
    if (preference !== 'system' || typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const next = systemTheme();
      setResolved(next);
      apply(next);
    };
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, [preference]);

  // Binary toggle — flips between explicit light and dark.
  // Always commits to a concrete preference so the user's choice is durable.
  const toggle = useCallback(() => {
    setPreference((p) => (resolve(p) === 'dark' ? 'light' : 'dark'));
  }, []);

  const setTheme = useCallback((value) => {
    if (VALID_PREFS.has(value)) setPreference(value);
  }, []);

  const value = useMemo(
    () => ({ preference, theme: resolved, isDark: resolved === 'dark', toggle, setTheme }),
    [preference, resolved, toggle, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (ctx) return ctx;

  // Standalone fallback (no provider mounted): bootstrap on the fly so
  // imports don't crash before the provider is wired into App.js.
  const pref = readPref();
  return {
    preference: pref,
    theme: resolve(pref),
    isDark: resolve(pref) === 'dark',
    toggle: () => {},
    setTheme: () => {},
  };
}

/* Apply persisted theme as early as possible to avoid a flash on first paint. */
export function bootstrapTheme() {
  apply(resolve(readPref()));
}
