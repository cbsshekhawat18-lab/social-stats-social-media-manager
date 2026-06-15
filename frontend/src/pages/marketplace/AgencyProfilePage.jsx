/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * AgencyProfilePage — public agency profile at /agencies/:slug.
 *
 * For end-users (logged in or not):
 * - Reads `marketplaceAPI.get(slug)` (404 if the agency hasn't enabled
 * marketplace listing AND the viewer isn't a member).
 * - Logged-in end-users get an "Invite this agency" CTA → opens
 * InviteAgencyModal () pre-loaded with this agency.
 * - Anyone can send a non-binding inquiry via the Contact panel.
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Building2, ShieldCheck, Star, MapPin, Globe, Send, Mail, Sparkles, ChevronLeft,
  ThumbsUp, MessageSquare, Trash2, Edit3,
} from 'lucide-react';

import InviteAgencyModal from '../../components/marketplace/InviteAgencyModal';
import WriteReviewModal  from '../../components/marketplace/WriteReviewModal';
import { marketplaceAPI, reviewAPI } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import toast from '../../components/ui/toast';

export default function AgencyProfilePage() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [agency,  setAgency]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [reviewsExtra, setReviewsExtra] = useState(null);  // { count, avg_rating, distribution, rows }
  const [editReview, setEditReview] = useState(null);

  // Reload reviews list (in full, with viewer-aware fields like is_owner / is_editable)
  function reloadReviews() {
    if (!agency?.slug) return;
    reviewAPI.list(agency.slug, { limit: 50 })
      .then((r) => setReviewsExtra(r.data || null))
      .catch(() => {});
  }
  useEffect(() => { reloadReviews(); /* eslint-disable-next-line */ }, [agency?.slug]);

  async function markHelpful(id) {
    try {
      const r = await reviewAPI.helpful(id);
      setReviewsExtra((prev) => prev ? {
        ...prev,
        rows: prev.rows.map((rv) => rv.id === id ? { ...rv, helpful_count: r.data.helpful_count } : rv),
      } : prev);
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not mark helpful');
    }
  }

  async function deleteReview(id) {
    if (!window.confirm('Delete this review?')) return;
    try {
      await reviewAPI.delete(id);
      toast.success('Review deleted');
      reloadReviews();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not delete');
    }
  }

  async function respondToReview(id, response) {
    try {
      await reviewAPI.respond(id, response);
      toast.success('Response posted');
      reloadReviews();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not respond');
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    marketplaceAPI.get(slug)
      .then((r) => { if (!cancelled) setAgency(r.data); })
      .catch((e) => { if (!cancelled) setError(e?.response?.data?.error || 'Could not load agency'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) return <Center><span style={{ color: 'var(--text-tertiary)' }}>Loading…</span></Center>;
  if (error || !agency) return <Center><div style={errorBox}>{error || 'Agency not found.'}</div></Center>;

  const isEndUser = user?.role === 'client';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-page)', padding: '24px 16px 56px' }}>
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        <Link to="/agencies" style={backLink}>
          <ChevronLeft size={14} /> All agencies
        </Link>

        {/* Hero */}
        <header style={hero}>
          <span style={agencyAvatar}>
            {agency.logo_url
              ? <img src={agency.logo_url} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }} />
              : <Building2 size={28} />}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {agency.name}
              {agency.is_verified && <ShieldCheck size={18} color="var(--success)" aria-label="Verified" />}
            </h1>
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>
              {agency.location && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MapPin size={12} /> {agency.location}</span>}
              {agency.review_count > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Star size={12} fill="var(--warning)" stroke="var(--warning)" /> {agency.avg_rating.toFixed(1)} <span>({agency.review_count} review{agency.review_count === 1 ? '' : 's'})</span>
                </span>
              )}
              {agency.website && (
                <a href={agency.website} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--brand-primary-hover)' }}>
                  <Globe size={12} /> {agency.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button type="button" onClick={() => setContactOpen(true)} style={btnGhost}>
              <Mail size={13} /> Contact
            </button>
            {isEndUser && (
              <button type="button" onClick={() => setInviteOpen(true)} style={btnPrimary}>
                <Send size={13} /> Invite this agency
              </button>
            )}
          </div>
        </header>

        {/* About */}
        {agency.description && (
          <Section title="About">
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
              {agency.description}
            </p>
          </Section>
        )}

        {/* Services + pricing */}
        {(agency.services_offered?.length > 0 || agency.pricing_starting_at) && (
          <Section title="Services & pricing">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {(agency.services_offered || []).map((s) => (
                <span key={s} style={chipNeutral}>{s}</span>
              ))}
            </div>
            {agency.pricing_starting_at && (
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
                Starting at <strong style={{ color: 'var(--text-primary)' }}>
                  {agency.pricing_currency} {Number(agency.pricing_starting_at).toLocaleString()}
                </strong> per month.
              </p>
            )}
          </Section>
        )}

        {/* Industries */}
        {agency.industries_served?.length > 0 && (
          <Section title="Industries served">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {agency.industries_served.map((ind) => (
                <span key={ind} style={chipNeutral}>{ind}</span>
              ))}
            </div>
          </Section>
        )}

        {/* Reviews */}
        <Section
          title={`Reviews ${reviewsExtra?.count > 0 ? `(${reviewsExtra.count})` : ''}`}
        >
          {reviewsExtra?.count > 0 && (
            <RatingSummary avg={reviewsExtra.avg_rating} distribution={reviewsExtra.distribution} count={reviewsExtra.count} />
          )}
          {(reviewsExtra?.rows?.length || 0) === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>
              No reviews yet — be the first to rate them after working together.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {reviewsExtra.rows.map((r) => (
                <ReviewItem
                  key={r.id}
                  review={r}
                  isAgencyMember={user?.primary_agency_slug === agency.slug}
                  onHelpful={() => markHelpful(r.id)}
                  onDelete={() => deleteReview(r.id)}
                  onRespond={(text) => respondToReview(r.id, text)}
                  onEdit={() => setEditReview(r)}
                />
              ))}
            </ul>
          )}
        </Section>

        {/* Trust footer */}
        <div style={trustBox}>
          <Sparkles size={16} style={{ color: 'var(--brand-primary-hover)' }} />
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            Social Stats keeps you in full control. Whichever agency you choose, you can pause access,
            revoke permissions, or end the relationship at any time — and every action is logged for audit.
          </p>
        </div>
      </div>

      <InviteAgencyModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        targetAgency={agency}
        onSent={() => toast.success(`Invitation sent to ${agency.name}`)}
      />

      <WriteReviewModal
        open={!!editReview}
        onClose={() => setEditReview(null)}
        agency={agency}
        existing={editReview}
        onSaved={() => { setEditReview(null); reloadReviews(); }}
      />

      <ContactModal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        agency={agency}
      />
    </div>
  );
}

