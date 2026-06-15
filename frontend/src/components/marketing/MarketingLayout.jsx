/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Menu, X, ChevronDown,
  Github, Linkedin, Twitter, Youtube,
  BarChart3, PenSquare, Inbox, MessageCircle, Bot, Sparkles, FileText,
  Zap, Building2, Users, Star, Calendar, MessagesSquare,
  Briefcase, Stethoscope, UtensilsCrossed, Palette, ShoppingBag, GraduationCap,
} from 'lucide-react';

import Logo from '../ui/Logo';
import Button from '../ui/Button';
import ThemeToggle from '../ui/ThemeToggle';
import SkipLink from '../ui/SkipLink';
import { prefetchRoute } from '../../utils/prefetchRoute';

/**
 * MarketingLayout — public site shell. Wraps every public/marketing page.
 *
 *  ┌─────────────────────────────────────────────────────────────┐
 *  │ Top nav (transparent on hero, solid + blur on scroll)       │
 *  │ + Product / Solutions mega-menus                            │
 *  ├─────────────────────────────────────────────────────────────┤
 *  │  page content                                               │
 *  ├─────────────────────────────────────────────────────────────┤
 *  │ 6-column footer (Product / Solutions / Resources / Company  │
 *  │                   / Legal + brand)                          │
 *  └─────────────────────────────────────────────────────────────┘
 */
