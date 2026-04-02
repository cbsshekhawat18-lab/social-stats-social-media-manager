import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useClients } from './hooks/useData';
import { useState } from 'react';

import Sidebar           from './components/layout/Sidebar';
import BottomNav         from './components/layout/BottomNav';
import MobileHeader      from './components/layout/MobileHeader';
import LoginPage         from './pages/LoginPage';
import ClientDashboard   from './pages/ClientDashboard';
import SettingsPage      from './pages/SettingsPage';
import AdminOverview     from './pages/AdminOverview';
import AllClientsPage    from './pages/AllClientsPage';
import SyncLogsPage      from './pages/SyncLogsPage';
import EditClientPage    from './pages/EditClientPage';
import PublicReportPage  from './pages/PublicReportPage';
import ROICalculatorPage from './pages/ROICalculatorPage';
import CalendarPage      from './pages/CalendarPage';
import AdminOnboardingPage from './pages/AdminOnboardingPage';
import MyPostsPage from './pages/MyPostsPage';
import AlertsPage from './pages/AlertsPage';
import ReportsPage from './pages/ReportsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ManagementPage from './pages/ManagementPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import CaptionWriterPage   from './pages/CaptionWriterPage';
import PostIdeasPage       from './pages/PostIdeasPage';
import logoStatoxBig from './assets/logo_statox_big.png';

// ── Protected route wrapper ───────────────────────────────────────────────────
function Protected({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user)   return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    const fallback = user.role === 'superadmin' || user.role === 'staff' ? '/admin' : '/dashboard';
    return <Navigate to={fallback} replace />;
  }
  return children;
}

// ── Admin layout with sidebar ─────────────────────────────────────────────────
function AdminLayout() {
  const { clients }              = useClients();
  const [selected, setSelected]  = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div style={{ display: 'flex' }}>
      <MobileHeader onMenuOpen={() => setMobileOpen(true)} />
      <Sidebar
        clients={clients}
        selectedClient={selected}
        onSelectClient={setSelected}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <main
        className="main-content"
        style={{ marginLeft: 260, flex: 1, minHeight: '100vh', background: '#f0f4f9' }}
      >
        <Routes>
          <Route index                     element={<AdminOverview />} />
          <Route path="client/:clientId/*" element={<AdminClientView />} />
          <Route path="clients"            element={<AllClientsPage onSelectClient={setSelected} />} />
          <Route path="synclogs"           element={<SyncLogsPage />} />
          <Route path="onboarding"         element={<AdminOnboardingPage />} />
          <Route path="roi"                element={<ROICalculatorPage clientId={null} />} />
          <Route path="calendar"           element={<CalendarPage clientId={null} />} />
          <Route path="alerts"             element={<AlertsPage />} />
          <Route path="reports"            element={<ReportsPage />} />
          <Route path="analytics"          element={<AnalyticsPage />} />
          <Route path="management"         element={<ManagementPage />} />
          <Route path="caption-writer"     element={<CaptionWriterPage />} />
          <Route path="post-ideas"         element={<PostIdeasPage />} />
          <Route path="hashtags"           element={<CaptionWriterPage defaultTab="hashtag" />} />
        </Routes>
      </main>
      <BottomNav onMenuOpen={() => setMobileOpen(true)} />
    </div>
  );
}

function AdminClientView() {
  const { clientId } = useParams();
  // Access setSelected from AdminLayout via context isn't available here,
  // so we pass a no-op for onSelectClient — edit page uses navigate(-1) to go back.
  return (
    <Routes>
      <Route index           element={<ClientDashboard clientId={clientId} />} />
      <Route path="settings" element={<SettingsPage clientId={clientId} />} />
      <Route path="edit"     element={<EditClientPage clientId={clientId} />} />
      <Route path="roi"      element={<ROICalculatorPage clientId={clientId} />} />
    </Routes>
  );
}

// ── Client layout with sidebar ────────────────────────────────────────────────
function ClientLayout() {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div style={{ display: 'flex' }}>
      <MobileHeader onMenuOpen={() => setMobileOpen(true)} />
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <main
        className="main-content"
        style={{ marginLeft: 260, flex: 1, minHeight: '100vh', background: '#f0f4f9' }}
      >
        <Routes>
          <Route index           element={<ClientDashboard clientId={user?.client_id} />} />
          <Route path="posts"    element={<MyPostsPage />} />
          <Route path="settings" element={<SettingsPage clientId={user?.client_id} />} />
          <Route path="roi"      element={<ROICalculatorPage clientId={user?.client_id} />} />
          <Route path="calendar"        element={<CalendarPage clientId={user?.client_id} />} />
          <Route path="caption-writer"  element={<CaptionWriterPage />} />
          <Route path="post-ideas"      element={<PostIdeasPage />} />
          <Route path="hashtags"        element={<CaptionWriterPage defaultTab="hashtag" />} />
        </Routes>
      </main>
      <BottomNav onMenuOpen={() => setMobileOpen(true)} />
    </div>
  );
}

// ── Root redirect ─────────────────────────────────────────────────────────────
function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user)   return <Navigate to="/login" replace />;
  if (user.role === 'superadmin' || user.role === 'staff')
    return <Navigate to="/admin" replace />;
  return <Navigate to="/dashboard" replace />;
}

function Loader() {
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0f172a',
      gap: 20,
    }}>
      <img
        src={logoStatoxBig}
        alt="STATOX"
        style={{
          height: 90,
          width: 'auto',
          objectFit: 'contain',
          animation: 'pulse-dot 1.8s ease-in-out infinite',
          filter: 'brightness(0) invert(1)',
        }}
        onError={e => {
          e.target.style.display = 'none';
          e.target.nextSibling.style.display = 'block';
        }}
      />
      {/* Fallback */}
      <div style={{ display: 'none', color: '#00CCF5', fontSize: 28, fontWeight: 900, letterSpacing: '0.1em' }}>
        STATOX
      </div>
      <div style={{
        fontSize: 12,
        color: '#334155',
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
      <AuthProvider>
        <Routes>
          <Route path="/"       element={<RootRedirect />} />
          <Route path="/login"         element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/report/:token" element={<PublicReportPage />} />

          <Route path="/admin/*" element={
            <Protected roles={['superadmin','staff']}>
              <AdminLayout />
            </Protected>
          } />

          <Route path="/dashboard/*" element={
            <Protected roles={['client']}>
              <ClientLayout />
            </Protected>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
