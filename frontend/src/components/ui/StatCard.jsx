import { fmt } from '../../services/platforms';

// Color → gradient + glow map
const COLOR_MAP = {
  '#6366f1': { gradient: 'linear-gradient(135deg,#818cf8,#6366f1)', glow: 'rgba(99,102,241,0.22)', light: '#eef2ff' },
  '#22c55e': { gradient: 'linear-gradient(135deg,#4ade80,#22c55e)', glow: 'rgba(34,197,94,0.22)',  light: '#f0fdf4' },
  '#2563eb': { gradient: 'linear-gradient(135deg,#60a5fa,#2563eb)', glow: 'rgba(37,99,235,0.22)',  light: '#eff6ff' },
  '#ef4444': { gradient: 'linear-gradient(135deg,#f87171,#ef4444)', glow: 'rgba(239,68,68,0.22)',  light: '#fef2f2' },
  '#f59e0b': { gradient: 'linear-gradient(135deg,#fcd34d,#f59e0b)', glow: 'rgba(245,158,11,0.22)', light: '#fffbeb' },
  '#8b5cf6': { gradient: 'linear-gradient(135deg,#a78bfa,#8b5cf6)', glow: 'rgba(139,92,246,0.22)', light: '#f5f3ff' },
  '#0891b2': { gradient: 'linear-gradient(135deg,#22d3ee,#0891b2)', glow: 'rgba(8,145,178,0.22)',  light: '#ecfeff' },
  '#059669': { gradient: 'linear-gradient(135deg,#34d399,#059669)', glow: 'rgba(5,150,105,0.22)',  light: '#ecfdf5' },
};

const DEFAULT_THEME = {
  gradient: 'linear-gradient(135deg,#94a3b8,#64748b)',
  glow: 'rgba(100,116,139,0.18)',
  light: '#f8fafc',
};

export default function StatCard({ label, value, icon: Icon, color = '#2563eb', sub, trend }) {
  const theme = COLOR_MAP[color] || DEFAULT_THEME;
  const isPositive = trend > 0;

  return (
    <div className="card-hover" style={{ ...styles.card, '--glow': theme.glow }}>
      {/* Top: icon + label */}
      <div style={styles.top}>
        <div style={{ ...styles.iconWrap, background: theme.gradient, boxShadow: `0 4px 12px ${theme.glow}` }}>
          {Icon && <Icon size={16} color="#fff" strokeWidth={2.2} />}
        </div>
        <span style={styles.label}>{label}</span>
      </div>

      {/* Value */}
      <div style={{ ...styles.value, color: color }}>{fmt(value)}</div>

      {/* Trend + Sub */}
      <div style={styles.bottom}>
        {typeof trend === 'number' && trend !== 0 && (
          <span style={{
            ...styles.trendBadge,
            background: isPositive ? '#dcfce7' : '#fef2f2',
            color: isPositive ? '#16a34a' : '#dc2626',
          }}>
            {isPositive ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
        {sub && <span style={styles.sub}>{sub}</span>}
      </div>

      {/* Decorative gradient strip at bottom */}
      <div style={{ ...styles.strip, background: theme.gradient }} />
    </div>
  );
}

const styles = {
  card: {
    position: 'relative',
    background: '#fff',
    borderRadius: 16,
    padding: '18px 20px 20px',
    boxShadow: '0 1px 4px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)',
    flex: 1,
    minWidth: 148,
    overflow: 'hidden',
    border: '1px solid #f1f5f9',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  top: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  label: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    lineHeight: 1.3,
  },
  value: {
    fontSize: 30,
    fontWeight: 800,
    letterSpacing: '-0.04em',
    lineHeight: 1,
    marginTop: 2,
  },
  bottom: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  trendBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: 999,
  },
  sub: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: 500,
  },
  strip: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    borderRadius: '0 0 16px 16px',
    opacity: 0.7,
  },
};
