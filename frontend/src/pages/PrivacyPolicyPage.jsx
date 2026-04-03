import { StatoxLogoHorizontal } from '../components/ui/StatoxLogo';

export default function PrivacyPolicyPage() {
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logoPlate}>
            <StatoxLogoHorizontal height={32} />
          </div>
        </div>

        <div style={styles.card}>
          <h2 style={styles.title}>Privacy Policy</h2>
          <p style={styles.meta}>Effective Date: April 3, 2026 · Last Updated: April 3, 2026</p>

          <Section title="1. Introduction">
            StatoX ("we", "our", or "us") operates a social media analytics platform that
            connects to Facebook, Instagram, Google, YouTube, and LinkedIn to display performance
            statistics for your social media accounts. We are committed to protecting your privacy.
            This Privacy Policy explains what data we collect, how we use it, and your rights.
          </Section>

          <Section title="2. Data We Collect">
            <p style={styles.p}>We collect only the data necessary to provide analytics. This includes:</p>
            <ul style={styles.ul}>
              <li><strong>Account identifiers</strong> — page IDs, channel IDs, and profile IDs from connected accounts</li>
              <li><strong>Performance metrics</strong> — reach, impressions, likes, comments, shares, follower counts, and engagement rates</li>
              <li><strong>Post data</strong> — post content, published timestamps, and per-post metrics</li>
              <li><strong>Basic profile info</strong> — name and profile picture of connected pages/accounts</li>
              <li><strong>Authentication tokens</strong> — OAuth access tokens and refresh tokens to fetch data on your behalf</li>
            </ul>
            <p style={styles.p}>We do <strong>not</strong> collect passwords, private messages, or any data unrelated to analytics.</p>
          </Section>

          <Section title="3. How We Use Your Data">
            <ul style={styles.ul}>
              <li>Display analytics dashboards and reports for your connected accounts</li>
              <li>Sync performance data on a scheduled basis so your stats stay current</li>
              <li>Generate insights and recommendations based on your performance trends</li>
              <li>Send reports to email addresses you provide</li>
            </ul>
            <p style={styles.p}>We do <strong>not</strong> sell, rent, or share your data with third parties for advertising or marketing purposes.</p>
          </Section>

          <Section title="4. Facebook & Instagram Data">
            <p style={styles.p}>
              We access Facebook and Instagram data through the Meta Graph API under your explicit
              authorization. We request only the permissions required to read page/account analytics
              (e.g. <code style={styles.code}>pages_read_engagement</code>, <code style={styles.code}>instagram_basic</code>,{' '}
              <code style={styles.code}>instagram_manage_insights</code>).
            </p>
            <p style={styles.p}>
              Data obtained from Meta APIs is used solely to display statistics within StatoX.
              We comply with the{' '}
              <a href="https://developers.facebook.com/policy/" target="_blank" rel="noreferrer" style={styles.link}>
                Meta Platform Terms
              </a>{' '}
              and{' '}
              <a href="https://developers.facebook.com/devpolicy/" target="_blank" rel="noreferrer" style={styles.link}>
                Meta Developer Policies
              </a>.
            </p>
          </Section>

          <Section title="5. Google & YouTube Data">
            <p style={styles.p}>
              We access Google and YouTube data through the Google APIs under your explicit
              authorization. We request only scopes required for reading analytics
              (e.g. <code style={styles.code}>youtube.readonly</code>,{' '}
              <code style={styles.code}>yt-analytics.readonly</code>).
            </p>
            <p style={styles.p}>
              Our use of data received from Google APIs complies with the{' '}
              <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer" style={styles.link}>
                Google API Services User Data Policy
              </a>, including the Limited Use requirements.
            </p>
          </Section>

          <Section title="6. LinkedIn Data">
            <p style={styles.p}>
              We access LinkedIn data through the LinkedIn Marketing API under your explicit
              authorization. We request only scopes required to read page and post analytics.
            </p>
            <p style={styles.p}>
              We comply with{' '}
              <a href="https://legal.linkedin.com/api-terms-of-use" target="_blank" rel="noreferrer" style={styles.link}>
                LinkedIn API Terms of Use
              </a>.
            </p>
          </Section>

          <Section title="7. Data Retention">
            <ul style={styles.ul}>
              <li>Analytics data is retained for as long as you maintain an active account</li>
              <li>OAuth tokens are securely stored and refreshed automatically</li>
              <li>You can request deletion of all your data at any time by contacting us</li>
              <li>Upon account deletion, all associated data is permanently removed within 30 days</li>
            </ul>
          </Section>

          <Section title="8. Data Security">
            <p style={styles.p}>
              We use industry-standard security practices including encrypted storage for tokens,
              HTTPS for all data transmission, and restricted access controls. No system is 100%
              secure, but we take reasonable measures to protect your information.
            </p>
          </Section>

          <Section title="9. Your Rights">
            <ul style={styles.ul}>
              <li><strong>Access</strong> — request a copy of the data we hold about you</li>
              <li><strong>Correction</strong> — request corrections to inaccurate data</li>
              <li><strong>Deletion</strong> — request deletion of your account and all associated data</li>
              <li><strong>Revoke access</strong> — disconnect any social account at any time from Settings</li>
            </ul>
          </Section>

          <Section title="10. Contact Us">
            <p style={styles.p}>
              For privacy-related questions or requests, contact us at:
            </p>
            <p style={styles.p}>
              <strong>Email:</strong> privacy@statox.ai<br />
              <strong>Website:</strong> https://statox.ai
            </p>
          </Section>
        </div>

        <p style={styles.footer}>
          © 2026 StatoX · <a href="/terms" style={styles.footerLink}>Terms of Service</a>
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h3 style={sectionStyles.heading}>{title}</h3>
      <div style={sectionStyles.body}>{children}</div>
    </div>
  );
}

// 3 brand colours: cyan · dark navy · light
const C = { cyan: '#00d7ff', dark: '#0f172a', light: '#f0f4f9' };  // light theme

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
  ul: { margin: '0 0 10px', paddingLeft: 20, color: '#334155', fontSize: 14, lineHeight: 1.9 },
  code: {
    background: `${C.cyan}18`, padding: '1px 6px', borderRadius: 4,
    fontFamily: 'monospace', fontSize: 12, color: C.dark,
  },
  link: { color: C.cyan, textDecoration: 'none' },
  footer: { textAlign: 'center', color: '#64748b', fontSize: 12, marginTop: 24 },
  footerLink: { color: C.cyan, textDecoration: 'none' },
};
