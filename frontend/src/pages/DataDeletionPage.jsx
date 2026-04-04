import { StatoxLogoHorizontal } from '../components/ui/StatoxLogo';
import SocialPlatformIcon from '../components/ui/SocialPlatformIcon';

const PLATFORMS = [
  {
    key: 'facebook',
    label: 'Facebook & Instagram',
    badge: 'Meta',
    steps: [
      <>Go to your <strong>Facebook account</strong></>,
      <><strong>Settings &amp; Privacy</strong> → <strong>Settings</strong></>,
      <>Click <strong>Apps and Websites</strong> in the left menu</>,
      <>Find <strong>StatoX</strong> in the list → click <strong>Remove</strong></>,
      <>Confirm removal — this triggers data deletion on our servers</>,
    ],
    note: 'This also revokes access to any connected Instagram accounts linked to the same Facebook Page.',
  },
  {
    key: 'google',
    label: 'Google & YouTube',
    badge: 'Google',
    steps: [
      <>Go to <strong>myaccount.google.com</strong></>,
      <>Click <strong>Security</strong> in the left menu</>,
      <>Scroll to <strong>Third-party apps with account access</strong> → click <strong>Manage third-party access</strong></>,
      <>Find <strong>StatoX</strong> → click it → click <strong>Remove Access</strong></>,
      <>Confirm — this revokes access to YouTube and Google My Business data</>,
    ],
    note: 'This removes access to YouTube Data API, YouTube Analytics API, and Business Profile API data.',
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    badge: 'LinkedIn',
    steps: [
      <>Go to your <strong>LinkedIn account</strong></>,
      <>Click <strong>Me</strong> → <strong>Settings &amp; Privacy</strong></>,
      <>Click <strong>Data Privacy</strong> → <strong>Other applications</strong></>,
      <>Find <strong>StatoX</strong> → click <strong>Remove</strong></>,
      <>Confirm removal</>,
    ],
    note: 'This revokes access to your LinkedIn Page analytics and post performance data.',
  },
];

