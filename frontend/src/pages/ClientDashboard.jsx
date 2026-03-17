import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useClientSummary, useTimeseries, usePosts, useDateRange, useOAuthStatus } from '../hooks/useData';
import { PLATFORMS, fmt } from '../services/platforms';
import { exportPDF } from '../services/exportPDF';
import StatCard from '../components/ui/StatCard';
import PlatformTabs from '../components/ui/PlatformTabs';
import DateRangePicker from '../components/ui/DateRangePicker';
import { ImpressionsChart, EngagementChart, VideoViewsChart, PlatformCompareChart } from '../components/charts/Charts';
import { clientsAPI } from '../services/api';
import { Eye, Radio, MousePointer2, Heart, Play, UserPlus, Globe, Phone, RefreshCw, Loader2, FileText, Share2 } from 'lucide-react';
import GoalTracker from '../components/ui/GoalTracker';
import AlertBell from '../components/ui/AlertBell';
import AIInsightCard from '../components/ui/AIInsightCard';
import BestPostWidget from '../components/ui/BestPostWidget';
import ShareReportModal from '../components/ui/ShareReportModal';
import OnboardingChecklist from '../components/ui/OnboardingChecklist';
import ROICalculatorPage from './ROICalculatorPage';
import CalendarPage from './CalendarPage';
import { useUpcomingPosts } from '../hooks/useCalendar';
import { NavLink } from 'react-router-dom';
import { PLATFORMS as PLATS } from '../services/platforms';
import { format, parseISO } from 'date-fns';

