/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useEffect, useState } from 'react';
import { gmbAPI } from '../../services/api';
import { MapPin, Phone, Globe, Star, CheckCircle, Clock, Navigation, MessageSquare } from 'lucide-react';

function StarRating({ rating, size = 14 }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={size}
          fill={i <= rating ? '#f59e0b' : 'none'}
          stroke={i <= rating ? '#f59e0b' : '#d1d5db'}
        />
      ))}
    </span>
  );
}

export default function GMBWidget({ clientId }) {
  const [info, setInfo]       = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    setLoading(true);
    Promise.all([
      gmbAPI.info(clientId),
      gmbAPI.reviews(clientId, { page_size: 5 }),
    ]).then(([infoRes, reviewsRes]) => {
      setInfo(infoRes.data && Object.keys(infoRes.data).length ? infoRes.data : null);
      setReviews(reviewsRes.data?.results || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [clientId]);

  if (loading) return <div style={s.loading}>Loading Google My Business data…</div>;
  if (!info && !reviews.length) return null;

  const hoursToday = (() => {
    if (!info?.regular_hours) return null;
    const days = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
    const key   = days[new Date().getDay()];
    const slots = info.regular_hours[key];
    if (!slots || !slots.length) return 'Closed today';
    return slots.map(h => `${h.open} – ${h.close}`).join(', ');
  })();

  return (
    <div style={s.wrap}>
      <h3 style={s.heading}>
        <span style={s.gmbDot}>G</span> Google My Business
      </h3>

      <div style={s.grid}>
        {/* Business Info Card */}
        {info && (
          <div style={s.card}>
            <div style={s.cardHead}>
              {info.profile_photo_url && (
                <img src={info.profile_photo_url} alt="Business" style={s.photo} />
              )}
              <div>
                <div style={s.bizName}>{info.business_name || '—'}</div>
                {info.category && <div style={s.category}>{info.category}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  {info.avg_rating > 0 && (
                    <>
                      <StarRating rating={Math.round(info.avg_rating)} />
                      <span style={s.ratingText}>
                        {info.avg_rating.toFixed(1)} ({info.total_reviews} reviews)
                      </span>
                    </>
                  )}
                  {info.is_verified && (
                    <span style={s.verifiedBadge}>
                      <CheckCircle size={12} /> Verified
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div style={s.details}>
              {info.address && (
                <div style={s.detailRow}>
                  <MapPin size={14} style={s.detailIcon} />
                  <span>{info.address}</span>
                </div>
              )}
              {info.phone && (
                <div style={s.detailRow}>
                  <Phone size={14} style={s.detailIcon} />
                  <span>{info.phone}</span>
                </div>
              )}
              {info.website && (
                <div style={s.detailRow}>
                  <Globe size={14} style={s.detailIcon} />
                  <a href={info.website} target="_blank" rel="noreferrer" style={s.link}>
                    {info.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </a>
                </div>
              )}
              {hoursToday && (
                <div style={s.detailRow}>
                  <Clock size={14} style={s.detailIcon} />
                  <span style={{ color: info.is_open ? '#16a34a' : '#dc2626' }}>
                    {info.is_open ? 'Open now' : 'Closed'} · {hoursToday}
                  </span>
                </div>
              )}
              {info.maps_url && (
                <div style={{ marginTop: 12 }}>
                  <a href={info.maps_url} target="_blank" rel="noreferrer" style={s.mapsBtn}>
                    <Navigation size={13} /> View on Google Maps
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reviews Card */}
        {reviews.length > 0 && (
          <div style={s.card}>
            <div style={s.reviewsHead}>
              <MessageSquare size={16} style={{ color: '#4285f4' }} />
              <strong style={{ fontSize: 14 }}>Recent Reviews</strong>
              {info?.total_reviews > 0 && (
                <span style={s.reviewCount}>{info.total_reviews} total</span>
              )}
            </div>
            <div style={s.reviewList}>
              {reviews.map(r => (
                <div key={r.id} style={s.reviewItem}>
                  <div style={s.reviewTop}>
                    {r.reviewer_photo && (
                      <img src={r.reviewer_photo} alt={r.reviewer_name} style={s.avatar} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={s.reviewerName}>{r.reviewer_name || 'Anonymous'}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <StarRating rating={r.rating} size={12} />
                        {r.published_at && (
                          <span style={s.reviewDate}>
                            {new Date(r.published_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {r.comment && (
                    <p style={s.comment}>{r.comment.slice(0, 160)}{r.comment.length > 160 ? '…' : ''}</p>
                  )}
                  {r.owner_reply && (
                    <div style={s.ownerReply}>
                      <strong style={{ fontSize: 11 }}>Owner reply:</strong> {r.owner_reply.slice(0, 120)}{r.owner_reply.length > 120 ? '…' : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  wrap:    { marginTop: 24 },
  heading: {
    display: 'flex', alignItems: 'center', gap: 8,
    margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)',
  },
  gmbDot: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 24, height: 24, borderRadius: '50%',
    background: '#4285f4', color: '#fff', fontSize: 13, fontWeight: 800,
  },
  loading: { color: 'var(--text-tertiary)', fontSize: 13, padding: '12px 0' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 16,
  },
  card: {
    background: 'var(--surface-card)', borderRadius: 12, padding: 20,
    boxShadow: '0 1px 6px rgba(0,0,0,.07)', border: '1px solid var(--border-default)',
  },
  cardHead: { display: 'flex', gap: 14, marginBottom: 16 },
  photo: { width: 56, height: 56, borderRadius: 10, objectFit: 'cover', flexShrink: 0 },
  bizName: { fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' },
  category: { fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 },
  ratingText: { fontSize: 12, color: 'var(--text-tertiary)' },
  verifiedBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 3,
    fontSize: 11, color: '#16a34a', fontWeight: 600,
    background: '#dcfce7', padding: '2px 7px', borderRadius: 10,
  },
  details: { display: 'flex', flexDirection: 'column', gap: 8 },
  detailRow: { display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#374151' },
  detailIcon: { color: 'var(--text-tertiary)', flexShrink: 0, marginTop: 1 },
  link: { color: '#2563eb', textDecoration: 'none', wordBreak: 'break-all' },
  mapsBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontSize: 12, fontWeight: 600, color: '#4285f4',
    background: '#eff6ff', border: '1px solid #bfdbfe',
    borderRadius: 8, padding: '6px 12px', textDecoration: 'none',
  },
  reviewsHead: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
  },
  reviewCount: {
    marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)',
    background: 'var(--surface-sunken)', borderRadius: 10, padding: '2px 8px',
  },
  reviewList: { display: 'flex', flexDirection: 'column', gap: 12 },
  reviewItem: {
    borderBottom: '1px solid var(--border-subtle)', paddingBottom: 12,
    ':last-child': { borderBottom: 'none', paddingBottom: 0 },
  },
  reviewTop: { display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  avatar: { width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 },
  reviewerName: { fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' },
  reviewDate: { fontSize: 11, color: 'var(--text-tertiary)' },
  comment: {
    margin: '4px 0 0', fontSize: 12, color: '#374151',
    lineHeight: 1.5,
  },
  ownerReply: {
    marginTop: 6, padding: '6px 10px',
    background: 'var(--surface-sunken)', borderLeft: '3px solid #4285f4',
    fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, borderRadius: '0 6px 6px 0',
  },
};
