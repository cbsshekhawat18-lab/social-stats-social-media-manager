/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * prefetchRoute — kick off the lazy import for a route's chunk *before* the
 * user navigates, so the click feels instant.
 *
 * Use the `prefetchProps(path)` helper to get spread-friendly hover/touch
 * handlers for any <Link>:
 *
 *   <Link to="/pricing" {...prefetchProps('/pricing')}>Pricing</Link>
 *
 * Why hover/focus/touchstart and not on render? Loading every route's chunk
 * up-front defeats the purpose of code splitting. Hover/focus is the earliest
 * confident signal a user will navigate; touchstart fires before the click
 * resolves on mobile, giving us 100-300ms head start.
 *
 * Each path is fetched once per page load — repeated hovers no-op.
 */

// Map URL paths → lazy import functions. Only routes worth prefetching
// (top-of-funnel marketing pages reachable from the nav) live here.
const ROUTE_LOADERS = {
  '/':             () => import('../pages/HomePage'),
  '/pricing':      () => import('../pages/PricingPage'),
  '/customers':    () => import('../pages/CustomersPage'),
  '/blog':         () => import('../pages/BlogIndexPage'),
  '/integrations': () => import('../pages/IntegrationsPage'),
  '/agencies':     () => import('../pages/marketing/AgenciesShowcasePage'),
  '/contact':      () => import('../pages/ContactPage'),
  '/about':        () => import('../pages/AboutPage'),
  '/help':         () => import('../pages/HelpCenterPage'),
};

const _prefetched = new Set();

export function prefetchRoute(path) {
  if (_prefetched.has(path)) return;
  const loader = ROUTE_LOADERS[path];
  if (!loader) return;
  _prefetched.add(path);
  // Fire and forget. The browser caches the JS chunk; React Router's lazy
  // loader will hit the cache on real navigation.
  loader().catch(() => { _prefetched.delete(path); /* allow retry */ });
}

/**
 * Spread on a <Link> to prefetch on first hover/focus/touch:
 *   <Link to="/pricing" {...prefetchProps('/pricing')}>Pricing</Link>
 */
export function prefetchProps(path) {
  return {
    onMouseEnter: () => prefetchRoute(path),
    onTouchStart: () => prefetchRoute(path),
    onFocus:      () => prefetchRoute(path),
  };
}
