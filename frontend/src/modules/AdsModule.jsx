/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';

const AdsComingSoon = lazy(() => import('../pages/ads/AdsComingSoon'));

function Fallback() {
  return <div style={{ padding: 40 }}><div className="skeleton-card" style={{ height: 120 }} /></div>;
}

export default function AdsModule() {
  return (
    <Suspense fallback={<Fallback />}>
      <Routes>
        <Route index   element={<AdsComingSoon />} />
        <Route path="*" element={<AdsComingSoon />} />
      </Routes>
    </Suspense>
  );
}
