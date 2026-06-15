/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './services/queryClient';
import RealtimeBridge from './components/RealtimeBridge';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import { RealtimeProvider } from './hooks/useRealtime';
import { Toaster } from 'react-hot-toast';
import { lazy, Suspense } from 'react';
import ErrorBoundary from './components/ui/ErrorBoundary';

import { BrandLogoStacked } from './components/ui/BrandLogo';

// ── New shell ───────────────────────────────────────────────────────────────
import AppShell from './components/shell/AppShell';
import CookieBanner from './components/legal/CookieBanner';
import PageviewTracker from './components/PageviewTracker';

// ── Modules (sub-routers) ──────────────────────────────────────────────────
const AnalyticsModule = lazy(() => import('./modules/AnalyticsModule'));
const MessagingModule = lazy(() => import('./modules/MessagingModule'));
const AdsModule       = lazy(() => import('./modules/AdsModule'));

// ── Eagerly loaded (critical path) ──────────────────────────────────────────
import LoginPage         from './pages/LoginPage';
import AuthCallbackPage  from './pages/AuthCallbackPage';
import OAuthCallbackPage from './pages/OAuthCallbackPage';

// ── Pages outside the modules (settings/admin/legacy detail views) ──────────
const SettingsPage         = lazy(() => import('./pages/SettingsPage'));
const EditClientPage       = lazy(() => import('./pages/EditClientPage'));
const ClientDashboard      = lazy(() => import('./pages/ClientDashboard'));
const ROICalculatorPage    = lazy(() => import('./pages/ROICalculatorPage'));
const AllClientsPage       = lazy(() => import('./pages/AllClientsPage'));
const ManagementPage       = lazy(() => import('./pages/ManagementPage'));
const UserSettingsPage     = lazy(() => import('./pages/UserSettingsPage'));
const ClientOnboardingPage = lazy(() => import('./pages/ClientOnboardingPage'));
const PublicReportPage     = lazy(() => import('./pages/PublicReportPage'));
const PrivacyPolicyPage    = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsOfServicePage   = lazy(() => import('./pages/TermsOfServicePage'));
const DataDeletionPage     = lazy(() => import('./pages/DataDeletionPage'));
const PendingDashboard     = lazy(() => import('./pages/PendingDashboard'));
const InvitationPage       = lazy(() => import('./pages/InvitationPage'));
const SignupPage           = lazy(() => import('./pages/SignupPage'));
const VerifyEmailPage      = lazy(() => import('./pages/VerifyEmailPage'));
const ResetPasswordPage    = lazy(() => import('./pages/ResetPasswordPage'));
const HomePage             = lazy(() => import('./pages/HomePage'));
const ForBusinessesPage    = lazy(() => import('./pages/ForBusinessesPage'));
const ForAgenciesPage      = lazy(() => import('./pages/ForAgenciesPage'));
const FeaturesPage         = lazy(() => import('./pages/FeaturesPage'));
const CustomersPage        = lazy(() => import('./pages/CustomersPage'));
const AboutPage            = lazy(() => import('./pages/AboutPage'));
const ContactPage          = lazy(() => import('./pages/ContactPage'));
const CookiePolicyPage     = lazy(() => import('./pages/CookiePolicyPage'));
const GDPRPage             = lazy(() => import('./pages/GDPRPage'));
const DPDPPage             = lazy(() => import('./pages/DPDPPage'));
const SecurityPage         = lazy(() => import('./pages/SecurityPage'));
const HelpCenterPage       = lazy(() => import('./pages/HelpCenterPage'));
const StatusPage           = lazy(() => import('./pages/StatusPage'));
const ChangelogPage        = lazy(() => import('./pages/ChangelogPage'));
const NotFoundPage         = lazy(() => import('./pages/NotFoundPage'));
const ServerErrorPage      = lazy(() => import('./pages/ServerErrorPage'));
const MaintenancePage      = lazy(() => import('./pages/MaintenancePage'));
const BlogIndexPage        = lazy(() => import('./pages/BlogIndexPage'));
const ComingSoonMarketingPage = lazy(() => import('./pages/marketing/ComingSoonPage'));
const ProductPage             = lazy(() => import('./pages/marketing/ProductPage'));
const SolutionPage            = lazy(() => import('./pages/marketing/SolutionPage'));
const CaseStudyPage           = lazy(() => import('./pages/marketing/CaseStudyPage'));
const IntegrationsPage        = lazy(() => import('./pages/IntegrationsPage'));
const AgenciesShowcasePage    = lazy(() => import('./pages/marketing/AgenciesShowcasePage'));
const AgencyShowcasePage      = lazy(() => import('./pages/marketing/AgencyShowcasePage'));
const BlogPostPage         = lazy(() => import('./pages/BlogPostPage'));

