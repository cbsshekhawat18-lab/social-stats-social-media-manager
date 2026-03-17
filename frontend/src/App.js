import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useClients } from './hooks/useData';
import { useState } from 'react';

import Sidebar           from './components/layout/Sidebar';
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

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar clients={clients} selectedClient={selected} onSelectClient={setSelected} />
      <main style={{ marginLeft: 264, flex: 1, minHeight: '100vh', background: '#f8fafc' }}>
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
  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: 264, flex: 1, minHeight: '100vh', background: '#f8fafc' }}>
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
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f8fafc', fontSize: 18, color: '#94a3b8',
    }}>
      Loading…
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