export default function MarketingLayout({ children }) {
  return (
    <div style={{ background: 'var(--surface-page)', color: 'var(--text-primary)' }}>
      <SkipLink targetId="marketing-main" />
      <MarketingNav />
      <main id="marketing-main" tabIndex={-1} style={{ outline: 'none' }}>
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Nav data
// ─────────────────────────────────────────────────────────────────────────────
const PRODUCT_MENU = [
  { label: 'Analytics',     to: '/product/analytics',         icon: BarChart3,    desc: 'Cross-platform metrics' },
  { label: 'Composer',      to: '/product/composer',          icon: PenSquare,    desc: 'Write once, publish 5x' },
  { label: 'Inbox',         to: '/product/inbox',             icon: Inbox,        desc: 'Every conversation, one place' },
  { label: 'WhatsApp',      to: '/product/whatsapp',          icon: MessageCircle,desc: 'Campaigns + two-way chat' },
  { label: 'Bot Builder',   to: '/product/bot-builder',       icon: Bot,          desc: 'Visual CTWA flow editor' },
  { label: 'AI Studio',     to: '/product/ai',                icon: Sparkles,     desc: 'Social Stats in every corner' },
  { label: 'AI Assistant',  to: '/product/ai-assistant',      icon: MessagesSquare, desc: 'Cmd+J — talk to your data' },
  { label: 'Reports',       to: '/product/reports',           icon: FileText,     desc: 'Reports that write themselves' },
  { label: 'Automations',   to: '/product/automations',       icon: Zap,          desc: 'IF this, do that' },
  { label: 'Marketplace',   to: '/product/marketplace-product', icon: Star,       desc: 'Two-sided marketplace' },
];

const SOLUTIONS_BY_ROLE = [
  { label: 'For Agencies',   to: '/solutions/agencies',   icon: Briefcase, desc: 'Manage 100+ clients' },
  { label: 'For Businesses', to: '/solutions/businesses', icon: Building2, desc: 'Take back control' },
  { label: 'For Creators',   to: '/solutions/creators',   icon: Palette,   desc: 'Track your creator economy' },
];

const SOLUTIONS_BY_INDUSTRY = [
  { label: 'Real Estate', to: '/solutions/real-estate', icon: Building2,        desc: 'Sell more properties' },
  { label: 'Healthcare',  to: '/solutions/clinics',     icon: Stethoscope,      desc: 'Engage patients' },
  { label: 'Restaurants', to: '/solutions/restaurants', icon: UtensilsCrossed,  desc: 'Fill more tables' },
  { label: 'E-commerce',  to: '/solutions/ecommerce',   icon: ShoppingBag,      desc: 'Drive sales from social' },
  { label: 'Education',   to: '/solutions/education',   icon: GraduationCap,    desc: 'Reach more students' },
];

const SIMPLE_LINKS = [
  { label: 'Customers',   to: '/customers' },
  { label: 'Resources',   to: null,
    menu: { single: [
      { label: 'Blog',          to: '/blog',         desc: 'Marketing tips + product updates' },
      { label: 'Help Center',   to: '/help',         desc: 'Guides + how-tos' },
      { label: 'Changelog',     to: '/changelog',    desc: 'What shipped this week' },
      { label: 'Status',        to: '/status',       desc: 'System uptime' },
      { label: 'Integrations',  to: '/integrations', desc: 'Connect your stack' },
      { label: 'Contact',       to: '/contact',      desc: 'Sales + support' },
    ]},
  },
  { label: 'About',       to: '/about' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Nav
// ─────────────────────────────────────────────────────────────────────────────
function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);  // 'product' | 'solutions' | 'resources'
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false);
  const location = useLocation();

  // Grace period for the mega-menu hover. Without it the menu closes
  // instantly when the pointer briefly leaves the trigger to reach the
  // panel — the cursor's natural diagonal path crosses non-menu space.
  const closeTimerRef = useRef(null);
  const cancelClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimerRef.current = setTimeout(() => setOpenMenu(null), 140);
  };
  useEffect(() => () => cancelClose(), []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Close mobile + mega-menu on navigation
  useEffect(() => {
    setMobileOpen(false);
    setOpenMenu(null);
  }, [location.pathname]);

  // Close mega-menu on Escape
  useEffect(() => {
    if (!openMenu) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpenMenu(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openMenu]);

  // Lock body scroll when mobile menu open
  useEffect(() => {
    if (mobileOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [mobileOpen]);

  return (
    <header
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        zIndex: 'var(--z-sticky)',
        background: scrolled || openMenu ? 'var(--surface-overlay)' : 'transparent',
        backdropFilter: scrolled || openMenu ? 'blur(14px) saturate(180%)' : 'none',
        WebkitBackdropFilter: scrolled || openMenu ? 'blur(14px) saturate(180%)' : 'none',
        borderBottom: scrolled || openMenu ? '1px solid var(--border-subtle)' : '1px solid transparent',
        transition: 'background var(--transition-default), border-color var(--transition-default), backdrop-filter var(--transition-default)',
      }}
      onMouseLeave={scheduleClose}
      onMouseEnter={cancelClose}
    >
      <div
        style={{
          maxWidth: 'var(--container-2xl)',
          margin: '0 auto',
          padding: isMobile ? '12px 20px' : '14px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
        }}
      >
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center' }} aria-label="Social Stats home">
          <Logo variant="horizontal" height={isMobile ? 26 : 30} />
        </Link>

        {/* Desktop nav */}
        {!isMobile && (
          <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <MegaTrigger label="Product"
                         active={openMenu === 'product'}
                         onEnter={() => { cancelClose(); setOpenMenu('product'); }} />
            <MegaTrigger label="Solutions"
                         active={openMenu === 'solutions'}
                         onEnter={() => { cancelClose(); setOpenMenu('solutions'); }} />
            {SIMPLE_LINKS.map((l) => l.to ? (
              <NavLink key={l.label} to={l.to}
                       active={location.pathname === l.to}
                       onMouseEnter={() => { cancelClose(); setOpenMenu(null); }}>
                {l.label}
              </NavLink>
            ) : (
              <MegaTrigger key={l.label} label={l.label}
                           active={openMenu === l.label.toLowerCase()}
                           onEnter={() => { cancelClose(); setOpenMenu(l.label.toLowerCase()); }} />
            ))}
          </nav>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ThemeToggle size="sm" />
          {!isMobile && (
            <>
              <Button as={Link} to="/login" variant="ghost" size="sm">Sign in</Button>
              <Button as={Link} to="/signup" size="sm" variant="primary">Get started free</Button>
            </>
          )}
          {isMobile && (
            <button
              type="button"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
              style={{
                width: 36, height: 36,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--surface-card)',
                color: 'var(--text-secondary)',
                cursor: 'pointer', padding: 0,
              }}
            >
              {mobileOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          )}
        </div>
      </div>

      {/* Mega-menu panels (desktop only) */}
      {!isMobile && openMenu === 'product' && (
        <MegaPanel onMouseEnter={cancelClose} onMouseLeave={scheduleClose}>
          <MegaGrid columns={2}>
            {PRODUCT_MENU.map((item) => (
              <MegaItem key={item.to} {...item} />
            ))}
          </MegaGrid>
        </MegaPanel>
      )}
      {!isMobile && openMenu === 'solutions' && (
        <MegaPanel onMouseEnter={cancelClose} onMouseLeave={scheduleClose}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
            <div>
              <MegaHeader>By role</MegaHeader>
              <MegaGrid columns={1}>
                {SOLUTIONS_BY_ROLE.map((item) => <MegaItem key={item.to} {...item} />)}
              </MegaGrid>
            </div>
            <div>
              <MegaHeader>By industry</MegaHeader>
              <MegaGrid columns={1}>
                {SOLUTIONS_BY_INDUSTRY.map((item) => <MegaItem key={item.to} {...item} />)}
              </MegaGrid>
            </div>
          </div>
        </MegaPanel>
      )}
      {!isMobile && openMenu === 'resources' && (
        <MegaPanel onMouseEnter={cancelClose} onMouseLeave={scheduleClose}>
          <MegaGrid columns={2}>
            {SIMPLE_LINKS.find((l) => l.label === 'Resources').menu.single.map((item) => (
              <MegaItem key={item.to} {...item} />
            ))}
          </MegaGrid>
        </MegaPanel>
      )}

      {/* Mobile drawer */}
      {isMobile && mobileOpen && (
        <MobileDrawer location={location} onClose={() => setMobileOpen(false)} />
      )}
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Nav primitives
// ─────────────────────────────────────────────────────────────────────────────
function NavLink({ to, active, children, onMouseEnter }) {
  return (
    <Link
      to={to}
      onMouseEnter={(e) => { prefetchRoute(to); onMouseEnter?.(e); }}
      onTouchStart={() => prefetchRoute(to)}
      onFocus={() => prefetchRoute(to)}
      style={{
        padding: '8px 12px',
        fontSize: 14, fontWeight: 500,
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        textDecoration: 'none',
        borderRadius: 'var(--radius-md)',
        transition: 'var(--transition-fast)',
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.color = 'var(--text-primary)';
        e.currentTarget.style.background = 'var(--surface-hover)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.color = active ? 'var(--text-primary)' : 'var(--text-secondary)';
        e.currentTarget.style.background = 'transparent';
      }}
    >
      {children}
    </Link>
  );
}

function MegaTrigger({ label, active, onEnter }) {
  return (
    <button
      type="button"
      onMouseEnter={onEnter}
      onFocus={onEnter}
      onClick={onEnter}
      aria-expanded={active}
      aria-haspopup="true"
      style={{
        padding: '8px 12px',
        fontSize: 14, fontWeight: 500,
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        background: active ? 'var(--surface-hover)' : 'transparent',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 4,
        transition: 'var(--transition-fast)',
        fontFamily: 'inherit',
      }}
    >
      {label}
      <ChevronDown size={14} style={{
        transform: active ? 'rotate(180deg)' : 'rotate(0)',
        transition: 'transform 160ms var(--ease-out)',
      }} />
    </button>
  );
}

function MegaPanel({ children, onMouseLeave, onMouseEnter }) {
  return (
    <div
      role="menu"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'absolute',
        top: '100%', left: 0, right: 0,
        animation: 'mkt-mega-fade 180ms var(--ease-out)',
      }}
    >
      <div
        style={{
          maxWidth: 'var(--container-2xl)',
          margin: '0 auto',
          padding: '24px 32px 32px',
        }}
      >
        {children}
      </div>
      <style>{`
        @keyframes mkt-mega-fade {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function MegaGrid({ children, columns = 2 }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      gap: 6,
    }}>
      {children}
    </div>
  );
}

function MegaHeader({ children }) {
  return (
    <h3 style={{
      margin: '0 0 12px',
      fontSize: 11, fontWeight: 600,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      color: 'var(--text-tertiary)',
    }}>{children}</h3>
  );
}

function MegaItem({ to, label, desc, icon: Icon }) {
  return (
    <Link
      to={to}
      role="menuitem"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '10px 12px',
        borderRadius: 'var(--radius-md)',
        textDecoration: 'none',
        color: 'var(--text-primary)',
        transition: 'var(--transition-fast)',
      }}
      onMouseOver={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
      onMouseOut={(e)  => { e.currentTarget.style.background = 'transparent'; }}
    >
      {Icon && (
        <span style={{
          width: 32, height: 32, flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--brand-primary-soft)',
          color: 'var(--brand-primary-hover)',
        }}>
          <Icon size={16} strokeWidth={2.2} />
        </span>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
        {desc && (
          <div style={{ marginTop: 2, fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
            {desc}
          </div>
        )}
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile drawer
// ─────────────────────────────────────────────────────────────────────────────
function MobileDrawer({ location, onClose }) {
  const [openSection, setOpenSection] = useState(null);
  const drawerRef = useRef(null);

  useEffect(() => {
    drawerRef.current?.focus();
  }, []);

  return (
    <div
      ref={drawerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Navigation"
      tabIndex={-1}
      style={{
        position: 'fixed',
        top: 60, left: 0, right: 0, bottom: 0,
        background: 'var(--surface-page)',
        zIndex: 'var(--z-overlay)',
        padding: 16,
        overflowY: 'auto',
        animation: 'mkt-drawer-slide 220ms var(--ease-out)',
      }}
    >
      <Accordion title="Product"
                 open={openSection === 'product'}
                 onToggle={() => setOpenSection((s) => s === 'product' ? null : 'product')}>
        {PRODUCT_MENU.map((item) => (
          <DrawerItem key={item.to} {...item} active={location.pathname === item.to} />
        ))}
      </Accordion>
      <Accordion title="Solutions"
                 open={openSection === 'solutions'}
                 onToggle={() => setOpenSection((s) => s === 'solutions' ? null : 'solutions')}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
                      textTransform: 'uppercase', color: 'var(--text-tertiary)',
                      padding: '8px 14px 4px' }}>By role</div>
        {SOLUTIONS_BY_ROLE.map((item) => (
          <DrawerItem key={item.to} {...item} active={location.pathname === item.to} />
        ))}
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
                      textTransform: 'uppercase', color: 'var(--text-tertiary)',
                      padding: '12px 14px 4px' }}>By industry</div>
        {SOLUTIONS_BY_INDUSTRY.map((item) => (
          <DrawerItem key={item.to} {...item} active={location.pathname === item.to} />
        ))}
      </Accordion>
      {SIMPLE_LINKS.map((l) =>
        l.to ? (
          <Link
            key={l.label}
            to={l.to}
            style={{
              display: 'block',
              padding: '14px 16px',
              fontSize: 16, fontWeight: 500,
              color: 'var(--text-primary)', textDecoration: 'none',
              borderRadius: 'var(--radius-md)',
              background: location.pathname === l.to ? 'var(--surface-hover)' : 'transparent',
            }}
          >{l.label}</Link>
        ) : (
          <Accordion key={l.label} title={l.label}
                     open={openSection === l.label.toLowerCase()}
                     onToggle={() => setOpenSection((s) => s === l.label.toLowerCase() ? null : l.label.toLowerCase())}>
            {l.menu.single.map((item) => (
              <DrawerItem key={item.to} {...item} active={location.pathname === item.to} />
            ))}
          </Accordion>
        )
      )}
      <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-subtle)',
                    display: 'grid', gap: 8 }}>
        <Button as={Link} to="/login" variant="secondary" size="lg" fullWidth>Sign in</Button>
        <Button as={Link} to="/signup" size="lg" fullWidth>Get started free</Button>
      </div>
      <style>{`
        @keyframes mkt-drawer-slide {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function Accordion({ title, open, onToggle, children }) {
  return (
    <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '14px 16px',
          fontSize: 16, fontWeight: 500,
          color: 'var(--text-primary)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontFamily: 'inherit',
        }}
      >
        {title}
        <ChevronDown size={16} style={{
          transform: open ? 'rotate(180deg)' : 'rotate(0)',
          transition: 'transform 160ms var(--ease-out)',
          color: 'var(--text-tertiary)',
        }} />
      </button>
      {open && <div style={{ padding: '4px 0 12px' }}>{children}</div>}
    </div>
  );
}

function DrawerItem({ to, label, desc, icon: Icon, active }) {
  return (
    <Link
      to={to}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '10px 16px',
        textDecoration: 'none',
        color: 'var(--text-primary)',
        background: active ? 'var(--surface-hover)' : 'transparent',
      }}
    >
      {Icon && (
        <span style={{
          width: 28, height: 28, flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--brand-primary-soft)',
          color: 'var(--brand-primary-hover)',
        }}>
          <Icon size={14} strokeWidth={2.2} />
        </span>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
        {desc && (
          <div style={{ marginTop: 1, fontSize: 12, color: 'var(--text-tertiary)' }}>{desc}</div>
        )}
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Footer — 6-column grid
// ─────────────────────────────────────────────────────────────────────────────
function MarketingFooter() {
  const year = new Date().getFullYear();

  const COLUMNS = [
    {
      title: 'Product',
      links: [
        { label: 'Analytics',     to: '/product/analytics' },
        { label: 'Composer',      to: '/product/composer' },
        { label: 'Inbox',         to: '/product/inbox' },
        { label: 'WhatsApp',      to: '/product/whatsapp' },
        { label: 'Bot Builder',   to: '/product/bot-builder' },
        { label: 'AI Studio',     to: '/product/ai' },
        { label: 'Reports',       to: '/product/reports' },
        { label: 'Automations',   to: '/product/automations' },
        { label: 'Marketplace',   to: '/product/marketplace-product' },
      ],
    },
    {
      title: 'Solutions',
      links: [
        { label: 'For Agencies',   to: '/solutions/agencies' },
        { label: 'For Businesses', to: '/solutions/businesses' },
        { label: 'Real Estate',    to: '/solutions/real-estate' },
        { label: 'Healthcare',     to: '/solutions/clinics' },
        { label: 'Restaurants',    to: '/solutions/restaurants' },
        { label: 'Creators',       to: '/solutions/creators' },
        { label: 'E-commerce',     to: '/solutions/ecommerce' },
      ],
    },
    {
      title: 'Resources',
      links: [
        { label: 'Customers',     to: '/customers' },
        { label: 'Blog',          to: '/blog' },
        { label: 'Help Center',   to: '/help' },
        { label: 'Changelog',     to: '/changelog' },
        { label: 'Status',        to: '/status' },
        { label: 'Integrations',  to: '/integrations' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About',     to: '/about' },
        { label: 'Customers', to: '/customers' },
        { label: 'Contact',   to: '/contact' },
        { label: 'Press',     to: '/about#press' },
        { label: 'Careers',   to: '/about#careers' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { label: 'Privacy',         to: '/privacy' },
        { label: 'Terms',           to: '/terms' },
        { label: 'Cookies',         to: '/cookies' },
        { label: 'GDPR',            to: '/gdpr' },
        { label: 'DPDP',            to: '/dpdp' },
        { label: 'Security',        to: '/security' },
      ],
    },
  ];

  return (
    <footer
      style={{
        marginTop: 80,
        background: 'var(--surface-card)',
        borderTop: '1px solid var(--border-subtle)',
      }}
    >
      <div
        style={{
          maxWidth: 'var(--container-2xl)',
          margin: '0 auto',
          padding: '64px 32px 32px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.6fr) repeat(5, minmax(0, 1fr))',
            gap: 40,
          }}
          className="mkt-footer-grid"
        >
          {/* Brand column */}
          <div>
            <Logo variant="horizontal" height={28} />
            <p style={{
              margin: '14px 0 16px',
              fontSize: 13, lineHeight: 1.6,
              color: 'var(--text-secondary)',
              maxWidth: 280,
            }}>
              The AI marketing OS for modern agencies. Analytics, content, conversations, and ads — for every client, in one place.
            </p>
            <div style={{ display: 'flex', gap: 6 }}>
              <SocialIconLink href="https://github.com/socialstats"            label="GitHub"   icon={Github} />
              <SocialIconLink href="https://linkedin.com/company/socialstats"  label="LinkedIn" icon={Linkedin} />
              <SocialIconLink href="https://twitter.com/socialstats"           label="Twitter"  icon={Twitter} />
              <SocialIconLink href="https://youtube.com/@socialstats"          label="YouTube"  icon={Youtube} />
            </div>
            {/* Geographic framing intentionally omitted from the global footer.
                Office and contact information lives on /contact and /dpdp. */}
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 style={{
                margin: '0 0 12px',
                fontSize: 11, fontWeight: 600,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                color: 'var(--text-tertiary)',
              }}>{col.title}</h3>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {col.links.map((l) => (
                  <li key={l.to + l.label}>
                    <Link
                      to={l.to}
                      style={{
                        fontSize: 13,
                        color: 'var(--text-secondary)',
                        textDecoration: 'none',
                        transition: 'var(--transition-fast)',
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                      onMouseOut={(e)  => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    >{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div style={{
          marginTop: 48,
          paddingTop: 24,
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center', justifyContent: 'space-between',
          gap: 16, flexWrap: 'wrap',
          fontSize: 12, color: 'var(--text-tertiary)',
        }}>
          <span>© {year} SocialStats. All rights reserved.</span>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <Link to="/status" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              color: 'var(--text-tertiary)', textDecoration: 'none',
            }}>
              <span aria-hidden style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--success)',
                boxShadow: '0 0 8px rgba(16,185,129,0.6)',
              }} />
              All systems operational
            </Link>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              color: 'var(--text-tertiary)',
            }}>
              <Sparkles size={11} /> Built with Social Stats
            </span>
          </div>
        </div>

        <style>{`
          @media (max-width: 1100px) {
            .mkt-footer-grid {
              grid-template-columns: 1fr 1fr 1fr !important;
            }
            .mkt-footer-grid > div:first-child { grid-column: 1 / -1; }
          }
          @media (max-width: 640px) {
            .mkt-footer-grid { grid-template-columns: 1fr 1fr !important; }
          }
        `}</style>
      </div>
    </footer>
  );
}

function SocialIconLink({ href, label, icon: Icon }) {
  return (
    <a
      href={href} target="_blank" rel="noopener noreferrer" aria-label={label}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 32, height: 32,
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-subtle)',
        color: 'var(--text-tertiary)',
        background: 'var(--surface-card)',
        transition: 'var(--transition-fast)',
        textDecoration: 'none',
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.color = 'var(--brand-primary-hover)';
        e.currentTarget.style.borderColor = 'var(--brand-primary-glow)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.color = 'var(--text-tertiary)';
        e.currentTarget.style.borderColor = 'var(--border-subtle)';
      }}
    >
      <Icon size={14} strokeWidth={2} />
    </a>
  );
}
