/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import LegalPageLayout from '../components/marketing/LegalPageLayout';

export default function TermsOfServicePage() {
  return (
    <LegalPageLayout
      eyebrow="Terms"
      title="Terms of Service"
      effectiveDate="2026-01-01"
      lastUpdated="2026-04-15"
      intro="These Terms govern your use of Social Stats. They are deliberately written in plain English so you can read them all the way through. By signing up for an account, you agree to these terms."
      sections={[
        {
          id: 'acceptance',
          title: '1. Acceptance of terms',
          body: (
            <>
              <p>
                By creating a Social Stats account, accessing the Social Stats web app, mobile apps, APIs, or any related
                services (collectively, the "<strong>Service</strong>"), you agree to be bound by these Terms of
                Service ("<strong>Terms</strong>") and our <a href="/privacy">Privacy Policy</a>.
              </p>
              <p>
                If you are accepting these Terms on behalf of an organization, you represent that you have authority
                to bind that organization. In that case "<strong>you</strong>" refers to that organization.
              </p>
            </>
          ),
        },
        {
          id: 'account',
          title: '2. Your account',
          body: (
            <>
              <ul>
                <li>You must be at least <strong>18 years old</strong> to create an account.</li>
                <li>You are responsible for keeping your credentials secure. We strongly recommend enabling 2FA.</li>
                <li>You are responsible for all activity under your account, including activity by your team members.</li>
                <li>Notify us immediately at <a href="mailto:security@socialstats.app">security@socialstats.app</a> if you suspect unauthorised access.</li>
                <li>You may not share, sell, or transfer your account to another person or company without our consent.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'plans',
          title: '3. Plans, billing, and renewal',
          body: (
            <>
              <p>Social Stats offers monthly and annual plans. Pricing is published at <a href="/pricing">/pricing</a>.</p>
              <ul>
                <li><strong>Free plan</strong> — limited to one account per platform; for evaluation only.</li>
                <li><strong>Paid plans</strong> — auto-renew until canceled. Cancel anytime from <strong>Settings → Billing</strong>.</li>
                <li><strong>Annual plans</strong> — billed once for 12 months at a discount.</li>
                <li><strong>Taxes</strong> — GST is added to all Indian invoices. International customers handle local VAT/sales tax.</li>
              </ul>
              <p>Payments are processed by <strong>Razorpay</strong>. Refunds follow our <a href="/refund">Refund Policy</a>.</p>
            </>
          ),
        },
        {
          id: 'use',
          title: '4. Acceptable use',
          body: (
            <>
              <p>Social Stats is a powerful tool, and powerful tools require responsible use. You agree NOT to:</p>
              <ul>
                <li>Send spam, mass unsolicited messages, or violate platform-specific (e.g. WhatsApp, Meta) policy.</li>
                <li>Post or distribute content that is illegal, defamatory, hateful, harassing, sexually explicit involving minors, or that infringes intellectual property.</li>
                <li>Reverse-engineer, decompile, or attempt to bypass our security or rate limits.</li>
                <li>Use Social Stats to impersonate another person, brand, or organization without authority.</li>
                <li>Build a competing product by copying our APIs, UI, or proprietary algorithms.</li>
                <li>Resell access without an Agency / Partner agreement signed with us.</li>
              </ul>
              <p>
                We may suspend or terminate accounts that violate these rules, without refund. Repeat or egregious
                violations may be reported to law enforcement.
              </p>
            </>
          ),
        },
        {
          id: 'content',
          title: '5. Your content',
          body: (
            <>
              <p>
                You retain all rights to the content (posts, media, captions, audience lists) you upload to Social Stats.
                You grant us a worldwide, non-exclusive license to host, store, transmit, and process that content
                solely for the purpose of providing the Service to you.
              </p>
              <p>
                We will <strong>never</strong>:
              </p>
              <ul>
                <li>Sell your content to third parties.</li>
                <li>Use your content to train AI models without your explicit, opt-in consent.</li>
                <li>Display your private content to other customers.</li>
              </ul>
              <p>
                Public-facing case studies and testimonials require your written consent each time.
              </p>
            </>
          ),
        },
        {
          id: 'thirdparty',
          title: '6. Third-party platforms',
          body: (
            <>
              <p>
                Social Stats connects to third-party platforms (Facebook, Instagram, YouTube, Google, LinkedIn, X, WhatsApp).
                Your use of those platforms via Social Stats is also subject to their terms. We are not responsible for:
              </p>
              <ul>
                <li>Outages, rate limits, or policy changes on third-party platforms.</li>
                <li>Account bans or content takedowns issued by those platforms.</li>
                <li>Pricing changes by Meta (WhatsApp conversation rates) or other vendors.</li>
              </ul>
              <p>
                We do our best to inform you proactively when a third-party policy change affects your usage.
              </p>
            </>
          ),
        },
        {
          id: 'ip',
          title: '7. Our intellectual property',
          body: (
            <p>
              The Social Stats name, logo, software, designs, and documentation are our property and protected by
              intellectual-property law. These Terms do not transfer any IP rights to you, except for the limited
              right to use the Service while your account is active.
            </p>
          ),
        },
        {
          id: 'warranties',
          title: '8. Warranties and disclaimers',
          body: (
            <>
              <p>
                We work hard to keep Social Stats running smoothly, but the Service is provided "<strong>as is</strong>" and
                "<strong>as available</strong>", without warranties of any kind, express or implied, including
                merchantability, fitness for a particular purpose, and non-infringement.
              </p>
              <p>
                We <strong>do not</strong> guarantee that the Service will be uninterrupted, error-free, or that any
                particular result (e.g., engagement growth, lead volume) will be achieved.
              </p>
              <p>
                Our public uptime target is <strong>99.9%</strong>, with an SLA available on Enterprise plans. See
                <a href="/status"> /status</a> for current and historical uptime.
              </p>
            </>
          ),
        },
        {
          id: 'liability',
          title: '9. Limitation of liability',
          body: (
            <p>
              To the maximum extent permitted by law, our total liability arising out of or relating to these Terms or
              your use of the Service is limited to the <strong>fees you paid us in the 12 months preceding the claim</strong>.
              We are not liable for indirect, incidental, special, consequential, or punitive damages, including loss
              of profits, revenue, or data.
            </p>
          ),
        },
        {
          id: 'indemnity',
          title: '10. Indemnification',
          body: (
            <p>
              You agree to indemnify and hold harmless Social Stats, its directors, employees, and affiliates from any claim
              or liability arising out of (a) your content, (b) your violation of these Terms, or (c) your violation of
              any law or third-party right.
            </p>
          ),
        },
        {
          id: 'termination',
          title: '11. Termination',
          body: (
            <>
              <p>
                You can cancel your account anytime from <strong>Settings → Billing</strong>. We may terminate or
                suspend your account for material breach of these Terms with reasonable notice — except for severe
                violations (e.g. spam, fraud, illegal use), where suspension may be immediate.
              </p>
              <p>
                On termination, you have <strong>30 days</strong> to export your data before it is permanently deleted
                from our systems. Backups are rotated out within 30 days thereafter.
              </p>
            </>
          ),
        },
        {
          id: 'law',
          title: '12. Governing law & disputes',
          body: (
            <p>
              These Terms are governed by the laws of <strong>India</strong>. Disputes will first be attempted to be
              resolved through good-faith negotiation. If unresolved, exclusive jurisdiction lies with the courts of
              <strong> Bengaluru, Karnataka</strong>.
            </p>
          ),
        },
        {
          id: 'changes',
          title: '13. Changes to these Terms',
          body: (
            <p>
              We may update these Terms occasionally. Material changes are announced via email and in-product banner
              at least <strong>30 days</strong> in advance. Continued use after the effective date constitutes acceptance.
            </p>
          ),
        },
        {
          id: 'contact',
          title: '14. Contact',
          body: (
            <p>
              Questions about these Terms? Email us at <a href="mailto:legal@socialstats.app">legal@socialstats.app</a> or visit
              our <a href="/contact">contact page</a>.
            </p>
          ),
        },
      ]}
    />
  );
}