// ── End-user (B2C marketplace) — ────────────────────────────────────
const EndUserSignupPage    = lazy(() => import('./pages/end-user/EndUserSignupPage'));
const EndUserShell         = lazy(() => import('./pages/end-user/EndUserShell'));
const EndUserDashboard     = lazy(() => import('./pages/end-user/EndUserDashboard'));
const MyConnectionsPage    = lazy(() => import('./pages/end-user/MyConnectionsPage'));
const MyAgencyPage         = lazy(() => import('./pages/end-user/MyAgencyPage'));
const ActivityLogPage      = lazy(() => import('./pages/end-user/ActivityLogPage'));
const ApprovalsPage        = lazy(() => import('./pages/end-user/ApprovalsPage'));
const NotificationPreferencesPage = lazy(() => import('./pages/end-user/NotificationPreferencesPage'));

// ── Marketplace flows — ────────────────────────────────────
const ManageInvitePage           = lazy(() => import('./pages/marketplace/ManageInvitePage'));
const AgencyInviteResponsePage   = lazy(() => import('./pages/marketplace/AgencyInviteResponsePage'));
const MarketplacePage            = lazy(() => import('./pages/marketplace/MarketplacePage'));
const AgencyProfilePage          = lazy(() => import('./pages/marketplace/AgencyProfilePage'));
const AgencyMarketplaceProfilePage = lazy(() => import('./pages/agency/AgencyMarketplaceProfilePage'));
const AdminTrustQueuePage          = lazy(() => import('./pages/admin/AdminTrustQueuePage'));

// ── CTWA bot builder ────────────────────────────────────────────────────────
const BotFlowsListPage             = lazy(() => import('./pages/bots/BotFlowsListPage'));
const BotFlowEditorPage            = lazy(() => import('./pages/bots/BotFlowEditorPage'));
const LeadsPage                    = lazy(() => import('./pages/leads/LeadsPage'));
const LeadDetailPage               = lazy(() => import('./pages/leads/LeadDetailPage'));
const BotConversationsPage         = lazy(() => import('./pages/bots/BotConversationsPage'));
const BotConversationDetailPage    = lazy(() => import('./pages/bots/BotConversationDetailPage'));
const BotAnalyticsPage             = lazy(() => import('./pages/bots/BotAnalyticsPage'));
const CTWACampaignsPage            = lazy(() => import('./pages/ctwa/CTWACampaignsPage'));
const CTWACampaignDetailPage       = lazy(() => import('./pages/ctwa/CTWACampaignDetailPage'));
const TemplatesGalleryPage         = lazy(() => import('./pages/bots/TemplatesGalleryPage'));
const HandoffQueuePage             = lazy(() => import('./pages/bots/HandoffQueuePage'));
const BotSettingsPage              = lazy(() => import('./pages/bots/BotSettingsPage'));

function LazyFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, padding: 40 }}>
      <div className="skeleton-card" style={{ width: '100%', maxWidth: 600, height: 120, borderRadius: 16 }} />
    </div>
  );
}

