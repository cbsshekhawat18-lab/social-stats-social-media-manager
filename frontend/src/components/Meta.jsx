/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useEffect } from 'react';

/**
 * Meta — imperative document head manager. No extra dependency.
 *
 * Renders nothing. On mount and whenever its props change, updates:
 *   - <title>
 *   - <meta name="description">
 *   - canonical link
 *   - Open Graph tags (og:title, og:description, og:image, og:url, og:type)
 *   - Twitter Card tags (twitter:card, twitter:title, twitter:description, twitter:image)
 *
 * Stack-aware: when the next page mounts a new <Meta>, it overwrites these
 * tags. Untouched tags (favicon, theme-color etc.) stay where they are.
 *
 * Props:
 *   title:       page-specific title (gets " · Social Stats" suffix unless `noSuffix`)
 *   description: meta description / og:description / twitter:description
 *   image:       og:image / twitter:image (absolute URL)
 *   url:         canonical / og:url (defaults to current location.href)
 *   type:        og:type (default 'website'; use 'article' for blog posts)
 *   noSuffix:    bool — drop the " · Social Stats" suffix (use for the home page)
 */
const SITE_NAME = 'Social Stats';
const DEFAULT_DESCRIPTION =
  'Social Stats — the marketing OS for modern agencies. Manage analytics, messaging, and ads for every client from one beautiful dashboard.';
const DEFAULT_IMAGE = '/og-image.png';

export default function Meta({
  title,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
  url,
  type = 'website',
  noSuffix = false,
}) {
  useEffect(() => {
    const fullTitle = title
      ? (noSuffix ? title : `${title} · ${SITE_NAME}`)
      : `${SITE_NAME} — The marketing OS for modern agencies`;

    document.title = fullTitle;
    setMetaName('description', description);

    const canonical = url || (typeof window !== 'undefined' ? window.location.href : '');
    setLink('canonical', canonical);

    // Open Graph
    setMetaProp('og:title',       fullTitle);
    setMetaProp('og:description', description);
    setMetaProp('og:type',        type);
    setMetaProp('og:url',         canonical);
    setMetaProp('og:image',       absUrl(image));
    setMetaProp('og:site_name',   SITE_NAME);

    // Twitter
    setMetaName('twitter:card',        'summary_large_image');
    setMetaName('twitter:title',       fullTitle);
    setMetaName('twitter:description', description);
    setMetaName('twitter:image',       absUrl(image));
    setMetaName('twitter:site',        '@socialstats');
  }, [title, description, image, url, type, noSuffix]);

  return null;
}

function absUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  if (typeof window === 'undefined') return path;
  return new URL(path, window.location.origin).toString();
}

function setMetaName(name, content) {
  setMetaTag('name', name, content);
}
function setMetaProp(prop, content) {
  setMetaTag('property', prop, content);
}
function setMetaTag(attr, key, content) {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content || '');
}
function setLink(rel, href) {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href || '');
}
