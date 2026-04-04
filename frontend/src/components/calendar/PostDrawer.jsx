import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { X, ExternalLink, Edit2, Trash2, Calendar, RefreshCw } from 'lucide-react';
import { PLATFORMS } from '../../services/platforms';
import SocialPlatformIcon from '../ui/SocialPlatformIcon';

function fmt(n) {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

const STATUS_BADGE = {
  published: { bg: '#D1FAE5', color: '#059669', label: 'Published' },
  scheduled: { bg: '#DBEAFE', color: '#2563EB', label: 'Scheduled' },
  draft:     { bg: '#F1F5F9', color: '#64748B', label: 'Draft'     },
  failed:    { bg: '#FEE2E2', color: '#EF4444', label: 'Failed'    },
};

export default function PostDrawer({ post, isOpen, onClose, onEdit, onDelete, onReschedule }) {
  const [deleteConfirm, setDeleteConfirm]     = useState(false);
  const [rescheduleMode, setRescheduleMode]   = useState(false);
  const [newDatetime,    setNewDatetime]       = useState('');
  const [rescheduling,   setRescheduling]      = useState(false);

  if (!post) return null;

  const platform = PLATFORMS[post.platform] || { color: '#64748B', label: post.platform };
  const badge    = STATUS_BADGE[post.status] || STATUS_BADGE.draft;

  const bestTime = post.scheduled_at || post.published_at;
  const dateDisplay = bestTime
    ? format(parseISO(bestTime), 'EEEE, MMMM d, yyyy · h:mm a')
    : '—';

  const performanceScore = post.performance_score || 0;
  const scoreMax = 1000;

  async function handleReschedule() {
    if (!newDatetime) return;
    setRescheduling(true);
    await onReschedule(post.id, newDatetime);
    setRescheduling(false);
    setRescheduleMode(false);
    setNewDatetime('');
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 1000,
          opacity: isOpen ? 1 : 0,
          transition: 'opacity 0.25s',
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
      />

      {/* Drawer */}
      <div style={{
        position:  'fixed', top: 0, right: 0, bottom: 0,
        width:     420,
        background:'#fff',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
        zIndex:    1001,
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition:'transform 0.25s ease-out',
        display:   'flex', flexDirection: 'column',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #E2E8F0',
          display: 'flex', alignItems: 'center', gap: 12,
          background: platform.color + '10',
          position: 'sticky', top: 0, zIndex: 1,
        }}>
          <SocialPlatformIcon platform={post.platform} size={28} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
              {platform.label}
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '1px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
              background: badge.bg, color: badge.color, marginTop: 2,
            }}>
              {badge.label}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 4,
          }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', flex: 1 }}>
          {/* Title */}
          {post.title && (
            <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a', marginBottom: 8 }}>
              {post.title}
            </div>
          )}

          {/* Datetime */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#64748B', fontSize: 13 }}>
            <Calendar size={14} />
            <span>{dateDisplay}</span>
          </div>

          {/* Caption */}
          {post.caption && (
            <div style={{
              background: '#F8FAFC', borderRadius: 8, padding: '12px 14px',
              fontSize: 13, color: '#334155', lineHeight: 1.6, marginBottom: 12,
              whiteSpace: 'pre-wrap',
            }}>
              {post.caption}
            </div>
          )}

          {/* Hashtags */}
          {post.hashtags && (
            <div style={{ marginBottom: 12, fontSize: 13, color: '#2563EB' }}>
              {post.hashtags}
            </div>
          )}

          {/* Media thumbnail */}
          {post.media_url && (
            <div style={{ marginBottom: 14, borderRadius: 8, overflow: 'hidden' }}>
              <img
                src={post.media_url}
                alt="Post media"
                style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }}
                onError={e => { e.target.style.display = 'none'; }}
              />
            </div>
          )}

          {/* Published metrics */}
          {post.status === 'published' && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Performance
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {[
                  { icon: '👁',  label: 'Impressions', value: post.impressions },
                  { icon: '📡',  label: 'Reach',       value: post.reach      },
                  { icon: '❤️',  label: 'Likes',       value: post.likes      },
                  { icon: '💬',  label: 'Comments',    value: post.comments   },
                  { icon: '📤',  label: 'Shares',      value: post.shares     },
                  { icon: '🔖',  label: 'Saves',       value: post.saves      },
                  { icon: '▶️',  label: 'Views',       value: post.video_views},
                ].filter(m => m.value > 0).map(m => (
                  <div key={m.label} style={{
                    background: '#F8FAFC', borderRadius: 8, padding: '8px',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 16 }}>{m.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{fmt(m.value)}</div>
                    <div style={{ fontSize: 10, color: '#94A3B8' }}>{m.label}</div>
                  </div>
                ))}
              </div>

              {/* Performance score bar */}
              {performanceScore > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748B', marginBottom: 4 }}>
                    <span>Performance Score</span>
                    <span>{Math.min(performanceScore, scoreMax).toLocaleString()} pts</span>
                  </div>
                  <div style={{ height: 6, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3,
                      width: `${Math.min((performanceScore / scoreMax) * 100, 100)}%`,
                      background: '#2563EB', transition: 'width 0.8s ease',
                    }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Post URL */}
          {post.post_url && (
            <a
              href={post.post_url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 8,
                background: platform.color, color: '#fff',
                textDecoration: 'none', fontSize: 13, fontWeight: 600,
                marginBottom: 14,
              }}
            >
              <ExternalLink size={14} />
              View on {platform.label}
            </a>
          )}

          {/* Notes */}
          {post.notes && (
            <div style={{
              background: '#FFFBEB', border: '1px solid #FDE68A',
              borderRadius: 8, padding: '10px 14px',
              fontSize: 12, color: '#92400E', marginBottom: 14,
            }}>
              <strong>Agency note:</strong> {post.notes}
            </div>
          )}

          {/* Reschedule section */}
          {post.status === 'scheduled' && (
            <div style={{ marginBottom: 14 }}>
              {!rescheduleMode ? (
                <button
                  onClick={() => setRescheduleMode(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 8,
                    background: '#F1F5F9', border: '1px solid #E2E8F0',
                    color: '#475569', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', width: '100%', justifyContent: 'center',
                  }}
                >
                  <RefreshCw size={14} /> Reschedule
                </button>
              ) : (
                <div style={{ background: '#F8FAFC', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                    New scheduled time:
                  </div>
                  <input
                    type="datetime-local"
                    value={newDatetime}
                    onChange={e => setNewDatetime(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 6,
                      border: '1px solid #D1D5DB', fontSize: 13,
                      marginBottom: 8, boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleReschedule}
                      disabled={!newDatetime || rescheduling}
                      style={{
                        flex: 1, padding: '8px', borderRadius: 6,
                        background: '#2563EB', color: '#fff',
                        border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                        opacity: (!newDatetime || rescheduling) ? 0.6 : 1,
                      }}
                    >
                      {rescheduling ? 'Saving…' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => { setRescheduleMode(false); setNewDatetime(''); }}
                      style={{
                        padding: '8px 12px', borderRadius: 6,
                        background: '#fff', border: '1px solid #E2E8F0',
                        cursor: 'pointer', fontSize: 13, color: '#64748B',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        {post.status !== 'published' && (
          <div style={{
            padding: '14px 20px', borderTop: '1px solid #E2E8F0',
            display: 'flex', gap: 8,
            position: 'sticky', bottom: 0, background: '#fff', zIndex: 1,
          }}>
            <button
              onClick={() => onEdit && onEdit(post)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '9px', borderRadius: 8,
                background: '#F1F5F9', border: '1px solid #E2E8F0',
                color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}
            >
              <Edit2 size={14} /> Edit
            </button>
            {!deleteConfirm ? (
              <button
                onClick={() => setDeleteConfirm(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 16px', borderRadius: 8,
                  background: '#FEF2F2', border: '1px solid #FECACA',
                  color: '#EF4444', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}
              >
                <Trash2 size={14} /> Delete
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => { onDelete && onDelete(post.id); setDeleteConfirm(false); }}
                  style={{
                    padding: '9px 14px', borderRadius: 8,
                    background: '#EF4444', color: '#fff',
                    border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  }}
                >
                  Confirm Delete
                </button>
                <button
                  onClick={() => setDeleteConfirm(false)}
                  style={{
                    padding: '9px 12px', borderRadius: 8,
                    background: '#F1F5F9', border: '1px solid #E2E8F0',
                    cursor: 'pointer', fontSize: 13, color: '#64748B',
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
