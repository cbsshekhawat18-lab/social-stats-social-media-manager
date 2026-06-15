/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { PLATFORMS } from '../../services/platforms';
import SocialPlatformIcon from './SocialPlatformIcon';
import SegmentedTabs from './SegmentedTabs';

export default function PlatformTabs({ selected, onChange, connected = [], platforms = [] }) {
  const platformItems = platforms.length > 0
    ? platforms.map((p) => ({
        key: p.key,
        label: p.label || p.key,
        color: PLATFORMS[p.key]?.color || '#64748b',
      }))
    : Object.entries(PLATFORMS).map(([key, v]) => ({ key, ...v }));

  const items = [
    { key: 'all', label: 'All', color: '#6366f1' },
    ...platformItems,
  ].map((p) => {
    const isConn = p.key === 'all' || connected.includes(p.key);

    return {
      id: p.key,
      label: p.label,
      disabled: !isConn,
      icon: p.key === 'all' ? null : <SocialPlatformIcon platform={p.key} size={15} />,
      trailing: isConn && p.key !== 'all'
        ? <span style={{ ...styles.connDot, background: p.color }} />
        : !isConn
          ? <span style={styles.notConn}>✕</span>
          : null,
    };
  });

  return (
    <SegmentedTabs
      items={items}
      active={selected}
      onChange={onChange}
      compact
      style={styles.wrap}
    />
  );
}

const styles = {
  wrap: {
    marginBottom: 20,
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
