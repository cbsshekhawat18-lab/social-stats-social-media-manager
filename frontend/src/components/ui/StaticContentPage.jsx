/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useEffect, useMemo, useState } from 'react';
import { contentAPI } from '../../services/api';
import LegalPageLayout from '../marketing/LegalPageLayout';
import Spinner from './Spinner';
import ErrorState from './ErrorState';
import { safeHtml } from '../../utils/sanitize';

/**
 * StaticContentPage — fetches a CMS-managed legal/policy doc by `contentKey`
 * and renders it inside the redesigned LegalPageLayout.
 *
 * Backend payload shape (unchanged):
 *   {
 *     title, effective_date, last_updated,
 *     content: {
 *       sections: [{ title, html }],
 *       footer_link_label,
 *       footer_link_url,
 *     }
 *   }
 */
export default function StaticContentPage({ contentKey, fallbackTitle, eyebrow }) {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError('');
    contentAPI.getPublic(contentKey)
      .then((res) => { if (!ignore) setDoc(res.data); })
      .catch(() => { if (!ignore) setError('Unable to load this page right now.'); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [contentKey, reloadTick]);

  const sections = useMemo(() => {
    if (!doc?.content?.sections) return [];
    return doc.content.sections.map((s, i) => ({
      id: slugify(s.title) || `section-${i + 1}`,
      title: s.title,
      body: <div dangerouslySetInnerHTML={safeHtml(s.html)} />,
    }));
  }, [doc]);

  if (loading) {
    return (
      <LegalPageLayout
        eyebrow={eyebrow}
        title={fallbackTitle}
        sections={[]}
      >
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <Spinner size="md" />
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-tertiary)' }}>Loading content…</div>
        </div>
      </LegalPageLayout>
    );
  }

  if (error || !doc) {
    return (
      <LegalPageLayout eyebrow={eyebrow} title={fallbackTitle} sections={[]}>
        <ErrorState
          title="Couldn't load this page"
          description={error || 'Please try again in a moment.'}
          onRetry={() => setReloadTick((t) => t + 1)}
          compact
        />
      </LegalPageLayout>
    );
  }

  return (
    <LegalPageLayout
      eyebrow={eyebrow}
      title={doc.title || fallbackTitle}
      effectiveDate={doc.effective_date}
      lastUpdated={doc.last_updated}
      sections={sections}
    >
      {doc.content?.footer_link_label && doc.content?.footer_link_url && (
        <p style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border-subtle)', fontSize: 12, color: 'var(--text-tertiary)' }}>
          © {new Date().getFullYear()} SocialStats ·{' '}
          <a href={doc.content.footer_link_url} style={{ color: 'var(--text-link)' }}>
            {doc.content.footer_link_label}
          </a>
        </p>
      )}
    </LegalPageLayout>
  );
}

function slugify(s = '') {
  return s.toLowerCase().trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
