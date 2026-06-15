/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * BotFlowsListPage — entry point for the bot builder.
 *
 * Filter pills (All / Active / Draft), grid of cards, "+ Create flow"
 * button that opens a small modal asking for a name + trigger type and
 * routes into the editor.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bot, Plus, Sparkles, Copy, Trash2, BarChart3, MoreHorizontal, X,
  Wand2, AlertTriangle,
} from 'lucide-react';

import { botAPI, botTemplateAPI } from '../../services/api';
import toast from '../../components/ui/toast';

const FILTERS = [
  { key: 'all',    label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'draft',  label: 'Draft' },
];

export default function BotFlowsListPage() {
  const navigate = useNavigate();
  const [flows,    setFlows]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [templates, setTemplates] = useState([]);

  function load() {
    setLoading(true);
    botAPI.list({ /* server filters can be added later */ })
      .then((r) => setFlows(r.data?.results || r.data || []))
      .catch(() => toast.error('Could not load flows'))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  // Featured templates for the empty-state
  useEffect(() => {
    botTemplateAPI.list({ featured: '1' })
      .then((r) => setTemplates(r.data?.results || r.data || []))
      .catch(() => setTemplates([]));
  }, []);

  const visible = useMemo(() => {
    if (filter === 'active') return flows.filter((f) => f.is_active);
    if (filter === 'draft')  return flows.filter((f) => !f.is_active);
    return flows;
  }, [flows, filter]);

  async function duplicate(id) {
    try {
      const r = await botAPI.duplicate(id);
      toast.success('Duplicated');
      navigate(`/admin/bot-flows/${r.data.id}/edit`);
    } catch { toast.error('Could not duplicate'); }
  }
  async function destroy(id) {
    if (!window.confirm('Delete this flow? This cannot be undone.')) return;
    try {
      await botAPI.delete(id);
      setFlows((fs) => fs.filter((f) => f.id !== id));
      toast.success('Deleted');
    } catch { toast.error('Could not delete'); }
  }

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{
          width: 40, height: 40,
          background: 'var(--brand-primary-glow)', color: 'var(--brand-primary-hover)',
          borderRadius: 'var(--radius-md)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Bot size={20} strokeWidth={2.2} />
        </span>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Bot flows
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-secondary)' }}>
            Build CTWA chatbots that capture leads and qualify them on WhatsApp.
          </p>
        </div>
        <Link to="/admin/bot-templates" style={btnGhost}>
          <Sparkles size={13} /> Browse templates
        </Link>
        <button type="button" onClick={() => setCreateOpen(true)} style={btnPrimary}>
          <Plus size={13} /> Create flow
        </button>
      </header>

      <nav style={{ display: 'flex', gap: 6 }}>
        {FILTERS.map((f) => (
          <button
            key={f.key} type="button" onClick={() => setFilter(f.key)}
            style={{
              padding: '5px 14px',
              fontSize: 12, fontWeight: filter === f.key ? 600 : 500,
              color: filter === f.key ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: filter === f.key ? 'var(--brand-primary-soft)' : 'var(--surface-card)',
              border: `1px solid ${filter === f.key ? 'var(--brand-primary)' : 'var(--border-default)'}`,
              borderRadius: 'var(--radius-pill)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {f.label}
            {f.key === 'all' && ` · ${flows.length}`}
          </button>
        ))}
      </nav>

      {loading ? (
        <div style={{ padding: 36, textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading…</div>
      ) : visible.length === 0 ? (
        <Empty templates={templates} onCreate={() => setCreateOpen(true)} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {visible.map((f) => (
            <FlowCard key={f.id} flow={f} onDuplicate={() => duplicate(f.id)} onDelete={() => destroy(f.id)} />
          ))}
        </div>
      )}

      {createOpen && (
        <CreateModal onClose={() => setCreateOpen(false)} onCreated={(id) => navigate(`/admin/bot-flows/${id}/edit`)} />
      )}
    </div>
  );
}

function FlowCard({ flow, onDuplicate, onDelete }) {
  const [menu, setMenu] = useState(false);
  return (
    <article style={{
      padding: 16,
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      display: 'flex', flexDirection: 'column', gap: 8,
      position: 'relative',
    }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <Link to={`/admin/bot-flows/${flow.id}/edit`} style={{
          flex: 1, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)',
          textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {flow.name}
        </Link>
        <span style={{
          padding: '2px 8px', fontSize: 10, fontWeight: 600,
          letterSpacing: '0.04em', textTransform: 'uppercase',
          color:      flow.is_active ? 'var(--success)' : 'var(--text-tertiary)',
          background: flow.is_active ? 'var(--success-bg)' : 'var(--surface-sunken)',
          border: '1px solid currentColor', borderRadius: 'var(--radius-pill)',
        }}>
          {flow.is_active ? 'Active' : 'Draft'}
        </span>
      </header>

      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 8px', alignSelf: 'flex-start',
        background: 'var(--surface-sunken)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-pill)',
        fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)',
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>{flow.trigger_type.replace(/_/g, ' ')}</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 4 }}>
        <Stat n={flow.total_triggered}      label="triggered" />
        <Stat n={flow.total_leads_captured} label="leads" />
        <Stat n={`${flow.completion_rate || 0}%`} label="complete" />
      </div>

      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>
        Updated {flow.updated_at ? new Date(flow.updated_at).toLocaleDateString() : '—'}
        <div style={{ marginLeft: 'auto', position: 'relative' }}>
          <button type="button" onClick={() => setMenu(v => !v)} aria-label="Actions" style={iconBtn}>
            <MoreHorizontal size={14} />
          </button>
          {menu && (
            <>
              <div onClick={() => setMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
              <div style={{
                position: 'absolute', top: '100%', right: 0, zIndex: 11,
                minWidth: 160, padding: 4,
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-lg)',
              }}>
                <Link to={`/admin/bot-flows/${flow.id}/edit`} style={menuItem}>Edit</Link>
                <Link to={`/admin/bot-flows/${flow.id}/analytics`} style={menuItem}>
                  <BarChart3 size={12} /> Analytics
                </Link>
                <button type="button" onClick={onDuplicate} style={menuItem}>
                  <Copy size={12} /> Duplicate
                </button>
                <button type="button" onClick={onDelete} style={{ ...menuItem, color: 'var(--danger)' }}>
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function Stat({ n, label }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 4px', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)' }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{n}</div>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
    </div>
  );
}

function Empty({ templates, onCreate }) {
  return (
    <div style={{
      padding: 36, textAlign: 'center',
      background: 'var(--surface-card)',
      border: '1px dashed var(--border-default)',
      borderRadius: 'var(--radius-lg)',
    }}>
      <Bot size={32} strokeWidth={1.5} style={{ opacity: 0.4 }} />
      <h2 style={{ margin: '12px 0 6px', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
        Create your first bot flow
      </h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
        Build it from scratch — or start from a template.
      </p>
      <button type="button" onClick={onCreate} style={btnPrimary}>
        <Plus size={13} /> Create flow
      </button>
      {templates.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Featured templates
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
            {templates.slice(0, 3).map((t) => (
              <Link key={t.id} to={`/admin/bot-templates/${t.id}`} style={{
                padding: '6px 12px',
                background: 'var(--brand-primary-soft)', color: 'var(--brand-primary-hover)',
                border: '1px solid var(--brand-primary-glow)',
                borderRadius: 'var(--radius-pill)',
                fontSize: 12, fontWeight: 600, textDecoration: 'none',
              }}>{t.name}</Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CreateModal({ onClose, onCreated }) {
  const [mode, setMode] = useState('blank'); // 'blank' | 'ai'

  // Blank-flow state
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState('ctwa_ad');

  // AI flow state
  const [prompt, setPrompt] = useState('');
  const [industry, setIndustry] = useState('');
  const [aiName, setAiName] = useState('');
  const [aiWarning, setAiWarning] = useState(null);

  const [busy, setBusy] = useState(false);

  async function goBlank() {
    if (!name.trim()) return toast.error('Pick a name');
    setBusy(true);
    try {
      const r = await botAPI.create({
        name: name.trim(), description: '',
        trigger_type: triggerType, trigger_config: {},
        nodes: [{ id: 'start', type: 'start', position: { x: 100, y: 200 }, data: {} }],
        edges: [], starting_node_id: 'start',
      });
      onCreated(r.data.id);
    } catch {
      toast.error('Could not create flow');
      setBusy(false);
    }
  }

  async function goAI() {
    if (!prompt.trim()) return toast.error('Describe the flow you want');
    setBusy(true);
    setAiWarning(null);
    try {
      const r = await botAPI.generateWithAI({
        prompt: prompt.trim(),
        industry: industry || undefined,
        name: aiName.trim() || undefined,
      });
      const v = r.data?.validation;
      if (v && Array.isArray(v.errors) && v.errors.length > 0) {
        // Persist anyway — the user can fix in the editor — but warn first.
        setAiWarning(`AI made ${v.errors.length} mistake${v.errors.length === 1 ? '' : 's'}. Opening anyway — review the highlighted nodes.`);
        setTimeout(() => onCreated(r.data.flow_id), 1100);
      } else {
        toast.success(`Generated ${r.data.node_count} nodes`);
        onCreated(r.data.flow_id);
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || 'AI generation failed');
      setBusy(false);
    }
  }

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={backdrop}>
      <div style={modal}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px 8px' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Create a flow</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ ...iconBtn, marginLeft: 'auto' }}>
            <X size={14} />
          </button>
        </header>

        {/* Mode toggle */}
        <div style={{
          display: 'flex', gap: 4, padding: '0 20px 12px',
        }}>
          <button type="button" onClick={() => setMode('blank')} style={modeTab(mode === 'blank')}>
            From scratch
          </button>
          <button type="button" onClick={() => setMode('ai')} style={modeTab(mode === 'ai')}>
            <Wand2 size={12} /> Generate with AI
          </button>
        </div>

        {mode === 'blank' ? (
          <div style={{ padding: '0 20px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={lbl}>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)}
                     autoFocus placeholder="Real-estate lead capture"
                     style={inputBig} />
            </div>
            <div>
              <label style={lbl}>Trigger</label>
              <select value={triggerType} onChange={(e) => setTriggerType(e.target.value)} style={inputBig}>
                <option value="ctwa_ad">Click-to-WhatsApp ad</option>
                <option value="keyword">Keyword in message</option>
                <option value="first_message">First message ever</option>
                <option value="referral_link">WhatsApp link referral</option>
                <option value="manual">Manually triggered</option>
              </select>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>
              Don't worry — you can change the trigger any time.
            </p>
          </div>
        ) : (
          <div style={{ padding: '0 20px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={lbl}>Describe what your bot should do</label>
              <textarea
                value={prompt} onChange={(e) => setPrompt(e.target.value)}
                autoFocus rows={4}
                placeholder="E.g. Greet leads from our gym ad, ask which goal (weight loss / strength / cardio), capture name and phone, then offer to book a free trial slot."
                style={{ ...inputBig, resize: 'vertical', minHeight: 96, fontFamily: 'inherit' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Industry (optional)</label>
                <select value={industry} onChange={(e) => setIndustry(e.target.value)} style={inputBig}>
                  <option value="">Any</option>
                  <option value="real-estate">Real estate</option>
                  <option value="healthcare">Healthcare</option>
                  <option value="restaurant">Restaurant</option>
                  <option value="fitness">Fitness / gym</option>
                  <option value="ecommerce">E-commerce</option>
                  <option value="education">Education</option>
                  <option value="services">Services</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Name (optional)</label>
                <input value={aiName} onChange={(e) => setAiName(e.target.value)}
                       placeholder="Auto-named if empty"
                       style={inputBig} />
              </div>
            </div>
            <p style={{
              margin: 0, padding: '8px 10px', fontSize: 11,
              background: 'var(--brand-primary-soft)',
              border: '1px solid var(--brand-primary-glow)',
              color: 'var(--brand-primary-hover)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Sparkles size={12} /> Social Stats drafts the flow. You can edit every step in the visual editor.
            </p>
            {aiWarning && (
              <p style={{
                margin: 0, padding: '8px 10px', fontSize: 11,
                background: 'var(--warning-bg)',
                border: '1px solid var(--warning)',
                color: 'var(--warning)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <AlertTriangle size={12} /> {aiWarning}
              </p>
            )}
          </div>
        )}

        <footer style={{
          padding: '12px 20px', borderTop: '1px solid var(--border-subtle)',
          background: 'var(--surface-card)',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <button type="button" onClick={onClose} style={btnGhost}>Cancel</button>
          {mode === 'blank' ? (
            <button type="button" onClick={goBlank} disabled={busy} style={btnPrimary}>
              {busy ? 'Creating…' : 'Create + open editor'}
            </button>
          ) : (
            <button type="button" onClick={goAI} disabled={busy} style={btnPrimary}>
              {busy ? <><Wand2 size={13} /> Generating…</> : <><Wand2 size={13} /> Generate</>}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

const modeTab = (active) => ({
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '6px 12px',
  fontSize: 12, fontWeight: active ? 700 : 500,
  color: active ? 'var(--brand-primary-hover)' : 'var(--text-secondary)',
  background: active ? 'var(--brand-primary-soft)' : 'transparent',
  border: `1px solid ${active ? 'var(--brand-primary-glow)' : 'var(--border-default)'}`,
  borderRadius: 'var(--radius-pill)',
  cursor: 'pointer', fontFamily: 'inherit',
});

const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px',
  background: 'var(--brand-primary)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius-md)',
  fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
  textDecoration: 'none',
};
const btnGhost = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 12px',
  background: 'var(--surface-card)', color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
  fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
  textDecoration: 'none',
};
const iconBtn = {
  width: 28, height: 28, padding: 0,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent', color: 'var(--text-tertiary)',
  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
};
const menuItem = {
  display: 'flex', alignItems: 'center', gap: 6,
  width: '100%', padding: '7px 10px',
  textAlign: 'left', fontSize: 12,
  color: 'var(--text-primary)', background: 'transparent',
  border: 'none', borderRadius: 'var(--radius-sm)',
  cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none',
};
const backdrop = {
  position: 'fixed', inset: 0, zIndex: 1100,
  background: 'rgba(10,14,20,0.50)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
};
const modal = {
  width: '100%', maxWidth: 480,
  background: 'var(--surface-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)',
};
const lbl = {
  display: 'block', fontSize: 11, fontWeight: 600,
  letterSpacing: '0.04em', textTransform: 'uppercase',
  color: 'var(--text-tertiary)', marginBottom: 4,
};
const inputBig = {
  width: '100%', padding: '10px 12px',
  background: 'var(--surface-sunken)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 14, color: 'var(--text-primary)',
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
};
