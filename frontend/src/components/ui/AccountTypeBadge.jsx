/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { Briefcase, Shield, User } from 'lucide-react';

/**
 * Small pill badge that visually distinguishes the user's account type.
 * Uses brand cyan for personal/end-user accounts, purple for agency,
 * neutral for staff/superadmin. Renders nothing when type is missing or
 * 'legacy' (we don't surface that state in the UI).
 *
 * Props:
 *   type:   'end_user' | 'agency_member' | 'legacy'
 *   role:   optional — staff/superadmin override; if set takes precedence
 *   size:   'sm' (default) | 'md'
 */
export default function AccountTypeBadge({ type, role, size = 'sm' }) {
  if (role === 'superadmin' || role === 'staff') {
    return (
      <Pill size={size}
            icon={Shield}
            label={role === 'superadmin' ? 'Superadmin' : 'Staff'}
            color="var(--text-secondary)"
            background="var(--surface-sunken)"
            border="var(--border-default)" />
    );
  }
  if (type === 'agency_member') {
    return (
      <Pill size={size}
            icon={Briefcase}
            label="Agency"
            color="#7c3aed"
            background="rgba(124, 58, 237, 0.10)"
            border="rgba(124, 58, 237, 0.28)" />
    );
  }
  if (type === 'end_user') {
    return (
      <Pill size={size}
            icon={User}
            label="Personal"
            color="var(--brand-primary-hover)"
            background="var(--brand-primary-soft)"
            border="var(--brand-primary-glow)" />
    );
  }
  return null;
}

function Pill({ icon: Icon, label, color, background, border, size }) {
  const padding = size === 'md' ? '4px 10px' : '2px 8px';
  const fontSize = size === 'md' ? 12 : 11;
  const iconSize = size === 'md' ? 12 : 11;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding,
      fontSize,
      fontWeight: 600,
      lineHeight: 1.2,
      letterSpacing: 0.2,
      color,
      background,
      border: `1px solid ${border}`,
      borderRadius: 'var(--radius-pill)',
    }}>
      <Icon size={iconSize} strokeWidth={2.2} />
      {label}
    </span>
  );
}
