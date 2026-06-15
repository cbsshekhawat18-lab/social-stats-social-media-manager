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

// Reuse the WhatsApp pages built earlier. They already enforce tenant
// isolation via `whatsappAPI` + role-aware viewsets, and they match the
// "messaging module" content 1:1.
const MessagingDashboard   = lazy(() => import('../pages/WhatsAppDashboard'));
const InboxPage            = lazy(() => import('../pages/WhatsAppInboxPage'));
const CampaignsPage        = lazy(() => import('../pages/WhatsAppCampaignsPage'));
const TemplatesPage        = lazy(() => import('../pages/WhatsAppTemplatesPage'));
const ContactsPage         = lazy(() => import('../pages/WhatsAppContactsPage'));
const MessagingAccountPage = lazy(() => import('../pages/WhatsAppSettingsPage'));

const ListsPage            = lazy(() => import('../pages/messaging/ListsPage'));
const CampaignDetailPage   = lazy(() => import('../pages/messaging/CampaignDetailPage'));

function Fallback() {
  return (
    <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
      <div className="skeleton-card" style={{ width: '100%', maxWidth: 600, height: 120 }} />
    </div>
  );
}

export default function MessagingModule() {
  return (
    <Suspense fallback={<Fallback />}>
      <Routes>
        <Route index                element={<MessagingDashboard />} />
        <Route path="inbox"         element={<InboxPage />} />
        <Route path="campaigns"     element={<CampaignsPage />} />
        <Route path="campaigns/:id" element={<CampaignDetailPage />} />
        <Route path="templates"     element={<TemplatesPage />} />
        <Route path="contacts"      element={<ContactsPage />} />
        <Route path="lists"         element={<ListsPage />} />
        <Route path="account"       element={<MessagingAccountPage />} />
        <Route path="*"             element={<Navigate to="" replace />} />
      </Routes>
    </Suspense>
  );
}
