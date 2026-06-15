/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * VariableInserter — small popover that lists every variable already
 * collected by upstream nodes. Click a variable to append `{{var}}` to the
 * connected textarea.
 *
 * Standard runtime variables (always available) are listed first:
 *   contact.name · contact.phone · contact.email
 * Then the flow's user-defined variables (collected from set_variable + ask_*
 * nodes upstream).
 */
import { useState } from 'react';
import { Variable, ChevronDown } from 'lucide-react';


const STANDARD = [
  'contact.name', 'contact.phone', 'contact.email',
];


export default function VariableInserter({ variables = [], onPick }) {
  const [open, setOpen] = useState(false);
  const all = [...STANDARD, ...variables.filter((v) => !STANDARD.includes(v))];

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button" onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox" aria-expanded={open}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '4px 8px',
          background: 'var(--brand-primary-soft)', color: 'var(--brand-primary-hover)',
          border: '1px solid var(--brand-primary-glow)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
        }}
      >
        <Variable size={11} /> Insert variable <ChevronDown size={10} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 80 }} />
          <ul role="listbox" style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 81,
            listStyle: 'none', padding: 4, margin: 0,
            minWidth: 220, maxHeight: 260, overflowY: 'auto',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow-lg)',
          }}>
            {all.map((v) => (
              <li key={v}>
                <button type="button"
                        onClick={() => { onPick(v); setOpen(false); }}
                        style={{
                          width: '100%', textAlign: 'left',
                          padding: '6px 10px',
                          background: 'transparent', color: 'var(--text-primary)',
                          border: 'none', borderRadius: 'var(--radius-sm)',
                          fontFamily: 'var(--font-mono)', fontSize: 12,
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                  {`{{${v}}}`}
                </button>
              </li>
            ))}
            {all.length === 0 && (
              <li style={{ padding: 10, color: 'var(--text-tertiary)', fontSize: 12 }}>
                No variables yet — earlier ask_* / set_variable nodes will appear here.
              </li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}
