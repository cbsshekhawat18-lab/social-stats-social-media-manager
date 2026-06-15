/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import { PLATFORMS } from '../../services/platforms';
import SocialPlatformIcon from '../ui/SocialPlatformIcon';

function relativeDay(dateStr) {
  const d = parseISO(dateStr);
  if (isToday(d))    return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  return format(d, 'EEE, MMM d');
}

export default function UpcomingPosts({ posts }) {
  if (!posts || posts.length === 0) {
    return (
      <div style={{
        textAlign: 'center', padding: '20px', color: '#94A3B8', fontSize: 13,
      }}>
        No posts scheduled in the next 7 days.
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', gap: 10, overflowX: 'auto',
      paddingBottom: 4,
    }}>
      {posts.map(post => {
        const p = PLATFORMS[post.platform] || { color: '#64748B', label: post.platform };
        const timeStr = post.scheduled_at
          ? format(parseISO(post.scheduled_at), 'h:mm a')
          : '';
        const dayStr  = post.scheduled_at ? relativeDay(post.scheduled_at) : '';
        const preview = (post.caption || post.title || '').slice(0, 60);

        return (
          <div key={post.id} style={{
            flexShrink: 0,
            width: 160,
            background: '#fff',
            borderRadius: 10,
            border: '1px solid #E2E8F0',
            borderTop: `3px solid ${p.color}`,
            padding: '10px 12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <SocialPlatformIcon platform={post.platform} size={18} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>{dayStr}</div>
                <div style={{ fontSize: 10, color: '#64748B' }}>{timeStr}</div>
              </div>
            </div>
            <div style={{
              fontSize: 12, color: '#374151', lineHeight: 1.4,
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>
              {preview || '(no caption)'}
            </div>
          </div>
        );
      })}
    </div>
  );
}
