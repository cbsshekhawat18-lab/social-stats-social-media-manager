import { useEffect, useState } from 'react';
import { StatoxLogoHorizontal } from './StatoxLogo';
import { contentAPI } from '../../services/api';

export default function StaticContentPage({ contentKey, fallbackTitle }) {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await contentAPI.getPublic(contentKey);
        if (!ignore) setDoc(res.data);
      } catch {
        if (!ignore) setError('Unable to load this page right now.');
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();
    return () => { ignore = true; };
  }, [contentKey]);

  const sections = doc?.content?.sections || [];
  const footerLabel = doc?.content?.footer_link_label;
  const footerUrl = doc?.content?.footer_link_url;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.logoPlate}>
            <StatoxLogoHorizontal height={32} />
          </div>
        </div>

        <div style={styles.card}>
          <h2 style={styles.title}>{doc?.title || fallbackTitle}</h2>
          {!loading && doc && (
            <p style={styles.meta}>
              Effective Date: {formatDate(doc.effective_date)} · Last Updated: {formatDate(doc.last_updated)}
            </p>
          )}

          {loading ? (
            <p style={styles.p}>Loading content…</p>
          ) : error ? (
            <p style={styles.error}>{error}</p>
          ) : (
            sections.map((section) => (
              <div key={section.title} style={{ marginBottom: 32 }}>
                <h3 style={sectionStyles.heading}>{section.title}</h3>
                <div
                  style={sectionStyles.body}
                  dangerouslySetInnerHTML={{ __html: section.html || '' }}
                />
              </div>
            ))
          )}
        </div>

        {(footerLabel && footerUrl) && (
          <p style={styles.footer}>
            © 2026 StatoX · <a href={footerUrl} style={styles.footerLink}>{footerLabel}</a>
          </p>
        )}
      </div>
    </div>
  );
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const sectionStyles = {
  heading: { fontSize: 16, fontWeight: 700, color: '#007a9a', marginBottom: 10, marginTop: 0 },
  body: { color: '#334155', fontSize: 14, lineHeight: 1.7 },
};

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f0f4f9',
    padding: '40px 16px',
  },
  container: {
    maxWidth: 760,
    margin: '0 auto',
  },
  header: {
    textAlign: 'center',
    marginBottom: 32,
  },
  logoPlate: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 20px',
    borderRadius: 18,
    background: '#fff',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 16px rgba(0,215,255,0.08)',
  },
  card: {
    background: '#fff',
    borderRadius: 20,
    padding: '48px 48px',
    boxShadow: '0 8px 32px rgba(15,23,42,.07)',
    border: '1px solid #e2e8f0',
  },
  title: { fontSize: 26, fontWeight: 800, color: '#0f172a', marginTop: 0, marginBottom: 6 },
  meta: { fontSize: 12, color: '#94a3b8', marginBottom: 36, marginTop: 0 },
  p: { margin: '0 0 10px', color: '#334155', fontSize: 14, lineHeight: 1.7 },
  error: {
    margin: 0,
    padding: '12px 14px',
    borderRadius: 10,
    background: '#fef2f2',
    color: '#b91c1c',
    fontSize: 14,
  },
  footer: { textAlign: 'center', color: '#64748b', fontSize: 12, marginTop: 24 },
  footerLink: { color: '#00d7ff', textDecoration: 'none' },
};
