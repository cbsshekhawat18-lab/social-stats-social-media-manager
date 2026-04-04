function getEyebrowLabel(title, eyebrow) {
  if (eyebrow) return eyebrow;

  const normalized = String(title || '').trim().toLowerCase();

  if (!normalized) return 'Workspace';
  if (normalized.includes('settings')) return 'Settings';
  if (normalized.includes('report')) return 'Reports';
  if (normalized.includes('alert')) return 'Alerts';
  if (normalized.includes('analytic')) return 'Analytics';
  if (normalized.includes('calendar')) return 'Content Calendar';
  if (normalized.includes('post ideas')) return 'Content Planning';
  if (normalized.includes('caption')) return 'AI Tools';
  if (normalized.includes('hashtag')) return 'AI Tools';
  if (normalized.includes('roi')) return 'ROI Insights';
  if (normalized.includes('management')) return 'Admin Controls';
  if (normalized.includes('sync')) return 'Operations';
  if (normalized.includes('onboarding')) return 'Onboarding';
  if (normalized.includes('client')) return 'Client Workspace';
  if (normalized.includes('dashboard')) return 'Dashboard';
  if (normalized.includes('content calculator')) return 'Planning Tools';
  if (normalized.includes('my posts')) return 'Content Library';
  if (normalized.includes('users')) return 'User Management';

  return 'Workspace';
}

export default function PageHeader({ title, subtitle, actions = null, meta = [], eyebrow = null }) {
  const eyebrowLabel = getEyebrowLabel(title, eyebrow);

  return (
    <div style={styles.wrap} className="page-enter">
      <div style={styles.surface}>
        <div style={styles.glowA} />
        <div style={styles.glowB} />

        <div style={styles.topRow}>
          <div style={styles.copy}>
            <div style={styles.eyebrow}>{eyebrowLabel}</div>
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
      {meta.length === 0 && (
        <div style={styles.bottomSpacer} />
      )}
      {meta.length > 0 && (
        <div style={styles.bottomSpacerDense} />
      )}
    </div>
  );
}

const styles = {
  wrap: {
    marginBottom: 28,
  },
  surface: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 26,
    padding: '24px 24px 22px',
    background: 'linear-gradient(135deg, #f2fcff 0%, #e7f9ff 36%, #edfaff 66%, #eefcf6 100%)',
    border: '1px solid #cfefff',
    boxShadow: '0 18px 40px rgba(15,23,42,.08)',
  },
  glowA: {
    position: 'absolute',
    top: -90,
    right: -70,
    width: 220,
    height: 220,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(0,215,255,.2) 0%, rgba(0,215,255,0) 72%)',
    pointerEvents: 'none',
  },
  glowB: {
    position: 'absolute',
    bottom: -100,
    left: -40,
    width: 220,
    height: 220,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(52,211,153,.14) 0%, rgba(52,211,153,0) 72%)',
    pointerEvents: 'none',
  },
  topRow: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    flexWrap: 'wrap',
  },
  copy: {
    minWidth: 0,
    maxWidth: 760,
  },
  eyebrow: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 12px',
    borderRadius: 999,
    background: 'rgba(255,255,255,.9)',
    color: '#0f766e',
    fontSize: 11,
    fontWeight: 800,
    boxShadow: '0 1px 2px rgba(15,23,42,.05)',
    letterSpacing: '.12em',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  title: {
    margin: 0,
    fontSize: 30,
    lineHeight: 1.08,
    fontWeight: 900,
    color: '#0f172a',
    letterSpacing: '-0.045em',
  },
  subtitle: {
    margin: '9px 0 0',
    color: '#64748b',
    fontSize: 14,
    lineHeight: 1.7,
    fontWeight: 400,
    maxWidth: 720,
  },
  actions: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  metaRow: {
    position: 'relative',
    zIndex: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: 10,
    marginTop: 18,
  },
  metaCard: {
    background: 'rgba(255,255,255,.82)',
    border: '1px solid #d7f3fb',
    borderRadius: 18,
    padding: '14px 16px',
    boxShadow: '0 8px 22px rgba(15,23,42,.05)',
    backdropFilter: 'blur(10px)',
  },
  metaLabel: {
    display: 'block',
    marginBottom: 6,
    fontSize: 10,
    fontWeight: 800,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '.1em',
  },
  metaValue: {
    fontSize: 15,
    fontWeight: 700,
    color: '#0f172a',
    lineHeight: 1.4,
  },
  bottomSpacer: {
    height: 2,
  },
  bottomSpacerDense: {
    height: 2,
  },
};
