/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import LegalPageLayout from '../components/marketing/LegalPageLayout';

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout
      eyebrow="Privacy"
      title="Privacy Policy"
      effectiveDate="2026-01-01"
      lastUpdated="2026-04-15"
      intro="Social Stats is built by people who hate dark patterns. This page explains, in plain English, what data we collect, why we need it, and how we keep it safe."
      sections={[
        {
          id: 'who',
          title: '1. Who we are',
          body: (
            <>
              <p>
                Social Stats is operated by Social Stats Technologies, an early-stage product team
                building marketing tooling. For corporate / registration details, write to
                <a href="mailto:privacy@socialstats.app"> privacy@socialstats.app</a>.
              </p>
              <p>
                This policy applies to <strong>socialstats.app</strong>, the Social Stats web app, our mobile apps, and any
                related services. For business customers (agencies, brands, creators), Social Stats is the
                <strong> data processor</strong> for content and audience data they upload — they remain the data
                controller for that data.
              </p>
            </>
          ),
        },
        {
          id: 'collect',
          title: '2. What we collect',
          body: (
            <>
              <p>We collect only what we need to run the product. There are four buckets:</p>
              <h3>a. Account data</h3>
              <p>Name, email, phone (optional), password hash, organization name, role, and billing details (handled by Razorpay — we only store the last 4 digits of the card).</p>
              <h3>b. Connected-account data</h3>
              <p>When you connect Facebook, Instagram, YouTube, Google Business, LinkedIn, or WhatsApp, we receive OAuth tokens, your platform username and ID, and access to the data scopes you authorise. Tokens are encrypted (AES-256 / Fernet) at rest.</p>
              <h3>c. Content data</h3>
              <p>Posts, captions, media files, comments, DMs, scheduled drafts, analytics pulled from connected platforms, and customer-uploaded audience lists.</p>
              <h3>d. Usage data</h3>
              <p>Pages visited, features used, IP address (truncated), device + browser, referrer, and timestamps. Used for product analytics, security, and performance monitoring.</p>
            </>
          ),
        },
        {
          id: 'why',
          title: '3. Why we collect it',
          body: (
            <>
              <p>We use your data only for these purposes:</p>
              <ul>
                <li><strong>Provide the service</strong> — schedule posts, fetch analytics, route messages, build reports.</li>
                <li><strong>Account security</strong> — detect suspicious sign-ins, abuse, and fraud.</li>
                <li><strong>Billing and invoicing</strong> — process payments, send invoices, comply with tax law.</li>
                <li><strong>Product improvement</strong> — aggregated, de-identified analytics. Never sold.</li>
                <li><strong>Customer support</strong> — answer your tickets, debug issues, improve documentation.</li>
                <li><strong>Legal compliance</strong> — respond to lawful requests, prevent illegal use of the platform.</li>
              </ul>
              <p>We <strong>do not</strong> sell your data, train AI models on your private content without explicit consent, or share it with advertisers.</p>
            </>
          ),
        },
        {
          id: 'ai',
          title: '4. AI features and your content',
          body: (
            <>
              <p>
                Social Stats uses Anthropic's Claude API to power the AI Assistant, Composer drafts, brand-voice training,
                and analytics summaries. When you use these features:
              </p>
              <ul>
                <li>Your prompts and the relevant context are sent to Anthropic for inference.</li>
                <li>Anthropic does <strong>not</strong> train models on your content (per their Enterprise terms).</li>
                <li>Generated drafts stay in your workspace — we don't reuse them across customers.</li>
                <li>Brand-voice training samples stay in your tenant. They are never blended with another customer's data.</li>
              </ul>
              <p>You can disable AI features at any time from <strong>Settings → AI</strong>.</p>
            </>
          ),
        },
        {
          id: 'share',
          title: '5. Who we share data with',
          body: (
            <>
              <p>We share data only with sub-processors that are essential to running the service:</p>
              <ul>
                <li><strong>AWS</strong> — hosting (Mumbai region for Indian customers).</li>
                <li><strong>Anthropic</strong> — Claude AI inference.</li>
                <li><strong>Razorpay</strong> — payment processing.</li>
                <li><strong>SendGrid</strong> — transactional email.</li>
                <li><strong>Sentry</strong> — error monitoring (PII scrubbed).</li>
                <li><strong>Pinbot.ai</strong> — WhatsApp Business API gateway.</li>
                <li><strong>Meta / Google / LinkedIn / X</strong> — only when you connect those accounts; we send the minimum data each platform requires for the action you requested.</li>
              </ul>
              <p>A complete, current list lives at <a href="/security#subprocessors">/security#subprocessors</a>.</p>
            </>
          ),
        },
        {
          id: 'retention',
          title: '6. How long we keep it',
          body: (
            <>
              <ul>
                <li><strong>Active account data</strong> — for as long as your account is active.</li>
                <li><strong>Canceled accounts</strong> — content retained 30 days, then permanently deleted.</li>
                <li><strong>Audit logs</strong> — 12 months on Growth, configurable on Enterprise.</li>
                <li><strong>Backups</strong> — encrypted, retained 30 days, then rotated out.</li>
                <li><strong>Invoices and tax records</strong> — 7 years (mandatory under Indian tax law).</li>
              </ul>
              <p>You can request earlier deletion at any time — see <a href="#rights">section 8</a>.</p>
            </>
          ),
        },
        {
          id: 'security',
          title: '7. How we protect it',
          body: (
            <>
              <ul>
                <li><strong>TLS 1.3</strong> in transit, <strong>AES-256-GCM (Fernet)</strong> at rest for tokens and secrets.</li>
                <li><strong>2FA</strong> available on all accounts; mandatory for Enterprise.</li>
                <li><strong>Role-based access control</strong> down to per-account level.</li>
                <li><strong>Audit log</strong> for every privileged action (auth, OAuth connect, publish, role change).</li>
                <li><strong>Quarterly penetration tests</strong> by independent third parties.</li>
                <li><strong>SOC 2 Type II</strong> in progress (target: Q4 2026).</li>
                <li><strong>Incident response</strong> — affected customers notified within 72 hours of confirmed breach.</li>
              </ul>
              <p>Full details at <a href="/security">/security</a>.</p>
            </>
          ),
        },
        {
          id: 'rights',
          title: '8. Your rights',
          body: (
            <>
              <p>Under the DPDP Act 2023 (India) and GDPR (EU), you have the right to:</p>
              <ul>
                <li><strong>Access</strong> a copy of all data we hold about you.</li>
                <li><strong>Correct</strong> inaccurate data.</li>
                <li><strong>Delete</strong> your account and personal data.</li>
                <li><strong>Export</strong> your data in a portable format (JSON or CSV).</li>
                <li><strong>Object</strong> to specific processing activities.</li>
                <li><strong>Withdraw consent</strong> for marketing communications at any time.</li>
              </ul>
              <p>
                Submit a request at <a href="/dpdp">/dpdp</a> (India) or <a href="/gdpr">/gdpr</a> (EU/EEA). We respond within
                <strong> 30 days</strong> as required by law.
              </p>
            </>
          ),
        },
        {
          id: 'cookies',
          title: '9. Cookies and tracking',
          body: (
            <p>
              We use a small number of cookies for authentication, preferences, and product analytics. We don't use
              third-party advertising trackers. See our <a href="/cookies">Cookie Policy</a> for the full list and
              opt-out controls.
            </p>
          ),
        },
        {
          id: 'children',
          title: '10. Children',
          body: (
            <p>
              SocialStats is a B2B product not intended for children under 18. We do not knowingly collect data from
              minors. If you believe a child has created an account, email{' '}
              <a href="mailto:privacy@socialstats.app">privacy@socialstats.app</a> and we'll delete it.
            </p>
          ),
        },
        {
          id: 'transfers',
          title: '11. International transfers',
          body: (
            <p>
              Indian customer data is hosted in AWS Mumbai (ap-south-1). For EU/EEA customers, we use Standard
              Contractual Clauses for any onward transfer. For US customers, AWS US-East-1 is available on Enterprise.
            </p>
          ),
        },
        {
          id: 'changes',
          title: '12. Changes to this policy',
          body: (
            <p>
              We update this policy when laws change or we add features. Material changes are announced via email and
              an in-product banner at least <strong>30 days</strong> in advance. Continued use after the effective
              date constitutes acceptance.
            </p>
          ),
        },
        {
          id: 'contact',
          title: '13. Contact us',
          body: (
            <>
              <p>
                Questions? Reach our DPO (Data Protection Officer) at{' '}
                <a href="mailto:privacy@socialstats.app">privacy@socialstats.app</a> or our postal address:
              </p>
              <p>
                <strong>Social Stats Technologies Pvt. Ltd.</strong><br />
                Attn: Data Protection Officer<br />
                Bengaluru, Karnataka, India
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
