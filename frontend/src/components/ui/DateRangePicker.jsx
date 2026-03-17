export default function DateRangePicker({ range, onChange }) {
  return (
    <div style={styles.wrap}>
      <label style={styles.label}>From</label>
      <input
        type="date"
        value={range.since}
        max={range.until}
        onChange={e => onChange({ ...range, since: e.target.value })}
        style={styles.input}
      />
      <span style={styles.sep}>→</span>
      <label style={styles.label}>To</label>
      <input
        type="date"
        value={range.until}
        min={range.since}
        max={new Date().toISOString().slice(0,10)}
        onChange={e => onChange({ ...range, until: e.target.value })}
        style={styles.input}
      />

      {/* Quick presets */}
      {[
        { label: '7d',  days: 7  },
        { label: '30d', days: 30 },
        { label: '90d', days: 90 },
      ].map(({ label, days }) => (
        <button
          key={label}
          onClick={() => {
            const until = new Date().toISOString().slice(0,10);
            const since = new Date(Date.now() - days * 86400000).toISOString().slice(0,10);
            onChange({ since, until });
          }}
          style={styles.preset}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

const styles = {
  wrap: {
    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
    background: '#fff', padding: '10px 16px', borderRadius: 10,
    boxShadow: '0 1px 4px rgba(0,0,0,.07)',
  },
  label: { fontSize: 12, color: '#64748b', fontWeight: 500 },
  input: {
    padding: '7px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb',
    fontSize: 13, outline: 'none', cursor: 'pointer',
  },
  sep: { color: '#94a3b8', fontSize: 14 },
  preset: {
    padding: '6px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb',
    background: '#f8fafc', color: '#475569', cursor: 'pointer',
    fontSize: 12, fontWeight: 600,
  },
};
