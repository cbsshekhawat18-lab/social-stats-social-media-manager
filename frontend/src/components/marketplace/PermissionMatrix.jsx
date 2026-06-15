/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * PermissionMatrix — reusable matrix for AGENCY_CLIENT_PERMISSIONS keys.
 *
 * Renders permissions grouped by category with risk pills. Each row has:
 * - a granted toggle (checkbox)
 * - an optional "ask me first" toggle (only visible when the permission is granted)
 *
 * Props:
 * catalog : { key: { label, category, risk, default } } — from server
 * permissions : { key: bool }
 * requiresApprovalFor: string[]
 * readOnly : bool
 * onChange : ({ permissions, requiresApprovalFor }) => void
 *
 * Pure controlled component — no internal state, easy to embed in modals
 * ( send-flow) and editors ( my-agency page).
 */

const RISK_COLOR = {
  low:      'var(--text-tertiary)',
  medium:   'var(--warning)',
  high:     'var(--danger)',
  critical: 'var(--danger)',
};

export default function PermissionMatrix({
  catalog = {},
  permissions = {},
  requiresApprovalFor = [],
  readOnly = false,
  onChange,
}) {
  // Group catalog by category, preserving server-side ordering as best we can
  const grouped = {};
  Object.entries(catalog).forEach(([key, meta]) => {
    const cat = meta.category || 'other';
    grouped[cat] = grouped[cat] || [];
    grouped[cat].push({ key, ...meta });
  });

  const approvalSet = new Set(requiresApprovalFor || []);

  function togglePerm(key) {
    if (readOnly) return;
    const next = { ...permissions, [key]: !permissions[key] };
    let nextApproval = requiresApprovalFor;
    if (!next[key] && approvalSet.has(key)) {
      // turning off a perm clears its approval flag
      nextApproval = (requiresApprovalFor || []).filter((k) => k !== key);
    }
    onChange?.({ permissions: next, requiresApprovalFor: nextApproval });
  }

  function toggleApproval(key) {
    if (readOnly) return;
    const setNext = new Set(requiresApprovalFor || []);
    if (setNext.has(key)) setNext.delete(key); else setNext.add(key);
    onChange?.({ permissions, requiresApprovalFor: Array.from(setNext) });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {Object.entries(grouped).map(([cat, perms]) => (
        <div key={cat}>
          <div style={catLabel}>{cat}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {perms.map((p) => {
              const granted = !!permissions[p.key];
              const needsApproval = approvalSet.has(p.key);
              return (
                <div key={p.key} style={rowStyle}>
                  <input
                    type="checkbox"
                    checked={granted}
                    disabled={readOnly}
                    onChange={() => togglePerm(p.key)}
                    style={{ cursor: readOnly ? 'not-allowed' : 'pointer' }}
                  />
                  <span style={{ flex: 1, color: 'var(--text-primary)', fontSize: 13 }}>{p.label || p.key}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: RISK_COLOR[p.risk] || RISK_COLOR.low }}>
                    {p.risk}
                  </span>
                  {granted && (
                    <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: 4, cursor: readOnly ? 'not-allowed' : 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={needsApproval}
                        disabled={readOnly}
                        onChange={() => toggleApproval(p.key)}
                      />
                      Ask me first
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

const catLabel = {
  fontSize: 10, fontWeight: 600,
  letterSpacing: '0.06em', textTransform: 'uppercase',
  color: 'var(--text-tertiary)',
  marginBottom: 4,
};

const rowStyle = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '7px 10px',
  background: 'var(--surface-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)',
};
