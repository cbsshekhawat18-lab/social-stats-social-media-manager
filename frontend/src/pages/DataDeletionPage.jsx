/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { BrandLogoHorizontal } from '../components/ui/BrandLogo';
import SocialPlatformIcon from '../components/ui/SocialPlatformIcon';

const PLATFORMS = [
  {
    key: 'facebook',
    label: 'Facebook & Instagram',
    badge: 'Meta',
    steps: [
      <>Go to your <strong>Facebook account</strong> and click the top-right menu</>,
      <><strong>Settings &amp; Privacy</strong> → <strong>Settings</strong></>,
      <>Click <strong>Apps and Websites</strong> in the left menu</>,
      <>Find <strong>Social Stats</strong> in the list → click <strong>View and edit</strong></>,
      <>Scroll down and click <strong>Remove</strong> → <strong>Remove</strong> to confirm</>,
      <>Meta automatically notifies our servers via our registered data deletion callback — we will delete your data within 30 days</>,
    ],
    note: 'Removing Social Stats also revokes access to any connected Instagram Business accounts linked to the same Facebook Page.',
  },
  {
    key: 'google',
    label: 'Google & YouTube',
    badge: 'Google',
    steps: [
      <>Go to <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer" style={{ color: '#007a9a' }}>myaccount.google.com/permissions</a></>,
      <>Find <strong>Social Stats</strong> in the list of third-party apps</>,
      <>Click <strong>Social Stats</strong> → click <strong>Remove Access</strong></>,
      <>Confirm removal — we will delete your cached analytics data within 30 days</>,
    ],
    note: 'This revokes Social Stats\'s access to YouTube Data API, YouTube Analytics API, and Google Business Profile API data.',
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    badge: 'LinkedIn',
    steps: [
      <>Go to your <strong>LinkedIn account</strong> and click <strong>Me</strong> in the top navigation</>,
      <>Click <strong>Settings &amp; Privacy</strong></>,
      <>Click <strong>Data Privacy</strong> in the left menu → <strong>Other applications</strong></>,
      <>Find <strong>Social Stats</strong> in the list → click <strong>Remove</strong></>,
      <>Confirm removal — we will delete your cached Page analytics data within 30 days</>,
    ],
    note: 'This revokes access to your LinkedIn Page analytics, post performance data, and follower statistics.',
  },
];

