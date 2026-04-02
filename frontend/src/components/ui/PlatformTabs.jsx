import { PLATFORMS } from '../../services/platforms';

const ALL_PLATFORMS = [
  { key: 'all', label: 'All', icon: '🌐', color: '#6366f1' },
  ...Object.entries(PLATFORMS).map(([key, v]) => ({ key, ...v })),
];

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

export default function PlatformTabs({ selected, onChange, connected = [] }) {
  return (
    <div style={styles.wrap}>
      {ALL_PLATFORMS.map(p => {
        const isActive = selected === p.key;
        const isConn   = p.key === 'all' || connected.includes(p.key);
        const rgb = p.color && p.color.startsWith('#') ? hexToRgb(p.color) : null;

        return (
          <button
            key={p.key}
            onClick={() => onChange(p.key)}
            disabled={!isConn}
            style={{
              ...styles.tab,
              background: isActive
                ? `linear-gradient(135deg, ${p.color}, ${p.color}cc)`
                : '#fff',
              color: isActive ? '#fff' : isConn ? '#374151' : '#c4c4c4',
              borderColor: isActive ? p.color : '#e2e8f0',
              opacity: isConn ? 1 : 0.45,
              boxShadow: isActive && rgb
                ? `0 4px 14px rgba(${rgb},0.35)`
                : '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <span style={styles.tabIcon}>{p.icon}</span>
            <span>{p.label}</span>
            {isConn && p.key !== 'all' && (
              <span style={{
                ...styles.connDot,
                background: isActive ? 'rgba(255,255,255,0.6)' : p.color,
              }} />
            )}
            {!isConn && <span style={styles.notConn}>✕</span>}
          </button>
        );
      })}
    </div>
  );
}

const styles = {
  wrap: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '8px 16px',
    borderRadius: 999,
    border: '1.5px solid',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    transition: 'all 0.18s ease',
    fontFamily: 'inherit',
    letterSpacing: '-0.01em',
  },
  tabIcon: {
    fontSize: 15,
    lineHeight: 1,
  },
  connDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
  },
  notConn: {
    fontSize: 10,
    opacity: 0.6,
    fontWeight: 700,
  },
};