export default function DataDeletionPage() {
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.logoPlate}>
            <StatoxLogoHorizontal height={32} />
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.badge}>Data Deletion Instructions</div>
          <h2 style={styles.title}>User Data Deletion</h2>
          <p style={styles.meta}>Last Updated: April 3, 2026</p>

          <p style={styles.intro}>
            StatoX connects to Facebook, Instagram, Google, YouTube, and LinkedIn to display
            your social media analytics. If you'd like to delete your data, you can revoke
            access directly from each platform's settings, or contact us and we'll handle it
            within <strong>30 days</strong>.
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
            <a href="mailto:privacy@statox.ai" style={styles.emailLink}>
              privacy@statox.ai
            </a>
          </div>
          <p style={styles.p}>Please include in your email:</p>
          <ul style={styles.ul}>
            <li>Your full name</li>
            <li>Email address associated with your StatoX account</li>
            <li>Platform(s) you want data removed from (Facebook, Google, LinkedIn, or all)</li>
            <li>Subject line: <strong>"Data Deletion Request"</strong></li>
          </ul>

          <div style={styles.divider} />

          {/* What we delete */}
          <h3 style={styles.sectionGroupTitle}>What We Delete</h3>
          <p style={styles.p}>Upon a valid request, we permanently remove:</p>
          <ul style={styles.ul}>
            <li>Your StatoX account and login credentials</li>
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
              <a href="mailto:privacy@statox.ai" style={styles.inlineLink}>privacy@statox.ai</a>
              {' '}or visit our{' '}
              <a href="/privacy" style={styles.inlineLink}>Privacy Policy</a>.
            </p>
          </div>
        </div>

        <p style={styles.footer}>
          © 2026 StatoX ·{' '}
          <a href="/privacy" style={styles.footerLink}>Privacy Policy</a>{' '}·{' '}
          <a href="/terms" style={styles.footerLink}>Terms of Service</a>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#f0f4f9', padding: '40px 16px' },
  container: { maxWidth: 760, margin: '0 auto' },
  header: { textAlign: 'center', marginBottom: 32 },
  logoPlate: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: '12px 20px', borderRadius: 18, background: '#fff',
    border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,215,255,0.08)',
  },
  card: {
    background: '#fff', borderRadius: 20, padding: '48px 48px',
    boxShadow: '0 8px 32px rgba(15,23,42,.07)', border: '1px solid #e2e8f0',
  },
  badge: {
    display: 'inline-block', padding: '4px 12px', borderRadius: 999,
    background: '#e6fbff', color: '#007a9a', fontSize: 11, fontWeight: 700,
    letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14,
    border: '1px solid #99eeff',
  },
  title: { fontSize: 26, fontWeight: 800, color: '#0f172a', marginTop: 0, marginBottom: 6 },
  meta: { fontSize: 12, color: '#94a3b8', marginBottom: 24, marginTop: 0 },
  intro: {
    fontSize: 14, color: '#334155', lineHeight: 1.8,
    background: '#f0f4f9', borderRadius: 12, padding: '16px 18px',
    marginBottom: 32, border: '1px solid #e2e8f0',
  },
  sectionGroupTitle: {
    fontSize: 17, fontWeight: 800, color: '#0f172a',
    margin: '0 0 20px', paddingBottom: 10,
    borderBottom: '2px solid #e6fbff',
  },
  platformBlock: {
    marginBottom: 28, padding: '20px 22px', borderRadius: 14,
    border: '1px solid #e2e8f0', background: '#fafcff',
  },
  platformHeader: {
    display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14,
  },
  platformIcon: { fontSize: 28, lineHeight: 1 },
  platformLabel: { fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 2 },
  platformBadge: {
    display: 'inline-block', fontSize: 11, fontWeight: 700,
    color: '#007a9a', background: '#e6fbff', border: '1px solid #99eeff',
    borderRadius: 999, padding: '1px 8px', letterSpacing: '0.06em',
  },
  noteBox: {
    display: 'flex', alignItems: 'flex-start', gap: 8,
    marginTop: 12, background: '#f0f4f9', borderRadius: 8,
    padding: '10px 14px', border: '1px solid #e2e8f0',
  },
  noteIcon: { fontSize: 14, color: '#007a9a', flexShrink: 0, marginTop: 1 },
  noteText: { fontSize: 13, color: '#475569', lineHeight: 1.6 },
  divider: { height: 1, background: '#e2e8f0', margin: '32px 0' },
  p: { margin: '0 0 10px', color: '#334155', fontSize: 14, lineHeight: 1.7 },
  ol: { margin: '0 0 10px', paddingLeft: 20, color: '#334155', fontSize: 14, lineHeight: 2.1 },
  ul: { margin: '0 0 10px', paddingLeft: 20, color: '#334155', fontSize: 14, lineHeight: 2.1 },
  emailBox: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: '#e6fbff', border: '1px solid #99eeff',
    borderRadius: 10, padding: '12px 16px', marginBottom: 16,
  },
  emailIcon: { fontSize: 18, color: '#007a9a' },
  emailLink: { color: '#007a9a', fontWeight: 700, fontSize: 15, textDecoration: 'none' },
  contactBox: {
    marginTop: 8, background: '#f0f4f9', borderRadius: 12,
    padding: '20px 22px', border: '1px solid #e2e8f0',
  },
  contactTitle: { margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: '#0f172a' },
  contactText: { margin: 0, fontSize: 14, color: '#334155', lineHeight: 1.7 },
  inlineLink: { color: '#007a9a', fontWeight: 600, textDecoration: 'none' },
  footer: { textAlign: 'center', color: '#64748b', fontSize: 12, marginTop: 24 },
  footerLink: { color: '#007a9a', textDecoration: 'none' },
};
