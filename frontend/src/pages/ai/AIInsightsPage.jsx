/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * AIInsightsPage — feed of AI-generated insights for the current client.
 *
 * Top: regenerate button + filter pills.
 * Body: cards in chronological order, each with severity badge, action recommendation,
 *       and dismiss / mark-acted-upon controls.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Sparkles, RefreshCw, AlertTriangle, TrendingUp, Trophy,
  CheckCircle2, X, Filter, Loader2,
} from 'lucide-react';

import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { aiV2API } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import toast from '../../components/ui/toast';

const SEVERITY_VARIANT = {
  critical: 'danger',
  high:     'warning',
  medium:   'info',
  low:      'default',
};

const TYPE_ICON = {
  engagement_trend:      TrendingUp,
  best_time_shift:       Sparkles,
  content_mix:           Sparkles,
  competitor_alert:      Trophy,
  platform_underperform: AlertTriangle,
  growth:                TrendingUp,
  other:                 Sparkles,
};

const FILTERS = [
  { id: 'all',      label: 'All' },
  { id: 'critical', label: 'Critical' },
  { id: 'high',     label: 'High' },
  { id: 'medium',   label: 'Medium' },
  { id: 'low',      label: 'Low' },
];


export default function AIInsightsPage({ clientId: propClientId = null }) {
  const { user } = useAuth();
  const clientId = propClientId || user?.client_id || null;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [filter, setFilter] = useState('all');
  const [showDismissed, setShowDismissed] = useState(false);

  function loadList() {
    if (!clientId) return;
    setLoading(true);
    aiV2API.insightsList({
      client_id: clientId,
      ...(showDismissed ? { dismissed: 'true' } : {}),
      ...(filter !== 'all' ? { severity: filter } : {}),
    })
      .then((r) => setItems(r.data?.insights || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }

  useEffect(loadList, [clientId, filter, showDismissed]);

  async function regenerate() {
    if (!clientId) {
      toast.error('Pick a client first');
      return;
    }
    setGenerating(true);
    try {
      const r = await aiV2API.insightGenerate({ client_id: clientId, days: 30, max_insights: 5 });
      const persisted = r.data?.persisted || 0;
      const note = r.data?.note;
      if (note) toast(note, { icon: 'ℹ️' });
      else if (persisted) toast.success(`Generated ${persisted} insight${persisted === 1 ? '' : 's'}`);
      else toast('No new insights right now');
      loadList();
    } catch (e) {
      const msg = e?.response?.data?.error || 'Generation failed';
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  }

  async function patch(id, body) {
    try {
      await aiV2API.insightUpdate(id, body);
      loadList();
    } catch {
      toast.error('Could not update');
    }
  }

  const visible = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((i) => i.severity === filter);
  }, [items, filter]);

  return (
    <div className="app-page app-page--lg">
      <PageHeader
        title="AI Insights"
        subtitle="Social Stats surfaces what matters from your data — refresh whenever you want fresh signal."
        actions={(
          <Button onClick={regenerate} icon={Sparkles} loading={generating}>
            {generating ? 'Generating…' : 'Generate fresh insights'}
          </Button>
        )}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <Filter size={14} style={{ color: 'var(--text-tertiary)' }} />
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              style={{
                padding: '4px 12px',
                minHeight: 'auto', minWidth: 'auto',
                background: active ? 'var(--brand-primary-soft)' : 'var(--surface-card)',
                color:      active ? 'var(--brand-primary-hover)' : 'var(--text-secondary)',
                border: `1px solid ${active ? 'var(--brand-primary)' : 'var(--border-default)'}`,
                borderRadius: 'var(--radius-pill)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {f.label}
            </button>
          );
        })}
        <span style={{ flex: 1 }} />
        <label style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer',
        }}>
          <input
            type="checkbox"
            checked={showDismissed}
            onChange={(e) => setShowDismissed(e.target.checked)}
          />
          Show dismissed
        </label>
      </div>

      {loading ? (
        <Card padding="lg">
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
            <Loader2 size={20} className="spin" style={{ color: 'var(--text-tertiary)', animation: 'spin 1s linear infinite' }} />
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </Card>
      ) : visible.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={Sparkles}
            title="No insights yet"
            description={items.length === 0
              ? 'Click “Generate fresh insights” to have Social Stats scan your last 30 days of data.'
              : 'Nothing matches that filter.'}
            action={<Button onClick={regenerate} icon={Sparkles} loading={generating}>Generate now</Button>}
          />
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visible.map((ins) => (
            <InsightCard key={ins.id} insight={ins} onDismiss={() => patch(ins.id, { dismissed: true })} onActed={() => patch(ins.id, { acted_upon: !ins.acted_upon })} />
          ))}
        </div>
      )}
    </div>
  );
}


function InsightCard({ insight, onDismiss, onActed }) {
  const Icon = TYPE_ICON[insight.insight_type] || Sparkles;
  return (
    <Card padding="md" style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <span style={{
          flexShrink: 0,
          width: 38, height: 38,
          borderRadius: 'var(--radius-md)',
          background: 'var(--brand-primary-soft)',
          color: 'var(--brand-primary-hover)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={16} strokeWidth={2.2} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <Badge variant={SEVERITY_VARIANT[insight.severity] || 'default'} size="sm" dot>
              {insight.severity}
            </Badge>
            <span style={{
              fontSize: 11, fontWeight: 500,
              color: 'var(--text-tertiary)',
              fontFamily: 'var(--font-mono)',
            }}>
              {insight.insight_type}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              · {Math.round((insight.confidence_score || 0) * 100)}% confidence
            </span>
            {insight.acted_upon && (
              <Badge variant="success" size="sm" icon={CheckCircle2}>Acted upon</Badge>
            )}
          </div>
          <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            {insight.title}
          </h3>
          <p style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            {insight.description}
          </p>
          {insight.action_recommended && (
            <div style={{
              padding: '8px 12px',
              background: 'var(--surface-sunken)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12, color: 'var(--text-primary)',
              marginBottom: 8,
            }}>
              <span style={{ fontWeight: 600, color: 'var(--brand-primary-hover)' }}>Suggested action: </span>
              {insight.action_recommended}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            <Button size="xs" variant={insight.acted_upon ? 'secondary' : 'primary'} icon={CheckCircle2} onClick={onActed}>
              {insight.acted_upon ? 'Mark not done' : 'Mark as done'}
            </Button>
            {!insight.dismissed && (
              <Button size="xs" variant="ghost" icon={X} onClick={onDismiss}>
                Dismiss
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
