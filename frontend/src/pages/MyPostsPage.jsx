import { useMemo, useState } from 'react';
import { ExternalLink, MessageCircle, Heart, Play, CalendarDays } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import DateRangePicker from '../components/ui/DateRangePicker';
import PlatformTabs from '../components/ui/PlatformTabs';
import { useAuth } from '../hooks/useAuth';
import { useDateRange, useOAuthStatus, usePosts } from '../hooks/useData';
import { PLATFORMS, fmt } from '../services/platforms';

function EmptyState() {
  return (
    <div style={styles.emptyState}>
      <CalendarDays size={28} style={{ color: '#94a3b8' }} />
      <h3 style={styles.emptyTitle}>No posts found</h3>
      <p style={styles.emptyText}>Posts will appear here once your connected accounts have synced content.</p>
    </div>
  );
}

export default function MyPostsPage() {
  const { user } = useAuth();
  const clientId = user?.client_id;
  const [range, setRange] = useDateRange(30);
  const [platform, setPlatform] = useState('all');
  const { posts, loading } = usePosts(clientId, platform, range);
  const { status: oauthStatus } = useOAuthStatus(clientId);

  const connectedPlatforms = useMemo(() => (
    Object.entries(oauthStatus)
      .filter(([, value]) => value.status === 'active')
      .map(([key]) => key)
  ), [oauthStatus]);

  return (
    <div style={styles.page}>
      <PageHeader
        title="My Posts"
        subtitle="Review recent content performance across your connected accounts."
        actions={<DateRangePicker range={range} onChange={setRange} />}
        meta={[
          { label: 'Posts', value: posts.length },
          { label: 'Platforms', value: connectedPlatforms.length || 0 },
          { label: 'View', value: platform === 'all' ? 'All Platforms' : (PLATFORMS[platform]?.label || platform) },
        ]}
      />

      <div style={styles.filterBar}>
        <PlatformTabs
          selected={platform}
          onChange={setPlatform}
          connected={connectedPlatforms}
        />
      </div>

      {loading ? (
        <div style={styles.loading}>Loading posts…</div>
      ) : posts.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={styles.grid}>
          {posts.map((post) => {
            const platformMeta = PLATFORMS[post.platform] || { icon: '🔗', label: post.platform, color: '#64748b', bg: '#f8fafc' };
            const title = post.caption || post.title || 'Untitled post';
            const isVideo = post.video_views > 0 || post.post_type?.includes('video');
            return (
              <article key={post.id} style={styles.card}>
                <div style={{ ...styles.thumb, background: platformMeta.bg }}>
                  {post.thumbnail_url ? (
                    <img src={post.thumbnail_url} alt="" style={styles.thumbImg} />
                  ) : isVideo ? (
                    <Play size={28} style={{ color: platformMeta.color }} />
                  ) : (
                    <span style={styles.thumbIcon}>{platformMeta.icon}</span>
                  )}
                </div>

                <div style={styles.cardBody}>
                  <div style={styles.cardTop}>
                    <span style={{ ...styles.platformPill, color: platformMeta.color, background: `${platformMeta.color}14` }}>
                      {platformMeta.icon} {platformMeta.label}
                    </span>
                    <span style={styles.dateText}>
                      {post.published_at ? new Date(post.published_at).toLocaleDateString() : 'Draft'}
                    </span>
                  </div>

                  <h3 style={styles.cardTitle}>{title}</h3>

                  <div style={styles.metricRow}>
                    <span style={styles.metricChip}>👁 {fmt(post.impressions)}</span>
                    <span style={styles.metricChip}><Heart size={12} /> {fmt(post.likes)}</span>
                    <span style={styles.metricChip}><MessageCircle size={12} /> {fmt(post.comments)}</span>
                    {post.video_views > 0 && <span style={styles.metricChip}><Play size={12} /> {fmt(post.video_views)}</span>}
                  </div>

                  {post.post_url && (
                    <a href={post.post_url} target="_blank" rel="noreferrer" style={styles.viewLink}>
                      <ExternalLink size={14} />
                      View Post
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { padding: '28px 32px 40px', maxWidth: 1480, margin: '0 auto' },
  filterBar: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 16,
    padding: '14px 16px',
    marginBottom: 20,
    boxShadow: '0 1px 6px rgba(15,23,42,.05)',
  },
  loading: { textAlign: 'center', color: '#94a3b8', padding: 60 },
  emptyState: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 16,
    padding: 48,
    textAlign: 'center',
    boxShadow: '0 1px 6px rgba(15,23,42,.05)',
  },
  emptyTitle: { margin: '12px 0 8px', fontSize: 18, fontWeight: 800, color: '#0f172a' },
  emptyText: { margin: 0, color: '#64748b', fontSize: 14 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 18,
  },
  card: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 18,
    overflow: 'hidden',
    boxShadow: '0 1px 8px rgba(15,23,42,.05)',
  },
  thumb: {
    height: 170,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottom: '1px solid #eef2f7',
  },
  thumbImg: { width: '100%', height: '100%', objectFit: 'cover' },
  thumbIcon: { fontSize: 34 },
  cardBody: { padding: 18 },
  cardTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  platformPill: {
    fontSize: 12,
    fontWeight: 700,
    borderRadius: 999,
    padding: '6px 10px',
  },
  dateText: { fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' },
  cardTitle: {
    margin: '0 0 14px',
    fontSize: 15,
    lineHeight: 1.5,
    fontWeight: 700,
    color: '#0f172a',
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  metricRow: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 },
  metricChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '6px 9px',
    borderRadius: 10,
    background: '#f0f4f9',
    color: '#475569',
    fontSize: 12,
    fontWeight: 600,
  },
  viewLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    color: '#00d7ff',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 700,
  },
};
