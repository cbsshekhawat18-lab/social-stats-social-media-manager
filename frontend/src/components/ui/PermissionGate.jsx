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
