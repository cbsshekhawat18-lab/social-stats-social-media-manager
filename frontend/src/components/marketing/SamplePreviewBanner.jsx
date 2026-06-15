/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { Info } from 'lucide-react';

/**
 * Visible disclosure rendered above marketplace agency profiles and customer
 * case studies while those pages still surface example/illustrative content.
 * Truthful framing — every named agency, customer, quote, and metric on the
 * surrounding page is illustrative until real partners are public.
 *
 * Pinned to the top of the viewport in the page flow so the user sees it
 * before the hero loads.
 */
export default function SamplePreviewBanner({ kind = 'agency' }) {
  const label = kind === 'agency'
    ? 'Sample agency listing — illustrative preview while the marketplace onboards real partners.'
    : 'Sample case study — illustrative preview while we onboard launch partners.';
  return (
    <div
      role="note"
      style={{
        position: 'relative',
        padding: '10px 24px',
        background: 'var(--brand-primary-soft)',
        color: 'var(--brand-primary-hover)',
        borderBottom: '1px solid var(--brand-primary-glow)',
        textAlign: 'center',
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: 0.2,
        lineHeight: 1.5,
      }}
    >
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        verticalAlign: 'middle',
      }}>
        <Info size={13} strokeWidth={2.2} />
        {label}
      </span>
    </div>
  );
}
