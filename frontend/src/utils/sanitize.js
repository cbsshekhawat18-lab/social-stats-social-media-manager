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
 * Use this anywhere you'd otherwise pass server-supplied HTML to
 * `dangerouslySetInnerHTML`. Static CSS / SVG / template strings written
 * by us in source code don't need it.
 *
 * Returns an object suitable for direct assignment:
 *     <div dangerouslySetInnerHTML={safeHtml(content)} />
 */
import DOMPurify from 'dompurify';

const DEFAULT_CONFIG = {
  // Block JavaScript URLs + event handlers + form/embed/object/iframe vectors.
  // Allow common formatting + links.
  ALLOWED_TAGS: [
    'a', 'b', 'br', 'code', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'hr', 'i', 'img', 'li', 'ol', 'p', 'pre', 'span', 'strong', 'sub', 'sup',
    'table', 'tbody', 'td', 'th', 'thead', 'tr', 'u', 'ul',
  ],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel', 'class', 'style'],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|data:image\/)/i,
  // Force any rendered <a> through rel=noopener noreferrer noindex
  ADD_ATTR: ['target'],
};

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.hasAttribute('href')) {
    node.setAttribute('rel', 'noopener noreferrer nofollow');
    if (node.getAttribute('target') !== '_self') node.setAttribute('target', '_blank');
  }
});

export function sanitizeHtml(rawHtml, config = {}) {
  if (!rawHtml) return '';
  return DOMPurify.sanitize(String(rawHtml), { ...DEFAULT_CONFIG, ...config });
}

export function safeHtml(rawHtml, config = {}) {
  return { __html: sanitizeHtml(rawHtml, config) };
}
