/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useState } from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useClientSummary, useTimeseries, usePosts, useDateRange, useOAuthStatus, useLookups } from '../hooks/useData';
import { PLATFORMS, fmt } from '../services/platforms';
import { exportPDF } from '../services/exportPDF';
import StatCard from '../components/ui/StatCard';
import PlatformTabs from '../components/ui/PlatformTabs';
import TodayBriefing from '../components/ai/TodayBriefing';
import DateRangePicker from '../components/ui/DateRangePicker';
import { ImpressionsChart, EngagementChart, VideoViewsChart, PlatformCompareChart } from '../components/charts/Charts';
import { clientsAPI } from '../services/api';
import {
  Eye, Radio, MousePointer2, Heart, Play, UserPlus, Globe, Phone,
  RefreshCw, Loader2, FileText, Share2, Clock, TrendingDown, Timer,
  Mail, Video, MessageCircle, Navigation, Bookmark,
  BarChart2, TrendingUp, Zap, Activity, Star, MapPin, CheckCircle2,
  Inbox, Sparkles,
} from 'lucide-react';
import GMBWidget from '../components/ui/GMBWidget';
import GoalTracker from '../components/ui/GoalTracker';
import NotificationBell from '../components/ui/NotificationBell';
import AIInsightCard from '../components/ui/AIInsightCard';
import BestPostWidget from '../components/ui/BestPostWidget';
import ShareReportModal from '../components/ui/ShareReportModal';
import ROICalculatorPage from './ROICalculatorPage';
import CalendarPage from './CalendarPage';
import { useUpcomingPosts } from '../hooks/useCalendar';
import PageHeader from '../components/layout/PageHeader';
import SegmentedTabs from '../components/ui/SegmentedTabs';
import { format, parseISO } from 'date-fns';
import SocialPlatformIcon from '../components/ui/SocialPlatformIcon';

const PLATS = PLATFORMS;

// Tab IDs are part of the public URL. Don't rename without a redirect.
const TAB_IDS = ['overview', 'analytics', 'posts', 'calendar', 'roi'];
const DEFAULT_TAB = 'overview';

const TAB_ITEMS = [
  { id: 'overview',  label: 'Overview'  },
  { id: 'analytics', label: 'Analytics' },
  { id: 'posts',     label: 'Posts'     },
  { id: 'calendar',  label: 'Calendar'  },
  { id: 'roi',       label: 'ROI'       },
];

