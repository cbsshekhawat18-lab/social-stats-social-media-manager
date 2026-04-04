import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useClientSummary, useTimeseries, usePosts, useDateRange, useOAuthStatus, useLookups } from '../hooks/useData';
import { PLATFORMS, fmt } from '../services/platforms';
import { exportPDF } from '../services/exportPDF';
import StatCard from '../components/ui/StatCard';
import PlatformTabs from '../components/ui/PlatformTabs';
import DateRangePicker from '../components/ui/DateRangePicker';
import { ImpressionsChart, EngagementChart, VideoViewsChart, PlatformCompareChart } from '../components/charts/Charts';
import { clientsAPI } from '../services/api';
import { Eye, Radio, MousePointer2, Heart, Play, UserPlus, Globe, Phone, RefreshCw, Loader2, FileText, Share2, Clock, TrendingDown, Timer, Mail, ThumbsDown, Video, MessageCircle, Navigation } from 'lucide-react';
import GMBWidget from '../components/ui/GMBWidget';
import GoalTracker from '../components/ui/GoalTracker';
import AlertBell from '../components/ui/AlertBell';
import AIInsightCard from '../components/ui/AIInsightCard';
import BestPostWidget from '../components/ui/BestPostWidget';
import ShareReportModal from '../components/ui/ShareReportModal';
import OnboardingChecklist from '../components/ui/OnboardingChecklist';
import ROICalculatorPage from './ROICalculatorPage';
import CalendarPage from './CalendarPage';
import { useUpcomingPosts } from '../hooks/useCalendar';
import PageHeader from '../components/layout/PageHeader';
import SegmentedTabs from '../components/ui/SegmentedTabs';
import { NavLink } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import SocialPlatformIcon from '../components/ui/SocialPlatformIcon';

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
  const { lookups }                                                      = useLookups();

  const platformLabelMap = (lookups.platforms || []).reduce((acc, item) => {
    acc[item.key] = item.label;
    return acc;
  }, {});

  const platformMeta = (key) => ({
    label: platformLabelMap[key] || PLATFORMS[key]?.label || key,
    color: PLATFORMS[key]?.color || '#64748b',
  });

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
    <div className="app-page app-page--content app-page--xl">
      <PageHeader
        title={client.company || 'Dashboard'}
        subtitle="Social Media Analytics"
        actions={(
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
        )}
      />

      {shareOpen && (
        <ShareReportModal clientId={clientId} onClose={() => setShareOpen(false)} />
      )}

      {/* Client Hero Card */}
      {!sumLoading && client.company && (
        <ClientHeroCard client={client} />
      )}

      {/* View Toggle */}
      <SegmentedTabs
        items={[
          { id: 'analytics', label: 'Analytics' },
          { id: 'roi', label: 'ROI Calculator' },
          { id: 'content', label: 'Content Calculator' },
        ]}
        active={activeView}
        onChange={setActiveView}
        compact
        style={{ marginBottom: 20 }}
      />

      {activeView === 'roi' && <ROICalculatorPage clientId={clientId} />}

      {activeView === 'content' && <CalendarPage clientId={clientId} />}

      {activeView === 'analytics' && (
        <>
          {/* Top Control Bar */}
          <div style={styles.controlBar}>
            <div style={styles.controlTop}>
              <DateRangePicker range={range} onChange={setRange} />
              <div style={styles.quickStats}>
                <div style={styles.qStat}>
                  <span style={styles.qStatNum}>{connectedCount}</span>
                  <span style={styles.qStatLabel}>Connected</span>
                </div>
                <div style={styles.qStatDivider} />
                <div style={styles.qStat}>
                  <span style={styles.qStatNum}>{posts.length}</span>
                  <span style={styles.qStatLabel}>Posts</span>
                </div>
                <div style={styles.qStatDivider} />
                <div style={styles.qStat}>
                  <span style={{ ...styles.qStatNum, color: hasAnalytics ? '#22c55e' : '#f59e0b', fontSize: 11 }}>
                    {hasAnalytics ? '● Live' : '● Waiting'}
                  </span>
                  <span style={styles.qStatLabel}>Data</span>
                </div>
              </div>
            </div>
            <PlatformTabs
              selected={platform}
              onChange={setPlatform}
              connected={connectedPlatforms}
              platforms={lookups.platforms || []}
            />
          </div>

          <div style={styles.analyticsLayout}>
            <div style={styles.primaryColumn}>
              {/* KPI Cards */}
              <div style={styles.cards}>
                {platform === 'youtube' ? (
                  <>
                    <StatCard label="Video Views"      value={totals.total_video_views}                                                       icon={Play}         color="#ff0000" />
                    <StatCard label="Watch Time (min)" value={totals.total_watch_time_minutes}                                                 icon={Clock}        color="#f59e0b" />
                    <StatCard label="Avg View (sec)"   value={totals.avg_view_duration != null ? Math.round(totals.avg_view_duration) : null}  icon={Timer}        color="#8b5cf6" />
                    <StatCard label="Likes"            value={totals.total_likes}                                                              icon={Heart}        color="#ef4444" />
                    <StatCard label="Comments"         value={totals.total_comments}                                                           icon={MessageCircle} color="#22c55e" />
                    <StatCard label="Shares"           value={totals.total_shares}                                                             icon={Share2}       color="#0891b2" />
                    <StatCard label="Subscribers"      value={totals.total_followers}                                                          icon={UserPlus}     color="#8b5cf6" />
                    <StatCard label="Unsubs"           value={totals.total_subscribers_lost}                                                   icon={TrendingDown} color="#94a3b8" />
                  </>
                ) : platform === 'facebook' ? (
                  <>
                    <StatCard label="Impressions"     value={totals.total_impressions}          icon={Eye}          color="#1877f2" />
                    <StatCard label="Reach"           value={totals.total_reach}                icon={Radio}        color="#22c55e" />
                    <StatCard label="Engagements"     value={totals.total_likes}                icon={Heart}        color="#ef4444" />
                    <StatCard label="Page Views"      value={totals.total_profile_views}        icon={MousePointer2} color="#00d7ff" />
                    <StatCard label="Followers"       value={totals.total_followers}            icon={UserPlus}     color="#8b5cf6" />
                    <StatCard label="Unfollows"       value={totals.total_followers_lost}       icon={TrendingDown} color="#94a3b8" />
                    <StatCard label="Video Views"     value={totals.total_fb_video_views}       icon={Video}        color="#f59e0b" />
                    <StatCard label="Neg. Feedback"   value={totals.total_negative_feedback}    icon={ThumbsDown}   color="#dc2626" />
                  </>
                ) : platform === 'instagram' ? (
                  <>
                    <StatCard label="Impressions"      value={totals.total_impressions}          icon={Eye}          color="#e1306c" />
                    <StatCard label="Reach"            value={totals.total_reach}                icon={Radio}        color="#22c55e" />
                    <StatCard label="Interactions"     value={totals.total_total_interactions}   icon={Heart}        color="#ef4444" />
                    <StatCard label="Accounts Engaged" value={totals.total_accounts_engaged}     icon={UserPlus}     color="#8b5cf6" />
                    <StatCard label="Profile Views"    value={totals.total_profile_views}        icon={MousePointer2} color="#00d7ff" />
                    <StatCard label="Website Clicks"   value={totals.total_website_clicks}       icon={Globe}        color="#0891b2" />
                    <StatCard label="Email Clicks"     value={totals.total_email_contacts}       icon={Mail}         color="#f59e0b" />
                    <StatCard label="Phone Clicks"     value={totals.total_phone_call_clicks}    icon={Phone}        color="#059669" />
                    <StatCard label="Direction Clicks" value={totals.total_direction_clicks}     icon={Navigation}   color="#6366f1" />
                    <StatCard label="Unfollows"        value={totals.total_ig_followers_lost}    icon={TrendingDown} color="#94a3b8" />
                  </>
                ) : (
                  <>
                    <StatCard label="Impressions"    value={totals.total_impressions}    icon={Eye}           color="#00d7ff" />
                    <StatCard label="Reach"          value={totals.total_reach}          icon={Radio}         color="#22c55e" />
                    <StatCard label="Clicks"         value={totals.total_clicks}         icon={MousePointer2} color="#00d7ff" />
                    <StatCard label="Likes"          value={totals.total_likes}          icon={Heart}         color="#ef4444" />
                    <StatCard label="Video Views"    value={totals.total_video_views}    icon={Play}          color="#f59e0b" />
                    <StatCard label="Followers"      value={totals.total_followers}      icon={UserPlus}      color="#8b5cf6" />
                    <StatCard label="Website Clicks" value={totals.total_website_clicks} icon={Globe}         color="#0891b2" />
                    <StatCard label="Phone Calls"    value={totals.total_phone_calls}    icon={Phone}         color="#059669" />
                  </>
                )}
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

          {connectedPlatforms.includes('google_my_business') && (
            <GMBWidget clientId={clientId} />
          )}

          <div style={styles.reportingSection}>
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
                            <span style={{ color: platformMeta(p.platform).color }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <SocialPlatformIcon platform={p.platform} size={15} />
                                {platformMeta(p.platform).label}
                              </span>
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
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <SocialPlatformIcon platform={p.platform} size={15} />
                              {PLATFORMS[p.platform]?.label}
                            </span>
                          </td>
                          <td style={{ ...styles.td, color: '#00d7ff', fontWeight: 500 }}>
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

const TONE_COLORS = {
  professional: '#0891b2', casual: '#f59e0b', funny: '#f97316',
  inspirational: '#8b5cf6', urgent: '#ef4444', friendly: '#22c55e',
};


function heroChip(color) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '3px 10px', borderRadius: 20,
    background: `${color}18`, border: `1px solid ${color}35`,
    color, fontSize: 11, fontWeight: 600,
  };
}

function ClientHeroCard({ client }) {
  const [expanded, setExpanded] = useState(false);
  const initials = (client.company || 'C')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const hasBrandInfo = !!(client.brand_description || client.usp || client.target_audience || client.target_locations?.length > 0);

  const hasAnyInfo = !!(
    client.business_category || client.business_location || client.brand_tone ||
    client.email || client.phone || client.website || client.whatsapp_number || hasBrandInfo
  );

  if (!hasAnyInfo) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Profile info strip — same bg as page, no card */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
        {/* Avatar */}
        {client.logo ? (
          <img src={client.logo} alt={client.company} style={{
            width: 40, height: 40, borderRadius: 10, objectFit: 'cover',
            border: '1px solid #e2e8f0', flexShrink: 0,
          }} />
        ) : (
          <div style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, #00d7ff 0%, #0099bb 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 800, color: '#0f172a',
          }}>{initials}</div>
        )}

        {/* Business chips */}
        {client.business_category && <span style={heroChip('#0891b2')}>🏢 {client.business_category}</span>}
        {client.business_location  && <span style={heroChip('#16a34a')}>📍 {client.business_location}</span>}
        {client.brand_tone && (
          <span style={heroChip(TONE_COLORS[client.brand_tone] || '#f59e0b')}>
            🎨 {client.brand_tone.charAt(0).toUpperCase() + client.brand_tone.slice(1)}
          </span>
        )}
        {client.gender && !['unspecified','all'].includes(client.gender) && (
          <span style={heroChip('#7c3aed')}>👥 {client.gender.charAt(0).toUpperCase() + client.gender.slice(1)}</span>
        )}
        {(client.target_locations || []).slice(0, 2).map(loc => (
          <span key={loc} style={heroChip('#d97706')}>🌍 {loc}</span>
        ))}

        {/* Divider */}
        {(client.email || client.phone || client.website || client.whatsapp_number) && (
          <span style={{ width: 1, height: 18, background: '#e2e8f0', flexShrink: 0 }} />
        )}

        {/* Contact links inline */}
        {client.email && (
          <a href={`mailto:${client.email}`} style={contactLink}>
            <Mail size={12} /> {client.email}
          </a>
        )}
        {client.phone && (
          <a href={`tel:${client.phone}`} style={contactLink}>
            <Phone size={12} /> {client.phone}
          </a>
        )}
        {client.whatsapp_number && (
          <span style={contactLink}>💬 {client.whatsapp_number}</span>
        )}
        {client.website && (
          <a href={client.website} target="_blank" rel="noreferrer" style={contactLink}>
            <Globe size={12} /> {client.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
          </a>
        )}
        {client.gmb_url && (
          <a href={client.gmb_url} target="_blank" rel="noreferrer" style={contactLink}>
            📍 Google Business
          </a>
        )}

        {/* Brand info toggle */}
        {hasBrandInfo && (
          <button onClick={() => setExpanded(e => !e)} style={{
            marginLeft: 'auto', background: 'none', border: '1px solid #e2e8f0',
            borderRadius: 8, cursor: 'pointer', color: '#64748b',
            fontSize: 11, fontWeight: 600, padding: '4px 10px',
          }}>
            {expanded ? 'Hide Profile ▲' : 'Brand Profile ▼'}
          </button>
        )}
      </div>

      {/* Brand Info (expandable) */}
      {hasBrandInfo && expanded && (
        <div style={{
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14,
          padding: '16px 20px', marginBottom: 4,
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12,
        }}>
          {client.brand_description && (
            <div style={brandInfoBox}>
              <span style={brandInfoLabel}>About</span>
              <p style={brandInfoText}>{client.brand_description}</p>
            </div>
          )}
          {client.usp && (
            <div style={brandInfoBox}>
              <span style={brandInfoLabel}>Unique Selling Points</span>
              <p style={brandInfoText}>{client.usp}</p>
            </div>
          )}
          {client.target_audience && (
            <div style={brandInfoBox}>
              <span style={brandInfoLabel}>Target Audience</span>
              <p style={brandInfoText}>{client.target_audience}</p>
            </div>
          )}
          {(client.business_subcategories || []).length > 0 && (
            <div style={brandInfoBox}>
              <span style={brandInfoLabel}>Subcategories</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
                {client.business_subcategories.map(s => (
                  <span key={s} style={heroChip('#64748b')}>{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const contactLink = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  color: '#64748b', fontSize: 12, textDecoration: 'none',
};

const brandInfoBox = {
  background: '#f8fafc', borderRadius: 10,
  padding: '10px 14px', border: '1px solid #e2e8f0',
};
const brandInfoLabel = {
  display: 'block', fontSize: 10, fontWeight: 700, color: '#94a3b8',
  textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 5,
};
const brandInfoText = { margin: 0, fontSize: 12, color: '#374151', lineHeight: 1.6 };

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
          const p = PLATS[post.platform] || { color: '#64748B', label: post.platform };
          const timeStr = post.scheduled_at
            ? format(parseISO(post.scheduled_at), 'MMM d · h:mm a')
            : '';
          return (
            <div key={post.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 8,
              background: '#f0f4f9', border: `1px solid ${p.color}30`,
            }}>
              <span style={{ fontSize: 18, flexShrink: 0, display: 'inline-flex' }}>
                <SocialPlatformIcon platform={post.platform} size={18} />
              </span>
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
  controlBar: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18,
    padding: '16px 18px', marginBottom: 20,
    boxShadow: '0 1px 6px rgba(15,23,42,.05)',
  },
  controlTop: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: 16, marginBottom: 14, flexWrap: 'wrap',
  },
  quickStats: {
    display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0,
  },
  qStat: { textAlign: 'center' },
  qStatNum: { display: 'block', fontSize: 16, fontWeight: 800, color: '#0f172a' },
  qStatLabel: { display: 'block', fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em' },
  qStatDivider: { width: 1, height: 28, background: '#e2e8f0' },
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
    background: '#f0f4f9',
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
    background: '#00d7ff', color: '#0f172a', cursor: 'pointer', fontWeight: 600, fontSize: 13,
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
    background: '#f0f4f9', borderRadius: 14,
  },
  tableWrap: {
    background: '#fff', borderRadius: 14, padding: 24,
    boxShadow: '0 1px 6px rgba(0,0,0,.07)', marginBottom: 24,
  },
  tableTitle: { margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#1e293b' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left', padding: '10px 12px',
    background: '#f0f4f9', color: '#64748b',
    fontWeight: 600, fontSize: 12, borderBottom: '1px solid #e5e7eb',
  },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '12px 12px', color: '#374151' },
  postLink: { color: '#00d7ff', textDecoration: 'none', fontWeight: 500 },
};
