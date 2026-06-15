/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useEffect, useState } from 'react';
import {
  Plus, Trash2, RefreshCw, Sparkles, TrendingUp, X,
  Loader2, Users, ChevronRight,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import toast from 'react-hot-toast';

import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { competitorAPI } from '../../services/api';

const PLATFORMS = ['facebook', 'instagram', 'youtube', 'linkedin', 'google_my_business'];

export default function CompetitorsPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);  // selected competitor
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await competitorAPI.list();
      const data = res.data?.results || res.data || [];
      setList(data);
      if (!active && data.length) setActive(data[0]);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  return (
    <div style={{ paddingBottom: 32 }}>
      <PageHeader
        title="Competitors"
        subtitle="Track public profile metrics and benchmark your client against them"
        action={<Button icon={Plus} onClick={() => setShowCreate(true)}>Add Competitor</Button>}
      />

      <div style={{
        display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)',
        gap: 16, padding: '0 24px',
      }} className="comp-grid">
        <Card padding="none" style={{ overflow: 'hidden', alignSelf: 'flex-start' }}>
          {loading && <div style={{ padding: 16, color: 'var(--text-tertiary)' }}>
            <Loader2 size={14} className="ds-spin" /> Loading…
          </div>}
          {!loading && list.length === 0 && (
            <EmptyState
              icon={Users}
              title="No competitors yet"
              description="Add a competitor to start tracking their public follower growth and content patterns."
              action={<Button icon={Plus} onClick={() => setShowCreate(true)}>Add competitor</Button>}
            />
          )}
          {list.map((c) => (
            <button
              key={c.id} type="button"
              onClick={() => setActive(c)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '12px 14px',
                background: active?.id === c.id ? 'var(--brand-primary-glow)' : 'transparent',
                border: 'none', borderBottom: '1px solid var(--border-subtle)',
                cursor: 'pointer', textAlign: 'left',
                minHeight: 'unset', minWidth: 'unset',
                transition: 'var(--transition-fast)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {c.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {Object.keys(c.public_handles || {}).length || 0} platform{(Object.keys(c.public_handles || {}).length === 1) ? '' : 's'}
                  {c.last_synced_at && ` · synced ${new Date(c.last_synced_at).toLocaleDateString()}`}
                </div>
              </div>
              <ChevronRight size={14} color="var(--text-tertiary)" />
            </button>
          ))}
        </Card>

        <div>
          {!active ? (
            <Card padding="none" style={{ overflow: 'hidden' }}>
              <EmptyState icon={Users} title="Select a competitor" />
            </Card>
          ) : (
            <CompetitorDetail competitor={active} onChange={load} />
          )}
        </div>
      </div>

      {showCreate && (
        <CreateCompetitorModal
          onClose={() => setShowCreate(false)}
          onCreated={(c) => { setShowCreate(false); load(); setActive(c); }}
        />
      )}

      <style>{`
        .ds-spin { animation: ds-spin 0.9s linear infinite; }
        @keyframes ds-spin { to { transform: rotate(360deg); } }
        @media (max-width: 1024px) { .comp-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}

/* ── Detail ─────────────────────────────────────────────────────────────── */
function CompetitorDetail({ competitor, onChange }) {
  const [timeline, setTimeline] = useState([]);
  const [posts, setPosts] = useState([]);
  const [insights, setInsights] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [platform, setPlatform] = useState('');

  async function loadAll() {
    try {
      const [tl, p] = await Promise.all([
        competitorAPI.timeline(competitor.id, { days: 90, ...(platform && { platform }) }),
        competitorAPI.posts(competitor.id, { days: 30, ...(platform && { platform }) }),
      ]);
      setTimeline(tl.data?.snapshots || []);
      setPosts(p.data?.posts || []);
    } catch {}
  }
  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [competitor.id, platform]);

  async function syncNow() {
    setSyncing(true);
    try {
      await competitorAPI.snapshotNow(competitor.id);
      toast.success('Sync queued — refresh in a few seconds');
      setTimeout(() => { loadAll(); onChange?.(); }, 3000);
    } catch (e) { toast.error('Sync failed'); }
    finally { setSyncing(false); }
  }

  async function destroy() {
    if (!window.confirm(`Delete "${competitor.name}"?`)) return;
    try { await competitorAPI.delete(competitor.id); onChange?.(); }
    catch { toast.error('Delete failed'); }
  }

  async function fetchInsights() {
    setLoadingInsights(true); setInsights(null);
    try {
      const res = await competitorAPI.insights(competitor.id);
      setInsights(res.data);
    } catch (e) {
      const detail = e.response?.data?.detail;
      toast.error(detail || 'Insights failed');
    } finally { setLoadingInsights(false); }
  }

  // Reduce timeline to a per-date series suitable for Recharts
  const chartData = (() => {
    const byDate = {};
    for (const s of timeline) {
      const d = byDate[s.date] || { date: s.date };
      d[s.platform] = s.followers;
      byDate[s.date] = d;
    }
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  })();

  const platformsInData = Array.from(new Set(timeline.map((s) => s.platform)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header card */}
      <Card padding="md">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
              {competitor.name}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {Object.entries(competitor.public_handles || {}).map(([p, h]) => (
                <Badge key={p} variant="default">{p}: {h}</Badge>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button variant="secondary" icon={RefreshCw} loading={syncing} onClick={syncNow}>
              Sync
            </Button>
            <Button variant="ghost" icon={Trash2} iconOnly aria-label="Delete" onClick={destroy} />
          </div>
        </div>

        {/* Latest snapshot stats */}
        {(competitor.latest_snapshots || []).length > 0 && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 8, marginTop: 16,
          }}>
            {competitor.latest_snapshots.map((s) => (
              <div key={`${s.platform}-${s.date}`} style={{
                padding: '10px 12px', borderRadius: 'var(--radius-md)',
                background: 'var(--surface-sunken)',
                border: '1px solid var(--border-subtle)',
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                              color: 'var(--text-tertiary)', letterSpacing: 0.4 }}>
                  {s.platform}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
                  {Number(s.followers || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {s.posts_count} posts · {new Date(s.date).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Timeline chart */}
      <Card padding="md">
        <Card.Header
          title="Follower timeline"
          subtitle="Last 90 days"
          action={
            <select value={platform} onChange={(e) => setPlatform(e.target.value)}
                     style={{ ...inputStyle, height: 32, width: 'auto' }}>
              <option value="">All</option>
              {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          }
        />
        {chartData.length === 0 ? (
          <EmptyState icon={TrendingUp} compact title="No data yet"
                       description='Click "Sync" above or wait for the daily 3am job.' />
        ) : (
          <div style={{ height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                {platformsInData.map((p, i) => (
                  <Line key={p} type="monotone" dataKey={p}
                        stroke={lineColor(i)} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Top posts captured */}
      <Card padding="md">
        <Card.Header title="Top public posts" subtitle="Captured during recent snapshots" />
        {posts.length === 0 ? (
          <EmptyState icon={TrendingUp} compact title="No public posts captured"
                       description="Available once snapshot helpers can scrape this competitor's public feed." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {posts.slice(0, 12).map((p, i) => (
              <div key={i} style={{
                padding: 12, borderRadius: 'var(--radius-md)',
                background: 'var(--surface-sunken)',
                border: '1px solid var(--border-subtle)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Badge variant="default">{p.platform}</Badge>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {p.snapshot_date && new Date(p.snapshot_date).toLocaleDateString()}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                  {p.caption || p.title || p.text || '(no caption)'}
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
                  {p.likes != null && <span>♥ {p.likes}</span>}
                  {p.comments != null && <span>💬 {p.comments}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* AI insights */}
      <Card padding="md">
        <Card.Header
          title="AI insights"
          subtitle="Social Stats analyzes 30 days of snapshots + sample posts"
          action={<Button icon={Sparkles} loading={loadingInsights} onClick={fetchInsights}>
            Generate
          </Button>}
        />
        {insights ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-primary)' }}>
              {insights.summary}
            </div>
            <InsightList title="Strengths" items={insights.strengths} variant="success" />
            <InsightList title="Opportunities" items={insights.opportunities} variant="info" />
            <InsightList title="Top themes" items={insights.top_themes} variant="brand" />
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            Click <strong>Generate</strong> for an AI-written analysis.
          </div>
        )}
      </Card>
    </div>
  );
}

function InsightList({ title, items, variant }) {
  if (!items || !items.length) return null;
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)',
        textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6,
      }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13 }}>
            <Badge variant={variant} dot>•</Badge>
            <span style={{ color: 'var(--text-primary)' }}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Create modal ──────────────────────────────────────────────────────── */
function CreateCompetitorModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [handles, setHandles] = useState({});
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) { toast.error('Name is required'); return; }
    const cleaned = Object.fromEntries(
      Object.entries(handles).filter(([_, v]) => (v || '').trim()),
    );
    if (!Object.keys(cleaned).length) {
      toast.error('Add at least one platform handle'); return;
    }
    setSaving(true);
    try {
      const res = await competitorAPI.create({ name, public_handles: cleaned });
      onCreated(res.data);
    } catch (e) {
      toast.error('Create failed');
    } finally { setSaving(false); }
  }

  return (
    <div onClick={onClose} style={modalBackdrop}>
      <Card onClick={(e) => e.stopPropagation()} padding="none" style={{
        width: 'min(520px, 100%)', display: 'flex', flexDirection: 'column',
      }}>
        <div style={modalHeader}>
          <strong style={{ fontSize: 16 }}>Add competitor</strong>
          <button onClick={onClose} style={iconBtnStyle} aria-label="Close"><X size={14} /></button>
        </div>
        <div style={{ padding: 16 }}>
          <label style={{ display: 'block', marginBottom: 12 }}>
            <span style={fieldLabel}>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="Acme Rival" style={inputStyle} autoFocus />
          </label>
          <div style={fieldLabel}>Public handles</div>
          <div style={{ marginTop: 6, color: 'var(--text-tertiary)', fontSize: 11, marginBottom: 8 }}>
            Channel ID for YouTube (UC…), page username for Facebook, @handle for Instagram.
          </div>
          {PLATFORMS.map((p) => (
            <div key={p} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', alignSelf: 'center' }}>{p}</span>
              <input value={handles[p] || ''}
                      onChange={(e) => setHandles({ ...handles, [p]: e.target.value })}
                      placeholder={p === 'youtube' ? 'UCxxxxxxxxxxxx' : '@handle or username'}
                      style={inputStyle} />
            </div>
          ))}
        </div>
        <div style={modalFooter}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>Add</Button>
        </div>
      </Card>
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────────────────────── */
const COLORS = ['#00CCF5', '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6'];
function lineColor(i) { return COLORS[i % COLORS.length]; }

const inputStyle = {
  width: '100%', height: 36, padding: '0 12px',
  background: 'var(--surface-card)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13, color: 'var(--text-primary)',
  outline: 'none', boxSizing: 'border-box', minHeight: 'unset',
};
const fieldLabel = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6,
};
const iconBtnStyle = {
  width: 28, height: 28, borderRadius: 'var(--radius-sm)',
  background: 'transparent', border: 'none', cursor: 'pointer',
  color: 'var(--text-tertiary)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  minHeight: 'unset', minWidth: 'unset',
};
const modalBackdrop = {
  position: 'fixed', inset: 0, zIndex: 200,
  background: 'rgba(10,14,20,0.5)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
};
const modalHeader = {
  padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};
const modalFooter = {
  padding: 12, borderTop: '1px solid var(--border-subtle)',
  display: 'flex', justifyContent: 'flex-end', gap: 8,
};
