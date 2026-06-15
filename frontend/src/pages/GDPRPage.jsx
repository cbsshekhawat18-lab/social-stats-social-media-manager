/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useState } from 'react';
import LegalPageLayout from '../components/marketing/LegalPageLayout';
import Input from '../components/ui/Input';
import Textarea from '../components/ui/Textarea';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import toast from '../components/ui/toast';

const REQUEST_TYPES = [
  { value: 'access',       label: 'Right to access — what data do you hold about me?' },
  { value: 'rectification',label: 'Right to rectification — correct data about me' },
  { value: 'erasure',      label: 'Right to erasure — delete my data' },
  { value: 'portability',  label: 'Right to data portability — export my data' },
  { value: 'restrict',     label: 'Right to restrict processing' },
  { value: 'object',       label: 'Right to object to processing' },
];

export default function GDPRPage() {
  return (
    <LegalPageLayout
      eyebrow="GDPR"
      title="GDPR Compliance"
      effectiveDate="2026-01-01"
      lastUpdated="2026-04-15"
      intro="If you're an EU/EEA resident or a customer with EU/EEA users, this page explains how Social Stats honours the General Data Protection Regulation (GDPR)."
      sections={[
        {
          id: 'role',
          title: '1. Our role',
          body: (
            <>
              <p>Under GDPR, Social Stats acts as:</p>
              <ul>
                <li><strong>Data controller</strong> for your account data (your email, billing info, settings).</li>
                <li><strong>Data processor</strong> for content you upload or sync (e.g., social-media posts and metrics).</li>
              </ul>
            </>
          ),
        },
        {
          id: 'rights',
          title: '2. Your rights under GDPR',
          body: (
            <>
              <p>You have the right to:</p>
              <ul>
                <li><strong>Access</strong> — request a copy of all data we hold about you.</li>
                <li><strong>Rectify</strong> — correct inaccurate data.</li>
                <li><strong>Erase</strong> — request deletion ("right to be forgotten").</li>
                <li><strong>Restrict</strong> — limit how we process your data.</li>
                <li><strong>Object</strong> — opt out of specific processing activities.</li>
                <li><strong>Port</strong> — receive your data in a machine-readable format.</li>
              </ul>
              <p>
                We respond to verified requests within <strong>30 days</strong> at no cost. If your request is
                particularly complex, we may extend this by 60 days and notify you in writing.
              </p>
            </>
          ),
        },
        {
          id: 'dpa',
          title: '3. Data Processing Agreement (DPA)',
          body: (
            <p>
              Customers who process EU personal data via SocialStats can sign our standard{' '}
              <a href="mailto:legal@socialstats.app">DPA</a> at no cost. Our DPA includes EU Standard Contractual Clauses
              (SCCs) for cross-border transfers and is updated annually.
            </p>
          ),
        },
        {
          id: 'subprocessors',
          title: '4. Sub-processors',
          body: (
            <>
              <p>We use the following sub-processors to provide Social Stats:</p>
              <ul>
                <li><strong>AWS (Frankfurt)</strong> — primary infrastructure, EU-region storage.</li>
                <li><strong>Anthropic</strong> — AI features (zero data retention contractually).</li>
                <li><strong>Razorpay / Stripe</strong> — payment processing.</li>
                <li><strong>Sentry</strong> — error monitoring.</li>
                <li><strong>Postmark</strong> — transactional email.</li>
              </ul>
              <p>
                We notify customers 30 days before adding new sub-processors. The current list is always available at{' '}
                <a href="mailto:privacy@socialstats.app">privacy@socialstats.app</a>.
              </p>
            </>
          ),
        },
        {
          id: 'transfers',
          title: '5. International data transfers',
          body: (
            <p>
              By default, EU customer data is stored in our Frankfurt region. Cross-border transfers (e.g., to AI
              providers) are governed by Standard Contractual Clauses and only happen when strictly necessary to
              deliver the requested feature.
            </p>
          ),
        },
        {
          id: 'request',
          title: '6. Submit a GDPR request',
          body: (
            <>
              <p>
                Use the form below to submit a verified data request. We'll confirm receipt within 48 hours and
                respond fully within 30 days.
              </p>
              <GDPRRequestForm />
            </>
          ),
        },
        {
          id: 'contact',
          title: '7. Contact our DPO',
          body: (
            <p>
              Our Data Protection Officer can be reached at <a href="mailto:dpo@socialstats.app">dpo@socialstats.app</a>. EU
              residents may also lodge a complaint with their local supervisory authority.
            </p>
          ),
        },
      ]}
    />
  );
}

function GDPRRequestForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [type, setType] = useState('access');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error('Name and email are required.');
      return;
    }
    setSubmitting(true);
    try {
      // No backend endpoint yet — pretend it submitted.
      await new Promise((r) => setTimeout(r, 700));
      setDone(true);
      toast.success('Request received. We\'ll be in touch within 48 hours.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div
        style={{
          padding: 18,
          background: 'var(--success-bg)',
          border: '1px solid var(--success)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--success)',
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        Thanks — your request has been logged. We'll confirm receipt at <strong>{email}</strong> within 48 hours.
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="gdpr-row">
        <Input label="Your name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" size="md" />
        <Input label="Your email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" size="md" />
      </div>
      <Select label="Request type" value={type} onChange={setType} options={REQUEST_TYPES} size="md" />
      <Textarea
        label="Additional details (optional)"
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="Anything that helps us identify your account or scope the request…"
        minRows={3}
        maxRows={8}
        showCount
        maxLength={1500}
      />
      <Button type="submit" size="md" loading={submitting}>Submit request</Button>
      <style>{`
        @media (max-width: 640px) { .gdpr-row { grid-template-columns: 1fr !important; } }
      `}</style>
    </form>
  );
}
