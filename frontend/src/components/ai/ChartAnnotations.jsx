/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useState } from 'react';
import { Sparkles, RefreshCw, Loader2 } from 'lucide-react';

import Button from '../ui/Button';
import { aiV2API } from '../../services/api';
import toast from '../ui/toast';

/**
 * ChartAnnotations — drop-in "What this data means" callout that sits
 * beside any chart. Pulls a few short narrative paragraphs + highlights
 * from /ai/v2/report-narrate.
 *
 * Props:
 *   clientId       required (tenant scoping)
 *   chartFocus     free-form hint, e.g. "engagement_over_time"
 *   days           lookback window (default 30)
 *   paragraphs     target paragraph count (default 2)
 *   compact        bool — render as a smaller inline strip rather than full card
 *
 * Lazy by design — does not call AI on mount. The user clicks "Explain this"
 * to fetch. Avoids burning quota on charts the user never looks at.
 */
export default function ChartAnnotations({
  clientId,
  chartFocus = '',
  days = 30,
  paragraphs = 2,
  compact = false,
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData]       = useState(null);
  const [error, setError]     = useState('');

  async function explain() {
    if (!clientId) {
      toast.error('Pick a client first');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const r = await aiV2API.reportNarrate({
        client_id:   clientId,
        days,
        chart_focus: chartFocus,
        paragraphs,
      });
      setData(r.data || null);
      if (r.data?.note) toast(r.data.note, { icon: 'ℹ️' });
    } catch (e) {
      const msg = e?.response?.data?.error || 'AI narration unavailable';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // ─────────────── COMPACT VARIANT ───────────────
  if (compact) {
    return (
      <div style={compactWrapperStyle}>
        <button
          type="button"
          onClick={explain}
          disabled={loading}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px',
            minHeight: 'auto', minWidth: 'auto',
            background: 'var(--brand-primary-soft)',
            color: 'var(--brand-primary-hover)',
            border: '1px solid var(--brand-primary-glow)',
            borderRadius: 'var(--radius-pill)',
            fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
            cursor: loading ? 'wait' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {loading
            ? <Loader2 size={11} style={{ animation: 'ca-spin 0.9s linear infinite' }} />
            : <Sparkles size={11} />}
          {data ? 'Refresh' : 'Explain this'}
        </button>
        {error && (
          <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--danger)' }}>{error}</span>
        )}
        {data?.paragraphs?.[0] && (
          <p style={{
            margin: '6px 0 0',
            fontSize: 12, lineHeight: 1.6,
            color: 'var(--text-secondary)',
          }}>
            {data.paragraphs[0]}
          </p>
        )}
        <style>{`@keyframes ca-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ─────────────── FULL CARD VARIANT ───────────────
  return (
    <div style={wrapperStyle}>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8, marginBottom: data ? 10 : 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={iconBubbleStyle}>
            <Sparkles size={12} strokeWidth={2.4} />
          </span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              What this data means
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              From Social Stats
            </div>
          </div>
        </div>
        <Button
          size="xs"
          variant="ghost"
          icon={data ? RefreshCw : Sparkles}
          onClick={explain}
          loading={loading}
          aria-label={data ? 'Refresh narration' : 'Generate narration'}
        >
          {data ? 'Refresh' : 'Explain'}
        </Button>
      </header>

      {!data && !loading && !error && (
        <p style={{
          margin: 0, fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.55,
        }}>
          Click <strong style={{ color: 'var(--brand-primary-hover)' }}>Explain</strong> to have Social Stats translate this chart in plain English.
        </p>
      )}

      {error && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--danger)' }}>{error}</p>
      )}

      {data && (
        <>
          {(data.paragraphs || []).map((p, i) => (
            <p key={i} style={{
              margin: i === 0 ? 0 : '8px 0 0',
              fontSize: 13, lineHeight: 1.6,
              color: 'var(--text-secondary)',
            }}>
              {p}
            </p>
          ))}

          {(data.highlights || []).length > 0 && (
            <ul style={{
              margin: '12px 0 0', paddingLeft: 18,
              fontSize: 12, color: 'var(--text-primary)',
              lineHeight: 1.55,
              borderLeft: '2px solid var(--brand-primary)',
              paddingTop: 4, paddingBottom: 4,
            }}>
              {data.highlights.map((h, i) => (
                <li key={i} style={{ marginBottom: 4 }}>{h}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

const wrapperStyle = {
  padding: 14,
  background: 'var(--surface-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-xs)',
};

const compactWrapperStyle = {
  padding: '10px 12px',
  background: 'var(--surface-sunken)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
};

const iconBubbleStyle = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 24, height: 24,
  background: 'var(--brand-gradient)',
  color: '#fff',
  borderRadius: 'var(--radius-sm)',
};
