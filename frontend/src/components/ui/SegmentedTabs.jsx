if (typeof document !== 'undefined' && !document.getElementById('segmented-tabs-styles')) {
  const style = document.createElement('style');
  style.id = 'segmented-tabs-styles';
  style.textContent = `
    .segmented-tab-btn,
    .segmented-tab-btn:focus,
    .segmented-tab-btn:focus-visible {
      outline: none !important;
    }

    .segmented-tab-btn::-moz-focus-inner {
      border: 0;
    }
  `;
  document.head.appendChild(style);
}

export default function SegmentedTabs({
  items,
  active,
  onChange,
  compact = false,
  fullWidth = false,
  style = {},
}) {
  return (
    <div
      style={{
        ...styles.wrap,
        ...(compact ? styles.wrapCompact : {}),
        ...(fullWidth ? styles.wrapFullWidth : {}),
        ...style,
      }}
    >
      {items.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            className="segmented-tab-btn"
            type="button"
            onClick={(event) => {
              if (!item.disabled) onChange(item.id);
              event.currentTarget.blur();
            }}
            disabled={item.disabled}
            style={{
              ...styles.tab,
              ...(compact ? styles.tabCompact : {}),
              ...(fullWidth ? styles.tabFullWidth : {}),
              ...(isActive ? styles.tabActive : {}),
              ...(item.disabled ? styles.tabDisabled : {}),
            }}
          >
            {item.icon ? <span style={styles.icon}>{item.icon}</span> : null}
            <span style={styles.label}>{item.label}</span>
            {item.trailing ? <span style={styles.trailing}>{item.trailing}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

const styles = {
  wrap: {
    display: 'inline-flex',
    gap: 8,
    padding: 6,
    borderRadius: 18,
    background: 'linear-gradient(135deg, rgba(0,215,255,0.12) 0%, rgba(255,255,255,0.92) 68%, rgba(236,253,245,0.9) 100%)',
    border: '1px solid #dbeafe',
    boxShadow: '0 12px 28px rgba(15,23,42,.05)',
    flexWrap: 'wrap',
  },
  wrapCompact: {
    gap: 6,
    padding: 5,
    borderRadius: 16,
  },
  wrapFullWidth: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    width: '100%',
  },
  tab: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 46,
    padding: '12px 18px',
    borderRadius: 12,
    border: 'none',
    background: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
    transition: 'all 0.2s ease',
    fontFamily: 'inherit',
    outline: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
    boxSizing: 'border-box',
  },
  tabCompact: {
    minHeight: 38,
    padding: '9px 14px',
    fontSize: 13,
    borderRadius: 11,
    gap: 6,
  },
  tabFullWidth: {
    width: '100%',
  },
  tabActive: {
    background: '#ffffff',
    color: '#0f172a',
    boxShadow: '0 10px 24px rgba(0,215,255,.16)',
  },
  tabDisabled: {
    opacity: 0.48,
    cursor: 'not-allowed',
  },
  icon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
    flexShrink: 0,
  },
  label: {
    whiteSpace: 'nowrap',
  },
  trailing: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
};
