/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 *
 * • Shows on first load until the user picks ANY option.
 * • Stores the choice in `localStorage` (survives logged-out → logged-in).
 * • When the user is authenticated, also POSTs the same choices to
 *   /api/privacy/consents/ so we have a server-side audit trail.
 *
 * Categories (only the first is mandatory):
 *   - essential: always on, can't disable
 *   - functional: prefs, language
 *   - analytics: Posthog/Plausible
 *   - marketing: ad pixels
 *
 * Re-prompt logic: bump COOKIE_POLICY_VERSION when material changes are
 * made to the consent text — older choices are then ignored.
 */

import { useEffect, useState } from 'react';
import { Cookie, ChevronDown, ChevronUp } from 'lucide-react';

import { privacyAPI } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';


export const COOKIE_POLICY_VERSION = '2024-11-01';
const STORAGE_KEY = 'socialstats_cookie_choice';


export function readCookieChoice() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!raw || raw.version !== COOKIE_POLICY_VERSION) return null;
    return raw.choices || null;
  } catch { return null; }
}


export default function CookieBanner() {
  const [choices, setChoices] = useState(() => readCookieChoice());
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [pending, setPending] = useState({
    essential: true,
    functional: true,
    analytics: false,
    marketing: false,
  });
  const auth = useAuth();
  const user = auth?.user;

  useEffect(() => {
    // Re-check storage on auth change (user may have made the choice while logged-out)
    setChoices(readCookieChoice());
  }, [user?.id]);

  if (choices) return null;  // already decided

  function persist(c) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: COOKIE_POLICY_VERSION,
        choices: c,
        decided_at: new Date().toISOString(),
      }));
    } catch { /* ignore */ }
    setChoices(c);

    // If logged in, also persist server-side as UserConsent rows
    if (user) {
      try {
        privacyAPI.setConsent('cookies_analytics', !!c.analytics, 'cookie_banner').catch(() => {});
        privacyAPI.setConsent('cookies_marketing', !!c.marketing, 'cookie_banner').catch(() => {});
      } catch { /* ignore */ }
    }
  }

  function acceptAll() {
    persist({ essential: true, functional: true, analytics: true, marketing: true });
  }
  function essentialOnly() {
    persist({ essential: true, functional: false, analytics: false, marketing: false });
  }
  function saveCustom() {
    persist({ ...pending, essential: true });
  }

  return (
    <div role="dialog" aria-label="Cookie preferences" style={s.wrap}>
      <div style={s.card}>
        <div style={s.header}>
          <Cookie size={18} style={{ color: 'var(--brand-primary-hover)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={s.title}>We use cookies</div>
            <div style={s.subtitle}>
              Essential cookies keep Social Stats working. Analytics + marketing cookies are
              optional — you can change preferences any time in Settings → Data & Privacy.
            </div>
          </div>
        </div>

        {advancedOpen && (
          <div style={s.advanced}>
            <Toggle name="essential" pending={pending} setPending={setPending}
                    label="Essential" desc="Login, security, CSRF — can't be disabled" disabled />
            <Toggle name="functional" pending={pending} setPending={setPending}
                    label="Functional" desc="Theme, language, layout preferences" />
            <Toggle name="analytics" pending={pending} setPending={setPending}
                    label="Analytics" desc="Anonymous usage stats (Posthog)" />
            <Toggle name="marketing" pending={pending} setPending={setPending}
                    label="Marketing" desc="Ad measurement and retargeting" />
          </div>
        )}

        <div style={s.actions}>
          <button type="button" onClick={acceptAll} style={s.btnPrimary}>Accept all</button>
          <button type="button" onClick={essentialOnly} style={s.btnSecondary}>Essential only</button>
          <button type="button" onClick={() => setAdvancedOpen((v) => !v)} style={s.btnGhost}>
            {advancedOpen ? <><ChevronUp size={13} /> Hide options</> : <><ChevronDown size={13} /> Customise</>}
          </button>
          {advancedOpen && (
            <button type="button" onClick={saveCustom} style={s.btnPrimary}>Save preferences</button>
          )}
        </div>
      </div>
    </div>
  );
}


function Toggle({ name, pending, setPending, label, desc, disabled }) {
  const checked = !!pending[name];
  return (
    <label style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '8px 0', borderBottom: '1px solid var(--border-subtle)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.7 : 1,
    }}>
      <input
        type="checkbox" checked={checked} disabled={disabled}
        onChange={(e) => setPending((p) => ({ ...p, [name]: e.target.checked }))}
        style={{ marginTop: 3, accentColor: 'var(--brand-primary)' }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{desc}</div>
      </div>
    </label>
  );
}


const s = {
  wrap: {
    position: 'fixed', bottom: 16, left: 16, right: 16, zIndex: 9000,
    display: 'flex', justifyContent: 'center', pointerEvents: 'none',
  },
  card: {
    pointerEvents: 'auto',
    width: '100%', maxWidth: 720,
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-xl)',
    padding: 18,
  },
  header: { display: 'flex', gap: 10, alignItems: 'flex-start' },
  title: { fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' },
  subtitle: { marginTop: 2, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 },
  advanced: { marginTop: 12 },
  actions: {
    marginTop: 14,
    display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end',
  },
  btnPrimary: {
    padding: '7px 14px', fontSize: 12, fontWeight: 600,
    background: 'var(--brand-primary)', color: '#fff',
    border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer',
  },
  btnSecondary: {
    padding: '7px 14px', fontSize: 12, fontWeight: 600,
    background: 'var(--surface-card)', color: 'var(--text-primary)',
    border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', cursor: 'pointer',
  },
  btnGhost: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '7px 12px', fontSize: 12, fontWeight: 600,
    background: 'transparent', color: 'var(--text-secondary)',
    border: '1px solid transparent', borderRadius: 'var(--radius-md)', cursor: 'pointer',
  },
};