function ContactModal({ open, onClose, agency }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();

  if (!open) return null;

  async function send() {
    if (!user) { toast.error('Please sign in to send an inquiry.'); return; }
    if (!message.trim()) { toast.error('Tell them what you need.'); return; }
    setBusy(true);
    try {
      await marketplaceAPI.contact(agency.slug, message.trim());
      toast.success(`Sent to ${agency.name}`);
      onClose?.();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not send');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={backdropStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div style={{ ...modalStyle, padding: 22 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Contact {agency.name}</h2>
        <p style={{ margin: '4px 0 12px', fontSize: 13, color: 'var(--text-secondary)' }}>
          A non-binding inquiry. They'll reply via email or invite you to manage.
        </p>
        <textarea
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Hi! I run a real estate brokerage in Pune and we're posting on Instagram + GMB. Can you help with content + analytics?"
          style={textareaStyle}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button type="button" onClick={onClose} style={btnGhost}>Cancel</button>
          <button type="button" onClick={send} disabled={busy} style={btnPrimary}>
            {busy ? 'Sending…' : <>Send <Send size={13} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section style={section}>
      <h3 style={sectionH}>{title}</h3>
      {children}
    </section>
  );
}

function ReviewItem({ review, isAgencyMember, onHelpful, onDelete, onRespond, onEdit }) {
  const reviewer = review.reviewer || review.reviewer_name;
  const isMine = !!review.is_owner;
  const canRespond = !!isAgencyMember && !review.agency_response;

  return (
    <li style={reviewCard}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{reviewer}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: 'var(--warning)' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={12} fill={i < review.rating ? 'var(--warning)' : 'transparent'} stroke="var(--warning)" />
          ))}
        </span>
        {review.is_verified && <span style={verifiedChip}><ShieldCheck size={10} /> Verified</span>}
        {review.created_at && (
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            {new Date(review.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
          </span>
        )}
      </div>

      {review.title && <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{review.title}</div>}
      <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
        {review.body}
      </p>

      {(review.pros?.length > 0 || review.cons?.length > 0) && (
        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
          {review.pros?.length > 0 && <ProsCons items={review.pros} tone="success" label="Pros" />}
          {review.cons?.length > 0 && <ProsCons items={review.cons} tone="warning" label="Cons" />}
        </div>
      )}

      {review.agency_response && (
        <div style={agencyResponseBox}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--brand-primary-hover)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Agency response
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-primary)' }}>{review.agency_response}</p>
        </div>
      )}

      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={onHelpful} style={miniBtn}>
          <ThumbsUp size={11} /> Helpful{review.helpful_count > 0 && ` · ${review.helpful_count}`}
        </button>
        {isMine && review.is_editable && onEdit && (
          <button type="button" onClick={onEdit} style={miniBtn}>
            <Edit3 size={11} /> Edit
          </button>
        )}
        {isMine && (
          <button type="button" onClick={onDelete} style={{ ...miniBtn, color: 'var(--danger)', borderColor: 'var(--danger)' }}>
            <Trash2 size={11} /> Delete
          </button>
        )}
        {canRespond && <RespondInline onSubmit={onRespond} />}
      </div>
    </li>
  );
}

