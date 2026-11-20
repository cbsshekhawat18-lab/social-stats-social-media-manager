/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * ValidationPanel — result of the flow validator, shown under the editor's
 * top bar. Lists every issue ({node_id, level, message}); "Show node" selects
 * and centres the node, which the canvas outlines in red (error) or amber
 * (warning). Errors block publishing, warnings don't.
 */
import { AlertTriangle, CheckCircle2, CircleAlert, X } from 'lucide-react';

export default function ValidationPanel({ result, onClose, onRecheck, onFocus }) {
  const items = result.errors
    || (result.issues || []).map((message) => ({ node_id: null, level: 'error', message }));
  const errors = items.filter((i) => i.level === 'error');
  const warnings = items.filter((i) => i.level !== 'error');
  const tone = errors.length ? 'var(--danger)' : warnings.length ? 'var(--warning, #f59e0b)' : 'var(--success)';
  return (
    <div role="region" aria-label="Flow validation" style={{
      borderBottom: `1px solid ${tone}`, background: 'var(--surface-card)', fontSize: 13,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', color: tone }}>
        {errors.length ? <AlertTriangle size={14} /> : warnings.length ? <CircleAlert size={14} /> : <CheckCircle2 size={14} />}
        <strong>
          {errors.length
            ? `${errors.length} ${errors.length === 1 ? 'problem' : 'problems'} to fix before publishing`
            : warnings.length
              ? `No blocking problems — ${warnings.length} ${warnings.length === 1 ? 'warning' : 'warnings'}`
              : `Flow looks good — ${result.node_count} nodes, ${result.edge_count} connections.`}
        </strong>
        {errors.length > 0 && warnings.length > 0 && (
          <span style={{ color: 'var(--text-tertiary)' }}>
            and {warnings.length} {warnings.length === 1 ? 'warning' : 'warnings'}
          </span>
        )}
        <button type="button" onClick={onRecheck} style={recheckBtn}>
          Check again
        </button>
        <button type="button" onClick={onClose} aria-label="Close validation" style={{
          background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)',
          display: 'inline-flex', minHeight: 'unset',
        }}><X size={14} /></button>
      </div>
      {items.length > 0 && (
        <ul style={{ margin: 0, padding: '0 14px 10px', listStyle: 'none', maxHeight: 168, overflowY: 'auto' }}>
          {[...errors, ...warnings].map((i, idx) => (
            <li key={idx} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 0' }}>
              <span style={{
                flexShrink: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                color: i.level === 'error' ? 'var(--danger)' : 'var(--warning, #f59e0b)', width: 54,
              }}>{i.level}</span>
              <span style={{ color: 'var(--text-primary)', flex: 1 }}>{i.message}</span>
              {i.node_id && (
                <button type="button" onClick={() => onFocus(i.node_id)} style={{
                  background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, minHeight: 'unset',
                  color: 'var(--brand-primary-hover, var(--brand-primary))', fontSize: 12, fontWeight: 600,
                  fontFamily: 'inherit', flexShrink: 0,
                }}>Show node</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const recheckBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 'auto',
  padding: '4px 10px',
  background: 'var(--surface-card)', color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
};
