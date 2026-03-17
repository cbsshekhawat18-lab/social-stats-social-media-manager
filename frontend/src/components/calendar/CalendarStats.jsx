import { useEffect, useRef } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { PLATFORMS } from '../../services/platforms';
import HeatmapCalendar from './HeatmapCalendar';

const PLATFORM_COLORS = Object.fromEntries(
  Object.entries(PLATFORMS).map(([k, v]) => [k, v.color])
);

const DOW_ORDER = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

function StatCard({ children, style }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.opacity   = '0';
      ref.current.style.transform = 'translateY(10px)';
      setTimeout(() => {
        if (ref.current) {
          ref.current.style.transition = 'opacity 0.3s, transform 0.3s';
          ref.current.style.opacity    = '1';
          ref.current.style.transform  = 'translateY(0)';
        }
      }, 50);
    }
  }, []);
  return (
    <div ref={ref} style={{
      background: '#fff', borderRadius: 12,
      border: '1px solid #E2E8F0', padding: '18px 20px',
      ...style,
    }}>
      {children}
    </div>
  );
}

function CardTitle({ children }) {
  return (
    <div style={{
      fontSize: 12, fontWeight: 700, color: '#64748B',
      textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14,
    }}>
      {children}
    </div>
  );
}

export default function CalendarStats({ stats, month, year, postsByDate }) {
  if (!stats) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: '#94A3B8', fontSize: 14 }}>
        No stats available for this period.
      </div>
    );
  }

  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthName = months[(month || 1) - 1];

  // Platform donut data
  const platformData = Object.entries(stats.by_platform || {}).map(([k, v]) => ({
    name:  PLATFORMS[k]?.label || k,
    value: v,
    color: PLATFORM_COLORS[k] || '#64748B',
    icon:  PLATFORMS[k]?.icon || '🔗',
  }));

  // Day of week bar data
  const dowData = DOW_ORDER.map(day => ({
    day: day.slice(0, 3),
    count: stats.by_day_of_week?.[day] || 0,
  }));
  const maxDow  = Math.max(...dowData.map(d => d.count), 1);
  const bestDow = dowData.reduce((a, b) => b.count > a.count ? b : a, dowData[0])?.day;

  // Post type data
  const typeData = Object.entries(stats.by_post_type || {}).sort((a, b) => b[1] - a[1]);
  const maxType  = Math.max(...typeData.map(([, v]) => v), 1);

  // Consecutive gap detection
  const gaps = stats.posting_gaps || [];
  let maxConsecutive = 0, current = 0;
  for (let i = 0; i < gaps.length; i++) {
    if (i === 0) { current = 1; continue; }
    const prev = new Date(gaps[i - 1]);
    const curr = new Date(gaps[i]);
    const diff = (curr - prev) / 86400000;
    if (diff === 1) { current++; } else { current = 1; }
    maxConsecutive = Math.max(maxConsecutive, current);
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>

      {/* Card 1 — Posting Frequency */}
      <StatCard>
        <CardTitle>Posting Frequency</CardTitle>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
          {stats.total_published}
        </div>
        <div style={{ fontSize: 13, color: '#64748B', marginBottom: 14 }}>
          posts published in {monthName} · ~{stats.avg_per_week}/week
        </div>
        <HeatmapCalendar month={month} year={year} postsByDate={postsByDate} />
      </StatCard>

      {/* Card 2 — Posts by Platform */}
      <StatCard>
        <CardTitle>Posts by Platform</CardTitle>
        {platformData.length === 0 ? (
          <div style={{ color: '#94A3B8', fontSize: 13 }}>No data</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={platformData} cx="50%" cy="50%"
                  innerRadius={40} outerRadius={70}
                  dataKey="value" paddingAngle={3}
                >
                  {platformData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {platformData.map(p => (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
                  <span style={{ color: '#374151' }}>{p.icon} {p.name}: <strong>{p.value}</strong></span>
                </div>
              ))}
            </div>
          </>
        )}
      </StatCard>

      {/* Card 3 — Posts by Day of Week */}
      <StatCard>
        <CardTitle>Posts by Day of Week</CardTitle>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={dowData} barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip cursor={{ fill: '#EFF6FF' }} />
            <Bar dataKey="count" radius={[4,4,0,0]}>
              {dowData.map((d, i) => (
                <Cell key={i} fill={d.day === bestDow ? '#10B981' : '#2563EB'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {bestDow && (
          <div style={{ fontSize: 12, color: '#10B981', fontWeight: 600, marginTop: 6 }}>
            🏆 Best day: {bestDow}
          </div>
        )}
      </StatCard>

      {/* Card 4 — Posts by Type */}
      <StatCard>
        <CardTitle>Posts by Type</CardTitle>
        {typeData.length === 0 ? (
          <div style={{ color: '#94A3B8', fontSize: 13 }}>No data</div>
        ) : (
          <div>
            {typeData.map(([type, count]) => (
              <div key={type} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: '#374151', textTransform: 'capitalize', fontWeight: 600 }}>{type}</span>
                  <span style={{ color: '#64748B' }}>{count}</span>
                </div>
                <div style={{ height: 8, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 4,
                    width: `${(count / maxType) * 100}%`,
                    background: '#2563EB', transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </StatCard>

      {/* Card 5 — Best Performing Post */}
      <StatCard>
        <CardTitle>🏆 Best Performing Post</CardTitle>
        {!stats.best_performing_post ? (
          <div style={{ color: '#94A3B8', fontSize: 13 }}>No published posts yet.</div>
        ) : (() => {
          const bp = stats.best_performing_post;
          const p  = PLATFORMS[bp.platform] || { color: '#64748B', icon: '🔗', label: bp.platform };
          return (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 22 }}>{p.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>{p.label}</div>
                  {bp.published_at && (
                    <div style={{ fontSize: 11, color: '#64748B' }}>
                      {new Date(bp.published_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </div>
                  )}
                </div>
              </div>
              {bp.caption && (
                <div style={{
                  fontSize: 12, color: '#334155', background: '#F8FAFC',
                  borderRadius: 6, padding: '8px 10px', marginBottom: 10,
                  lineHeight: 1.5,
                }}>
                  {bp.caption.slice(0, 120)}{bp.caption.length > 120 ? '…' : ''}
                </div>
              )}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, marginBottom: 10 }}>
                {[
                  ['👁', bp.impressions],
                  ['📡', bp.reach],
                  ['❤️', bp.likes],
                ].map(([icon, val]) => (
                  <span key={icon} style={{ color: '#374151' }}>
                    {icon} {(val || 0).toLocaleString()}
                  </span>
                ))}
              </div>
              {bp.post_url && (
                <a
                  href={bp.post_url} target="_blank" rel="noreferrer"
                  style={{
                    fontSize: 12, color: p.color, fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  View Post →
                </a>
              )}
            </div>
          );
        })()}
      </StatCard>

      {/* Card 6 — Posting Gaps */}
      <StatCard>
        <CardTitle>Posting Gaps</CardTitle>
        {gaps.length === 0 ? (
          <div style={{ color: '#10B981', fontSize: 13, fontWeight: 600 }}>
            ✅ No gaps — great consistency!
          </div>
        ) : (
          <>
            <div style={{
              fontSize: 24, fontWeight: 800, color: maxConsecutive >= 3 ? '#EF4444' : '#F59E0B',
              marginBottom: 4,
            }}>
              {gaps.length} day{gaps.length !== 1 ? 's' : ''}
            </div>
            <div style={{ fontSize: 13, color: '#64748B', marginBottom: 10 }}>
              with no posts in {monthName}
              {maxConsecutive >= 3 && (
                <span style={{ color: '#EF4444', marginLeft: 6, fontWeight: 600 }}>
                  · {maxConsecutive} consecutive days
                </span>
              )}
            </div>
            <div style={{ maxHeight: 120, overflowY: 'auto' }}>
              {gaps.slice(0, 15).map(d => (
                <div key={d} style={{
                  display: 'inline-block', margin: '2px 3px',
                  padding: '2px 8px', borderRadius: 20,
                  background: '#FEF2F2', color: '#EF4444',
                  fontSize: 11, fontWeight: 600,
                }}>
                  {new Date(d + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </div>
              ))}
              {gaps.length > 15 && (
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                  + {gaps.length - 15} more
                </div>
              )}
            </div>
          </>
        )}
      </StatCard>

    </div>
  );
}
