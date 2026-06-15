/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useState } from 'react';
import {
  Star, Flag, MessageSquare, Send, Smile, Frown, Meh, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';

import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { useReviews } from '../../hooks/useInbox';
import { inboxAPI } from '../../services/api';

const STATUS_FILTERS = [
  { id: '',        label: 'All' },
  { id: 'new',     label: 'New' },
  { id: 'replied', label: 'Replied' },
  { id: 'flagged', label: 'Flagged' },
];

const SENTIMENT = {
  positive: { color: 'var(--success)', icon: Smile,  label: 'Positive' },
  neutral:  { color: 'var(--text-tertiary)', icon: Meh, label: 'Neutral' },
  negative: { color: 'var(--danger)',  icon: Frown,  label: 'Negative' },
  unknown:  { color: 'var(--text-tertiary)', icon: null, label: '' },
};

export default function ReviewsPage() {
  const [status, setStatus] = useState('');
  const [rating, setRating] = useState('');

  const params = {};
  if (status) params.status = status;
  if (rating) params.rating = rating;

  const { data: reviews, refetch, loading } = useReviews(params);

  return (
    <div style={{ paddingBottom: 32 }}>
      <PageHeader
        title="Reviews"
        subtitle={`${reviews.length} review${reviews.length === 1 ? '' : 's'}`}
      />

      <div style={{ padding: '0 24px' }}>
        {/* Filters */}
        <Card padding="sm" style={{
          padding: 12, marginBottom: 16,
          display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
        }}>
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase', letterSpacing: 0.4,
          }}>
            Status
          </span>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id || 'all'}
              type="button"
              onClick={() => setStatus(f.id)}
              style={pillStyle(status === f.id)}
            >
              {f.label}
            </button>
          ))}
          <span style={{ width: 1, height: 20, background: 'var(--border-subtle)' }} />
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase', letterSpacing: 0.4,
          }}>
            Rating
          </span>
          {['', '5', '4', '3', '2', '1'].map((r) => (
            <button
              key={r || 'all'}
              type="button"
              onClick={() => setRating(r)}
              style={pillStyle(rating === r)}
            >
              {r ? `${r}★` : 'All'}
            </button>
          ))}
        </Card>

        {/* Grid */}
        {loading && (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <Loader2 size={18} className="ds-spin" color="var(--text-tertiary)" />
          </div>
        )}
        {!loading && reviews.length === 0 && (
          <Card padding="none" style={{ overflow: 'hidden' }}>
            <EmptyState
              icon={Star}
              title="No reviews to show"
              description="When customers leave a review on Google Business Profile, it'll appear here. Make sure your GMB account is connected."
            />
          </Card>
        )}
        {!loading && reviews.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: 16,
          }}>
            {reviews.map((r) => (
              <ReviewCard key={r.id} review={r} onChange={refetch} />
            ))}
          </div>
        )}
      </div>
      <style>{`.ds-spin { animation: ds-spin 0.9s linear infinite; } @keyframes ds-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ReviewCard({ review, onChange }) {
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const sent = SENTIMENT[review.sentiment] || SENTIMENT.unknown;

  async function send() {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await inboxAPI.reviews.reply(review.id, reply.trim());
      setReply('');
      toast.success('Reply posted');
      onChange?.();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Reply failed');
    } finally {
      setSending(false);
    }
  }

  async function flag() {
    if (!window.confirm('Flag this review as inappropriate?')) return;
    try {
      await inboxAPI.reviews.flag(review.id);
      toast.success('Review flagged');
      onChange?.();
    } catch (e) {
      toast.error('Flag failed');
    }
  }

  const initial = (review.reviewer_name || '?')[0].toUpperCase();

  return (
    <Card padding="md">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {review.reviewer_avatar_url ? (
          <img src={review.reviewer_avatar_url} alt={review.reviewer_name}
               style={{ width: 40, height: 40, borderRadius: 999, objectFit: 'cover' }} />
        ) : (
          <div style={{
            width: 40, height: 40, borderRadius: 999,
            background: 'linear-gradient(135deg, #34A853, #2d8e44)',
            color: '#fff', fontWeight: 700, fontSize: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {initial}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>
              {review.reviewer_name || 'Anonymous'}
            </span>
            <StatusBadge status={review.status} />
          </div>
          <Stars n={review.rating} />
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {review.created_at_platform ? new Date(review.created_at_platform).toLocaleDateString() : ''}
          </div>
        </div>
        {sent.icon && (
          <span title={sent.label}><sent.icon size={16} color={sent.color} /></span>
        )}
      </div>

      {review.comment && (
        <div style={{
          marginTop: 12, padding: '12px 14px',
          background: 'var(--surface-sunken)',
          borderLeft: `3px solid ${sent.color}`,
          borderRadius: 'var(--radius-sm)',
          fontSize: 13, lineHeight: 1.5,
          color: 'var(--text-primary)',
          whiteSpace: 'pre-wrap',
        }}>
          {review.comment}
        </div>
      )}

      {review.reply_text ? (
        <div style={{
          marginTop: 12, padding: '10px 12px',
          background: 'var(--brand-primary-glow)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 13, lineHeight: 1.5,
          color: 'var(--text-primary)',
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, marginBottom: 4,
            color: 'var(--brand-primary-hover)', textTransform: 'uppercase', letterSpacing: 0.4,
          }}>
            Owner reply{review.replied_at ? ` · ${new Date(review.replied_at).toLocaleDateString()}` : ''}
          </div>
          {review.reply_text}
        </div>
      ) : (
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <textarea
            rows={2}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={review.status === 'flagged' ? 'Flagged — replies disabled' : 'Reply to this review…'}
            disabled={review.status === 'flagged' || sending}
            style={{
              flex: 1, padding: '10px 12px',
              background: 'var(--surface-sunken)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13, fontFamily: 'inherit',
              color: 'var(--text-primary)', resize: 'vertical',
              outline: 'none', boxSizing: 'border-box', minHeight: 'unset',
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Button
              icon={Send} size="sm"
              onClick={send} loading={sending}
              disabled={!reply.trim() || review.status === 'flagged'}
            >
              Reply
            </Button>
            <Button variant="ghost" icon={Flag} size="sm" onClick={flag}>
              Flag
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function Stars({ n }) {
  const filled = Math.max(0, Math.min(5, n || 0));
  return (
    <div style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i} size={14}
          fill={i <= filled ? '#f59e0b' : 'transparent'}
          color={i <= filled ? '#f59e0b' : 'var(--border-default)'}
        />
      ))}
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === 'replied') return <Badge variant="success" dot>Replied</Badge>;
  if (status === 'flagged') return <Badge variant="warning" dot>Flagged</Badge>;
  return <Badge variant="info" dot>New</Badge>;
}

function pillStyle(active) {
  return {
    padding: '4px 12px',
    borderRadius: 'var(--radius-pill)',
    border: `1px solid ${active ? 'transparent' : 'var(--border-subtle)'}`,
    background: active ? 'var(--brand-primary-glow)' : 'var(--surface-card)',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
    minHeight: 'unset', minWidth: 'unset',
    transition: 'var(--transition-fast)',
  };
}
