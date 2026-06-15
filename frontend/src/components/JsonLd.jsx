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
 * JsonLd — imperative <script type="application/ld+json"> manager.
 *
 * Renders nothing visually. On mount, injects a JSON-LD block into <head>
 * keyed by `id` so multiple JsonLd blocks can coexist on one page (e.g. an
 * Organization plus a BreadcrumbList plus an Article).
 *
 *   <JsonLd id="article" data={{ '@context': 'https://schema.org', '@type': 'Article', ... }} />
 *
 * On unmount we DON'T remove the script — Google sometimes reads after
 * client transitions and a stale tag is harmless. The next page mounts
 * its own block under a different id (or replaces the same one).
 *
 * Use the helper builders below for common shapes (organization, article,
 * software application, breadcrumb, FAQ).
 */
export default function JsonLd({ id, data }) {
  useEffect(() => {
    if (!data) return;
    const tagId = `jsonld-${id}`;
    let tag = document.getElementById(tagId);
    if (!tag) {
      tag = document.createElement('script');
      tag.type = 'application/ld+json';
      tag.id = tagId;
      document.head.appendChild(tag);
    }
    try {
      tag.textContent = JSON.stringify(data);
    } catch {
      /* ignore — bad payload */
    }
  }, [id, data]);

  return null;
}


// ── shared site identity ──────────────────────────────────────────────
const SITE = {
  name: 'Social Stats',
  url: 'https://socialstats.app',
  logo: 'https://socialstats.app/logo512.png',
  sameAs: [
    'https://twitter.com/socialstats',
    'https://www.linkedin.com/company/socialstats',
    'https://github.com/socialstats',
  ],
};

const ORG_NODE = {
  '@type': 'Organization',
  '@id': `${SITE.url}/#organization`,
  name: SITE.name,
  url: SITE.url,
  logo: SITE.logo,
  sameAs: SITE.sameAs,
};


// ── builders ──────────────────────────────────────────────────────────
export function buildOrganization() {
  return {
    '@context': 'https://schema.org',
    ...ORG_NODE,
    foundingDate: '2024',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'IN',
      addressLocality: 'Bengaluru',
      addressRegion: 'Karnataka',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: 'support@socialstats.app',
      availableLanguage: ['en', 'hi'],
    },
  };
}

export function buildWebSite() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE.url}/#website`,
    url: SITE.url,
    name: SITE.name,
    publisher: { '@id': `${SITE.url}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE.url}/blog?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function buildBreadcrumbs(items) {
  // items: [{ name, url }] — root → leaf
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

export function buildArticle({ title, description, slug, datePublished, dateModified, authorName, image }) {
  const url = `${SITE.url}/blog/${slug}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    datePublished,
    dateModified: dateModified || datePublished,
    author: { '@type': 'Person', name: authorName },
    publisher: ORG_NODE,
    image: image || SITE.logo,
  };
}

export function buildSoftwareApplication({ name, description, image, ratingValue, ratingCount }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: name ? `Social Stats — ${name}` : 'Social Stats',
    description,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web, iOS, Android',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'INR',
      url: `${SITE.url}/pricing`,
    },
    image: image || SITE.logo,
    publisher: ORG_NODE,
    ...(ratingValue && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue,
        ratingCount,
        bestRating: 5,
        worstRating: 1,
      },
    }),
  };
}

export function buildFAQ(items) {
  // items: [{ question, answer }]
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.question,
      acceptedAnswer: { '@type': 'Answer', text: it.answer },
    })),
  };
}

export function buildLocalBusiness({ name, slug, description, location, rating, founded }) {
  const url = `${SITE.url}/agencies/${slug}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name,
    description,
    url,
    foundingDate: String(founded),
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'IN',
      addressLocality: location,
    },
    ...(rating && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: rating.score,
        ratingCount: rating.count,
        bestRating: 5,
        worstRating: 1,
      },
    }),
  };
}

export const SITE_URL = SITE.url;
