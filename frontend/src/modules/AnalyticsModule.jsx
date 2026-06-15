/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

const AdminOverview     = lazy(() => import('../pages/AdminOverview'));
const ClientDashboard   = lazy(() => import('../pages/ClientDashboard'));
const AnalyticsPage     = lazy(() => import('../pages/AnalyticsPage'));
const ReportsPage       = lazy(() => import('../pages/ReportsPage'));
const MyPostsPage       = lazy(() => import('../pages/MyPostsPage'));
const CalendarPage      = lazy(() => import('../pages/CalendarPage'));
const CaptionWriterPage = lazy(() => import('../pages/CaptionWriterPage'));
const PostIdeasPage     = lazy(() => import('../pages/PostIdeasPage'));
const ROICalculatorPage = lazy(() => import('../pages/ROICalculatorPage'));
const AlertsPage        = lazy(() => import('../pages/AlertsPage'));
const SyncLogsPage      = lazy(() => import('../pages/SyncLogsPage'));
// Composer ( unified control center)
const ComposerPage      = lazy(() => import('../pages/composer/ComposerPage'));
const MediaLibraryPage  = lazy(() => import('../pages/composer/MediaLibraryPage'));
const QueueManagerPage  = lazy(() => import('../pages/composer/QueueManagerPage'));
// Inbox ( unified inbox)
const UnifiedInboxPage  = lazy(() => import('../pages/inbox/UnifiedInboxPage'));
const ReviewsPage       = lazy(() => import('../pages/inbox/ReviewsPage'));
// Automations ()
const AutomationsPage   = lazy(() => import('../pages/automations/AutomationsPage'));
// Video Studio ()
const VideoStudioPage   = lazy(() => import('../pages/video/VideoStudioPage'));
// Growth ()
const CompetitorsPage      = lazy(() => import('../pages/growth/CompetitorsPage'));
const AudienceInsightsPage = lazy(() => import('../pages/growth/AudienceInsightsPage'));
// Admin ()
const NotificationPreferencesPage = lazy(() => import('../pages/admin/NotificationPreferencesPage'));
const AuditLogPage                = lazy(() => import('../pages/admin/AuditLogPage'));
const ApprovalQueuePage           = lazy(() => import('../pages/admin/ApprovalQueuePage'));
// AI ( of comprehensive AI build)
const BrandVoicePage              = lazy(() => import('../pages/ai/BrandVoicePage'));
const AIInsightsPage              = lazy(() => import('../pages/ai/AIInsightsPage'));
const AIStudioPage                = lazy(() => import('../pages/ai/AIStudio'));
const AIUsagePage                 = lazy(() => import('../pages/ai/AIUsagePage'));
const AIChatHistoryPage           = lazy(() => import('../pages/ai/AIChatHistoryPage'));
const AIAuditPage                 = lazy(() => import('../pages/ai/AIAuditPage'));

function Fallback() {
  return (
    <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
      <div className="skeleton-card" style={{ width: '100%', maxWidth: 600, height: 120 }} />
    </div>
  );
}

/**
 * Routes for the Analytics module.
 *
 * Props:
 * isAdmin: bool — admin gets AdminOverview; client gets ClientDashboard
 * clientId: optional override for client-scoped pages (passed to ClientDashboard / SettingsPage)
 */
export default function AnalyticsModule({ isAdmin = false, clientId = null }) {
  const Home = isAdmin ? AdminOverview : ClientDashboard;
  const HomeProps = isAdmin ? {} : { clientId };

  return (
    <Suspense fallback={<Fallback />}>
      <Routes>
        <Route index               element={<Home {...HomeProps} />} />
        <Route path="dashboard"    element={<Home {...HomeProps} />} />
        <Route path="analytics"    element={<AnalyticsPage />} />
        <Route path="reports"      element={<ReportsPage />} />
        <Route path="posts"        element={<MyPostsPage />} />
        <Route path="calendar"     element={<CalendarPage clientId={clientId} />} />
        <Route path="caption-writer" element={<CaptionWriterPage />} />
        <Route path="post-ideas"   element={<PostIdeasPage />} />
        <Route path="hashtags"     element={<CaptionWriterPage defaultTab="hashtag" />} />
        <Route path="roi"          element={<ROICalculatorPage clientId={clientId} />} />
        <Route path="alerts"       element={<AlertsPage />} />
        <Route path="synclogs"     element={<SyncLogsPage />} />
        {/* Composer */}
        <Route path="composer"      element={<ComposerPage />} />
        <Route path="composer/:id"  element={<ComposerPage />} />
        <Route path="media"         element={<MediaLibraryPage />} />
        <Route path="queues"        element={<QueueManagerPage />} />
        {/* Inbox */}
        <Route path="inbox"         element={<UnifiedInboxPage />} />
        <Route path="reviews"       element={<ReviewsPage />} />
        {/* Automations */}
        <Route path="automations"   element={<AutomationsPage />} />
        {/* Video Studio */}
        <Route path="video"         element={<VideoStudioPage />} />
        {/* Growth */}
        <Route path="competitors"   element={<CompetitorsPage />} />
        <Route path="audience"      element={<AudienceInsightsPage />} />
        {/* Admin */}
        <Route path="approvals"      element={<ApprovalQueuePage />} />
        <Route path="audit-log"      element={<AuditLogPage />} />
        <Route path="notifications"  element={<NotificationPreferencesPage />} />
        {/* AI */}
        <Route path="brand-voice"    element={<BrandVoicePage clientId={clientId} />} />
        <Route path="insights"       element={<AIInsightsPage clientId={clientId} />} />
        <Route path="ai-studio"      element={<AIStudioPage />} />
        <Route path="ai-usage"       element={<AIUsagePage />} />
        <Route path="chat-history"   element={<AIChatHistoryPage />} />
        <Route path="ai-audit"       element={<AIAuditPage clientId={clientId} />} />
        <Route path="*"            element={<Navigate to="dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
