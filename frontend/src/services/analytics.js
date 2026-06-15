/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * analytics.js — privacy-first marketing analytics wrapper.
 *
 * Default vendor is Plausible (no third-party trackers, GDPR/DPDP friendly,
 * no cookie banner required for EU). Configure via env:
 *
 *   REACT_APP_PLAUSIBLE_DOMAIN  e.g. "socialstats.app"
 *   REACT_APP_PLAUSIBLE_HOST    optional, e.g. "https://plausible.socialstats.app"
 *
 * If REACT_APP_PLAUSIBLE_DOMAIN is missing, every method is a no-op.
 *
 * Consent: respects the existing cookie-consent toggle stored at
 * `localStorage.socialstats_cookie_prefs` by CookiePolicyPage. The "analytics"
 * key gates everything in this module. Also respects the browser's
 * Do Not Track header — DNT off + analytics consent on = tracking. Either
 * one off = silent no-op.
 *
 * Public API:
 *   init()                           call once on app boot
 *   pageview(path?, props?)          fired automatically on route change
 *   track(event, props?)             fire conversion events
 *   identify(userId, traits?)        link a logged-in user
 *
 * `event` is a short string like "signup_click", "plan_selected".
 * `props` is a flat dict of strings/numbers — no nested objects.
 */

const DOMAIN = process.env.REACT_APP_PLAUSIBLE_DOMAIN;
const HOST   = process.env.REACT_APP_PLAUSIBLE_HOST || 'https://plausible.io';
const SCRIPT_ID = 'plausible-script';

let scriptInjected = false;

function dntEnabled() {
  if (typeof navigator === 'undefined') return false;
  // navigator.doNotTrack: '1' = on, '0' = off, null/'unspecified' = unset
  // navigator.msDoNotTrack on old IE; window.doNotTrack on Safari
  const v = navigator.doNotTrack
        || window.doNotTrack
        || navigator.msDoNotTrack;
  return v === '1' || v === 'yes';
}

function consentGranted() {
  try {
    const raw = window.localStorage.getItem('socialstats_cookie_prefs');
    if (!raw) return false;
    const prefs = JSON.parse(raw);
    return prefs?.analytics === true;
  } catch {
    return false;
  }
}

function shouldTrack() {
  if (!DOMAIN) return false;
  if (dntEnabled()) return false;
  return consentGranted();
}

function ensureScript() {
  if (scriptInjected || typeof document === 'undefined') return;
  if (document.getElementById(SCRIPT_ID)) {
    scriptInjected = true;
    return;
  }
  const s = document.createElement('script');
  s.id = SCRIPT_ID;
  s.defer = true;
  s.dataset.domain = DOMAIN;
  s.src = `${HOST}/js/script.js`;
  s.onerror = () => { /* network blocked or script-blocker active — silent */ };
  document.head.appendChild(s);
  scriptInjected = true;

  // Plausible queue shim — ensures track calls before the script loads still land.
  if (!window.plausible) {
    window.plausible = function () {
      (window.plausible.q = window.plausible.q || []).push(arguments);
    };
  }
}

/**
 * Call once on app boot. Idempotent. Safe to call when consent is missing —
 * the script only loads when consent is granted.
 */
export function init() {
  if (!shouldTrack()) return;
  ensureScript();
}

/**
 * Fire a page-view event. `path` defaults to current location. Plausible
 * will use document.title automatically.
 */
export function pageview(_path, props) {
  if (!shouldTrack()) return;
  ensureScript();
  if (typeof window === 'undefined' || !window.plausible) return;
  // Plausible's pageview is implicit when the script loads, but on SPA route
  // changes we re-fire it via `pageview` event. Custom props piggyback.
  try {
    window.plausible('pageview', props ? { props } : undefined);
  } catch {
    /* swallow */
  }
}

/**
 * Fire a custom conversion event.
 *   track('signup_click', { source: 'home_hero' })
 *   track('plan_selected', { plan: 'growth', billing: 'annual' })
 */
export function track(event, props) {
  if (!shouldTrack()) return;
  if (!event || typeof event !== 'string') return;
  ensureScript();
  if (typeof window === 'undefined' || !window.plausible) return;
  try {
    window.plausible(event, props ? { props: cleanProps(props) } : undefined);
  } catch {
    /* swallow */
  }
}

/**
 * Identify the current user. Plausible doesn't store user IDs (privacy by
 * design) — we just include the role/plan as event props on subsequent calls.
 * This is here as a stable surface so other vendors can be swapped in later.
 */
let _identity = null;
export function identify(userId, traits = {}) {
  _identity = { userId, ...traits };
}

export function getIdentity() { return _identity; }

// Plausible only accepts string/number props — coerce safely.
function cleanProps(props) {
  const out = {};
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null) continue;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = String(v).slice(0, 200);
    }
  }
  return out;
}

const analytics = { init, pageview, track, identify, getIdentity };
export default analytics;
