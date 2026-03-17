import { PLATFORMS } from '../../services/platforms';

const ALL_PLATFORMS = [
  { key: 'all', label: 'All Platforms', icon: '🌐', color: '#6366f1' },
  ...Object.entries(PLATFORMS).map(([key, v]) => ({ key, ...v })),
];

export default function PlatformTabs({ selected, onChange, connected = [] }) {
  return (
    <div style={styles.wrap}>
      {ALL_PLATFORMS.map(p => {
        const isActive  = selected === p.key;
        const isConn    = p.key === 'all' || connected.includes(p.key);
        return (
          <button
            key={p.key}
            onClick={() => onChange(p.key)}
            disabled={!isConn}
            style={{
              ...styles.tab,
              background: isActive ? p.color : '#fff',
              color:      isActive ? '#fff' : isConn ? '#374151' : '#c4c4c4',
              borderColor:isActive ? p.color : '#e5e7eb',
              opacity:    isConn ? 1 : 0.5,
            }}
          >
            <span style={styles.tabIcon}>{p.icon}</span>
            <span style={styles.tabLabel}>{p.label}</span>
            {!isConn && <span style={styles.notConn}>not connected</span>}
          </button>
        );
      })}
    </div>
  );
}

const styles = {
  wrap: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 },
  tab: {
    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
    borderRadius: 10, border: '1.5px solid', cursor: 'pointer',
    fontSize: 13, fontWeight: 600, transition: 'all .15s',
  },
  tabIcon:   { fontSize: 16 },
  tabLabel:  {},
  notConn:   { fontSize: 10, marginLeft: 4, opacity: 0.7 },
};
