/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { Star } from 'lucide-react';
import ScrollReveal from './ScrollReveal';

/**
 * TestimonialMasonry — Pinterest-style masonry grid of customer quotes.
 *
 *   <TestimonialMasonry items={[
 *     { quote, name, title, company, avatar?, rating? }
 *   ]} />
 *
 * Uses CSS columns for masonry — works without JS measurement, content
 * flows top-to-bottom by column.
 */
export default function TestimonialMasonry({ items = [], columns = 3 }) {
  return (
    <div
      style={{
        columnCount: columns,
        columnGap: 16,
      }}
      className="mkt-masonry"
    >
      {items.map((it, i) => (
        <ScrollReveal key={i} delay={(i % columns) * 0.05}>
          <Card item={it} />
        </ScrollReveal>
      ))}
      <style>{`
        @media (max-width: 1024px) { .mkt-masonry { column-count: 2 !important; } }
        @media (max-width: 640px)  { .mkt-masonry { column-count: 1 !important; } }
      `}</style>
    </div>
  );
}


function Card({ item }) {
  const { quote, name, title, company, avatar, rating } = item;
  return (
    <div style={{
      display: 'inline-block',
      width: '100%',
      marginBottom: 16,
      padding: 20,
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      breakInside: 'avoid',
      pageBreakInside: 'avoid',
      WebkitColumnBreakInside: 'avoid',
    }}>
      {rating && (
        <div style={{ display: 'flex', gap: 2, marginBottom: 12 }}>
          {[...Array(5)].map((_, i) => (
            <Star
              key={i} size={13}
              style={{
                color: i < rating ? '#fbbf24' : 'var(--border-default)',
                fill: i < rating ? '#fbbf24' : 'transparent',
              }}
            />
          ))}
        </div>
      )}

      <p style={{
        margin: '0 0 16px',
        fontSize: 14, lineHeight: 1.65,
        color: 'var(--text-primary)',
      }}>“{quote}”</p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {avatar ? (
          <img src={avatar} alt={name}
               style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'linear-gradient(135deg, #00CCF5, #8b5cf6)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: '#fff',
          }}>{(name || '?').slice(0, 1)}</div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            {title}{company ? ` · ${company}` : ''}
          </div>
        </div>
      </div>
    </div>
  );
}
