import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Mail, MessageSquare, Phone, MapPin, ArrowRight,
  BookOpen, Activity, ShieldCheck, CheckCircle, Send,
} from 'lucide-react';

import MarketingLayout from '../components/marketing/MarketingLayout';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import Textarea from '../components/ui/Textarea';
import Select from '../components/ui/Select';
import Meta from '../components/Meta';

const REASONS = [
  { value: 'sales',     label: 'Sales — pricing or demo' },
  { value: 'support',   label: 'Support — I\'m a customer' },
  { value: 'partner',   label: 'Partnership / integration' },
  { value: 'press',     label: 'Press / media inquiry' },
  { value: 'other',     label: 'Something else' },
];

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [reason, setReason] = useState('sales');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState({});

  function validate() {
    const e = {};
    if (!name.trim()) e.name = 'Your name helps us reply properly.';
    if (!email.trim()) e.email = 'We need your email to reply.';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'That doesn\'t look like a valid email.';
    if (!message.trim()) e.message = 'Tell us a bit about what you\'re working on.';
    else if (message.trim().length < 10) e.message = 'A few more words, please.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      // No backend endpoint yet — pretend it submitted.
      // When the contact endpoint exists, swap this for an API call.
      await new Promise((r) => setTimeout(r, 700));
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <MarketingLayout>
      <Meta
        title="Contact"
        description="Sales, support, partnerships, press — get in touch with the Statox team. We typically reply within one business day."
      />
      {/* Hero */}
      <section style={{ padding: '128px 32px 56px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0,
            background: 'var(--brand-mesh)',
            opacity: 0.30, filter: 'blur(80px) saturate(140%)',
          }}
        />
        <div style={{ position: 'relative', maxWidth: 720, margin: '0 auto' }}>
          <Badge variant="brand" size="md">Contact</Badge>
          <h1 style={{
            margin: '20px 0 18px',
            fontSize: 'clamp(40px, 5vw, 56px)',
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}>
            Let's talk.
          </h1>
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
            Sales, support, partnerships, press — pick a reason and we'll route you to the right human.
          </p>
        </div>
      </section>

      {/* Form + info */}
      <section style={{ padding: '32px 32px 96px' }}>
        <div
          style={{
            maxWidth: 'var(--container-xl)',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)',
            gap: 32,
            alignItems: 'flex-start',
          }}
          className="contact-grid"
        >
          {/* Form */}
          <div
            style={{
              padding: 32,
              background: 'var(--surface-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            {done ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div
                  aria-hidden
                  style={{
                    width: 56, height: 56,
                    margin: '0 auto 16px',
                    background: 'var(--success-bg)',
                    color: 'var(--success)',
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <CheckCircle size={26} strokeWidth={1.8} />
                </div>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                  Thanks — we got your message.
                </h2>
                <p style={{ margin: '8px auto 20px', maxWidth: 380, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  We usually reply within one business day. If it's urgent, email us at{' '}
                  <a href="mailto:hello@statox.ai" style={{ color: 'var(--text-link)', fontWeight: 500 }}>hello@statox.ai</a>.
                </p>
                <Button as={Link} to="/" variant="secondary" size="md">Back to home</Button>
              </div>
            ) : (
              <>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
                  Send us a message
                </h2>
                <p style={{ margin: '6px 0 22px', fontSize: 14, color: 'var(--text-secondary)' }}>
                  We typically reply within one business day.
                </p>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }} className="contact-row">
                    <Input
                      label="Your name"
                      value={name}
                      onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined })); }}
                      placeholder="Your full name"
                      error={errors.name}
                      size="lg"
                    />
                    <Input
                      label="Work email"
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })); }}
                      placeholder="you@company.com"
                      error={errors.email}
                      size="lg"
                    />
                  </div>

                  <Input
                    label="Company (optional)"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Your agency or company"
                    size="lg"
                  />

                  <Select
                    label="What's this about?"
                    value={reason}
                    onChange={setReason}
                    options={REASONS}
                    size="lg"
                  />

                  <Textarea
                    label="Message"
                    value={message}
                    onChange={(e) => { setMessage(e.target.value); setErrors((p) => ({ ...p, message: undefined })); }}
                    placeholder="Tell us a bit about what you're working on…"
                    minRows={4}
                    maxRows={10}
                    error={errors.message}
                    showCount
                    maxLength={1500}
                  />

                  <Button type="submit" size="lg" icon={Send} fullWidth loading={submitting}>
                    Send message
                  </Button>

                  <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                    By sending you agree to our{' '}
                    <Link to="/privacy" style={{ color: 'var(--text-link)' }}>Privacy Policy</Link>.
                  </p>
                </form>
              </>
            )}
            <style>{`
              @media (max-width: 640px) { .contact-row { grid-template-columns: 1fr !important; } }
            `}</style>
          </div>

          {/* Info side */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <ContactInfoCard
              icon={Mail}
              title="Email"
              body="hello@statox.ai"
              detail="General inquiries, partnerships, press."
              link="mailto:hello@statox.ai"
            />
            <ContactInfoCard
              icon={MessageSquare}
              title="Sales"
              body="sales@statox.ai"
              detail="Demos, pricing, and enterprise contracts."
              link="mailto:sales@statox.ai"
            />
            <ContactInfoCard
              icon={Phone}
              title="Phone"
              body="Email-first support"
              detail="Phone callbacks scheduled via support."
              link="mailto:support@statox.ai"
            />
            <ContactInfoCard
              icon={MapPin}
              title="Office"
              body="Bengaluru, India"
              detail="Postal address shared on request via support@statox.ai."
            />
          </div>
        </div>

        <style>{`
          @media (max-width: 980px) { .contact-grid { grid-template-columns: 1fr !important; } }
        `}</style>
      </section>

      {/* Support links */}
      <section style={{ padding: '64px 32px', background: 'var(--surface-card)', borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ maxWidth: 'var(--container-xl)', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h2 style={{ margin: 0, fontSize: 'clamp(24px, 2.8vw, 32px)', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              Looking for something specific?
            </h2>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 16,
            }}
            className="contact-support-grid"
          >
            <SupportLinkCard
              icon={BookOpen}
              title="Help Center"
              body="Setup guides, troubleshooting, FAQs."
              to="/help"
            />
            <SupportLinkCard
              icon={Activity}
              title="System Status"
              body="Live uptime, incidents, scheduled maintenance."
              to="/status"
            />
            <SupportLinkCard
              icon={ShieldCheck}
              title="Security"
              body="Compliance, certifications, vulnerability reports."
              to="/security"
            />
          </div>
          <style>{`
            @media (max-width: 880px) { .contact-support-grid { grid-template-columns: 1fr !important; } }
          `}</style>
        </div>
      </section>
    </MarketingLayout>
  );
}

function ContactInfoCard({ icon: Icon, title, body, detail, link }) {
  const Wrapper = link ? 'a' : 'div';
  return (
    <Wrapper
      href={link}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 14,
        padding: 18,
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-xs)',
        textDecoration: 'none',
        transition: 'var(--transition-fast)',
        cursor: link ? 'pointer' : 'default',
      }}
      onMouseEnter={link ? (e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; } : undefined}
      onMouseLeave={link ? (e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.boxShadow = 'var(--shadow-xs)'; } : undefined}
    >
      <span style={{
        display: 'inline-flex',
        width: 36, height: 36, borderRadius: 'var(--radius-md)',
        background: 'var(--brand-primary-soft)',
        color: 'var(--brand-primary-hover)',
        alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={16} strokeWidth={2.2} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
          {title}
        </div>
        <div style={{ marginTop: 2, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
          {body}
        </div>
        <div style={{ marginTop: 2, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {detail}
        </div>
      </div>
    </Wrapper>
  );
}

function SupportLinkCard({ icon: Icon, title, body, to }) {
  return (
    <Link
      to={to}
      style={{
        display: 'flex', flexDirection: 'column',
        padding: 24,
        background: 'var(--surface-page)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-xl)',
        textDecoration: 'none',
        transition: 'var(--transition-fast)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <span style={{
        display: 'inline-flex',
        width: 36, height: 36,
        borderRadius: 'var(--radius-md)',
        background: 'var(--brand-primary-soft)',
        color: 'var(--brand-primary-hover)',
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 14,
      }}>
        <Icon size={16} strokeWidth={2.2} />
      </span>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
      <p style={{ margin: '4px 0 14px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        {body}
      </p>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--text-link)' }}>
        Open <ArrowRight size={12} />
      </span>
    </Link>
  );
}
