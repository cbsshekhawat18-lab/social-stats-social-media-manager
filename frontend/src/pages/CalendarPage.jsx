/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useState, useCallback, useEffect } from 'react';
import { addMonths, subMonths, format, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Calendar, List, BarChart2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useClients } from '../hooks/useData';
import {
  useCalendarPosts, useCalendarStats, useCalendarNotes,
  useCreatePost, useUpcomingPosts,
} from '../hooks/useCalendar';
import { PLATFORMS, PLATFORM_LIST } from '../services/platforms';
import CalendarGrid       from '../components/calendar/CalendarGrid';
import PostDrawer         from '../components/calendar/PostDrawer';
import PostFormDrawer     from '../components/calendar/PostFormDrawer';
import CalendarStats      from '../components/calendar/CalendarStats';
import UpcomingPosts      from '../components/calendar/UpcomingPosts';
import PageHeader         from '../components/layout/PageHeader';
import SocialPlatformIcon from '../components/ui/SocialPlatformIcon';

// ── Inject animation keyframes once ──────────────────────────────────────────
const STYLE_ID = 'cal-keyframes';
if (!document.getElementById(STYLE_ID)) {
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    @keyframes calFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    .cal-fade { animation: calFadeIn 0.2s ease-out; }
  `;
  document.head.appendChild(s);
}

const VIEWS = [
  { key: 'month', icon: <Calendar size={14} />, label: 'Month'  },
  { key: 'list',  icon: <List     size={14} />, label: 'List'   },
  { key: 'stats', icon: <BarChart2 size={14}/>, label: 'Stats'  },
];

// ── List view helpers ─────────────────────────────────────────────────────────
function fmt(n) {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

const STATUS_BADGE = {
  published: { bg: '#D1FAE5', color: '#059669' },
  scheduled: { bg: '#e6fbff', color: '#007a9a' },
  draft:     { bg: '#F1F5F9', color: 'var(--text-secondary)' },
  failed:    { bg: '#FEE2E2', color: '#EF4444' },
};

// ── List view ─────────────────────────────────────────────────────────────────
function ListView({ postsByDate, onPostClick, onEditPost, onDeletePost, onReschedule, isAdmin, month, year }) {
  // Build sorted date groups for the month
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const entries = Object.entries(postsByDate)
    .filter(([d]) => d.startsWith(prefix))
    .sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary)' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
          No posts this month
        </div>
        <div style={{ fontSize: 13 }}>Schedule your first post using the "+" button above.</div>
      </div>
    );
  }

  return (
    <div>
      {entries.map(([dateStr, posts]) => (
        <div key={dateStr} style={{ marginBottom: 24 }}>
          {/* Sticky date header */}
          <div style={{
            position: 'sticky', top: 0, zIndex: 10,
            background: 'var(--surface-page)', padding: '8px 0',
            borderBottom: '2px solid var(--border-default)', marginBottom: 8,
          }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
              {format(parseISO(dateStr), 'EEEE, MMMM d')}
            </span>
            <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>
              {posts.length} post{posts.length !== 1 ? 's' : ''}
            </span>
          </div>
          {posts.map(post => {
            const p     = PLATFORMS[post.platform] || { color: 'var(--text-secondary)', label: post.platform };
            const badge = STATUS_BADGE[post.status] || STATUS_BADGE.draft;
            const timeStr = (post.scheduled_at || post.published_at)
              ? format(parseISO(post.scheduled_at || post.published_at), 'h:mm a')
              : '';
            return (
              <div key={post.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                background: 'var(--surface-card)', borderRadius: 10,
                border: '1px solid var(--border-default)',
                borderLeft: `4px solid ${p.color}`,
                padding: '12px 16px', marginBottom: 8,
              }}>
                {/* Platform icon */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: p.color + '20',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, flexShrink: 0,
                }}>
                  <SocialPlatformIcon platform={post.platform} size={18} />
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                      {post.title || '(no title)'}
                    </span>
                    <span style={{
                      padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                      background: badge.bg, color: badge.color,
                    }}>
                      {post.status}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4,
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    marginBottom: 4,
                  }}>
                    {post.caption || '(no caption)'}
                  </div>
                  {post.hashtags && (
                    <div style={{ fontSize: 11, color: '#007a9a' }}>
                      {post.hashtags.split(' ').filter(h => h.startsWith('#')).length} hashtags
                    </div>
                  )}
                  {post.status === 'published' && (post.impressions > 0 || post.likes > 0) && (
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                      {post.impressions > 0 && <span>👁 {fmt(post.impressions)}</span>}
                      {post.likes       > 0 && <span>❤️ {fmt(post.likes)}</span>}
                      {post.comments    > 0 && <span>💬 {fmt(post.comments)}</span>}
                    </div>
                  )}
                </div>

                {/* Right: time + actions */}
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    {timeStr}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => onPostClick(post)} style={listBtnStyle}>View</button>
                    {isAdmin && post.status !== 'published' && (
                      <>
                        <button onClick={() => onEditPost(post)} style={listBtnStyle}>Edit</button>
                        <button
                          onClick={() => onDeletePost(post.id)}
                          style={{ ...listBtnStyle, color: '#EF4444', borderColor: '#FECACA' }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

const listBtnStyle = {
  padding: '4px 10px', borderRadius: 6,
  background: 'var(--surface-page)', border: '1px solid var(--border-default)',
  cursor: 'pointer', fontSize: 11, color: 'var(--text-secondary)',
};

// ── Main CalendarPage ─────────────────────────────────────────────────────────
export default function CalendarPage({ clientId: propClientId }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user }     = useAuth();
  const { clients }  = useClients();
  const isAdmin      = user?.role === 'superadmin' || user?.role === 'staff';
  const isEmbedded   = !!propClientId;
  const showClientSelector = isAdmin && !propClientId;
  const queryClientId = searchParams.get('client');
  const queryView = searchParams.get('view');
  const parsedClientId = queryClientId ? parseInt(queryClientId, 10) : null;
  const initialView = ['month', 'list', 'stats'].includes(queryView) ? queryView : 'month';

  // Client selector for admin
  const [selectedClientId, setSelectedClientId] = useState(
    propClientId || parsedClientId || (isAdmin ? null : user?.client_id) || null
  );
  const clientId = selectedClientId;

  useEffect(() => {
    if (!clientId && !isAdmin && user?.client_id) {
      setSelectedClientId(user.client_id);
    }
  }, [user, isAdmin, clientId]);

  // Month navigation
  const now = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const month = currentDate.getMonth() + 1;
  const year  = currentDate.getFullYear();

  // View + platform filter
  const [view,     setView]     = useState(initialView);
  const [platform, setPlatform] = useState('all');

  const updateSearch = useCallback((updates) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (parsedClientId && parsedClientId !== clientId) {
      setSelectedClientId(parsedClientId);
    }
    if (['month', 'list', 'stats'].includes(queryView) && queryView !== view) {
      setView(queryView);
    }
  }, [parsedClientId, queryView, clientId, view]);

  // Drawer state
  const [detailPost,   setDetailPost]   = useState(null);
  const [detailOpen,   setDetailOpen]   = useState(false);
  const [formOpen,     setFormOpen]     = useState(false);
  const [formDate,     setFormDate]     = useState(null);
  const [editingPost,  setEditingPost]  = useState(null);

  // Data hooks
  const { postsByDate, loading: postsLoading, refetch: refetchPosts } =
    useCalendarPosts(clientId, month, year, platform === 'all' ? '' : platform);
  const { notesByDate } = useCalendarNotes(clientId, month, year);
  const { stats }       = useCalendarStats(clientId, month, year);
  const { upcoming }    = useUpcomingPosts(clientId);
  const { creating, create, update, remove, reschedule } = useCreatePost();

  function prevMonth() { setCurrentDate(d => subMonths(d, 1)); }
  function nextMonth() { setCurrentDate(d => addMonths(d, 1)); }
  function goToday()   { setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1)); }

  function openPostDetail(post) { setDetailPost(post); setDetailOpen(true); }
  function closeDetail()        { setDetailOpen(false); setTimeout(() => setDetailPost(null), 300); }

  function openFormForDate(date) {
    if (!isAdmin) return;
    setEditingPost(null);
    setFormDate(date);
    setFormOpen(true);
  }
  function openFormForEdit(post) {
    if (!isAdmin) return;
    setEditingPost(post);
    setFormDate(null);
    setFormOpen(true);
    setDetailOpen(false);
  }
  function closeForm() { setFormOpen(false); setTimeout(() => { setEditingPost(null); setFormDate(null); }, 300); }

  async function handleSavePost(data, postId) {
    let result;
    if (postId) {
      result = await update(postId, data);
    } else {
      if (!clientId) return { success: false, error: 'No user selected.' };
      result = await create({ ...data, client: clientId });
    }
    if (result.success) {
      closeForm();
      refetchPosts();
    }
    return result;
  }

  async function handleDeletePost(postId) {
    const r = await remove(postId);
    if (r.success) { closeDetail(); refetchPosts(); }
    else alert(r.error);
  }

  async function handleReschedule(postId, datetime) {
    const r = await reschedule(postId, datetime);
    if (r.success) {
      setDetailPost(r.post);
      refetchPosts();
    } else {
      alert(r.error);
    }
  }

  // ── No client selected (admin only) ──
  if (showClientSelector && !clientId) {
    return (
      <div style={{
        padding: '28px 32px 40px',
        background: 'var(--surface-page)',
        minHeight: '100vh',
        width: '100%',
        maxWidth: '100%',
        overflowX: 'hidden',
        boxSizing: 'border-box',
      }}>
        <div style={{ maxWidth: 1480, margin: '0 auto' }}>
          <PageHeader
            title="Content Calendar"
            subtitle="Plan, review, and measure your scheduled content."
            actions={(
              <select
                value=""
                onChange={e => {
                  const nextClientId = e.target.value ? parseInt(e.target.value, 10) : null;
                  setSelectedClientId(nextClientId);
                  updateSearch({ client: nextClientId });
                }}
                style={adminClientSelectStyle}
              >
                <option value="">All Users</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
              </select>
            )}
          />
          <div style={{ padding: 40, maxWidth: 500, margin: '60px auto', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>Content Calendar</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 0 }}>
              Select a user from the top-right dropdown to view their content calendar.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: '28px 32px 40px',
      background: 'var(--surface-page)',
      minHeight: '100vh',
      width: '100%',
      maxWidth: '100%',
      overflowX: 'hidden',
      boxSizing: 'border-box',
    }}>
      <div style={{
        maxWidth: isEmbedded ? '100%' : 1480,
        margin: isEmbedded ? '0' : '0 auto',
      }}>
        <PageHeader
          title="Content Calendar"
          subtitle="Plan, review, and measure your scheduled content."
          actions={showClientSelector ? (
            <select
              value={clientId || ''}
              onChange={e => {
                const nextClientId = e.target.value ? parseInt(e.target.value, 10) : null;
                setSelectedClientId(nextClientId);
                updateSearch({ client: nextClientId });
              }}
              style={adminClientSelectStyle}
            >
              <option value="">All Users</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
            </select>
          ) : null}
        />

        {/* Top bar */}
        <div className="calendar-toolbar" style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          marginBottom: 20,
          flexWrap: 'wrap',
          width: '100%',
        }}>
        {/* Month nav */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexWrap: 'wrap',
          flex: '1 1 260px',
          minWidth: 0,
        }}>
          <button onClick={prevMonth} style={navBtnStyle}><ChevronLeft size={16} /></button>
          <div style={{
            fontWeight: 800,
            fontSize: 18,
            color: 'var(--text-primary)',
            minWidth: isEmbedded ? 140 : 160,
            textAlign: 'center',
          }}>
            {format(currentDate, 'MMMM yyyy')}
          </div>
          <button onClick={nextMonth} style={navBtnStyle}><ChevronRight size={16} /></button>
          <button onClick={goToday} style={{
            padding: '6px 12px', borderRadius: 8, background: 'var(--surface-page)',
            border: '1px solid var(--border-default)', cursor: 'pointer', fontSize: 12,
            fontWeight: 600, color: 'var(--text-secondary)',
          }}>Today</button>
        </div>

        {/* Platform filter */}
        <div style={{
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          flex: '999 1 420px',
          minWidth: 0,
        }}>
          {[{ key: 'all', label: 'All', color: '#00d7ff' },
            ...PLATFORM_LIST.map(k => ({ key: k, ...PLATFORMS[k] }))
          ].map(p => (
            <button
              key={p.key}
              onClick={() => setPlatform(p.key)}
              style={{
                padding: '5px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s',
                background: platform === p.key ? '#00d7ff' : '#fff',
                color:      platform === p.key ? '#fff' : 'var(--text-secondary)',
                border:     platform === p.key
                  ? '1px solid #00d7ff'
                  : '1px solid var(--border-default)',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {p.key === 'all' ? null : <SocialPlatformIcon platform={p.key} size={14} />}
                {p.label?.split(' ')[0] || 'All'}
              </span>
            </button>
          ))}
        </div>

        {/* Right: Schedule + View Toggle */}
        <div style={{
          marginLeft: isEmbedded ? 0 : 'auto',
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          justifyContent: isEmbedded ? 'flex-start' : 'flex-end',
          flex: '1 1 260px',
          minWidth: 0,
        }}>
          {isAdmin && (
            <button
              onClick={() => openFormForDate(new Date())}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 8,
                background: '#00d7ff', color: 'var(--text-primary)',
                border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              <Plus size={16} /> Schedule Post
            </button>
          )}
          <div style={{
            display: 'flex', border: '1px solid var(--border-default)',
            borderRadius: 8, overflow: 'hidden',
            flexWrap: 'wrap',
            maxWidth: '100%',
          }}>
            {VIEWS.map(v => (
              <button
                key={v.key}
                onClick={() => {
                  setView(v.key);
                  updateSearch({ view: v.key, client: clientId });
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '7px 14px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: view === v.key ? '#00d7ff' : '#fff',
                  color:      view === v.key ? '#fff'   : 'var(--text-secondary)',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {v.icon} {v.label}
              </button>
            ))}
          </div>
        </div>
        </div>

        {/* Loading state */}
        {postsLoading && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 14 }}>
            Loading calendar…
          </div>
        )}

        {/* ── MONTH VIEW ── */}
        {!postsLoading && view === 'month' && (
          <div className="cal-fade">
            <CalendarGrid
              month={month} year={year}
              postsByDate={postsByDate}
              notesByDate={notesByDate}
              onDayClick={openFormForDate}
              onPostClick={openPostDetail}
              selectedPlatform={platform}
            />
          </div>
        )}

        {/* ── LIST VIEW ── */}
        {!postsLoading && view === 'list' && (
          <div className="cal-fade">
          {/* Upcoming strip */}
          {upcoming.length > 0 && (
            <div style={{
              background: 'var(--surface-card)', borderRadius: 12, border: '1px solid var(--border-default)',
              padding: '16px 20px', marginBottom: 20,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
                📅 Coming up this week
              </div>
              <UpcomingPosts posts={upcoming} />
            </div>
          )}

          <ListView
            postsByDate={postsByDate}
            onPostClick={openPostDetail}
            onEditPost={openFormForEdit}
            onDeletePost={handleDeletePost}
            onReschedule={handleReschedule}
            isAdmin={isAdmin}
            month={month}
            year={year}
          />
          </div>
        )}

        {/* ── STATS VIEW ── */}
        {!postsLoading && view === 'stats' && (
          <div className="cal-fade">
            <CalendarStats stats={stats} month={month} year={year} postsByDate={postsByDate} />
          </div>
        )}

        {/* ── Post Detail Drawer ── */}
        <PostDrawer
          post={detailPost}
          isOpen={detailOpen}
          onClose={closeDetail}
          onEdit={openFormForEdit}
          onDelete={handleDeletePost}
          onReschedule={handleReschedule}
        />

        {/* ── Post Form Drawer ── */}
        <PostFormDrawer
          date={formDate}
          post={editingPost}
          isOpen={formOpen}
          onClose={closeForm}
          onSave={handleSavePost}
          clientId={clientId}
          readOnly={!isAdmin}
        />
      </div>
    </div>
  );
}

const navBtnStyle = {
  width: 32, height: 32, borderRadius: '50%',
  background: 'var(--surface-card)', border: '1px solid var(--border-default)',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--text-secondary)', transition: 'background 0.15s',
};

const adminClientSelectStyle = {
  padding: '8px 14px',
  borderRadius: 10,
  border: '1.5px solid var(--border-default)',
  fontSize: 13,
  color: 'var(--text-primary)',
  background: 'var(--surface-card)',
  outline: 'none',
  minWidth: 200,
  fontWeight: 600,
};
