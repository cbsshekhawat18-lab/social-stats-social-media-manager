import { useState } from 'react';
import { PLATFORMS } from '../../services/platforms';
import SocialPlatformIcon from '../ui/SocialPlatformIcon';

const STATUS_STYLES = {
  published: (color) => ({
    background:   color + '30',
    borderLeft:   `3px solid ${color}`,
    borderTop:    'none',
    borderRight:  'none',
    borderBottom: 'none',
  }),
  scheduled: (color) => ({
    background:   '#fff',
    border:       `1px dashed ${color}`,
    borderLeft:   `3px dashed ${color}`,
  }),
  draft: () => ({
    background:  '#F1F5F9',
    borderLeft:  '3px solid #94A3B8',
    border:      '1px solid #E2E8F0',
  }),
  failed: () => ({
    background:  '#FEF2F2',
    borderLeft:  '3px solid #EF4444',
    border:      '1px solid #FECACA',
  }),
};

export default function PostPill({ post, onClick }) {
  const [hovered, setHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ left: 0, top: 0 });
  const platform = PLATFORMS[post.platform] || { color: '#64748B', label: post.platform };
  const statusStyle = (STATUS_STYLES[post.status] || STATUS_STYLES.draft)(platform.color);
  const label = post.title || post.caption || '(no caption)';
  const truncated = label.length > 22 ? label.slice(0, 22) + '…' : label;

  const timeStr = post.scheduled_at || post.published_at
    ? new Date(post.scheduled_at || post.published_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  function handleMouseEnter(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const tooltipWidth = 220;
    const gap = 8;
    const left = rect.right + gap + tooltipWidth > window.innerWidth
      ? Math.max(12, rect.left - tooltipWidth - gap)
      : rect.right + gap;
    const top = Math.min(
      window.innerHeight - 140,
      Math.max(12, rect.top - 6)
    );

    setTooltipPos({ left, top });
    setHovered(true);
  }

  return (
    <div style={{ position: 'relative', display: 'block', width: '100%', minWidth: 0 }}>
      <div
        onClick={(e) => { e.stopPropagation(); onClick && onClick(post); }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setHovered(false)}
        style={{
          ...statusStyle,
          borderRadius: 4,
          padding: '2px 5px',
          marginBottom: 2,
          cursor: 'pointer',
          fontSize: 11,
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          overflow: 'hidden',
          minWidth: 0,
          width: '100%',
          boxSizing: 'border-box',
          transform: hovered ? 'scale(1.02)' : 'scale(1)',
          boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.12)' : 'none',
          transition: 'all 0.15s',
          userSelect: 'none',
        }}
      >
        <span style={{ flexShrink: 0, display: 'inline-flex' }}>
          <SocialPlatformIcon platform={post.platform} size={10} />
        </span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, color: '#1e293b' }}>
          {truncated}
        </span>
        {timeStr && (
          <span style={{ color: '#64748b', fontSize: 10, flexShrink: 0 }}>{timeStr}</span>
        )}
      </div>

      {/* Hover tooltip */}
      {hovered && (
        <div style={{
          position:   'fixed',
          left:       tooltipPos.left,
          top:        tooltipPos.top,
          zIndex:     1000,
          background: '#0f172a',
          color:      '#f8fafc',
          borderRadius: 8,
          padding:    '10px 12px',
          width:      220,
          fontSize:   12,
          boxShadow:  '0 8px 24px rgba(0,0,0,0.3)',
          pointerEvents: 'none',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <SocialPlatformIcon platform={post.platform} size={14} />
            <span style={{ color: platform.color }}>{platform.label}</span>
            <span style={{
              marginLeft: 'auto',
              fontSize: 10,
              padding: '1px 6px',
              borderRadius: 20,
              background: post.status === 'published' ? '#10B981' : post.status === 'scheduled' ? '#3B82F6' : post.status === 'failed' ? '#EF4444' : '#64748B',
              color: '#fff',
            }}>{post.status}</span>
          </div>
          <div style={{ marginBottom: 6, color: '#cbd5e1', lineHeight: 1.4 }}>
            {(post.caption || post.title || '').slice(0, 120)}{(post.caption || post.title || '').length > 120 ? '…' : ''}
          </div>
          {post.status === 'published' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid #1e293b', paddingTop: 6 }}>
              {post.impressions > 0 && <span>👁 {post.impressions.toLocaleString()}</span>}
              {post.likes > 0       && <span>❤️ {post.likes.toLocaleString()}</span>}
              {post.comments > 0    && <span>💬 {post.comments.toLocaleString()}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