export default function DataDeletionPage() {
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <a href="/" style={styles.logoLink}>
            <div style={styles.logoPlate}>
              <BrandLogoHorizontal height={32} />
            </div>
          </a>
        </div>

        <div style={styles.card}>
          <div style={styles.badge}>Data Deletion Instructions</div>
          <h2 style={styles.title}>User Data Deletion</h2>
          <p style={styles.meta}>Last Updated: April 3, 2026</p>

          <p style={styles.intro}>
            Social Stats connects to Facebook, Instagram, Google, YouTube, and LinkedIn to display
            your social media analytics. You can revoke access and delete your data in three ways:{' '}
            <strong>(1)</strong> directly from each platform's settings below,{' '}
            <strong>(2)</strong> from your Social Stats account settings (Settings → Delete Account), or{' '}
            <strong>(3)</strong> by emailing us at{' '}
            <a href="mailto:support@socialstats.app" style={{ color: '#007a9a' }}>support@socialstats.app</a>.
            All data is permanently deleted within <strong>30 days</strong> of a valid request.
          </p>

          {/* Per-platform sections */}
          <h3 style={styles.sectionGroupTitle}>Remove Access by Platform</h3>

          {PLATFORMS.map((platform) => (
            <div key={platform.key} style={styles.platformBlock}>
              <div style={styles.platformHeader}>
                <span style={styles.platformIcon}>
                  <SocialPlatformIcon platform={platform.key} size={28} />
                </span>
                <div>
                  <div style={styles.platformLabel}>{platform.label}</div>
                  <div style={styles.platformBadge}>{platform.badge}</div>
                </div>
              </div>
              <ol style={styles.ol}>
                {platform.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
              <div style={styles.noteBox}>
                <span style={styles.noteIcon}>ℹ</span>
                <span style={styles.noteText}>{platform.note}</span>
              </div>
            </div>
          ))}

          {/* Email request */}
          <div style={styles.divider} />

          <h3 style={styles.sectionGroupTitle}>Or — Email Us Directly</h3>
          <p style={styles.p}>
            If you prefer, send a deletion request to our privacy team and we will remove
            all data across all connected platforms:
          </p>
          <div style={styles.emailBox}>
            <span style={styles.emailIcon}>✉</span>
            <a href="mailto:support@socialstats.app" style={styles.emailLink}>
              support@socialstats.app
            </a>
          </div>
          <p style={styles.p}>Please include in your email:</p>
          <ul style={styles.ul}>
            <li>Your full name</li>
            <li>Email address associated with your Social Stats account</li>
            <li>Platform(s) you want data removed from (Facebook, Google, LinkedIn, or all)</li>
            <li>Subject line: <strong>"Data Deletion Request"</strong></li>
          </ul>

          <div style={styles.divider} />

          {/* What we delete */}
          <h3 style={styles.sectionGroupTitle}>What We Delete</h3>
          <p style={styles.p}>Upon a valid request, we permanently remove:</p>
          <ul style={styles.ul}>
            <li>Your Social Stats account and login credentials</li>
            <li>All OAuth access tokens for every connected platform</li>
            <li>All analytics data: impressions, reach, likes, follower counts, post metrics</li>
            <li>Any reports or exports generated from your data</li>
            <li>Scheduled sync jobs associated with your accounts</li>
          </ul>

          <div style={styles.divider} />

          {/* Timeline */}
          <h3 style={styles.sectionGroupTitle}>Confirmation &amp; Timeline</h3>
          <ul style={styles.ul}>
            <li>Confirmation email sent within <strong>72 hours</strong></li>
            <li>All data permanently deleted within <strong>30 days</strong></li>
            <li>Final confirmation email once deletion is complete</li>
            <li>Anonymised aggregate data may be kept for legal compliance — never linked to your identity</li>
          </ul>

          <div style={styles.contactBox}>
            <p style={styles.contactTitle}>Questions?</p>
            <p style={styles.contactText}>
              Contact our privacy team at{' '}
              <a href="mailto:support@socialstats.app" style={styles.inlineLink}>support@socialstats.app</a>
              {' '}or visit our{' '}
              <a href="/privacy" style={styles.inlineLink}>Privacy Policy</a>.
            </p>
          </div>
        </div>

        <p style={styles.footer}>
          © 2026 Social Stats ·{' '}
          <a href="/privacy" style={styles.footerLink}>Privacy Policy</a>{' '}·{' '}
          <a href="/terms" style={styles.footerLink}>Terms of Service</a>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: 'var(--surface-page)', padding: '40px 16px' },
  container: { maxWidth: 760, margin: '0 auto' },
  header: { textAlign: 'center', marginBottom: 32 },
  logoPlate: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: '12px 20px', borderRadius: 18, background: 'var(--surface-card)',
    border: '1px solid var(--border-default)', boxShadow: '0 4px 16px rgba(0,215,255,0.08)',
  },
  card: {
    background: 'var(--surface-card)', borderRadius: 20, padding: '48px 48px',
    boxShadow: '0 8px 32px rgba(15,23,42,.07)', border: '1px solid var(--border-default)',
  },
  badge: {
    display: 'inline-block', padding: '4px 12px', borderRadius: 999,
    background: '#e6fbff', color: '#007a9a', fontSize: 11, fontWeight: 700,
    letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14,
    border: '1px solid #99eeff',
  },
  title: { fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', marginTop: 0, marginBottom: 6 },
  meta: { fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 24, marginTop: 0 },
  intro: {
    fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8,
    background: 'var(--surface-page)', borderRadius: 12, padding: '16px 18px',
    marginBottom: 32, border: '1px solid var(--border-default)',
  },
  sectionGroupTitle: {
    fontSize: 17, fontWeight: 800, color: 'var(--text-primary)',
    margin: '0 0 20px', paddingBottom: 10,
    borderBottom: '2px solid #e6fbff',
  },
  platformBlock: {
    marginBottom: 28, padding: '20px 22px', borderRadius: 14,
    border: '1px solid var(--border-default)', background: '#fafcff',
  },
  platformHeader: {
    display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14,
  },
  platformIcon: { fontSize: 28, lineHeight: 1 },
  platformLabel: { fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 },
  platformBadge: {
    display: 'inline-block', fontSize: 11, fontWeight: 700,
    color: '#007a9a', background: '#e6fbff', border: '1px solid #99eeff',
    borderRadius: 999, padding: '1px 8px', letterSpacing: '0.06em',
  },
  noteBox: {
    display: 'flex', alignItems: 'flex-start', gap: 8,
    marginTop: 12, background: 'var(--surface-page)', borderRadius: 8,
    padding: '10px 14px', border: '1px solid var(--border-default)',
  },
  noteIcon: { fontSize: 14, color: '#007a9a', flexShrink: 0, marginTop: 1 },
  noteText: { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 },
  divider: { height: 1, background: 'var(--border-default)', margin: '32px 0' },
  p: { margin: '0 0 10px', color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7 },
  ol: { margin: '0 0 10px', paddingLeft: 20, color: 'var(--text-secondary)', fontSize: 14, lineHeight: 2.1 },
  ul: { margin: '0 0 10px', paddingLeft: 20, color: 'var(--text-secondary)', fontSize: 14, lineHeight: 2.1 },
  emailBox: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: '#e6fbff', border: '1px solid #99eeff',
    borderRadius: 10, padding: '12px 16px', marginBottom: 16,
  },
  emailIcon: { fontSize: 18, color: '#007a9a' },
  emailLink: { color: '#007a9a', fontWeight: 700, fontSize: 15, textDecoration: 'none' },
  contactBox: {
    marginTop: 8, background: 'var(--surface-page)', borderRadius: 12,
    padding: '20px 22px', border: '1px solid var(--border-default)',
  },
  contactTitle: { margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' },
  contactText: { margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 },
  inlineLink: { color: '#007a9a', fontWeight: 600, textDecoration: 'none' },
  footer: { textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12, marginTop: 24 },
  footerLink: { color: '#007a9a', textDecoration: 'none' },
  logoLink: { display: 'inline-flex', textDecoration: 'none' },
};