// ── Protected route wrapper ───────────────────────────────────────────────────
function Protected({ children, roles, accountTypes }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user)   return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    const fallback = user.role === 'superadmin' || user.role === 'staff' ? '/admin' : '/dashboard';
    return <Navigate to={fallback} replace />;
  }
  // Account-type guard — keeps /agency/* limited to agency members and
  // /u/* limited to end users, even though both share role='client'.
  if (accountTypes && !accountTypes.includes(user.account_type)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

// ── Admin layout — wraps admin/staff routes in AppShell ───────────────────────
function AdminLayout() {
  return (
    <AppShell isAdmin>
      <Suspense fallback={<LazyFallback />}>
        <Routes>
          {/* Default → analytics module */}
          <Route index element={<Navigate to="analytics" replace />} />

          {/* Modules */}
          <Route path="analytics/*" element={<AnalyticsModule isAdmin />} />
          <Route path="messaging/*" element={<MessagingModule />} />
          <Route path="ads/*"       element={<AdsModule />} />

          {/* Outside-module pages */}
          <Route path="clients"            element={<AllClientsPage />} />
          <Route path="management"         element={<ManagementPage />} />
          <Route path="account-settings"   element={<UserSettingsPage />} />
          <Route path="trust"               element={<AdminTrustQueuePage />} />

          {/* Agency-only pages moved to /agency/*. Redirect any stale links. */}
          <Route path="marketplace-profile" element={<Navigate to="/agency/marketplace-profile" replace />} />

          {/* CTWA bot builder list (full editor lives at top-level /bot-flows/:id/edit
              so it can use the entire viewport without the AppShell chrome) */}
          <Route path="bot-flows"           element={<BotFlowsListPage />} />
          <Route path="leads"               element={<LeadsPage />} />
          <Route path="leads/:id"           element={<LeadDetailPage />} />
          <Route path="conversations"       element={<BotConversationsPage />} />
          <Route path="conversations/:id"   element={<BotConversationDetailPage />} />
          <Route path="handoff"             element={<HandoffQueuePage />} />
          <Route path="bot-settings"        element={<BotSettingsPage />} />
          <Route path="bot-flows/:id/analytics" element={<BotAnalyticsPage />} />
          <Route path="ctwa"                element={<CTWACampaignsPage />} />
          <Route path="ctwa/:id"            element={<CTWACampaignDetailPage />} />
          <Route path="bot-templates"       element={<TemplatesGalleryPage />} />

          {/* Per-client deep-dive */}
          <Route path="client/:clientId/*" element={<AdminClientView />} />

          {/* Legacy URL redirects → new module routes */}
          <Route path="dashboard"      element={<Navigate to="/admin/analytics/dashboard" replace />} />
          <Route path="analytics"      element={<Navigate to="/admin/analytics/analytics" replace />} />
          <Route path="reports"        element={<Navigate to="/admin/analytics/reports"   replace />} />
          <Route path="calendar"       element={<Navigate to="/admin/analytics/calendar"  replace />} />
          <Route path="roi"            element={<Navigate to="/admin/analytics/roi"       replace />} />
          <Route path="alerts"         element={<Navigate to="/admin/analytics/alerts"    replace />} />
          <Route path="synclogs"       element={<Navigate to="/admin/analytics/synclogs"  replace />} />
          <Route path="caption-writer" element={<Navigate to="/admin/analytics/caption-writer" replace />} />
          <Route path="post-ideas"     element={<Navigate to="/admin/analytics/post-ideas"  replace />} />
          <Route path="hashtags"       element={<Navigate to="/admin/analytics/hashtags"    replace />} />

          <Route path="whatsapp"            element={<Navigate to="/admin/messaging" replace />} />
          <Route path="whatsapp/inbox"      element={<Navigate to="/admin/messaging/inbox"     replace />} />
          <Route path="whatsapp/contacts"   element={<Navigate to="/admin/messaging/contacts"  replace />} />
          <Route path="whatsapp/templates"  element={<Navigate to="/admin/messaging/templates" replace />} />
          <Route path="whatsapp/campaigns"  element={<Navigate to="/admin/messaging/campaigns" replace />} />
          <Route path="whatsapp/settings"   element={<Navigate to="/admin/messaging/account"   replace />} />

          <Route path="onboarding" element={<Navigate to="/admin" replace />} />

          {/* Catch-all → analytics */}
          <Route path="*" element={<Navigate to="analytics" replace />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}

function AdminClientView() {
  const { clientId } = useParams();
  return (
    <Suspense fallback={<LazyFallback />}>
      <Routes>
        <Route index           element={<ClientDashboard clientId={clientId} />} />
        <Route path="settings" element={<SettingsPage clientId={clientId} />} />
        <Route path="edit"     element={<EditClientPage clientId={clientId} />} />
        <Route path="roi"      element={<ROICalculatorPage clientId={clientId} />} />
      </Routes>
    </Suspense>
  );
}

// ── Client layout — wraps client routes in AppShell ───────────────────────────
function ClientLayout() {
  const { user } = useAuth();
  return (
    <AppShell isAdmin={false}>
      <Suspense fallback={<LazyFallback />}>
        <Routes>
          <Route index element={<Navigate to="analytics" replace />} />

          <Route path="analytics/*" element={<AnalyticsModule clientId={user?.client_id} />} />
          <Route path="messaging/*" element={<MessagingModule />} />
          <Route path="ads/*"       element={<AdsModule />} />

          <Route path="settings"        element={<SettingsPage clientId={user?.client_id} />} />
          <Route path="account-settings" element={<UserSettingsPage />} />
          <Route path="onboarding"       element={<ClientOnboardingPage />} />

          {/* Legacy URL redirects */}
          <Route path="posts"          element={<Navigate to="/dashboard/analytics/posts" replace />} />
          <Route path="calendar"       element={<Navigate to="/dashboard/analytics/calendar" replace />} />
          <Route path="roi"            element={<Navigate to="/dashboard/analytics/roi" replace />} />
          <Route path="caption-writer" element={<Navigate to="/dashboard/analytics/caption-writer" replace />} />
          <Route path="post-ideas"     element={<Navigate to="/dashboard/analytics/post-ideas" replace />} />
          <Route path="hashtags"       element={<Navigate to="/dashboard/analytics/hashtags" replace />} />

          <Route path="whatsapp"            element={<Navigate to="/dashboard/messaging" replace />} />
          <Route path="whatsapp/inbox"      element={<Navigate to="/dashboard/messaging/inbox" replace />} />
          <Route path="whatsapp/contacts"   element={<Navigate to="/dashboard/messaging/contacts" replace />} />
          <Route path="whatsapp/templates"  element={<Navigate to="/dashboard/messaging/templates" replace />} />
          <Route path="whatsapp/campaigns"  element={<Navigate to="/dashboard/messaging/campaigns" replace />} />
          <Route path="whatsapp/settings"   element={<Navigate to="/dashboard/messaging/account" replace />} />

          <Route path="*" element={<Navigate to="analytics" replace />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}

// ── Root: marketing home for guests, dashboard redirect for users ────────────
function RootRedirect() {
  const { user, loading, isPending } = useAuth();
  if (loading) return <Loader />;
  if (!user)   return <HomePage />;
  if (user.role === 'superadmin' || user.role === 'staff')
    return <Navigate to="/admin" replace />;
  if (isPending) return <Navigate to="/pending" replace />;
  // Account-type-aware client routing. End users land in their dedicated
  // shell; agency members and legacy clients use the shared dashboard.
  if (user.account_type === 'end_user') return <Navigate to="/u" replace />;
  return <Navigate to="/dashboard" replace />;
}

// ── Agency layout — wraps agency-member-only management pages in AppShell ────
function AgencyLayout() {
  return (
    <AppShell isAdmin={false}>
      <Suspense fallback={<LazyFallback />}>
        <Routes>
          <Route index element={<Navigate to="marketplace-profile" replace />} />
          <Route path="marketplace-profile" element={<AgencyMarketplaceProfilePage />} />
          <Route path="*" element={<Navigate to="marketplace-profile" replace />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}

function Loader() {
  return (
    <div className="socialstats-loader" style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--surface-page)',
      color: 'var(--text-secondary)',
      gap: 20,
    }}>
      <div
        className="socialstats-loader__logo"
        style={{ animation: 'pulse-dot 1.8s ease-in-out infinite' }}
      >
        <BrandLogoStacked height={120} />
      </div>
      <div style={{
        fontSize: 12,
        color: 'var(--text-tertiary)',
        fontWeight: 600,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        marginTop: 4,
      }}>
        Loading…
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <PageviewTracker />
      <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
        <QueryClientProvider client={queryClient}>
        <RealtimeProvider>
          {/*bridges WebSocket events to React Query cache
              invalidation + bumps zustand badge counts between polls.
              Renders nothing; safe to mount unconditionally. */}
          <RealtimeBridge />
          <Suspense fallback={<Loader />}>
          <Routes>
            <Route path="/"       element={<RootRedirect />} />
            <Route path="/login"         element={<LoginPage />} />
            <Route path="/auth/callback"  element={<AuthCallbackPage />} />
            <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
            <Route path="/report/:token"    element={<PublicReportPage />} />
            <Route path="/privacy"          element={<PrivacyPolicyPage />} />
            <Route path="/terms"            element={<TermsOfServicePage />} />
            <Route path="/data-deletion"    element={<DataDeletionPage />} />
            <Route path="/features"         element={<FeaturesPage />} />
            <Route path="/customers"        element={<CustomersPage />} />
            <Route path="/customers/:slug"  element={<CaseStudyPage />} />
            <Route path="/about"            element={<AboutPage />} />
            <Route path="/contact"          element={<ContactPage />} />
            <Route path="/cookies"          element={<CookiePolicyPage />} />
            <Route path="/gdpr"             element={<GDPRPage />} />
            <Route path="/dpdp"             element={<DPDPPage />} />
            <Route path="/security"         element={<SecurityPage />} />
            <Route path="/help"             element={<HelpCenterPage />} />
            <Route path="/help/:category"   element={<HelpCenterPage />} />
            <Route path="/status"           element={<StatusPage />} />
            <Route path="/changelog"        element={<ChangelogPage />} />
            <Route path="/maintenance"      element={<MaintenancePage />} />
            <Route path="/500"              element={<ServerErrorPage />} />
            <Route path="/blog"             element={<BlogIndexPage />} />
            <Route path="/blog/:slug"       element={<BlogPostPage />} />

            {/* Marketingproduct pages (data-driven via productPages.js) */}
            <Route path="/product/:slug"     element={<ProductPage />} />
            {/* Marketingsolution pages (data-driven via solutionPages.js) */}
            <Route path="/solutions/:slug"   element={<SolutionPage />} />
            <Route path="/integrations"      element={<IntegrationsPage />} />
            {/*marketing-flavoured agency showcase (public, SEO).
                The functional B2C marketplace lives at /marketplace. */}
            <Route path="/agencies"          element={<AgenciesShowcasePage />} />
            <Route path="/agencies/:slug"    element={<AgencyShowcasePage />} />
            <Route path="/invitation/:token" element={<InvitationPage />} />
            <Route path="/signup"            element={<SignupPage />} />
            <Route path="/auth/end-user/signup" element={<EndUserSignupPage />} />
            <Route path="/invite/:token" element={<ManageInvitePage />} />
            <Route path="/agency-invite/:token" element={<AgencyInviteResponsePage />} />
            <Route path="/marketplace"        element={<MarketplacePage />} />
            <Route path="/marketplace/:slug"  element={<AgencyProfilePage />} />
            <Route path="/for-businesses"     element={<ForBusinessesPage />} />
            <Route path="/for-agencies"       element={<ForAgenciesPage />} />
            <Route path="/verify-email"     element={<VerifyEmailPage />} />
            <Route path="/forgot-password"  element={<ResetPasswordPage />} />
            <Route path="/reset-password"   element={<ResetPasswordPage />} />

            <Route path="/pending" element={
              <Protected roles={['client']}>
                <PendingDashboard />
              </Protected>
            } />

            <Route path="/admin/*" element={
              <Protected roles={['superadmin','staff']}>
                <AdminLayout />
              </Protected>
            } />

            {/* CTWA bot editor — full-screen, bypasses the AppShell */}
            <Route path="/admin/bot-flows/:id/edit" element={
              <Protected roles={['superadmin','staff']}>
                <Suspense fallback={<LazyFallback />}>
                  <BotFlowEditorPage />
                </Suspense>
              </Protected>
            } />

            <Route path="/dashboard/*" element={
              <Protected roles={['client']}>
                <ClientLayout />
              </Protected>
            } />

            {/* Agency-member-only management pages.
                account_type guard prevents end_user clients from reaching
                /agency/billing or /agency/marketplace-profile. */}
            <Route path="/agency/*" element={
              <Protected roles={['client']} accountTypes={['agency_member']}>
                <AgencyLayout />
              </Protected>
            } />

            {/* End-user (B2C marketplace) shell*/}
            <Route path="/u" element={
              <Protected roles={['client']} accountTypes={['end_user']}>
                <EndUserShell />
              </Protected>
            }>
              <Route index               element={<EndUserDashboard />} />
              <Route path="connections"  element={<MyConnectionsPage />} />
              <Route path="agency"        element={<MyAgencyPage />} />
              <Route path="agency/find"   element={<MarketplacePage />} />
              <Route path="activity"      element={<ActivityLogPage />} />
              <Route path="approvals"     element={<ApprovalsPage />} />
              <Route path="notifications" element={<NotificationPreferencesPage />} />
            </Route>

            {/* Catch-all 404 — must be last */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </Suspense>

          {/* Toast notifications*/}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: 'var(--surface-elevated)',
                color:      'var(--text-primary)',
                border:     '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
                boxShadow: 'var(--shadow-lg)',
              },
              success: { iconTheme: { primary: 'var(--success)', secondary: '#fff' } },
              error:   { iconTheme: { primary: 'var(--danger)',  secondary: '#fff' } },
            }}
          />

          <CookieBanner />
        </RealtimeProvider>
        </QueryClientProvider>
        </AuthProvider>
      </ThemeProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
