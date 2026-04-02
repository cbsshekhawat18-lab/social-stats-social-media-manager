import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
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
import { StatoxLogoHorizontal, StatoxMark } from '../ui/StatoxLogo';

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

// Deterministic hue from a string for avatar gradients
function stringToHue(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % 360;
}

function ItemIcon({ icon: Icon, active, danger = false }) {
  return (
    <span style={{
      ...styles.itemIcon,
      background: active
        ? 'linear-gradient(135deg, #00CCF5 0%, #00A8D8 100%)'
        : danger
          ? '#fef2f2'
          : '#f1f5f9',
      color: active ? '#fff' : danger ? '#dc2626' : '#64748b',
      boxShadow: active ? '0 2px 8px rgba(0,204,245,0.35)' : 'none',
    }}>
      <Icon size={14} strokeWidth={2.2} />
    </span>
  );
}

function SectionTitle({ children }) {
  return <div style={styles.sectionTitle}>{children}</div>;
}

function isPathActive(pathname, to, end) {
  if (end) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

function NavItem({ to, icon, label, pathname, end = false, badge, disabled = false, danger = false }) {
  if (disabled) {
    return (
      <div style={{ ...styles.navRow, opacity: 0.4, cursor: 'default' }}>
        <div style={styles.navMain}>
          <ItemIcon icon={icon} active={false} danger={danger} />
          <span>{label}</span>
        </div>
        {badge ? <span style={styles.badge}>{badge}</span> : null}
      </div>
    );
  }

  const isActive = isPathActive(pathname, to, end);

  return (
    <NavLink to={to} end={end} style={navItemStyle(isActive)}>
      <>
        <div style={styles.navMain}>
          <ItemIcon icon={icon} active={isActive} danger={danger} />
          <span style={{ color: isActive ? '#006E88' : '#475569' }}>{label}</span>
        </div>
        {badge ? <span style={styles.badge}>{badge}</span> : null}
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

  const avatarHue = useMemo(() => stringToHue(displayName), [displayName]);

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
      {/* ── Brand ───────────────────────────────────────────────────────── */}
      <div style={styles.brandCard}>
        <StatoxLogoHorizontal height={36} />
      </div>

      {/* ── Navigation body ──────────────────────────────────────────────── */}
      <div style={styles.body} className="sidebar-scroll">
        {isAdmin ? (
          <>
            <SectionTitle>Overview</SectionTitle>
            <NavItem to="/admin" end pathname={location.pathname} icon={LayoutDashboard} label="Dashboard" />
            <NavItem to="/admin/analytics" pathname={location.pathname} icon={LineChart} label="Analytics" />

            <SectionTitle>Management</SectionTitle>
            <NavItem to="/admin/calendar"       pathname={location.pathname} icon={CalendarDays} label="Content Calendar" />
            <NavItem
              to="/admin/alerts"
              pathname={location.pathname}
              icon={AlertCircle}
              label="Alerts"
              badge={alertCount > 0 ? alertCount : null}
            />
            <NavItem to="/admin/reports"        pathname={location.pathname} icon={FileText}     label="Reports" />
            <NavItem to="/admin/roi"            pathname={location.pathname} icon={TrendingUp}   label="ROI Calculator" />
            <NavItem to="/admin/synclogs"       pathname={location.pathname} icon={FolderSync}   label="Sync Logs" />

            <SectionTitle>AI Tools</SectionTitle>
            <NavItem to="/admin/caption-writer" pathname={location.pathname} icon={Wand2}        label="Caption Writer" />
            <NavItem to="/admin/post-ideas"     pathname={location.pathname} icon={Lightbulb}    label="Post Ideas" />

            <SectionTitle>Users</SectionTitle>
            <NavItem to="/admin/clients" pathname={location.pathname} icon={Users} label="Users" />

            <button
              type="button"
              onClick={() => setClientsOpen((open) => !open)}
              style={styles.clientToggle}
            >
              <span style={styles.clientToggleLabel}>
                {clientsOpen ? <ChevronDown size={13} color="#94a3b8" /> : <ChevronRight size={13} color="#94a3b8" />}
                <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600 }}>
                  {clients.length ? `${clients.length} Active Users` : 'No Users Yet'}
                </span>
              </span>
            </button>

            {clientsOpen && (
              <div style={styles.clientList}>
                {clients.map((client) => {
                  const isSelected = activeClientId === client.id;
                  const hue = stringToHue(client.company || '');
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
                        ...styles.clientAvatar,
                        background: `linear-gradient(135deg, hsl(${hue},70%,50%) 0%, hsl(${(hue+40)%360},70%,45%) 100%)`,
                      }}>
                        {(client.company || '?')[0].toUpperCase()}
                      </span>
                      <span style={{
                        ...styles.clientName,
                        color: isSelected ? '#1e40af' : '#475569',
                      }}>
                        {client.company}
                      </span>
                      {isSelected && (
                        <span style={styles.clientActiveDot} />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <SectionTitle>Settings</SectionTitle>
            <NavItem to="/admin/settings"    pathname={location.pathname} icon={Settings}   label="Settings" />
            <NavItem to="/admin/billing"     pathname={location.pathname} icon={CreditCard}  label="Billing" />
            {user?.role === 'superadmin' && (
              <NavItem to="/admin/management" pathname={location.pathname} icon={KeyRound} label="Access Management" />
            )}
          </>
        ) : (
          <>
            <SectionTitle>My Account</SectionTitle>
            <NavItem to="/dashboard"          end pathname={location.pathname} icon={LayoutDashboard} label="Dashboard" />
            <NavItem to="/dashboard/posts"    end pathname={location.pathname} icon={FileText}        label="My Posts" />
            <NavItem to="/dashboard/calendar" end pathname={location.pathname} icon={CalendarDays}    label="Content Calendar" />
            <NavItem to="/dashboard/roi"      end pathname={location.pathname} icon={TrendingUp}      label="ROI Calculator" />

            <SectionTitle>AI Tools</SectionTitle>
            <NavItem to="/dashboard/caption-writer" end pathname={location.pathname} icon={Wand2}     label="Caption Writer" />
            <NavItem to="/dashboard/post-ideas"     end pathname={location.pathname} icon={Lightbulb} label="Post Ideas" />

            <SectionTitle>Settings</SectionTitle>
            <NavItem to="/dashboard/settings" end pathname={location.pathname} icon={Sparkles} label="Connect Accounts" />
          </>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div style={styles.footer}>
        <div style={styles.userCard}>
          <div style={{
            ...styles.avatar,
            background: `linear-gradient(135deg, hsl(${avatarHue},65%,52%) 0%, hsl(${(avatarHue+50)%360},65%,45%) 100%)`,
          }}>
            {initials}
          </div>
          <div style={styles.userMeta}>
            <div style={styles.userName}>
              {isAdmin ? displayName : (selectedClient?.company || displayName)}
            </div>
            <div style={styles.roleBadge}>{roleLabel}</div>
          </div>
        </div>

        <button type="button" onClick={handleLogout} style={styles.logoutBtn}>
          <LogOut size={14} />
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
    width: 260,
    height: '100vh',
    position: 'fixed',
    left: 0,
    top: 0,
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    background: '#ffffff',
    borderRight: '1px solid #e2e8f0',
    boxShadow: '4px 0 20px rgba(15,23,42,0.06)',
  },
  brandCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '20px 18px 16px',
    borderBottom: '1px solid #f1f5f9',
  },
  brandName: {
    fontSize: 16,
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: '-0.025em',
  },
  brandSub: {
    marginTop: 1,
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: 500,
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '14px 10px 8px',
  },
  sectionTitle: {
    padding: '14px 10px 6px',
    fontSize: 10,
    fontWeight: 700,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
  },
  navRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 2,
    padding: '9px 10px',
    borderRadius: 10,
    color: '#475569',
    textDecoration: 'none',
    fontSize: 13.5,
    fontWeight: 500,
    transition: 'all 0.15s ease',
    borderLeft: '2px solid transparent',
  },
  navRowActive: {
    background: '#E0F9FF',
    borderLeftColor: '#00B8DA',
    color: '#006E88',
    fontWeight: 700,
    boxShadow: 'inset 0 0 0 1px #BAF0FC',
  },
  navMain: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
    fontSize: 13.5,
    fontWeight: 'inherit',
  },
  itemIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'all 0.15s ease',
  },
  badge: {
    minWidth: 20,
    height: 20,
    padding: '0 6px',
    borderRadius: 999,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
    fontWeight: 800,
    background: '#fee2e2',
    color: '#dc2626',
    border: '1px solid #fecaca',
  },
  clientToggle: {
    width: '100%',
    marginTop: 6,
    marginBottom: 4,
    padding: '7px 10px',
    border: 'none',
    borderRadius: 8,
    background: 'transparent',
    cursor: 'pointer',
    textAlign: 'left',
  },
  clientToggleLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
  },
  clientList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    marginBottom: 8,
    paddingLeft: 4,
  },
  clientItem: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    border: 'none',
    background: 'transparent',
    borderRadius: 9,
    padding: '8px 10px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s ease',
  },
  clientItemActive: {
    background: '#eff6ff',
    boxShadow: 'inset 0 0 0 1px #dbeafe',
  },
  clientAvatar: {
    width: 22,
    height: 22,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: 11,
    fontWeight: 800,
    color: '#fff',
  },
  clientName: {
    fontSize: 13,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    flex: 1,
  },
  clientActiveDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#00CCF5',
    flexShrink: 0,
    boxShadow: '0 0 6px rgba(0,204,245,0.6)',
  },
  brandMarkFallback: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0D0D0D',
    flexShrink: 0,
  },
  footer: {
    borderTop: '1px solid #f1f5f9',
    padding: '14px 12px 16px',
    background: '#fafafa',
  },
  userCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 11,
    marginBottom: 12,
    padding: '2px 2px 0',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 800,
    flexShrink: 0,
    color: '#fff',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  },
  userMeta: {
    minWidth: 0,
  },
  userName: {
    fontSize: 13,
    fontWeight: 700,
    color: '#0f172a',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  roleBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    marginTop: 4,
    padding: '2px 8px',
    borderRadius: 999,
    background: '#f3e8ff',
    color: '#7c3aed',
    fontSize: 10,
    fontWeight: 700,
    border: '1px solid #e9d5ff',
  },
  logoutBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    background: '#fff',
    color: '#64748b',
    fontSize: 13,
    fontWeight: 600,
    padding: '9px 14px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
};
