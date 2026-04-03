import { useState, useEffect, useRef } from 'react';
import { Trophy, ExternalLink, TrendingUp, TrendingDown, ImageOff, Play } from 'lucide-react';
import { topPostsAPI } from '../../services/api';
import { PLATFORMS, fmt } from '../../services/platforms';
// Inject keyframe once
if (typeof document !== 'undefined' && !document.getElementById('best-post-styles')) {
  const s = document.createElement('style');
  s.id = 'best-post-styles';
  s.textContent = `
    @keyframes trophyPop {
      0%   { transform: scale(.6) rotate(-10deg); opacity: 0; }
      70%  { transform: scale(1.15) rotate(4deg); opacity: 1; }
      100% { transform: scale(1) rotate(0deg); opacity: 1; }
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(s);
}

function useTopPosts(clientId, week) {
  const [posts, setPosts]     = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    setLoading(true);
    const params = { client: clientId };
    if (week) params.week = week;
    topPostsAPI.list(params)
      .then(res => setPosts(res.data.results || res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [clientId, week]);

  return { posts, loading };
}

function ScorePill({ label, value, weight, color }) {
  if (!value) return null;
  const weighted = Math.round(value * weight);
  return (
    <div style={{ ...pillStyle, borderColor: color + '40', background: color + '0d' }}>
      <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600, letterSpacing: .3 }}>
        {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
        {fmt(value)}
      </span>
      <span style={{ fontSize: 10, color }}>+{fmt(weighted)}</span>
    </div>
  );
}

const SCORE_WEIGHTS = [
  { key: 'impressions', label: 'Impr.', weight: 1,   color: '#6366f1' },
  { key: 'reach',       label: 'Reach', weight: 1.2, color: '#2563eb' },
  { key: 'likes',       label: 'Likes', weight: 2,   color: '#ef4444' },
  { key: 'comments',    label: 'Comm.', weight: 3,   color: '#f59e0b' },
  { key: 'shares',      label: 'Share', weight: 4,   color: '#8b5cf6' },
  { key: 'saves',       label: 'Saves', weight: 3,   color: '#ec4899' },
  { key: 'video_views', label: 'Views', weight: 0.5, color: '#ff0000' },
];

function PostCard({ entry, animKey }) {
  const post    = entry?.post;
  const platform = PLATFORMS[entry?.platform] || {};
  const [imgFailed, setImgFailed] = useState(false);

  if (!post) return (
    <div style={emptyCard}>
      <ImageOff size={28} style={{ color: '#cbd5e1', marginBottom: 8 }} />
      <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>No post data yet.</p>
    </div>
  );

  // vs average
  const avgScore = entry.avg_score || 0;
  const vsPct    = avgScore > 0 ? Math.round(((entry.score - avgScore) / avgScore) * 100) : null;
  const vsAbove  = vsPct !== null && vsPct >= 0;

  const caption = post.caption?.trim();
  const preview = caption ? (caption.length > 100 ? caption.slice(0, 100) + '…' : caption) : null;

  return (
    <div key={animKey} style={{ ...cardBody, animation: 'slideIn .35s ease' }}>
      <div style={cardInner}>
        {/* Thumbnail */}
        <div style={thumbWrap}>
          {post.thumbnail_url && !imgFailed ? (
            <img
              src={post.thumbnail_url} alt=""
              style={thumbImg}
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div style={{ ...thumbImg, display: 'flex', alignItems: 'center', justifyContent: 'center', background: platform.bg || '#f1f5f9' }}>
              {post.post_type?.includes('video') || post.video_views > 0
                ? <Play size={26} style={{ color: platform.color || '#94a3b8' }} />
                : <span style={{ fontSize: 28 }}>{platform.icon || '📄'}</span>
              }
            </div>
          )}
        </div>

        {/* Content */}
        <div style={contentCol}>
          {/* Trophy + score */}
          <div style={topRow}>
            <div style={headlineBlock}>
              <div style={trophyWrap}>
                <span style={{ animation: 'trophyPop .5s ease', display: 'inline-block', fontSize: 20 }}>
                  🏆
                </span>
                <span style={scoreLabel}>Score</span>
              </div>
              <strong style={scoreValue}>{fmt(Math.round(entry.score))}</strong>
            </div>
            {vsPct !== null && (
              <div style={{ ...vsBadge, background: vsAbove ? '#dcfce7' : '#fee2e2', color: vsAbove ? '#16a34a' : '#dc2626' }}>
                {vsAbove
                  ? <TrendingUp size={11} />
                  : <TrendingDown size={11} />
                }
                {Math.abs(vsPct)}% {vsAbove ? 'above' : 'below'} avg
              </div>
            )}
          </div>

          {/* Caption */}
          {preview && <p style={captionStyle}>{preview}</p>}

          {/* Date + type */}
          <div style={metaRow}>
            {post.published_at && (
              <span style={metaTag}>
                {new Date(post.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
            {post.post_type && (
              <span style={{ ...metaTag, background: '#f1f5f9', color: '#475569' }}>
                {post.post_type}
              </span>
            )}
          </div>

          {/* Score breakdown pills */}
          <div style={pillsRow}>
            {SCORE_WEIGHTS.map(sw => (
              <ScorePill key={sw.key} label={sw.label} value={post[sw.key]} weight={sw.weight} color={sw.color} />
            ))}
          </div>

          {/* View post link */}
          {post.post_url && (
            <a href={post.post_url} target="_blank" rel="noreferrer" style={viewLink}>
              <ExternalLink size={13} /> View Post
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BestPostWidget({ clientId, week }) {
  const { posts, loading } = useTopPosts(clientId, week);
  const [activeTab, setActiveTab] = useState(null);
  const animKey = useRef(0);

  // Auto-select first tab with data
  useEffect(() => {
    if (posts.length > 0 && !posts.find(p => p.platform === activeTab)) {
      setActiveTab(posts[0].platform);
    }
  }, [posts]); // eslint-disable-line

  const handleTab = (platform) => {
    animKey.current += 1;
    setActiveTab(platform);
  };

  const active = posts.find(p => p.platform === activeTab);

  if (!loading && posts.length === 0) return null;

  return (
    <div style={widgetWrap}>
      <div style={widgetHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={headerIcon}>
            <Trophy size={16} style={{ color: '#d97706' }} />
          </div>
          <div>
            <h3 style={headerTitle}>Best Post of the Week</h3>
            {week && <p style={headerSub}>Week of {week}</p>}
          </div>
        </div>
      </div>

      {/* Platform Tabs */}
      <div style={tabRow}>
        {posts.map(entry => {
          const p   = PLATFORMS[entry.platform] || {};
          const sel = entry.platform === activeTab;
          return (
            <button
              key={entry.platform}
              onClick={() => handleTab(entry.platform)}
              style={{
                ...tabBtn,
                borderColor:  sel ? (p.color || '#6366f1') : 'transparent',
                background:   sel ? (p.bg || '#f0f4ff') : 'transparent',
                color:        sel ? (p.color || '#1e293b') : '#64748b',
                fontWeight:   sel ? 700 : 500,
              }}
            >
              {p.icon} {p.label || entry.platform}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={skeleton}>
          <div style={{ height: 180, background: '#f1f5f9', borderRadius: 10, marginBottom: 12 }} />
          <div style={{ height: 14, background: '#f1f5f9', borderRadius: 6, width: '70%' }} />
        </div>
      ) : (
        <PostCard entry={active} animKey={animKey.current} />
      )}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const widgetWrap = {
  background: '#fff',
  borderRadius: 24,
  padding: 28,
  boxShadow: '0 18px 42px rgba(15,23,42,.08)',
  border: '1px solid #e5e7eb',
  marginBottom: 24,
};
const widgetHeader = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  marginBottom: 18,
};
const headerIcon = {
  width: 42, height: 42, borderRadius: 14, background: '#fff1c2',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const headerTitle = { margin: 0, fontSize: 16, fontWeight: 800, color: '#1e293b', letterSpacing: '-0.02em' };
const headerSub   = { margin: '3px 0 0', fontSize: 12, color: '#94a3b8' };

const tabRow = { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 };
const tabBtn = {
  padding: '9px 16px',
  borderRadius: 999,
  fontSize: 13,
  border: '1.5px solid',
  cursor: 'pointer', transition: 'all .15s',
};

const cardBody  = { };
const cardInner = {
  display: 'grid',
  gridTemplateColumns: '180px minmax(0, 1fr)',
  gap: 24,
  alignItems: 'start',
};
const thumbWrap = { flexShrink: 0 };
const thumbImg  = {
  width: 180,
  height: 180,
  objectFit: 'cover',
  borderRadius: 18,
  border: '1px solid #fbcfe8',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.7)',
};
const contentCol = { flex: 1, minWidth: 0, paddingTop: 6 };
const emptyCard  = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', padding: '32px 0',
};

const topRow    = { display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 12 };
const headlineBlock = { display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' };
const trophyWrap = { display: 'flex', alignItems: 'center', gap: 6 };
const scoreLabel = { fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700 };
const scoreValue = { fontSize: 36, lineHeight: 1, color: '#1e293b', letterSpacing: '-0.04em' };
const vsBadge    = {
  display: 'inline-flex', alignItems: 'center', gap: 3,
  fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 999,
};

const captionStyle = {
  margin: '0 0 14px', fontSize: 16, color: '#374151', lineHeight: 1.65, maxWidth: 760,
};
const metaRow  = { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 };
const metaTag  = {
  fontSize: 13, background: '#fef3c7', color: '#92400e',
  borderRadius: 999, padding: '6px 12px', fontWeight: 700,
};
const pillsRow = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))',
  gap: 10,
  marginBottom: 18,
};
const pillStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  border: '1px solid',
  borderRadius: 16,
  padding: '10px 12px',
  minWidth: 0,
  boxShadow: '0 1px 0 rgba(255,255,255,.7) inset',
};
const viewLink = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  color: '#2563eb', fontSize: 16, fontWeight: 700, textDecoration: 'none',
};
const skeleton = { padding: '8px 0' };
