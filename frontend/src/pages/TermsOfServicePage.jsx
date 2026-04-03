import { StatoxLogoHorizontal } from '../components/ui/StatoxLogo';

export default function TermsOfServicePage() {
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
          <h2 style={styles.title}>Terms of Service</h2>
          <p style={styles.meta}>Effective Date: April 3, 2026 · Last Updated: April 3, 2026</p>

          <Section title="1. Acceptance of Terms">
            By accessing or using StatoX ("the Service"), you agree to be bound by these
            Terms of Service. If you do not agree, do not use the Service. We may update these
            terms at any time; continued use of the Service constitutes acceptance of any changes.
          </Section>

          <Section title="2. Description of Service">
            <p style={styles.p}>
              StatoX is a social media analytics platform that connects to your Facebook,
              Instagram, Google, YouTube, and LinkedIn accounts — with your permission — and
              displays performance statistics, engagement metrics, and post analytics in a unified
              dashboard.
            </p>
            <p style={styles.p}>
              We are a <strong>read-only</strong> service. We do not post, publish, delete, or
              modify any content on your social media accounts.
            </p>
          </Section>

          <Section title="3. Account Registration">
            <ul style={styles.ul}>
              <li>You must provide accurate and complete registration information</li>
              <li>You are responsible for maintaining the confidentiality of your login credentials</li>
              <li>You must be at least 18 years old to use the Service</li>
              <li>One person or entity may not maintain more than one free account</li>
            </ul>
          </Section>

          <Section title="4. Connecting Social Accounts">
            <p style={styles.p}>
              When you connect a Facebook, Instagram, Google, YouTube, or LinkedIn account, you
              authorize StatoX to access that account's analytics data via the respective
              platform's official API. You can revoke this access at any time from:
            </p>
            <ul style={styles.ul}>
              <li><strong>Facebook/Instagram</strong> — Facebook Settings → Apps and Websites</li>
              <li><strong>Google/YouTube</strong> — Google Account → Security → Third-party access</li>
              <li><strong>LinkedIn</strong> — LinkedIn Settings → Data Privacy → Permitted Services</li>
              <li><strong>StatoX</strong> — Settings page within the dashboard</li>
            </ul>
          </Section>

          <Section title="5. Acceptable Use">
            <p style={styles.p}>You agree not to:</p>
            <ul style={styles.ul}>
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to reverse-engineer, scrape, or extract data from the Service</li>
              <li>Share your account credentials with unauthorized parties</li>
              <li>Use the Service to violate the terms of any connected social media platform</li>
              <li>Interfere with or disrupt the Service infrastructure</li>
            </ul>
          </Section>

          <Section title="6. Data and Privacy">
            <p style={styles.p}>
              Your use of the Service is also governed by our{' '}
              <a href="/privacy" style={styles.link}>Privacy Policy</a>, which is incorporated
              into these Terms by reference. We handle your data in compliance with applicable
              privacy laws and the data policies of Meta, Google, and LinkedIn.
            </p>
          </Section>

          <Section title="7. Third-Party Platform Compliance">
            <p style={styles.p}>By using StatoX, you acknowledge that:</p>
            <ul style={styles.ul}>
              <li>
                Your use of Facebook and Instagram data is subject to the{' '}
                <a href="https://www.facebook.com/terms.php" target="_blank" rel="noreferrer" style={styles.link}>
                  Facebook Terms of Service
                </a>{' '}
                and{' '}
                <a href="https://developers.facebook.com/policy/" target="_blank" rel="noreferrer" style={styles.link}>
                  Meta Platform Terms
                </a>
              </li>
              <li>
                Your use of Google and YouTube data is subject to the{' '}
                <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer" style={styles.link}>
                  Google Terms of Service
                </a>{' '}
                and{' '}
                <a href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer" style={styles.link}>
                  YouTube Terms of Service
                </a>
              </li>
              <li>
                Your use of LinkedIn data is subject to the{' '}
                <a href="https://www.linkedin.com/legal/user-agreement" target="_blank" rel="noreferrer" style={styles.link}>
                  LinkedIn User Agreement
                </a>
              </li>
            </ul>
          </Section>

          <Section title="8. Intellectual Property">
            <p style={styles.p}>
              The StatoX platform, including its design, code, and content, is owned by us
              and protected by intellectual property laws. You may not copy, reproduce, or
              distribute any part of the Service without written permission.
            </p>
            <p style={styles.p}>
              Your social media data remains owned by you and the respective platforms. We claim
              no ownership over data retrieved from your connected accounts.
            </p>
          </Section>

          <Section title="9. Disclaimers">
            <p style={styles.p}>
              The Service is provided "as is" without warranties of any kind. We do not guarantee
              that analytics data is 100% accurate, as it is sourced directly from third-party
              platform APIs. We are not responsible for discrepancies between our dashboard and
              the native analytics tools of each platform.
            </p>
          </Section>

          <Section title="10. Limitation of Liability">
            <p style={styles.p}>
              To the maximum extent permitted by law, StatoX shall not be liable for any
              indirect, incidental, special, or consequential damages arising from your use of
              the Service, including but not limited to loss of data or business interruption.
            </p>
          </Section>

          <Section title="11. Termination">
            <p style={styles.p}>
              We reserve the right to suspend or terminate accounts that violate these Terms.
              You may delete your account at any time from the Settings page. Upon termination,
              your data will be deleted within 30 days.
            </p>
          </Section>

          <Section title="12. Contact Us">
            <p style={styles.p}>
              For questions about these Terms, contact us at:
            </p>
            <p style={styles.p}>
              <strong>Email:</strong> legal@statox.ai<br />
              <strong>Website:</strong> https://statox.ai
            </p>
          </Section>
        </div>

        <p style={styles.footer}>
          © 2026 StatoX · <a href="/privacy" style={styles.footerLink}>Privacy Policy</a>
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
  link: { color: C.cyan, textDecoration: 'none' },
  footer: { textAlign: 'center', color: '#64748b', fontSize: 12, marginTop: 24 },
  footerLink: { color: C.cyan, textDecoration: 'none' },
};