function ProsCons({ items, tone, label }) {
  const color = tone === 'success' ? 'var(--success)' : 'var(--warning)';
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color, marginBottom: 4 }}>
        {label}
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map((it, i) => (
          <li key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', paddingLeft: 12, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 0, color }}>·</span>
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RespondInline({ onSubmit }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={miniBtn}>
        <MessageSquare size={11} /> Respond
      </button>
    );
  }
  return (
    <div style={{ flexBasis: '100%', display: 'flex', gap: 6, marginTop: 6 }}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Your response (public)"
        style={{ flex: 1, padding: '7px 10px', background: 'var(--surface-sunken)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit' }}
      />
      <button type="button" onClick={() => { if (text.trim()) { onSubmit(text.trim()); setOpen(false); setText(''); } }} style={miniBtn}>Post</button>
      <button type="button" onClick={() => { setOpen(false); setText(''); }} style={miniBtn}>Cancel</button>
    </div>
  );
}

function RatingSummary({ avg, distribution, count }) {
  const max = Math.max(1, ...Object.values(distribution || {}));
  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'center', padding: 12, marginBottom: 14, background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)' }}>
      <div style={{ textAlign: 'center', minWidth: 100 }}>
        <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {Number(avg || 0).toFixed(1)}
        </div>
        <div style={{ display: 'inline-flex', gap: 1, marginTop: 4, color: 'var(--warning)' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={13} fill={i < Math.round(avg) ? 'var(--warning)' : 'transparent'} stroke="var(--warning)" />
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{count} review{count === 1 ? '' : 's'}</div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {[5, 4, 3, 2, 1].map((star) => {
          const c = (distribution && distribution[star]) || 0;
          const pct = c / max;
          return (
            <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>
              <span style={{ width: 16, textAlign: 'right' }}>{star}★</span>
              <div style={{ flex: 1, height: 6, background: 'var(--border-subtle)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${pct * 100}%`, height: '100%', background: 'var(--warning)' }} />
              </div>
              <span style={{ width: 24, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Center({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--surface-page)' }}>
      {children}
    </div>
  );
}

const backLink = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  fontSize: 13, color: 'var(--text-secondary)',
  textDecoration: 'none',
  marginBottom: 16,
};

const hero = {
  display: 'flex', gap: 16, alignItems: 'flex-start',
  padding: 24,
  background: 'var(--surface-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-lg)',
  marginBottom: 18,
  flexWrap: 'wrap',
};

const agencyAvatar = {
  width: 56, height: 56,
  background: 'var(--brand-primary-glow)',
  color: 'var(--brand-primary-hover)',
  borderRadius: 'var(--radius-md)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
};

const section = {
  padding: 20,
  background: 'var(--surface-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  marginBottom: 12,
};

const sectionH = {
  margin: '0 0 12px',
  fontSize: 15, fontWeight: 700, color: 'var(--text-primary)',
};

const chipNeutral = {
  padding: '3px 10px',
  background: 'var(--surface-sunken)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-pill)',
  fontSize: 12, color: 'var(--text-secondary)',
};

const verifiedChip = {
  display: 'inline-flex', alignItems: 'center', gap: 3,
  padding: '1px 6px',
  background: 'var(--success-bg)', color: 'var(--success)',
  border: '1px solid var(--success)',
  borderRadius: 'var(--radius-pill)',
  fontSize: 10, fontWeight: 600,
};

const reviewCard = {
  padding: 14,
  background: 'var(--surface-sunken)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
};

const agencyResponseBox = {
  marginTop: 10, padding: '8px 12px',
  background: 'var(--brand-primary-soft)',
  border: '1px solid var(--brand-primary-glow)',
  borderRadius: 'var(--radius-sm)',
};

const trustBox = {
  marginTop: 18, padding: 14,
  display: 'flex', gap: 10, alignItems: 'flex-start',
  background: 'var(--surface-sunken)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
};

const errorBox = {
  padding: 24,
  background: 'var(--surface-card)',
  border: '1px solid var(--danger)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-primary)',
};

const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '9px 14px',
  background: 'var(--brand-primary)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius-md)',
  fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
};

const btnGhost = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '9px 14px',
  background: 'var(--surface-card)', color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
};

const miniBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '4px 8px',
  background: 'transparent',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 11, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
};

const backdropStyle = {
  position: 'fixed', inset: 0, zIndex: 1100,
  background: 'rgba(10,14,20,0.50)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
};

const modalStyle = {
  width: '100%', maxWidth: 480,
  background: 'var(--surface-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-xl)',
};

const textareaStyle = {
  width: '100%', padding: 10,
  background: 'var(--surface-sunken)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 13, color: 'var(--text-primary)',
  outline: 'none', fontFamily: 'inherit',
  resize: 'vertical', boxSizing: 'border-box',
};
