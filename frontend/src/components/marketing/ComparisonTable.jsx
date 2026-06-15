/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { Check, X, AlertTriangle } from 'lucide-react';

/**
 * ComparisonTable — sticky-header pricing/feature comparison table.
 * The HIGHLIGHT_COLUMN gets a brand-color background that bleeds across the
 * full row vertically.
 *
 *   <ComparisonTable
 *     columns={['Social Stats', 'Hootsuite', ...]}
 *     highlightIndex={0}
 *     rows={[
 *       { feature: '...', cells: ['yes', 'yes', 'partial', 'no'] }
 *     ]}
 *   />
 *
 * Cell values: 'yes' / 'no' / 'partial' / any string.
 */
export default function ComparisonTable({ columns = [], rows = [], highlightIndex = 0 }) {
  return (
    <div style={{
      width: '100%',
      overflowX: 'auto',
      WebkitOverflowScrolling: 'touch',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-subtle)',
      background: 'var(--surface-card)',
    }}>
      <table style={{
        width: '100%',
        minWidth: 720,
        borderCollapse: 'collapse',
        position: 'relative',
      }}>
        <thead>
          <tr>
            <th style={headFeatureStyle}>Feature</th>
            {columns.map((c, i) => (
              <th key={c}
                  style={{
                    ...headCellStyle,
                    ...(i === highlightIndex ? headHighlightStyle : {}),
                  }}>
                {c}
                {i === highlightIndex && (
                  <span style={{
                    display: 'block', marginTop: 4,
                    fontSize: 10, fontWeight: 600,
                    color: '#00CCF5', letterSpacing: '0.06em',
                  }}>RECOMMENDED</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rIdx) => (
            <tr key={rIdx}>
              <td style={featureCellStyle}>{row.feature}</td>
              {row.cells.map((cell, i) => (
                <td key={i}
                    style={{
                      ...cellStyle,
                      ...(i === highlightIndex ? cellHighlightStyle : {}),
                    }}>
                  <CellValue value={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


function CellValue({ value }) {
  if (value === 'yes' || value === true) {
    return <Check size={16} strokeWidth={2.4} style={{ color: 'var(--success)' }} aria-label="Yes" />;
  }
  if (value === 'no' || value === false) {
    return <X size={16} strokeWidth={2.4} style={{ color: 'var(--text-tertiary)', opacity: 0.5 }} aria-label="No" />;
  }
  if (value === 'partial' || value === 'limited') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--warning)' }}>
        <AlertTriangle size={13} strokeWidth={2.2} /> Limited
      </span>
    );
  }
  return <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{value}</span>;
}


// ─────────────────────────────────────────────────────────────────────────────
const headFeatureStyle = {
  position: 'sticky', top: 0, zIndex: 2,
  textAlign: 'left',
  padding: '14px 18px',
  fontSize: 11, fontWeight: 600,
  letterSpacing: '0.06em', textTransform: 'uppercase',
  color: 'var(--text-tertiary)',
  background: 'var(--surface-card)',
  borderBottom: '1px solid var(--border-subtle)',
};

const headCellStyle = {
  position: 'sticky', top: 0, zIndex: 2,
  textAlign: 'center',
  padding: '14px 12px',
  fontSize: 13, fontWeight: 700,
  color: 'var(--text-primary)',
  background: 'var(--surface-card)',
  borderBottom: '1px solid var(--border-subtle)',
  borderLeft: '1px solid var(--border-subtle)',
};

const headHighlightStyle = {
  background: 'linear-gradient(180deg, rgba(0,204,245,0.12), rgba(0,204,245,0.04))',
  borderLeft: '1px solid rgba(0,204,245,0.3)',
  borderRight: '1px solid rgba(0,204,245,0.3)',
  borderTop: '2px solid #00CCF5',
};

const featureCellStyle = {
  padding: '14px 18px',
  fontSize: 13, fontWeight: 500,
  color: 'var(--text-primary)',
  borderBottom: '1px solid var(--border-subtle)',
};

const cellStyle = {
  padding: '14px 12px',
  textAlign: 'center',
  borderBottom: '1px solid var(--border-subtle)',
  borderLeft: '1px solid var(--border-subtle)',
};

const cellHighlightStyle = {
  background: 'rgba(0,204,245,0.04)',
  borderLeft: '1px solid rgba(0,204,245,0.3)',
  borderRight: '1px solid rgba(0,204,245,0.3)',
};
