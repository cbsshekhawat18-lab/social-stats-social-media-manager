/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import LegalPageLayout from '../components/marketing/LegalPageLayout';

export default function RefundPolicyPage() {
  return (
    <LegalPageLayout
      eyebrow="Refunds"
      title="Refund Policy"
      effectiveDate="2026-01-01"
      lastUpdated="2026-04-15"
      intro="We want you to be completely satisfied with Social Stats. This page explains how refunds work — for both monthly and annual plans."
      sections={[
        {
          id: 'overview',
          title: '1. Overview',
          body: (
            <p>
              Social Stats offers a 14-day free trial, so most customers know what they're paying for before billing begins.
              For paid plans, the policy below describes when and how refunds are issued.
            </p>
          ),
        },
        {
          id: 'monthly',
          title: '2. Monthly subscriptions',
          body: (
            <>
              <p>
                Monthly plans are billed in advance for the upcoming 30-day period. If you cancel, your subscription
                remains active until the end of that period — you do not receive a prorated refund for unused days.
              </p>
              <p>
                <strong>7-day refund window:</strong> If you cancel within 7 days of your first paid billing
                cycle and have not actively used the service in that period, contact{' '}
                <a href="mailto:billing@socialstats.app">billing@socialstats.app</a> for a full refund.
              </p>
            </>
          ),
        },
        {
          id: 'annual',
          title: '3. Annual subscriptions',
          body: (
            <>
              <p>
                Annual plans are billed once for 12 months at a 20% discount. If you cancel mid-term, refunds are
                <strong> prorated</strong> for the remaining unused months, less the 20% annual discount.
              </p>
              <p>
                Example: canceling after month 4 of a 12-month plan returns 8/12 of the price paid, minus the discount delta.
              </p>
            </>
          ),
        },
        {
          id: 'how',
          title: '4. How to request a refund',
          body: (
            <>
              <p>To request a refund:</p>
              <ol>
                <li>Email <a href="mailto:billing@socialstats.app">billing@socialstats.app</a> from the email associated with your account.</li>
                <li>Include your account email and the reason (so we can improve).</li>
                <li>We'll process eligible refunds within <strong>7 business days</strong> via your original payment method (Razorpay).</li>
              </ol>
            </>
          ),
        },
        {
          id: 'exceptions',
          title: '5. Exceptions',
          body: (
            <>
              <p>Refunds may be denied in the following cases:</p>
              <ul>
                <li>Accounts terminated for abuse, fraud, or violation of our <a href="/terms">Terms of Service</a>.</li>
                <li>Accounts that have used &gt;75% of plan limits for the period.</li>
                <li>Add-on charges (e.g., extra account slots) that have been actively used.</li>
                <li>Refunds requested more than 60 days after the original charge.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'enterprise',
          title: '6. Enterprise contracts',
          body: (
            <p>
              Custom enterprise contracts have refund terms negotiated in the master service agreement (MSA). Refer to
              your signed MSA, or contact your assigned customer success manager.
            </p>
          ),
        },
        {
          id: 'changes',
          title: '7. Changes to this policy',
          body: (
            <p>
              We may update this policy occasionally. Material changes are announced via email at least 30 days in
              advance. Continued use of Social Stats after changes constitutes acceptance of the new policy.
            </p>
          ),
        },
        {
          id: 'contact',
          title: '8. Contact',
          body: (
            <p>
              Questions? Reach us at <a href="mailto:billing@socialstats.app">billing@socialstats.app</a> or via our{' '}
              <a href="/contact">contact page</a>.
            </p>
          ),
        },
      ]}
    />
  );
}