export default function ClientDashboard({ clientId: propClientId }) {
  const { user }                   = useAuth();
  const clientId                   = propClientId || user?.client_id;
  const [range, setRange]          = useDateRange(30);
  const [platform, setPlatform]    = useState('all');
  const [syncing, setSyncing]      = useState(false);
  const [shareOpen, setShareOpen]  = useState(false);
  const [activeView, setActiveView] = useState('analytics');

  const { data: summary, loading: sumLoading, refetch: refetchSummary } = useClientSummary(clientId, range, platform);
  const { data: timeseries, loading: tsLoading }                        = useTimeseries(clientId, range, platform);
  const { posts }                                                        = usePosts(clientId, platform, range);
  const { status: oauthStatus }                                          = useOAuthStatus(clientId);

  const totals     = summary?.totals      || {};
  const byPlatform = summary?.by_platform || [];
  const client     = summary?.client      || {};

  const connectedPlatforms = Object.entries(oauthStatus)
    .filter(([, v]) => v.status === 'active')
    .map(([k]) => k);
  const hasAnalytics = timeseries.length > 0 || byPlatform.length > 0;
  const hasPosts = posts.length > 0;
  const connectedCount = connectedPlatforms.length;

  const handleSync = async () => {
    setSyncing(true);
    try {
      await clientsAPI.triggerSync(clientId, connectedPlatforms);
      setTimeout(() => { refetchSummary(); setSyncing(false); }, 3000);
    } catch { setSyncing(false); }
  };

  const handleExportPDF = () => {
    exportPDF({
      client,
      summary,
      dateRange: range,
      chartsElementId: 'charts-area',
      posts,
      timeseries,
      connectedPlatforms,
    });
  };

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>{client.company || 'Dashboard'}</h1>
          <p style={styles.subtitle}>Social Media Analytics</p>
        </div>
        <div style={styles.headerActions}>
          <AlertBell clientId={clientId} />
          <button onClick={handleSync} disabled={syncing} style={styles.syncBtn}>
            <span style={styles.btnInner}>
              {syncing
                ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Syncing…</>
                : <><RefreshCw size={16} /> Sync Now</>
              }
            </span>
          </button>
          <button onClick={() => setShareOpen(true)} style={styles.shareBtn}>
            <span style={styles.btnInner}><Share2 size={16} /> Share Report</span>
          </button>
          <button onClick={handleExportPDF} style={styles.pdfBtn}>
            <span style={styles.btnInner}><FileText size={16} /> Export PDF</span>
          </button>
        </div>
      </div>

      {shareOpen && (
        <ShareReportModal clientId={clientId} onClose={() => setShareOpen(false)} />
      )}

      {/* View Toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[
          { key: 'analytics', label: '📊 Analytics' },
          { key: 'roi',       label: '📈 ROI Calculator' },
          { key: 'content',   label: '📝 Content Calculator' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveView(tab.key)}
            style={{
              padding: '8px 20px', borderRadius: 20, fontSize: 13, fontWeight: 600,
              border: '1.5px solid',
              borderColor: activeView === tab.key ? '#2563EB' : '#E2E8F0',
              background:  activeView === tab.key ? '#2563EB' : '#fff',
              color:       activeView === tab.key ? '#fff' : '#64748B',
              cursor: 'pointer', transition: 'all .15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeView === 'roi' && <ROICalculatorPage clientId={clientId} />}

      {activeView === 'content' && <CalendarPage clientId={clientId} />}

      {activeView === 'analytics' && (
        <>
          <div style={styles.analyticsLayout}>
            <div style={styles.primaryColumn}>
              {/* KPI Cards */}
              <div style={styles.cards}>
                <StatCard label="Impressions"    value={totals.total_impressions}    icon={Eye}           color="#6366f1" />
                <StatCard label="Reach"          value={totals.total_reach}          icon={Radio}         color="#22c55e" />
                <StatCard label="Clicks"         value={totals.total_clicks}         icon={MousePointer2} color="#2563eb" />
                <StatCard label="Likes"          value={totals.total_likes}          icon={Heart}         color="#ef4444" />
                <StatCard label="Video Views"    value={totals.total_video_views}    icon={Play}          color="#f59e0b" />
                <StatCard label="Followers"      value={totals.total_followers}      icon={UserPlus}      color="#8b5cf6" />
                <StatCard label="Website Clicks" value={totals.total_website_clicks} icon={Globe}         color="#0891b2" />
                <StatCard label="Phone Calls"    value={totals.total_phone_calls}    icon={Phone}         color="#059669" />
              </div>

              {/* Charts */}
              {tsLoading ? (
                <div style={styles.loading}>Loading charts…</div>
              ) : hasAnalytics ? (
                <div id="charts-area" style={styles.chartsGrid}>
                  <ImpressionsChart    data={timeseries} platform={platform} />
                  <EngagementChart     data={timeseries} platform={platform} />
                  <VideoViewsChart     data={timeseries} platform={platform} />
                  {platform === 'all' && byPlatform.length > 1 && (
                    <PlatformCompareChart byPlatform={byPlatform} />
                  )}
                </div>
              ) : !hasPosts ? (
                <div style={styles.empty}>
                  No data yet. Connect your accounts and click Sync Now.
                </div>
              ) : null}

              {/* Goal Tracker */}
            </div>

            <div style={styles.secondaryColumn}>
              <OnboardingChecklist clientId={clientId} />
              <UpcomingPostsWidget clientId={clientId} />
            </div>
          </div>

          <div style={styles.featureStack}>
            <div style={styles.featureItem}>
              <GoalTracker
                clientId={clientId}
                month={new Date().getMonth() + 1}
                year={new Date().getFullYear()}
              />
            </div>

            <div style={styles.featureItem}>
              <AIInsightCard
                clientId={clientId}
                month={new Date().getMonth() + 1}
                year={new Date().getFullYear()}
                canGenerate={user?.role === 'superadmin' || user?.role === 'staff'}
              />
            </div>
            <div style={styles.featureItem}>
              <BestPostWidget clientId={clientId} />
            </div>
          </div>

          <div style={styles.reportingSection}>
            <div style={styles.filterPanel}>
              <div style={styles.topBar}>
                <div style={styles.controls}>
                  <DateRangePicker range={range} onChange={setRange} />
                </div>
               
              </div>

              <PlatformTabs
                selected={platform}
                onChange={setPlatform}
                connected={connectedPlatforms}
              />

              <div style={styles.summaryStrip}>
                <div style={styles.summaryCard}>
                  <span style={styles.summaryLabel}>Connected Platforms</span>
                  <strong style={styles.summaryValue}>{connectedCount}</strong>
                </div>
                <div style={styles.summaryCard}>
                  <span style={styles.summaryLabel}>Total Posts</span>
                  <strong style={styles.summaryValue}>{posts.length}</strong>
                </div>
                <div style={styles.summaryCard}>
                  <span style={styles.summaryLabel}>Platform View</span>
                  <strong style={styles.summaryValue}>
                    {platform === 'all' ? 'All Platforms' : (PLATFORMS[platform]?.label || platform)}
                  </strong>
                </div>
                <div style={styles.summaryCard}>
                  <span style={styles.summaryLabel}>Data Status</span>
                  <strong style={styles.summaryValue}>{hasAnalytics ? 'Active' : 'Waiting'}</strong>
                </div>
              </div>
            </div>

            {byPlatform.length > 0 && platform === 'all' && (
              <div style={styles.tableWrap}>
                <h3 style={styles.tableTitle}>Platform Breakdown</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        {['Platform','Impressions','Reach','Clicks','Likes','Video Views','Followers'].map(h => (
                          <th key={h} style={styles.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {byPlatform.map(p => (
                        <tr key={p.platform} style={styles.tr}>
                          <td style={styles.td}>
                            <span style={{ color: PLATFORMS[p.platform]?.color }}>
                              {PLATFORMS[p.platform]?.icon} {PLATFORMS[p.platform]?.label || p.platform}
                            </span>
                          </td>
                          <td style={styles.td}>{fmt(p.impressions)}</td>
                          <td style={styles.td}>{fmt(p.reach)}</td>
                          <td style={styles.td}>{fmt(p.clicks)}</td>
                          <td style={styles.td}>{fmt(p.likes)}</td>
                          <td style={styles.td}>{fmt(p.video_views)}</td>
                          <td style={styles.td}>{fmt(p.followers)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {hasPosts && (
              <div style={styles.tableWrap}>
                <h3 style={styles.tableTitle}>Recent Posts</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        {['Post','Platform','Account','Date','Impressions','Reach','Likes','Comments'].map(h => (
                          <th key={h} style={styles.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {posts.map(p => (
                        <tr key={p.id} style={styles.tr}>
                          <td style={{ ...styles.td, maxWidth: 220 }}>
                            <a href={p.post_url} target="_blank" rel="noreferrer" style={styles.postLink}>
                              {p.caption?.slice(0, 60) || p.post_type || '—'}…
                            </a>
                          </td>
                          <td style={styles.td}>
                            {PLATFORMS[p.platform]?.icon} {PLATFORMS[p.platform]?.label}
                          </td>
                          <td style={{ ...styles.td, color: '#6366f1', fontWeight: 500 }}>
                            {p.account_name ? `@${p.account_name}` : '—'}
                          </td>
                          <td style={styles.td}>
                            {p.published_at ? new Date(p.published_at).toLocaleDateString() : '—'}
                          </td>
                          <td style={styles.td}>{fmt(p.impressions)}</td>
                          <td style={styles.td}>{fmt(p.reach)}</td>
                          <td style={styles.td}>{fmt(p.likes)}</td>
                          <td style={styles.td}>{fmt(p.comments)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function UpcomingPostsWidget({ clientId }) {
  const { upcoming, loading } = useUpcomingPosts(clientId);
  if (loading || !upcoming.length) return null;

  const shown = upcoming.slice(0, 3);
  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0',
      padding: '16px 20px', marginBottom: 20,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
      }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>📅 Upcoming Posts</span>
        <NavLink
          to="/dashboard/calendar"
          style={{ fontSize: 12, color: '#2563EB', fontWeight: 600, textDecoration: 'none' }}
        >
          View Full Calendar →
        </NavLink>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {shown.map(post => {
          const p = PLATS[post.platform] || { color: '#64748B', icon: '🔗', label: post.platform };
          const timeStr = post.scheduled_at
            ? format(parseISO(post.scheduled_at), 'MMM d · h:mm a')
            : '';
          return (
            <div key={post.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 8,
              background: '#F8FAFC', border: `1px solid ${p.color}30`,
            }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{p.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, color: '#374151',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {post.caption || post.title || '(no caption)'}
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#64748B', flexShrink: 0 }}>{timeStr}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  page: { padding: '28px 32px 40px', maxWidth: 1480, margin: '0 auto' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    gap: 20, marginBottom: 24, flexWrap: 'wrap',
  },
  title: { margin: 0, fontSize: 26, fontWeight: 800, color: '#0f172a' },
  subtitle: { margin: '4px 0 0', color: '#64748b', fontSize: 14 },
  headerActions: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  filterPanel: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 18,
    padding: '18px 18px 16px',
    marginBottom: 20,
    boxShadow: '0 1px 6px rgba(15,23,42,.05)',
  },
  summaryStrip: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    background: '#f8fafc',
    border: '1px solid #e5e7eb',
    borderRadius: 14,
    padding: '14px 16px',
  },
  summaryLabel: {
    display: 'block',
    marginBottom: 6,
    fontSize: 11,
    fontWeight: 700,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '.08em',
  },
  summaryValue: {
    fontSize: 15,
    color: '#0f172a',
  },
  btnInner: { display: 'flex', alignItems: 'center', gap: 6 },
  syncBtn: {
    padding: '10px 18px', borderRadius: 10, border: '1.5px solid #e5e7eb',
    background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13,
  },
  shareBtn: {
    padding: '10px 18px', borderRadius: 10, border: 'none',
    background: '#6366f1', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13,
  },
  pdfBtn: {
    padding: '10px 18px', borderRadius: 10, border: 'none',
    background: '#0f172a', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13,
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  controls: { flex: '1 1 280px' },
  filterMeta: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
    minWidth: 140,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '.08em',
  },
  filterValue: {
    fontSize: 14,
    fontWeight: 700,
    color: '#0f172a',
  },
  analyticsLayout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.9fr) minmax(320px, 1.1fr)',
    gap: 20,
    alignItems: 'start',
    marginBottom: 18,
  },
  featureStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
    marginBottom: 18,
  },
  featureItem: {
    minWidth: 0,
  },
  primaryColumn: {
    minWidth: 0,
  },
  secondaryColumn: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    alignSelf: 'start',
  },
  reportingSection: {
    marginTop: 4,
  },
  cards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 14, marginBottom: 20,
  },
  chartsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: 16, marginBottom: 18,
  },
  loading: { textAlign: 'center', color: '#94a3b8', padding: 60 },
  empty: {
    textAlign: 'center', color: '#94a3b8', padding: 60,
    background: '#f8fafc', borderRadius: 14,
  },
  tableWrap: {
    background: '#fff', borderRadius: 14, padding: 24,
    boxShadow: '0 1px 6px rgba(0,0,0,.07)', marginBottom: 24,
  },
  tableTitle: { margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#1e293b' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left', padding: '10px 12px',
    background: '#f8fafc', color: '#64748b',
    fontWeight: 600, fontSize: 12, borderBottom: '1px solid #e5e7eb',
  },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '12px 12px', color: '#374151' },
  postLink: { color: '#2563eb', textDecoration: 'none', fontWeight: 500 },
};
