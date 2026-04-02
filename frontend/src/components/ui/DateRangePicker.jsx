const PRESETS = [
  { label: '7d',  days: 7  },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

function isPresetActive(range, days) {
  const until = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  return range.since === since && range.until === until;
}

export default function DateRangePicker({ range, onChange }) {
  return (
    <div style={styles.wrap}>
      {/* Preset pills */}
      <div style={styles.presetGroup}>
        {PRESETS.map(({ label, days }) => {
          const active = isPresetActive(range, days);
          return (
            <button
              key={label}
              onClick={() => {
                const until = new Date().toISOString().slice(0, 10);
                const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
                onChange({ since, until });
              }}
              style={{
                ...styles.preset,
                background: active ? '#0D0D0D' : '#f1f5f9',
                color:      active ? '#00CCF5' : '#475569',
                borderColor:active ? '#0D0D0D' : 'transparent',
                boxShadow:  active ? '0 2px 8px rgba(0,204,245,0.25)' : 'none',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <span style={styles.sep} />

      {/* Date inputs */}
      <div style={styles.dateGroup}>
        <div style={styles.dateField}>
          <span style={styles.dateLabel}>From</span>
          <input
            type="date"
            value={range.since}
            max={range.until}
            onChange={e => onChange({ ...range, since: e.target.value })}
            style={styles.input}
          />
        </div>
        <span style={styles.arrow}>→</span>
        <div style={styles.dateField}>
          <span style={styles.dateLabel}>To</span>
          <input
            type="date"
            value={range.until}
            min={range.since}
            max={new Date().toISOString().slice(0, 10)}
            onChange={e => onChange({ ...range, until: e.target.value })}
            style={styles.input}
          />
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    background: '#fff',
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 4px rgba(0,0,0,.05)',
  },
  presetGroup: {
    display: 'flex',
    gap: 6,
  },
  preset: {
    padding: '6px 14px',
    borderRadius: 999,
    border: '1.5px solid',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
    transition: 'all 0.15s ease',
    fontFamily: 'inherit',
    letterSpacing: '0.01em',
  },
  sep: {
    width: 1,
    height: 22,
    background: '#e2e8f0',
    flexShrink: 0,
  },
  dateGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  dateField: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  dateLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  input: {
    padding: '6px 10px',
    borderRadius: 8,
    border: '1.5px solid #e2e8f0',
    fontSize: 13,
    outline: 'none',
    cursor: 'pointer',
    color: '#0f172a',
    fontFamily: 'inherit',
    background: '#f8fafc',
  },
  arrow: {
    color: '#cbd5e1',
    fontSize: 14,
    marginTop: 14,
  },
};
