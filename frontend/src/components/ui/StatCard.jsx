import { fmt } from '../../services/platforms';

export default function StatCard({ label, value, icon: Icon, color = '#2563eb', sub }) {
  return (
    <div style={{ ...styles.card, borderTop: `3px solid ${color}` }}>
      <div style={styles.top}>
        <span style={styles.icon}>
          {Icon && <Icon size={20} color={color} />}
        </span>
        <span style={{ ...styles.label }}>{label}</span>
      </div>
      <div style={{ ...styles.value, color }}>{fmt(value)}</div>
      {sub && <div style={styles.sub}>{sub}</div>}
    </div>
  );
}

const styles = {
  card: {
    background: '#fff', borderRadius: 14, padding: '20px 22px',
    boxShadow: '0 1px 6px rgba(0,0,0,.07)', flex: 1, minWidth: 140,
  },
  top:   { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 },
  icon:  { display: 'flex', alignItems: 'center' },
  label: { fontSize: 13, color: '#64748b', fontWeight: 500 },
  value: { fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px' },
  sub:   { fontSize: 12, color: '#94a3b8', marginTop: 4 },
};
