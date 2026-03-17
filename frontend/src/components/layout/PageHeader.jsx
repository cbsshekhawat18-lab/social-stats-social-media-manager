export default function PageHeader({ title, subtitle, actions = null, meta = [] }) {
  return (
    <div style={styles.wrap}>
      <div style={styles.topRow}>
        <div style={styles.copy}>
          <h1 style={styles.title}>{title}</h1>
          {subtitle ? <p style={styles.subtitle}>{subtitle}</p> : null}
        </div>
        {actions ? <div style={styles.actions}>{actions}</div> : null}
      </div>

      {meta.length > 0 && (
        <div style={styles.metaRow}>
          {meta.map((item) => (
            <div key={item.label} style={styles.metaCard}>
              <span style={styles.metaLabel}>{item.label}</span>
              <strong style={styles.metaValue}>{item.value}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: {
    marginBottom: 24,
  },
  topRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    flexWrap: 'wrap',
  },
  copy: {
    minWidth: 0,
  },
  title: {
    margin: 0,
    fontSize: 28,
    lineHeight: 1.1,
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: '-0.03em',
  },
  subtitle: {
    margin: '6px 0 0',
    color: '#64748b',
    fontSize: 14,
    lineHeight: 1.5,
  },
  actions: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  metaRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 12,
    marginTop: 16,
  },
  metaCard: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 14,
    padding: '12px 14px',
    boxShadow: '0 1px 6px rgba(15,23,42,.05)',
  },
  metaLabel: {
    display: 'block',
    marginBottom: 6,
    fontSize: 11,
    fontWeight: 700,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '.08em',
  },
  metaValue: {
    fontSize: 15,
    color: '#0f172a',
  },
};
