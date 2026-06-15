/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
export default function NoteTooltip({ note }) {
  if (!note) return null;
  return (
    <div style={{
      background:   '#0f172a',
      color:        '#f8fafc',
      borderRadius: 8,
      padding:      '8px 12px',
      fontSize:     12,
      boxShadow:    '0 8px 24px rgba(0,0,0,0.3)',
      maxWidth:     200,
      pointerEvents:'none',
    }}>
      <div style={{
        fontWeight: 700,
        marginBottom: note.note ? 4 : 0,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: note.color || '#2563EB',
          flexShrink: 0,
          display: 'inline-block',
        }} />
        {note.title}
      </div>
      {note.note && (
        <div style={{ color: '#94a3b8', lineHeight: 1.4 }}>{note.note}</div>
      )}
      <div style={{ color: '#475569', fontSize: 11, marginTop: 4 }}>
        {new Date(note.date + 'T00:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
      </div>
    </div>
  );
}
