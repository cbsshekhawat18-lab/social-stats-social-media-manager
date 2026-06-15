/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { motion, useReducedMotion } from 'framer-motion';
import {
  BarChart3, Inbox, Calendar, Bot, Sparkles, MessageCircle,
  TrendingUp, Users, ArrowUpRight,
} from 'lucide-react';

/**
 * AnimatedDashboardMockup — pure-HTML/SVG stylised representation of the
 * Social Stats dashboard. Used as the hero centerpiece. Animates on mount + on
 * scroll (no images — never goes stale).
 *
 * Layout (top-down):
 *   Window chrome (red/yellow/green dots + URL bar)
 *   ─────────────────────────────────────────────
 *   Sidebar nav (icons) │ Topbar (search · avatar)
 *                       │ Stat cards row
 *                       │ Chart + side widget
 *                       │ Activity feed
 *
 * The chart line draws itself; stat counters tick up; the activity feed
 * has staggered fade-up entries.
 */
export default function AnimatedDashboardMockup() {
  const reduced = useReducedMotion();

  const chartPath = 'M 0 70 L 50 64 L 100 50 L 150 56 L 200 38 L 250 30 L 300 24 L 350 14 L 400 22';

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 920,
        aspectRatio: '16 / 10',
        margin: '0 auto',
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        background: 'linear-gradient(180deg, #0d1218 0%, #0a0e14 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 40px 120px rgba(0, 204, 245, 0.18), 0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      {/* Window chrome */}
      <div style={{
        height: 28, padding: '0 14px',
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <span style={dotStyle('#ff5f57')} />
        <span style={dotStyle('#febc2e')} />
        <span style={dotStyle('#28c840')} />
        <div style={{
          marginLeft: 18, padding: '2px 12px',
          fontSize: 10, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.4)',
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 'var(--radius-sm)',
        }}>app.socialstats.app/dashboard</div>
      </div>

      <div style={{ display: 'flex', height: 'calc(100% - 28px)' }}>
        {/* Sidebar */}
        <div style={{
          width: 56, padding: '14px 0',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        }}>
          {[BarChart3, Inbox, Calendar, Bot, Sparkles, MessageCircle].map((Icon, i) => (
            <SidebarBtn key={i} active={i === 0}><Icon size={14} /></SidebarBtn>
          ))}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Topbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              flex: 1, height: 28,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 'var(--radius-md)',
              padding: '0 10px',
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 11, color: 'rgba(255,255,255,0.4)',
            }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
              Search…
            </div>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'linear-gradient(135deg, #00CCF5, #8b5cf6)',
            }} />
          </div>

          {/* Stat cards row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <StatCard label="Reach" value="248K" delta="+23%" tone="cyan" delay={0.2} />
            <StatCard label="Engagement" value="14.2K" delta="+12%" tone="purple" delay={0.4} />
            <StatCard label="Leads" value="312" delta="+5x" tone="green" delay={0.6} />
          </div>

          {/* Chart + side widget */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 10, flex: 1 }}>
            {/* Chart */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 'var(--radius-md)',
              padding: 12,
              display: 'flex', flexDirection: 'column', gap: 8,
              minHeight: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Last 30 days
                </span>
                <TrendingUp size={11} color="#00CCF5" />
              </div>
              <svg viewBox="0 0 400 90" preserveAspectRatio="none" style={{ width: '100%', flex: 1 }}>
                <defs>
                  <linearGradient id="chart-line" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%"  stopColor="#00CCF5" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                  <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor="#00CCF5" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#00CCF5" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <motion.path
                  d={chartPath + ' L 400 90 L 0 90 Z'}
                  fill="url(#chart-fill)"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.2, duration: 0.6 }}
                />
                <motion.path
                  d={chartPath}
                  fill="none"
                  stroke="url(#chart-line)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: 0.8, duration: reduced ? 0 : 1.4, ease: 'easeOut' }}
                />
              </svg>
            </div>

            {/* Side widget — top channels */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 'var(--radius-md)',
              padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Top channels
              </span>
              <ChannelRow name="Instagram" pct={68} tone="#E4405F" delay={1.4} />
              <ChannelRow name="Facebook"  pct={52} tone="#1877F2" delay={1.6} />
              <ChannelRow name="WhatsApp"  pct={41} tone="#25D366" delay={1.8} />
              <ChannelRow name="YouTube"   pct={28} tone="#FF0000" delay={2.0} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function SidebarBtn({ children, active }) {
  return (
    <div style={{
      width: 30, height: 30,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 'var(--radius-sm)',
      background: active ? 'rgba(0,204,245,0.18)' : 'transparent',
      color: active ? '#00CCF5' : 'rgba(255,255,255,0.45)',
    }}>
      {children}
    </div>
  );
}

function StatCard({ label, value, delta, tone, delay }) {
  const toneColors = {
    cyan:   { bg: 'rgba(0,204,245,0.10)',  text: '#00CCF5' },
    purple: { bg: 'rgba(139,92,246,0.10)', text: '#a78bfa' },
    green:  { bg: 'rgba(16,185,129,0.10)', text: '#10b981' },
  }[tone] || { bg: 'rgba(255,255,255,0.04)', text: '#fff' };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      style={{
        padding: 12,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 'var(--radius-md)',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}
    >
      <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
      <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
      <span style={{
        fontSize: 10, fontWeight: 600,
        color: toneColors.text,
        display: 'inline-flex', alignItems: 'center', gap: 2,
      }}>
        <ArrowUpRight size={10} /> {delta}
      </span>
    </motion.div>
  );
}

function ChannelRow({ name, pct, tone, delay }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
        <span style={{ color: 'rgba(255,255,255,0.7)' }}>{name}</span>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ delay, duration: 0.7, ease: 'easeOut' }}
          style={{ height: '100%', background: tone }}
        />
      </div>
    </div>
  );
}

const dotStyle = (color) => ({
  width: 9, height: 9, borderRadius: '50%', background: color,
});
