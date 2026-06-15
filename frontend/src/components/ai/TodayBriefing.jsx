/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles, RefreshCw, ArrowRight, AlertTriangle, TrendingUp, Trophy, Loader2,
} from 'lucide-react';

import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { aiV2API } from '../../services/api';
import toast from '../ui/toast';

/**
 * TodayBriefing — top-of-dashboard widget that surfaces the most recent
 * AI-generated insights for the current client.
 *
 * Pure read on mount (cheap GET /ai/v2/today-briefing/). The "Refresh" button
 * triggers /ai/v2/insight-generate/ which kicks off a fresh AI analysis +
 * persists new AIInsight rows; once that completes, re-fetches.
 *
 * Props:
 *   clientId   required for tenant scoping
 *   basePath   '/admin' or '/dashboard' for the "View all" link
 */
const SEVERITY_COLORS = {
  critical: { bg: 'var(--danger-bg)',  fg: 'var(--danger)',           label: 'Critical' },
  high:     { bg: 'var(--warning-bg)', fg: 'var(--warning)',          label: 'High' },
  medium:   { bg: 'var(--info-bg)',    fg: 'var(--info)',             label: 'Medium' },
  low:      { bg: 'var(--surface-sunken)', fg: 'var(--text-secondary)', label: 'Low' },
};

const TYPE_ICON = {
  competitor_alert:      Trophy,
  platform_underperform: AlertTriangle,
  engagement_trend:      TrendingUp,
  growth:                TrendingUp,
};


export default function TodayBriefing({ clientId, basePath = '/dashboard' }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState({});  // {id: bool}

  function load() {
    if (!clientId) return;
    setLoading(true);
    aiV2API.todayBriefing({ client_id: clientId })
      .then((r) => setItems(r.data?.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }

  useEffect(load, [clientId]);

  async function refresh() {
    if (!clientId) return;
    setRefreshing(true);
    try {
      const r = await aiV2API.insightGenerate({ client_id: clientId, days: 30, max_insights: 5 });
      const persisted = r.data?.persisted || 0;
      const note = r.data?.note;
      if (note) toast(note, { icon: 'ℹ️' });
      else if (persisted) toast.success(`Social Stats surfaced ${persisted} new insight${persisted === 1 ? '' : 's'}`);
      load();
    } catch (e) {
      const msg = e?.response?.data?.error || 'AI is unavailable right now';
      toast.error(msg);
    } finally {
      setRefreshing(false);
    }
  }

  if (!clientId) return null;

  return (
    <Card padding="md" style={{ marginBottom: 16 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8, marginBottom: 10, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28,
            background: 'var(--brand-gradient)', color: '#fff',
            borderRadius: 'var(--radius-sm)',
          }}>
            <Sparkles size={14} strokeWidth={2.4} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              Today&apos;s briefing
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              From Social Stats · most recent insights
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Button
            size="xs" variant="ghost" icon={RefreshCw}
            onClick={refresh} loading={refreshing}
            aria-label="Regenerate insights"
          >
            Refresh
          </Button>
          <Button
            size="xs" variant="ghost" iconRight={ArrowRight}
            as={Link} to={`${basePath}/analytics/insights`}
          >
            View all
          </Button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 14 }}>
          <Loader2 size={16} style={{ color: 'var(--text-tertiary)', animation: 'briefing-spin 1s linear infinite' }} />
          <style>{`@keyframes briefing-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : items.length === 0 ? (
        <div style={{
          padding: '12px 4px', fontSize: 13, color: 'var(--text-secondary)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <span>No insights yet — give Social Stats a moment to study your data.</span>
          <Button size="xs" icon={Sparkles} onClick={refresh} loading={refreshing}>Generate</Button>
        </div>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((it) => {
            const sev = SEVERITY_COLORS[it.severity] || SEVERITY_COLORS.low;
            const Icon = TYPE_ICON[it.insight_type] || Sparkles;
            const isOpen = !!expanded[it.id];
            return (
              <li
                key={it.id}
                style={{
                  padding: '10px 12px',
                  background: 'var(--surface-sunken)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setExpanded((m) => ({ ...m, [it.id]: !isOpen }))}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    width: '100%',
                    minHeight: 'auto', minWidth: 'auto',
                    padding: 0, border: 'none', background: 'transparent',
                    textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <span style={{
                    flexShrink: 0,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 22, height: 22, marginTop: 1,
                    borderRadius: 'var(--radius-xs)',
                    background: sev.bg, color: sev.fg,
                  }}>
                    <Icon size={11} strokeWidth={2.4} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <Badge variant="default" size="sm" dot style={{ color: sev.fg }}>
                        {sev.label}
                      </Badge>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        {it.insight_type?.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div style={{
                      fontSize: 13, fontWeight: 500,
                      color: 'var(--text-primary)',
                      letterSpacing: '-0.01em',
                    }}>
                      {it.title}
                    </div>
                    {isOpen && (
                      <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
                        {it.description}
                        {it.action_recommended && (
                          <div style={{
                            marginTop: 6, padding: '6px 8px',
                            background: 'var(--brand-primary-soft)',
                            border: '1px solid var(--brand-primary-glow)',
                            borderRadius: 'var(--radius-xs)',
                            color: 'var(--text-primary)',
                          }}>
                            <strong style={{ color: 'var(--brand-primary-hover)' }}>Action: </strong>
                            {it.action_recommended}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
