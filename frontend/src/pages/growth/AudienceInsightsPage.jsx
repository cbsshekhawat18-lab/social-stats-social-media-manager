/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useEffect, useState } from 'react';
import { Loader2, Users, Activity, Layers, Info } from 'lucide-react';

import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import StatCard from '../../components/ui/StatCard';
import { audienceAPI } from '../../services/api';

const DAYS_OPTIONS = [7, 30, 90, 180];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function AudienceInsightsPage() {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    audienceAPI.unified({ days })
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [days]);

  const totals = data?.totals || {};
  const byPlatform = data?.by_platform || {};
  const heatmap = data?.active_hours?.heatmap || [];
  const top = data?.top_content_types || {};

  return (
    <div style={{ paddingBottom: 32 }}>
      <PageHeader
        title="Audience Insights"
        subtitle="Cross-platform engagement, activity heatmap, and top content types"
        action={
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}
                   style={{
                     height: 36, padding: '0 12px',
                     background: 'var(--surface-card)',
                     border: '1px solid var(--border-default)',
                     borderRadius: 'var(--radius-md)',
                     fontSize: 13, color: 'var(--text-primary)',
                     outline: 'none', minHeight: 'unset',
                   }}>
            {DAYS_OPTIONS.map((d) => <option key={d} value={d}>{d} days</option>)}
          </select>
        }
      />

      {loading && (
        <div style={{ padding: 32, textAlign: 'center' }}>
          <Loader2 size={20} className="ds-spin" color="var(--text-tertiary)" />
        </div>
      )}

      {!loading && data && (
        <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Totals row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
            <StatCard label="Total reach"     value={totals.reach}        icon={Users}     color="#00CCF5" />
            <StatCard label="Impressions"     value={totals.impressions}  icon={Activity}  color="#2563eb" />
            <StatCard label="Followers (max)" value={totals.followers_max} icon={Users}    color="#22c55e" />
            <StatCard label="Engagement"      value={`${(totals.engagement_rate || 0).toFixed(2)}%`}
                                              icon={Activity}  color="#8b5cf6" />
          </div>

          {/* Per-platform breakdown */}
          <Card padding="md">
            <Card.Header title="Per platform" subtitle={`Last ${days} days`} />
            {Object.keys(byPlatform).length === 0 ? (
              <EmptyState icon={Layers} compact title="No metrics yet"
                           description="Connect a platform via Settings to start collecting data." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={th}>Platform</th>
                      <th style={thNum}>Reach</th>
                      <th style={thNum}>Impressions</th>
                      <th style={thNum}>Followers</th>
                      <th style={thNum}>Eng. rate</th>
                      <th style={thNum}>Video views</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(byPlatform).map(([p, m]) => (
                      <tr key={p}>
                        <td style={td}>{p}</td>
                        <td style={tdNum}>{Number(m.reach).toLocaleString()}</td>
                        <td style={tdNum}>{Number(m.impressions).toLocaleString()}</td>
                        <td style={tdNum}>{Number(m.followers).toLocaleString()}</td>
                        <td style={tdNum}>{(m.engagement_rate || 0).toFixed(2)}%</td>
                        <td style={tdNum}>{Number(m.video_views).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Active-hours heatmap */}
          <Card padding="md">
            <Card.Header
              title="Active hours"
              subtitle="When your audience engages with your posts (UTC)"
            />
            {heatmap.length === 0 || heatmap.flat().every((c) => c === 0) ? (
              <EmptyState icon={Activity} compact title="No engagement data yet"
                           description="Publish a few posts and metrics sync to see when your audience is active." />
            ) : (
              <Heatmap heatmap={heatmap} />
            )}
          </Card>

          {/* Top content types */}
          <Card padding="md">
            <Card.Header title="Top content types"
                          subtitle="Ranked by average engagement per post" />
            {Object.keys(top).length === 0 ? (
              <EmptyState icon={Layers} compact title="No post-type breakdown yet" />
            ) : (
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12,
              }}>
                {Object.entries(top).map(([p, types]) => (
                  <div key={p} style={{
                    padding: 12, borderRadius: 'var(--radius-md)',
                    background: 'var(--surface-sunken)',
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                                  color: 'var(--text-tertiary)', letterSpacing: 0.4, marginBottom: 8 }}>
                      {p}
                    </div>
                    {types.map((t, i) => (
                      <div key={t.post_type} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '6px 0', borderTop: i ? '1px solid var(--border-subtle)' : 'none',
                      }}>
                        <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                          {t.post_type}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                          {t.avg_score.toLocaleString()} avg · {t.samples} post{t.samples === 1 ? '' : 's'}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Demographics placeholder */}
          {data.demographics?.status === 'data_unavailable' && (
            <Card padding="md" style={{
              background: 'var(--info-bg)', border: '1px solid var(--border-subtle)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <Info size={16} color="var(--info)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                    Demographics — coming soon
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {data.demographics.note}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      <style>{`.ds-spin { animation: ds-spin 0.9s linear infinite; } @keyframes ds-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ── Heatmap subcomponent ──────────────────────────────────────────────── */
function Heatmap({ heatmap }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'inline-grid',
                    gridTemplateColumns: '40px repeat(24, minmax(20px, 1fr))',
                    gap: 2, alignItems: 'center', minWidth: 580 }}>
        {/* Header row — hours */}
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} style={hourLabel}>
            {h % 3 === 0 ? `${h}` : ''}
          </div>
        ))}

        {heatmap.map((row, dow) => (
          <>
            <div key={`d-${dow}`} style={{
              fontSize: 11, fontWeight: 600,
              color: 'var(--text-tertiary)', textAlign: 'right', paddingRight: 6,
            }}>
              {DAYS[dow]}
            </div>
            {row.map((value, h) => (
              <div
                key={`c-${dow}-${h}`}
                title={`${DAYS[dow]} ${h}:00 — ${(value * 100).toFixed(0)}%`}
                style={{
                  height: 24, borderRadius: 4,
                  background: heatColor(value),
                }}
              />
            ))}
          </>
        ))}
      </div>
    </div>
  );
}

const hourLabel = {
  fontSize: 10, color: 'var(--text-tertiary)',
  textAlign: 'center',
};

function heatColor(value) {
  // 0 → cool gray surface; 1 → vivid brand cyan
  if (!value || value <= 0) return 'var(--surface-sunken)';
  const alpha = Math.min(1, 0.15 + value * 0.85);
  return `rgba(0, 204, 245, ${alpha.toFixed(2)})`;
}

/* ── Table styles ──────────────────────────────────────────────────────── */
const th = {
  textAlign: 'left', padding: '10px 14px', fontSize: 11,
  fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4,
  color: 'var(--text-tertiary)',
  borderBottom: '1px solid var(--border-subtle)',
  background: 'var(--surface-sunken)',
};
const thNum = { ...th, textAlign: 'right' };
const td = { padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)', fontWeight: 500 };
const tdNum = { ...td, textAlign: 'right' };
