import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CreditCard,
  FileText,
  FolderSync,
  Hash,
  KeyRound,
  LayoutDashboard,
  Lightbulb,
  LineChart,
  LogOut,
  Settings,
  Sparkles,
  TrendingUp,
  Users,
  Wand2,
} from 'lucide-react';
import { alertsAPI } from '../../services/api';

function getDisplayName(user, isAdmin) {
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;
  if (isAdmin) return user?.email || 'Admin User';
  return user?.email || 'User';
}

function getInitials(label) {
  const parts = (label || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function ItemIcon({ icon: Icon, active, danger = false }) {
  return (
    <span style={{
      ...styles.itemIcon,
      background: active
        ? 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)'
        : danger
          ? '#fef2f2'
          : '#eef2ff',
      color: active ? '#fff' : danger ? '#dc2626' : '#335cff',
    }}>
      <Icon size={14} strokeWidth={2.2} />
    </span>
  );
}

function SectionTitle({ children }) {
  return <div style={styles.sectionTitle}>{children}</div>;
}

function isPathActive(pathname, to, end) {
  if (end) {
    return pathname === to;
  }
  return pathname === to || pathname.startsWith(`${to}/`);
}

function NavItem({ to, icon, label, pathname, end = false, badge, disabled = false, danger = false }) {
  if (disabled) {
    return (
      <div style={{ ...styles.navRow, ...styles.navRowDisabled }}>
        <div style={styles.navMain}>
          <ItemIcon icon={icon} active={false} danger={danger} />
          <span>{label}</span>
        </div>
        {badge ? <span style={{ ...styles.badge, ...styles.badgeAlert }}>{badge}</span> : null}
      </div>
    );
  }

  const isActive = isPathActive(pathname, to, end);

  return (
    <NavLink to={to} end={end} style={navItemStyle(isActive)}>
      <>
        <div style={styles.navMain}>
          <ItemIcon icon={icon} active={isActive} danger={danger} />
          <span>{label}</span>
        </div>
        {badge ? <span style={{ ...styles.badge, ...styles.badgeAlert }}>{badge}</span> : null}
      </>
    </NavLink>
  );
}

export default function Sidebar({ clients = [], selectedClient, onSelectClient }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = user?.role === 'superadmin' || user?.role === 'staff';
  const [clientsOpen, setClientsOpen] = useState(true);
  const [alertCount, setAlertCount] = useState(0);

  // Fetch unread alert count for admins
  useEffect(() => {
    if (!isAdmin) return;
    alertsAPI.list({ is_read: false, page_size: 1 })
      .then(res => {
        const count = res.data?.count ?? (Array.isArray(res.data) ? res.data.length : 0);
        setAlertCount(count);
      })
      .catch(() => {});
  }, [isAdmin]);

  const displayName = useMemo(() => getDisplayName(user, isAdmin), [user, isAdmin]);
  const initials = useMemo(
    () => getInitials(isAdmin ? displayName : (selectedClient?.company || displayName)),
    [displayName, isAdmin, selectedClient]
  );
  const roleLabel = isAdmin
    ? (user?.role === 'superadmin' ? 'Super Admin' : 'Staff')
    : 'User';

  const activeClientId = useMemo(() => {
    const match = location.pathname.match(/\/admin\/client\/(\d+)/);
    return match ? Number(match[1]) : selectedClient?.id || null;
  }, [location.pathname, selectedClient]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSelectClient = (client) => {
    onSelectClient && onSelectClient(client);
    navigate(`/admin/client/${client.id}`);
  };

  return (
    <aside style={styles.sidebar}>
      {/* Brand */}
      <div style={styles.brandCard}>
        <div style={styles.brandMark}>
          <BarChart3 size={18} strokeWidth={2.2} />
        </div>
        <div>
          <div style={styles.brandName}>SocialStats</div>
          <div style={styles.brandSub}>Agency Platform</div>
        </div>
      </div>

      <div style={styles.body}>
        {isAdmin ? (
          <>
            {/* ── Overview ───────────────────────────────── */}
            <SectionTitle>Overview</SectionTitle>
            <NavItem to="/admin" end pathname={location.pathname} icon={LayoutDashboard} label="Dashboard" />
            <NavItem to="/admin/analytics" pathname={location.pathname} icon={LineChart} label="Analytics" />

            {/* ── Management ─────────────────────────────── */}
            <SectionTitle>Management</SectionTitle>
            <NavItem to="/admin/calendar"   pathname={location.pathname} icon={CalendarDays} label="Content Calendar" />
            <NavItem
              to="/admin/alerts"
              pathname={location.pathname}
              icon={AlertCircle}
              label="Alerts"
              badge={alertCount > 0 ? alertCount : null}
            />
            <NavItem to="/admin/reports"    pathname={location.pathname} icon={FileText}     label="Reports" />
            <NavItem to="/admin/roi"        pathname={location.pathname} icon={TrendingUp}   label="ROI Calculator" />
            <NavItem to="/admin/synclogs"      pathname={location.pathname} icon={FolderSync}   label="Sync Logs" />
            <NavItem to="/admin/caption-writer" pathname={location.pathname} icon={Wand2}      label="Caption Writer" />
            <NavItem to="/admin/post-ideas"     pathname={location.pathname} icon={Lightbulb}  label="Post Ideas" />
            {/* <NavItem to="/admin/hashtags"        pathname={location.pathname} icon={Hash}       label="Hashtag Research" /> */}

            {/* ── Users ──────────────────────────────────── */}
            <SectionTitle>Users</SectionTitle>
            <NavItem to="/admin/clients" pathname={location.pathname} icon={Users} label="Users" />
            <button
              type="button"
              onClick={() => setClientsOpen((open) => !open)}
              style={styles.clientToggle}
            >
              <span style={styles.clientToggleLabel}>
                {clientsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span>{clients.length ? `${clients.length} Active Users` : 'No Users Yet'}</span>
              </span>
            </button>

            {clientsOpen && (
              <div style={styles.clientList}>
                {clients.map((client) => {
                  const isSelected = activeClientId === client.id;
                  return (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => handleSelectClient(client)}
                      style={{
                        ...styles.clientItem,
                        ...(isSelected ? styles.clientItemActive : null),
                      }}
                    >
                      <span style={{
                        ...styles.clientBullet,
                        background: isSelected ? '#2563eb' : '#cbd5e1',
                      }} />
                      <span style={styles.clientName}>{client.company}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Settings ───────────────────────────────── */}
            <SectionTitle>Settings</SectionTitle>
            <NavItem to="/admin/settings" pathname={location.pathname} icon={Settings}    label="Settings" />
            <NavItem to="/admin/billing"  pathname={location.pathname} icon={CreditCard}  label="Billing" />
            {user?.role === 'superadmin' && (
              <NavItem to="/admin/management" pathname={location.pathname} icon={KeyRound} label="Access Management" />
            )}
          </>
        ) : (
          <>
            {/* ── Client: My Account ─────────────────────── */}
            <SectionTitle>My Account</SectionTitle>
            <NavItem to="/dashboard"          end pathname={location.pathname} icon={LayoutDashboard} label="Dashboard" />
            <NavItem to="/dashboard/posts"    end pathname={location.pathname} icon={FileText}        label="My Posts" />
            <NavItem to="/dashboard/calendar" end pathname={location.pathname} icon={CalendarDays}    label="Content Calendar" />
            <NavItem to="/dashboard/roi"      end pathname={location.pathname} icon={TrendingUp}      label="ROI Calculator" />

            {/* ── Client: Tools ──────────────────────────── */}
            <SectionTitle>Tools</SectionTitle>
            <NavItem to="/dashboard/caption-writer" end pathname={location.pathname} icon={Wand2}      label="Caption Writer" />
            <NavItem to="/dashboard/post-ideas"     end pathname={location.pathname} icon={Lightbulb}  label="Post Ideas" />
            <NavItem to="/dashboard/hashtags"        end pathname={location.pathname} icon={Hash}       label="Hashtag Research" />

            {/* ── Client: Settings ───────────────────────── */}
            <SectionTitle>Settings</SectionTitle>
            <NavItem to="/dashboard/settings" end pathname={location.pathname} icon={Sparkles} label="Connect Accounts" />
          </>
        )}
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <div style={styles.userCard}>
          <div style={styles.avatar}>{initials}</div>
          <div style={styles.userMeta}>
            <div style={styles.userName}>{isAdmin ? displayName : (selectedClient?.company || displayName)}</div>
            <div style={styles.roleBadge}>{roleLabel}</div>
          </div>
        </div>

        <button type="button" onClick={handleLogout} style={styles.logoutBtn}>
          <LogOut size={15} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

function navItemStyle(isActive) {
  return {
    ...styles.navRow,
    ...(isActive ? styles.navRowActive : null),
  };
}

const styles = {
  sidebar: {
    width: 264,
    height: '100vh',
    position: 'fixed',
    left: 0,
    top: 0,
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
    borderRight: '1px solid #dbe5f3',
    boxShadow: '12px 0 32px rgba(15, 23, 42, 0.06)',
  },
  brandCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '22px 20px 18px',
    borderBottom: '1px solid #e2e8f0',
  },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: 13,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    background: 'linear-gradient(180deg, #4f8cff 0%, #2563eb 100%)',
    boxShadow: '0 10px 20px rgba(37, 99, 235, 0.28)',
  },
  brandName: {
    fontSize: 18,
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: '-0.02em',
  },
  brandSub: {
    marginTop: 2,
    fontSize: 12,
    color: '#64748b',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '18px 14px 10px',
  },
  sectionTitle: {
    padding: '12px 8px 8px',
    fontSize: 11,
    fontWeight: 800,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
  },
  navRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 6,
    padding: '10px 12px',
    borderRadius: 12,
    color: '#1e293b',
    textDecoration: 'none',
    borderLeft: '4px solid transparent',
    transition: 'all 0.18s ease',
  },
  navRowActive: {
    background: '#eff6ff',
    borderLeftColor: '#2563eb',
    boxShadow: 'inset 0 0 0 1px #dbeafe',
    color: '#0f172a',
    fontWeight: 700,
  },
  navRowDisabled: {
    opacity: 0.58,
    cursor: 'default',
  },
  navMain: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
    fontSize: 14,
    fontWeight: 600,
  },
  itemIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  badge: {
    minWidth: 22,
    height: 22,
    padding: '0 7px',
    borderRadius: 999,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 800,
  },
  badgeAlert: {
    background: '#fee2e2',
    color: '#dc2626',
  },
  clientToggle: {
    width: '100%',
    marginTop: 2,
    marginBottom: 8,
    padding: '9px 10px',
    border: 'none',
    borderRadius: 12,
    background: '#f8fafc',
    color: '#475569',
    cursor: 'pointer',
    textAlign: 'left',
  },
  clientToggleLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    fontWeight: 700,
  },
  clientList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginBottom: 8,
  },
  clientItem: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    border: 'none',
    background: 'transparent',
    borderRadius: 12,
    padding: '10px 12px',
    color: '#334155',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.18s ease',
  },
  clientItemActive: {
    background: '#eff6ff',
    boxShadow: 'inset 0 0 0 1px #dbeafe',
    color: '#0f172a',
    fontWeight: 700,
  },
  clientBullet: {
    width: 9,
    height: 9,
    borderRadius: '50%',
    flexShrink: 0,
  },
  clientName: {
    fontSize: 14,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  footer: {
    borderTop: '1px solid #e2e8f0',
    padding: '16px 14px 18px',
    background: '#ffffff',
  },
  userCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
    padding: '2px 2px 0',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(180deg, #dbeafe 0%, #bfdbfe 100%)',
    color: '#1d4ed8',
    fontSize: 14,
    fontWeight: 800,
    flexShrink: 0,
  },
  userMeta: {
    minWidth: 0,
  },
  userName: {
    fontSize: 14,
    fontWeight: 700,
    color: '#0f172a',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  roleBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    marginTop: 5,
    padding: '4px 9px',
    borderRadius: 999,
    background: '#f3e8ff',
    color: '#7c3aed',
    fontSize: 11,
    fontWeight: 800,
  },
  logoutBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    border: '1px solid #dbe5f3',
    borderRadius: 12,
    background: '#fff',
    color: '#334155',
    fontSize: 13,
    fontWeight: 700,
    padding: '10px 14px',
    cursor: 'pointer',
  },
};