export default function ClientDashboard({ clientId: propClientId }) {
  const { user }                    = useAuth();
  const clientId                    = propClientId || user?.client_id;
  const [range, setRange]           = useDateRange(30);
  const [platform, setPlatform]     = useState('all');
  const [syncing, setSyncing]       = useState(false);
  const [shareOpen, setShareOpen]   = useState(false);

  // ── URL-backed tab state ──────────────────────────────────────────────────
  // ?tab=analytics, ?tab=posts, etc. Omitted from URL on the default tab so
  // /dashboard stays clean. Invalid values fall back to the default.
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab = TAB_IDS.includes(rawTab) ? rawTab : DEFAULT_TAB;

  const setTab = (id) => {
    const next = new URLSearchParams(searchParams);
    if (id === DEFAULT_TAB) next.delete('tab');
    else next.set('tab', id);
    setSearchParams(next, { replace: true });
  };

  // ── Data ──────────────────────────────────────────────────────────────────
  // Hooks live here (parent) so switching tabs doesn't refetch. Each tab
  // receives the slice of data it needs via props.
  const { data: summary, loading: sumLoading, refetch: refetchSummary } = useClientSummary(clientId, range, platform);
  const { data: timeseries, loading: tsLoading }                        = useTimeseries(clientId, range, platform);
  const { posts }                                                        = usePosts(clientId, platform, range);
  const { status: oauthStatus }                                          = useOAuthStatus(clientId);
  const { lookups }                                                      = useLookups();

  const platformLabelMap = (lookups.platforms || []).reduce((acc, item) => {
    acc[item.key] = item.label;
    return acc;
  }, {});

  const platformMeta = (key) => ({
    label: platformLabelMap[key] || PLATFORMS[key]?.label || key,
    color: PLATFORMS[key]?.color || 'var(--text-secondary)',
  });

  const totals     = summary?.totals      || {};
  const byPlatform = summary?.by_platform || [];
  const client     = summary?.client      || {};

  const connectedPlatforms = Object.entries(oauthStatus)
    .filter(([, v]) => v.status === 'active')
    .map(([k]) => k);
  const hasAnalytics   = timeseries.length > 0 || byPlatform.length > 0;
  const hasPosts       = posts.length > 0;
  const connectedCount = connectedPlatforms.length;

  const handleSync = async () => {
    setSyncing(true);
    try {
      await clientsAPI.triggerSync(clientId, connectedPlatforms);
      setTimeout(() => { refetchSummary(); setSyncing(false); }, 3000);
    } catch { setSyncing(false); }
  };

  const handleExportPDF = () => {
    exportPDF({ client, summary, dateRange: range, chartsElementId: 'charts-area', posts, timeseries, connectedPlatforms });
  };

  const tabProps = {
    clientId, user,
    range, setRange, platform, setPlatform,
    summary, sumLoading, timeseries, tsLoading, posts,
    oauthStatus, lookups, totals, byPlatform, client,
    connectedPlatforms, connectedCount, hasAnalytics, hasPosts,
    platformMeta, handleSync, syncing,
    setTab,
  };

  return (
    <div className="app-page app-page--content app-page--xl">
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .db-card { animation: fadeUp .3s ease both; }
        .db-kpi:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,.10) !important; transition: all .2s; }
        .db-row:hover { background: var(--surface-sunken) !important; }
        .db-post-thumb { transition: transform .2s; }
        .db-post-thumb:hover { transform: scale(1.04); }
      `}</style>

      <PageHeader
        title={client.company || 'Dashboard'}
        subtitle="Social Media Analytics"
        actions={(
          <div style={S.headerActions}>
            <NotificationBell clientId={clientId} />
            <button onClick={handleSync} disabled={syncing} style={S.syncBtn}>
              <span style={S.btnInner}>
                {syncing
                  ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Syncing…</>
                  : <><RefreshCw size={15} /> Sync Now</>}
              </span>
            </button>
            <button onClick={() => setShareOpen(true)} style={S.shareBtn}>
              <span style={S.btnInner}><Share2 size={15} /> Share</span>
            </button>
            <button onClick={handleExportPDF} style={S.pdfBtn}>
              <span style={S.btnInner}><FileText size={15} /> Export PDF</span>
            </button>
          </div>
        )}
      />

      {shareOpen && <ShareReportModal clientId={clientId} onClose={() => setShareOpen(false)} />}

      {/* Client profile strip — applies across all tabs */}
      {!sumLoading && client.company && <ClientProfileStrip client={client} />}

      <SegmentedTabs
        items={TAB_ITEMS}
        active={activeTab}
        onChange={setTab}
        compact
        style={{ marginBottom: 20 }}
      />

      {activeTab === 'overview'  && <OverviewTab  {...tabProps} />}
      {activeTab === 'analytics' && <AnalyticsTab {...tabProps} />}
      {activeTab === 'posts'     && <PostsTab     {...tabProps} />}
      {activeTab === 'calendar'  && <CalendarPage clientId={clientId} />}
      {activeTab === 'roi'       && <ROICalculatorPage clientId={clientId} />}
    </div>
  );
}

// ── Tab components ────────────────────────────────────────────────────────────

function OverviewTab(p) {
  const {
    clientId, user, range, setRange, platform, setPlatform,
    posts, lookups, totals, byPlatform,
    connectedPlatforms, connectedCount, hasAnalytics,
    platformMeta, handleSync, syncing, setTab,
  } = p;

  const briefingBasePath = user?.role === 'client' ? '/dashboard' : '/admin';

  return (
    <>
      {/* Greeting */}
      <div style={S.greetWrap}>
        <div>
          <div style={S.greetTitle}>Good morning 👋</div>
          <div style={S.greetSub}>Here's a snapshot of your latest activity</div>
        </div>
      </div>

      {/* AI today briefingof comprehensive AI build */}
      {clientId && <TodayBriefing clientId={clientId} basePath={briefingBasePath} />}

      {/* Control bar */}
      <ControlBar
        range={range}
        setRange={setRange}
        platform={platform}
        setPlatform={setPlatform}
        connectedPlatforms={connectedPlatforms}
        platforms={lookups.platforms || []}
        postCount={posts.length}
        connectedCount={connectedCount}
        hasAnalytics={hasAnalytics}
      />

      {/* No connections empty state */}
      {connectedCount === 0 ? (
        <EmptyState
          icon={<Activity size={32} color="var(--text-tertiary)" />}
          title="No accounts connected yet"
          body="Connect Facebook, Instagram, LinkedIn, YouTube, or Google My Business to start syncing your data."
          actionLabel="Connect accounts"
          actionHref="/dashboard/settings"
        />
      ) : (
        <>
          {/* Highlight strip */}
          {hasAnalytics && (
            <div style={S.highlightStrip} className="db-card client-highlight-strip">
              <HighlightTile
                icon={<TrendingUp size={16} color="#22c55e" />}
                label="Engagement Rate"
                value={totals.avg_engagement_rate != null ? `${totals.avg_engagement_rate.toFixed(2)}%` : '—'}
                bg="#f0fdf4" border="#bbf7d0"
              />
              <HighlightTile
                icon={<Bookmark size={16} color="#8b5cf6" />}
                label="Total Saves"
                value={fmt(totals.total_saves)}
                bg="#f5f3ff" border="#ddd6fe"
              />
              <HighlightTile
                icon={<MessageCircle size={16} color="#0891b2" />}
                label="Total Comments"
                value={fmt(totals.total_comments)}
                bg="#f0f9ff" border="#bae6fd"
              />
              <HighlightTile
                icon={<Share2 size={16} color="#f59e0b" />}
                label="Total Shares"
                value={fmt(totals.total_shares)}
                bg="#fffbeb" border="#fde68a"
              />
            </div>
          )}

          {/* No-data nudge (connected but no metrics yet) */}
          {!hasAnalytics && (
            <EmptyState
              icon={<BarChart2 size={32} color="var(--text-tertiary)" />}
              title="No analytics yet"
              body="Your accounts are connected but we haven't pulled metrics yet. Click Sync Now to start."
              actionLabel={syncing ? 'Syncing…' : 'Sync Now'}
              onAction={syncing ? undefined : handleSync}
              compact
            />
          )}

          {/* 2-col grid: features | sidebar widgets */}
          <div style={S.analyticsLayout} className="client-analytics-grid">
            <div style={S.primaryColumn}>
              <div style={S.featureStack}>
                <GoalTracker
                  clientId={clientId}
                  month={new Date().getMonth() + 1}
                  year={new Date().getFullYear()}
                />
                <AIInsightCard
                  clientId={clientId}
                  month={new Date().getMonth() + 1}
                  year={new Date().getFullYear()}
                  canGenerate={user?.role === 'superadmin' || user?.role === 'staff'}
                />
                <BestPostWidget clientId={clientId} />
              </div>

              {/* Quick links into deeper tabs */}
              <div style={S.quickLinks} className="db-card">
                <div style={S.sectionHead}>
                  <Sparkles size={14} color="var(--text-secondary)" />
                  <span style={S.sectionTitle}>Jump to</span>
                </div>
                <div style={S.quickLinkRow}>
                  <button onClick={() => setTab('analytics')} style={S.quickLinkBtn}>
                    <BarChart2 size={14} color="#0891b2" />
                    Full analytics
                  </button>
                  <button onClick={() => setTab('posts')} style={S.quickLinkBtn}>
                    <FileText size={14} color="#8b5cf6" />
                    All posts
                  </button>
                  <button onClick={() => setTab('calendar')} style={S.quickLinkBtn}>
                    <Clock size={14} color="#2563eb" />
                    Calendar
                  </button>
                  <button onClick={() => setTab('roi')} style={S.quickLinkBtn}>
                    <TrendingUp size={14} color="#22c55e" />
                    ROI
                  </button>
                </div>
              </div>
            </div>

            <div style={S.secondaryColumn}>
              <UpcomingPostsWidget clientId={clientId} />

              {byPlatform.length > 0 && platform === 'all' && (
                <div style={S.platformCards} className="db-card">
                  <div style={S.sectionHead} className="client-section-heading">
                    <Activity size={14} color="var(--text-secondary)" />
                    <span style={S.sectionTitle}>Platforms</span>
                  </div>
                  {byPlatform.map(pl => (
                    <div key={pl.platform} style={S.platformRow}>
                      <SocialPlatformIcon platform={pl.platform} size={18} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {platformMeta(pl.platform).label}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                          {fmt(pl.impressions)} impr · {fmt(pl.reach)} reach
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right' }}>
                        <div>{fmt(pl.likes)} likes</div>
                        <div>{fmt(pl.followers)} new</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function AnalyticsTab(p) {
  const {
    clientId, range, setRange, platform, setPlatform,
    timeseries, tsLoading, posts, lookups,
    totals, byPlatform,
    connectedPlatforms, connectedCount, hasAnalytics,
    platformMeta,
  } = p;

  return (
    <>
      <ControlBar
        range={range}
        setRange={setRange}
        platform={platform}
        setPlatform={setPlatform}
        connectedPlatforms={connectedPlatforms}
        platforms={lookups.platforms || []}
        postCount={posts.length}
        connectedCount={connectedCount}
        hasAnalytics={hasAnalytics}
      />

      {/* KPI cards */}
      <section id="kpis" style={S.cards} className="db-card client-kpi-grid">
        <KPICards platform={platform} totals={totals} />
      </section>

      {/* Charts */}
      <section id="charts">
        {tsLoading ? (
          <div style={S.loadingBox}>
            <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', color: '#00d7ff' }} />
            <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Loading charts…</span>
          </div>
        ) : hasAnalytics ? (
          <div id="charts-area" style={S.chartsGrid} className="db-card client-charts-grid">
            <ImpressionsChart    data={timeseries} platform={platform} />
            <EngagementChart     data={timeseries} platform={platform} />
            <VideoViewsChart     data={timeseries} platform={platform} />
            {platform === 'all' && byPlatform.length > 1 && (
              <PlatformCompareChart byPlatform={byPlatform} />
            )}
          </div>
        ) : (
          <div style={S.emptyBox} className="db-card">
            <BarChart2 size={36} style={{ color: 'var(--text-quaternary)', marginBottom: 10 }} />
            <p style={{ margin: 0, color: 'var(--text-tertiary)', fontWeight: 600 }}>No data yet</p>
            <p style={{ margin: '6px 0 0', color: 'var(--text-quaternary)', fontSize: 13 }}>Connect your accounts and click Sync Now to pull in data.</p>
          </div>
        )}
      </section>

      {/* GMB block */}
      {connectedPlatforms.includes('google_my_business') && (
        <GMBWidget clientId={clientId} />
      )}

      {/* Platform breakdown table */}
      {byPlatform.length > 0 && platform === 'all' && (
        <section id="breakdown" style={S.tableWrap} className="db-card">
          <div style={S.sectionHead2} className="client-section-heading">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={16} color="var(--text-secondary)" />
              <span style={S.sectionTitle2}>Platform Breakdown</span>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead>
                <tr>
                  {['Platform','Reach','Impressions','Likes','Comments','Shares','Video Views','Followers'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byPlatform.map(pl => (
                  <tr key={pl.platform} style={S.tr} className="db-row">
                    <td style={S.td}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 600 }}>
                        <SocialPlatformIcon platform={pl.platform} size={16} />
                        {platformMeta(pl.platform).label}
                      </span>
                    </td>
                    <td style={S.td}><span style={S.num}>{fmt(pl.reach)}</span></td>
                    <td style={S.td}><span style={S.num}>{fmt(pl.impressions)}</span></td>
                    <td style={{ ...S.td, color: '#ef4444' }}>{fmt(pl.likes)}</td>
                    <td style={S.td}>{fmt(pl.comments)}</td>
                    <td style={S.td}>{fmt(pl.shares)}</td>
                    <td style={S.td}>{fmt(pl.video_views)}</td>
                    <td style={{ ...S.td, color: '#8b5cf6' }}>{fmt(pl.followers)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

function PostsTab(p) {
  const {
    clientId, range, setRange, platform, setPlatform,
    posts, lookups,
    connectedPlatforms, connectedCount, hasAnalytics, hasPosts,
    handleSync, syncing,
  } = p;

  return (
    <>
      <ControlBar
        range={range}
        setRange={setRange}
        platform={platform}
        setPlatform={setPlatform}
        connectedPlatforms={connectedPlatforms}
        platforms={lookups.platforms || []}
        postCount={posts.length}
        connectedCount={connectedCount}
        hasAnalytics={hasAnalytics}
      />

      <BestPostWidget clientId={clientId} />

      {!hasPosts ? (
        <EmptyState
          icon={<Inbox size={32} color="var(--text-tertiary)" />}
          title="No posts in this range"
          body="Try widening the date range, or run a sync to pull the latest posts from your connected accounts."
          actionLabel={syncing ? 'Syncing…' : 'Sync Now'}
          onAction={syncing ? undefined : handleSync}
          compact
        />
      ) : (
        <div style={S.postsSection} className="db-card">
          <div style={S.sectionHead2} className="client-section-heading">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart2 size={16} color="var(--text-secondary)" />
              <span style={S.sectionTitle2}>All Posts</span>
              <span style={S.countBadge}>{posts.length}</span>
            </div>
          </div>
          <div style={S.postsGrid}>
            {posts.map(post => <PostCard key={post.id} post={post} />)}
          </div>
        </div>
      )}
    </>
  );
}

// ── Reusable building blocks ──────────────────────────────────────────────────

function ControlBar({ range, setRange, platform, setPlatform, connectedPlatforms, platforms, postCount, connectedCount, hasAnalytics }) {
  return (
    <div style={S.controlBar} className="db-card client-control-bar">
      <div style={S.controlTop}>
        <DateRangePicker range={range} onChange={setRange} />
        <div style={S.quickStats}>
          <QuickStat icon={<Activity size={14} color="#00d7ff" />} num={connectedCount} label="Connected" />
          <div style={S.qDivider} />
          <QuickStat icon={<BarChart2 size={14} color="#8b5cf6" />} num={postCount} label="Posts" />
          <div style={S.qDivider} />
          <QuickStat
            icon={<Zap size={14} color={hasAnalytics ? '#22c55e' : '#f59e0b'} />}
            num={<span style={{ fontSize: 12, color: hasAnalytics ? '#22c55e' : '#f59e0b', fontWeight: 700 }}>{hasAnalytics ? 'Live' : 'Waiting'}</span>}
            label="Data"
          />
        </div>
      </div>
      <PlatformTabs
        selected={platform}
        onChange={setPlatform}
        connected={connectedPlatforms}
        platforms={platforms}
      />
    </div>
  );
}

function KPICards({ platform, totals }) {
  if (platform === 'youtube') return (
    <>
      <StatCard label="Video Views"      value={totals.total_video_views}                                                      icon={Play}          color="#ff0000" />
      <StatCard label="Watch Time (min)" value={totals.total_watch_time_minutes}                                                icon={Clock}         color="#f59e0b" />
      <StatCard label="Avg View (sec)"   value={totals.avg_view_duration != null ? Math.round(totals.avg_view_duration) : null} icon={Timer}         color="#8b5cf6" />
      <StatCard label="Likes"            value={totals.total_likes}                                                             icon={Heart}         color="#ef4444" />
      <StatCard label="Comments"         value={totals.total_comments}                                                          icon={MessageCircle} color="#22c55e" />
      <StatCard label="Shares"           value={totals.total_shares}                                                            icon={Share2}        color="#0891b2" />
      <StatCard label="Subscribers"      value={totals.total_followers}                                                         icon={UserPlus}      color="#8b5cf6" />
      <StatCard label="Unsubs"           value={totals.total_subscribers_lost}                                                  icon={TrendingDown}  color="var(--text-tertiary)" />
    </>
  );
  if (platform === 'facebook') return (
    <>
      <StatCard label="Reach"          value={totals.total_reach}             icon={Radio}         color="#1877f2" />
      <StatCard label="Engagements"    value={totals.total_likes}             icon={Heart}         color="#ef4444" />
      <StatCard label="Page Views"     value={totals.total_profile_views}     icon={MousePointer2} color="#00d7ff" />
      <StatCard label="Followers"      value={totals.total_followers}         icon={UserPlus}      color="#8b5cf6" />
      <StatCard label="Unfollows"      value={totals.total_followers_lost}    icon={TrendingDown}  color="var(--text-tertiary)" />
      <StatCard label="Video Views"    value={totals.total_fb_video_views}    icon={Video}         color="#f59e0b" />
      <StatCard label="Comments"       value={totals.total_comments}          icon={MessageCircle} color="#22c55e" />
      <StatCard label="Shares"         value={totals.total_shares}            icon={Share2}        color="#0891b2" />
    </>
  );
  if (platform === 'instagram') return (
    <>
      <StatCard label="Reach"            value={totals.total_reach}               icon={Radio}         color="#e1306c" />
      <StatCard label="Interactions"     value={totals.total_total_interactions}  icon={Heart}         color="#ef4444" />
      <StatCard label="Accounts Engaged" value={totals.total_accounts_engaged}    icon={UserPlus}      color="#8b5cf6" />
      <StatCard label="Profile Views"    value={totals.total_profile_views}       icon={MousePointer2} color="#00d7ff" />
      <StatCard label="Website Clicks"   value={totals.total_website_clicks}      icon={Globe}         color="#0891b2" />
      <StatCard label="Saves"            value={totals.total_saves}               icon={Bookmark}      color="#7c3aed" />
      <StatCard label="Comments"         value={totals.total_comments}            icon={MessageCircle} color="#22c55e" />
      <StatCard label="Shares"           value={totals.total_shares}              icon={Share2}        color="#f59e0b" />
      <StatCard label="Email Clicks"     value={totals.total_email_contacts}      icon={Mail}          color="#f59e0b" />
      <StatCard label="Phone Clicks"     value={totals.total_phone_call_clicks}   icon={Phone}         color="#059669" />
      <StatCard label="Direction Clicks" value={totals.total_direction_clicks}    icon={Navigation}    color="#6366f1" />
      <StatCard label="Unfollows"        value={totals.total_ig_followers_lost}   icon={TrendingDown}  color="var(--text-tertiary)" />
    </>
  );
  if (platform === 'google_my_business') return (
    <>
      <StatCard label="Search Impressions" value={totals.total_search_impressions}  icon={Eye}        color="#4285f4" />
      <StatCard label="Maps Impressions"   value={totals.total_maps_impressions}    icon={MapPin}     color="#ea4335" />
      <StatCard label="Website Clicks"     value={totals.total_website_clicks}      icon={Globe}      color="#0891b2" />
      <StatCard label="Direction Requests" value={totals.total_direction_requests}  icon={Navigation} color="#34a853" />
      <StatCard label="Phone Calls"        value={totals.total_phone_calls}         icon={Phone}      color="#059669" />
      <StatCard label="Photo Views"        value={totals.total_photo_views}         icon={Eye}        color="#8b5cf6" />
    </>
  );
  return (
    <>
      <StatCard label="Impressions"    value={totals.total_impressions}    icon={Eye}           color="#00d7ff" />
      <StatCard label="Reach"          value={totals.total_reach}          icon={Radio}         color="#22c55e" />
      <StatCard label="Clicks"         value={totals.total_clicks}         icon={MousePointer2} color="#00d7ff" />
      <StatCard label="Likes"          value={totals.total_likes}          icon={Heart}         color="#ef4444" />
      <StatCard label="Comments"       value={totals.total_comments}       icon={MessageCircle} color="#22c55e" />
      <StatCard label="Shares"         value={totals.total_shares}         icon={Share2}        color="#f59e0b" />
      <StatCard label="Video Views"    value={totals.total_video_views}    icon={Play}          color="#f59e0b" />
      <StatCard label="Followers"      value={totals.total_followers}      icon={UserPlus}      color="#8b5cf6" />
      <StatCard label="Website Clicks" value={totals.total_website_clicks} icon={Globe}         color="#0891b2" />
      <StatCard label="Phone Calls"    value={totals.total_phone_calls}    icon={Phone}         color="#059669" />
    </>
  );
}

function EmptyState({ icon, title, body, actionLabel, actionHref, onAction, compact = false }) {
  return (
    <div style={{ ...S.emptyBox, ...(compact ? S.emptyBoxCompact : null) }} className="db-card">
      <div style={{ marginBottom: 10 }}>{icon}</div>
      <p style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 700, fontSize: 14 }}>{title}</p>
      <p style={{ margin: '6px 0 14px', color: 'var(--text-secondary)', fontSize: 13, maxWidth: 420 }}>{body}</p>
      {actionLabel && actionHref && (
        <NavLink to={actionHref} style={S.emptyActionBtn}>{actionLabel}</NavLink>
      )}
      {actionLabel && onAction && (
        <button onClick={onAction} style={S.emptyActionBtn}>{actionLabel}</button>
      )}
    </div>
  );
}

// ── Sub-components (preserved from prior version) ─────────────────────────────

function QuickStat({ icon, num, label }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 52 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 2 }}>
        {icon}
        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{num}</span>
      </div>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
    </div>
  );
}

function HighlightTile({ icon, label, value, bg, border }) {
  return (
    <div style={{
      flex: '1 1 160px', padding: '14px 18px', borderRadius: 14,
      background: bg, border: `1.5px solid ${border}`,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: 'var(--surface-card)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,.08)',
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>{value}</div>
      </div>
    </div>
  );
}

function PostCard({ post }) {
  const platform = PLATFORMS[post.platform] || { color: 'var(--text-secondary)', label: post.platform };
  const thumb    = post.thumbnail_url;
  const caption  = post.caption || post.post_type || 'Post';
  const date     = post.published_at ? format(parseISO(post.published_at), 'MMM d') : '';

  return (
    <a href={post.post_url || '#'} target="_blank" rel="noreferrer" style={S.postCard}>
      <div style={{ ...S.postThumb, background: `${platform.color}12` }} className="db-post-thumb">
        {thumb
          ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none'; }} />
          : <Play size={22} color={platform.color} opacity={0.5} />}
      </div>

      <div style={S.postMeta}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ ...S.platChip, background: `${platform.color}15`, color: platform.color }}>
            <SocialPlatformIcon platform={post.platform} size={11} />
            {platform.label}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{date}</span>
        </div>
        <p style={S.postCaption}>{caption.slice(0, 80)}{caption.length > 80 ? '…' : ''}</p>
        <div style={S.postStats}>
          <span style={S.postStat}><Heart size={11} color="#ef4444" /> {fmt(post.likes)}</span>
          <span style={S.postStat}><MessageCircle size={11} color="#0891b2" /> {fmt(post.comments)}</span>
          <span style={S.postStat}><Eye size={11} color="var(--text-secondary)" /> {fmt(post.impressions || post.reach)}</span>
          {post.saves > 0 && <span style={S.postStat}><Bookmark size={11} color="#8b5cf6" /> {fmt(post.saves)}</span>}
          {post.shares > 0 && <span style={S.postStat}><Share2 size={11} color="#f59e0b" /> {fmt(post.shares)}</span>}
        </div>
      </div>
    </a>
  );
}

function ClientProfileStrip({ client }) {
  const [expanded, setExpanded] = useState(false);
  const initials = (client.company || 'C').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const TONE_COLORS = {
    professional: '#0891b2', casual: '#f59e0b', funny: '#f97316',
    inspirational: '#8b5cf6', urgent: '#ef4444', friendly: '#22c55e',
  };

  const hasBrandInfo = !!(client.brand_description || client.usp || client.target_audience || client.target_locations?.length > 0);
  const hasAnyInfo   = !!(client.business_category || client.business_location || client.brand_tone ||
    client.email || client.phone || client.website || client.whatsapp_number || hasBrandInfo);

  if (!hasAnyInfo) return null;

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={S.profileStrip}>
        {client.logo
          ? <img src={client.logo} alt={client.company} style={S.avatarImg} />
          : <div style={S.avatarDiv}>{initials}</div>}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 }}>
          {client.business_category && <Chip icon="🏢" label={client.business_category} color="#0891b2" />}
          {client.business_location  && <Chip icon="📍" label={client.business_location}  color="#16a34a" />}
          {client.brand_tone && (
            <Chip icon="🎨" label={client.brand_tone.charAt(0).toUpperCase() + client.brand_tone.slice(1)}
              color={TONE_COLORS[client.brand_tone] || '#f59e0b'} />
          )}
          {(client.target_locations || []).slice(0, 2).map(loc => (
            <Chip key={loc} icon="🌍" label={loc} color="#d97706" />
          ))}

          {(client.email || client.phone || client.website) && (
            <span style={{ width: 1, height: 16, background: 'var(--border-default)' }} />
          )}
          {client.email     && <a href={`mailto:${client.email}`}    style={S.contactLink}><Mail size={12}/> {client.email}</a>}
          {client.phone     && <a href={`tel:${client.phone}`}       style={S.contactLink}><Phone size={12}/> {client.phone}</a>}
          {client.website   && <a href={client.website} target="_blank" rel="noreferrer" style={S.contactLink}><Globe size={12}/> {client.website.replace(/^https?:\/\//,'').replace(/\/$/,'')}</a>}
          {client.gmb_url   && <a href={client.gmb_url} target="_blank" rel="noreferrer" style={S.contactLink}><Star size={12}/> Google Business</a>}
        </div>

        {hasBrandInfo && (
          <button onClick={() => setExpanded(e => !e)} style={S.expandBtn}>
            {expanded ? 'Hide ▲' : 'Brand Profile ▼'}
          </button>
        )}
      </div>

      {hasBrandInfo && expanded && (
        <div style={S.brandGrid}>
          {client.brand_description && <BrandBox label="About"           text={client.brand_description} />}
          {client.usp               && <BrandBox label="USP"             text={client.usp} />}
          {client.target_audience   && <BrandBox label="Target Audience" text={client.target_audience} />}
          {(client.business_subcategories || []).length > 0 && (
            <div style={S.brandBox}>
              <span style={S.brandLabel}>Subcategories</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
                {client.business_subcategories.map(s => <Chip key={s} label={s} color="var(--text-secondary)" />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Chip({ icon, label, color }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: `${color}15`, border: `1px solid ${color}30`, color,
    }}>
      {icon && <span>{icon}</span>}{label}
    </span>
  );
}

function BrandBox({ label, text }) {
  return (
    <div style={S.brandBox}>
      <span style={S.brandLabel}>{label}</span>
      <p style={S.brandText}>{text}</p>
    </div>
  );
}

function UpcomingPostsWidget({ clientId }) {
  const { upcoming, loading } = useUpcomingPosts(clientId);
  if (loading || !upcoming.length) return null;

  return (
    <div style={S.upcomingWrap}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={14} color="#2563eb" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>Upcoming Posts</span>
          <span style={{ ...S.countBadge, background: '#eff6ff', color: '#2563eb' }}>{upcoming.length}</span>
        </div>
        <NavLink to="/dashboard/calendar" style={{ fontSize: 11, color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
          View all →
        </NavLink>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {upcoming.slice(0, 4).map(post => {
          const p = PLATS[post.platform] || { color: 'var(--text-secondary)', label: post.platform };
          const timeStr = post.scheduled_at ? format(parseISO(post.scheduled_at), 'MMM d · h:mm a') : '';
          return (
            <div key={post.id} style={{ ...S.upcomingRow, borderLeft: `3px solid ${p.color}` }}>
              <SocialPlatformIcon platform={post.platform} size={16} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {post.caption || post.title || '(no caption)'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{timeStr}</div>
              </div>
              <CheckCircle2 size={14} color="#22c55e" style={{ flexShrink: 0 }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  headerActions: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  btnInner: { display: 'flex', alignItems: 'center', gap: 6 },
  syncBtn: {
    padding: '9px 16px', borderRadius: 12, border: '1.5px solid var(--border-default)',
    background: 'var(--surface-card)', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)',
    WebkitTapHighlightColor: 'transparent',
  },
  shareBtn: {
    padding: '9px 16px', borderRadius: 12, border: 'none',
    background: 'linear-gradient(135deg,#00d7ff,#0099bb)', color: '#fff',
    cursor: 'pointer', fontWeight: 700, fontSize: 13,
    WebkitTapHighlightColor: 'transparent',
  },
  pdfBtn: {
    padding: '9px 16px', borderRadius: 12, border: 'none',
    background: 'var(--text-primary)', color: 'var(--surface-card)', cursor: 'pointer', fontWeight: 700, fontSize: 13,
    WebkitTapHighlightColor: 'transparent',
  },

  // Greeting
  greetWrap: { padding: '20px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  greetTitle: { fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' },
  greetSub:   { fontSize: 14, color: 'var(--text-secondary)', marginTop: 2 },

  // Profile strip
  profileStrip: {
    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    background: 'var(--surface-card)', border: '1px solid #e8edf2', borderRadius: 14,
    padding: '12px 16px', marginBottom: 4,
  },
  avatarImg: { width: 38, height: 38, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--border-default)', flexShrink: 0 },
  avatarDiv: {
    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
    background: 'linear-gradient(135deg,#00d7ff,#0099bb)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 800, color: 'var(--text-primary)',
  },
  contactLink: { display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)', fontSize: 12, textDecoration: 'none' },
  expandBtn: {
    marginLeft: 'auto', background: 'none', border: '1px solid var(--border-default)',
    borderRadius: 8, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 11,
    fontWeight: 600, padding: '4px 10px', whiteSpace: 'nowrap',
  },
  brandGrid: {
    background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 14,
    padding: '16px 20px', display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12,
  },
  brandBox: { background: 'var(--surface-sunken)', borderRadius: 10, padding: '10px 14px', border: '1px solid var(--border-default)' },
  brandLabel: { display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 5 },
  brandText: { margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 },

  // Control bar
  controlBar: {
    background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)',
    padding: '16px 18px', marginBottom: 16,
    boxShadow: 'var(--shadow-sm)',
  },
  controlTop: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: 16, marginBottom: 14, flexWrap: 'wrap',
  },
  quickStats: { display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 },
  qDivider: { width: 1, height: 28, background: 'var(--border-default)' },

  // Highlight strip
  highlightStrip: { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 },

  // Layout
  analyticsLayout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.9fr) minmax(300px, 1fr)',
    gap: 18, alignItems: 'start', marginBottom: 16,
  },
  primaryColumn: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 },
  secondaryColumn: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16, alignSelf: 'start' },

  // Quick links into other tabs (Overview only)
  quickLinks: {
    background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)',
    padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10,
  },
  quickLinkRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  quickLinkBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 12px', borderRadius: 10,
    border: '1px solid var(--border-default)', background: 'var(--surface-sunken)',
    color: 'var(--text-primary)', fontSize: 12, fontWeight: 600,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },

  // KPI cards
  cards: {
    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 12, marginBottom: 18,
    padding: '0 16px',
  },

  // Charts
  chartsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 14, marginBottom: 16,
  },
  loadingBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
    padding: 60, background: 'var(--surface-sunken)', borderRadius: 14,
  },
  emptyBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 60,
    background: 'var(--surface-sunken)', borderRadius: 14, textAlign: 'center',
    marginBottom: 16,
  },
  emptyBoxCompact: { padding: '36px 20px' },
  emptyActionBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '10px 18px', borderRadius: 12, border: 'none',
    background: '#00d7ff', color: '#021418',
    fontWeight: 700, fontSize: 13, textDecoration: 'none', cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,215,255,0.25)',
    WebkitTapHighlightColor: 'transparent',
  },

  // Platform mini cards (secondary col)
  platformCards: {
    background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 14,
    padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10,
  },
  platformRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 10px', borderRadius: 10, background: 'var(--surface-sunken)',
  },
  sectionHead: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionTitle: { fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.06em' },

  // Feature stack
  featureStack: { display: 'flex', flexDirection: 'column', gap: 16 },

  // Posts grid
  postsSection: {
    background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 16,
    padding: '20px 20px 24px', marginBottom: 18,
  },
  sectionHead2: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  sectionTitle2: { fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' },
  countBadge: {
    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
    background: 'var(--surface-sunken)', color: 'var(--text-secondary)',
  },
  postsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14,
  },
  postCard: {
    background: 'var(--surface-card)', borderRadius: 12, border: '1px solid #e8edf2',
    overflow: 'hidden', textDecoration: 'none', display: 'block',
    transition: 'box-shadow .2s', boxShadow: '0 1px 4px rgba(0,0,0,.05)',
  },
  postThumb: {
    height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', position: 'relative',
  },
  postMeta: { padding: '10px 12px 12px' },
  platChip: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
  },
  postCaption: {
    margin: '0 0 8px', fontSize: 11, color: 'var(--text-secondary)',
    lineHeight: 1.5, minHeight: 32,
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
  },
  postStats: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  postStat: { display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 },
  num: { fontWeight: 700, color: 'var(--text-primary)' },

  // Upcoming posts
  upcomingWrap: {
    background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 14, padding: '16px 18px',
  },
  upcomingRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 12px', borderRadius: 8, background: 'var(--surface-sunken)',
  },

  // Table
  tableWrap: {
    background: 'var(--surface-card)', borderRadius: 16, padding: '20px 20px 24px',
    border: '1px solid var(--border-default)', marginBottom: 18,
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left', padding: '10px 14px',
    background: 'var(--surface-sunken)', color: 'var(--text-secondary)',
    fontWeight: 600, fontSize: 11, textTransform: 'uppercase',
    letterSpacing: '.05em', borderBottom: '1px solid var(--surface-sunken)',
  },
  tr: { borderBottom: '1px solid var(--surface-sunken)' },
  td: { padding: '12px 14px', color: 'var(--text-secondary)', verticalAlign: 'middle' },
};
