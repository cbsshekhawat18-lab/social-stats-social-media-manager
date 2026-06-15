/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useAuth } from '../../hooks/useAuth';

/**
 * Renders children only if the current user has the given permission code.
 * Superadmin always passes. Optional `fallback` prop renders instead.
 *
 * Usage:
 *   <PermissionGate code="view_analytics">
 *     <AnalyticsSection />
 *   </PermissionGate>
 */
export default function PermissionGate({ code, fallback = null, children }) {
  const { can } = useAuth();
  if (!code || can(code)) return children;
  return fallback;
}
