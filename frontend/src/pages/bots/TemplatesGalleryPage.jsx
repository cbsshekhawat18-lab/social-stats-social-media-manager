/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * TemplatesGalleryPage — discover and clone pre-built bot flows.
 *
 * Layout:
 *   - Featured strip (cards with cover image fallback)
 *   - Industry + use-case filter chips
 *   - Card grid for the rest
 *   - Click card → preview modal (node summary + use-count + Clone button)
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, Copy, RefreshCw, X, ArrowRight, Bot, Filter,
} from 'lucide-react';

import { botTemplateAPI } from '../../services/api';
import { getNodeMeta } from '../../components/bot/nodeCatalog';
import toast from '../../components/ui/toast';

const INDUSTRY_LABELS = {
  real_estate:   'Real estate',
  healthcare:    'Healthcare',
  restaurant:    'Restaurant',
  fitness:       'Fitness',
  education:     'Education',
  ecommerce:     'E-commerce',
  professional:  'Professional services',
  general:       'General',
};
const USE_CASE_LABELS = {
  lead_capture:        'Lead capture',
  appointment_booking: 'Appointments',
  product_inquiry:     'Product inquiry',
  feedback_collection: 'Feedback',
  support:             'Support',
  lead_magnet:         'Lead magnet',
};

export default function TemplatesGalleryPage() {
  const [templates, setTemplates] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [industry,  setIndustry]  = useState('');
  const [useCase,   setUseCase]   = useState('');
  const [preview,   setPreview]   = useState(null);

  function load() {
    setLoading(true);
    const params = {};
    if (industry) params.industry = industry;
    if (useCase)  params.use_case = useCase;
    botTemplateAPI.list(params)
      .then((r) => setTemplates(r.data?.results || r.data || []))
      .catch(() => toast.error('Could not load templates'))
      .finally(() => setLoading(false));
  }
  useEffect(load, [industry, useCase]); // eslint-disable-line

  const featured = useMemo(() => templates.filter((t) => t.is_featured), [templates]);
  const rest     = useMemo(() => templates.filter((t) => !t.is_featured), [templates]);

  const industries = useMemo(
    () => Array.from(new Set(templates.map((t) => t.industry))).filter(Boolean),
    [templates]
  );
  const useCases = useMemo(
    () => Array.from(new Set(templates.map((t) => t.use_case))).filter(Boolean),
    [templates]
  );

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{
          width: 40, height: 40,
          background: 'var(--brand-primary-glow)', color: 'var(--brand-primary-hover)',
          borderRadius: 'var(--radius-md)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Sparkles size={20} strokeWidth={2.2} />
        </span>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Bot flow templates
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            Pre-built flows for the most common CTWA use cases. Clone one to start in 30 seconds.
          </p>
        </div>
        <button type="button" onClick={load} aria-label="Refresh" style={iconBtn}>
          <RefreshCw size={13} />
        </button>
      </header>

      {/* Featured strip */}
      {featured.length > 0 && !industry && !useCase && (
        <Section title="Featured" icon={Sparkles}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {featured.map((t) => <Card key={t.id} t={t} onPreview={() => setPreview(t)} featured />)}
          </div>
        </Section>
      )}

      {/* Filter chips */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
        padding: 10,
        background: 'var(--surface-card)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
      }}>
        <Filter size={12} style={{ color: 'var(--text-tertiary)' }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginRight: 4 }}>
          Industry
        </span>
        <Chip active={!industry} onClick={() => setIndustry('')}>All</Chip>
        {industries.map((i) => (
          <Chip key={i} active={industry === i} onClick={() => setIndustry(i)}>
            {INDUSTRY_LABELS[i] || i}
          </Chip>
        ))}
        <span style={{ width: 1, height: 18, background: 'var(--border-default)', margin: '0 6px' }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginRight: 4 }}>
          Use case
        </span>
        <Chip active={!useCase} onClick={() => setUseCase('')}>All</Chip>
        {useCases.map((u) => (
          <Chip key={u} active={useCase === u} onClick={() => setUseCase(u)}>
            {USE_CASE_LABELS[u] || u}
          </Chip>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading…</div>
      ) : templates.length === 0 ? (
        <Empty />
      ) : (
        <Section title={industry || useCase ? 'Filtered' : 'All templates'}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {(industry || useCase ? templates : rest).map((t) => (
              <Card key={t.id} t={t} onPreview={() => setPreview(t)} />
            ))}
          </div>
        </Section>
      )}

      {preview && (
        <PreviewModal template={preview} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}

function Card({ t, onPreview, featured }) {
  return (
    <button type="button" onClick={onPreview} style={{
      padding: 14, textAlign: 'left',
      background: featured ? 'var(--brand-primary-soft)' : 'var(--surface-card)',
      border: `1px solid ${featured ? 'var(--brand-primary)' : 'var(--border-subtle)'}`,
      borderRadius: 'var(--radius-md)',
      cursor: 'pointer', fontFamily: 'inherit',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{
          width: 30, height: 30, borderRadius: 'var(--radius-sm)',
          background: 'var(--brand-primary-glow)', color: 'var(--brand-primary-hover)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Bot size={14} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t.name}
          </div>
          <div style={{ marginTop: 2, fontSize: 11, color: 'var(--text-tertiary)' }}>
            {INDUSTRY_LABELS[t.industry] || t.industry} · {USE_CASE_LABELS[t.use_case] || t.use_case}
          </div>
        </div>
        {featured && (
          <Sparkles size={12} style={{ color: 'var(--brand-primary-hover)', flexShrink: 0 }} />
        )}
      </header>
      <p style={{
        margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        overflow: 'hidden', minHeight: '2.8em',
      }}>{t.description}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>
        <span>{(t.nodes || []).length} nodes</span>
        {t.use_count > 0 && <span>Used {t.use_count}× by agencies</span>}
      </div>
    </button>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '4px 10px',
      fontSize: 11, fontWeight: active ? 600 : 500,
      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
      background: active ? 'var(--brand-primary-soft)' : 'var(--surface-card)',
      border: `1px solid ${active ? 'var(--brand-primary)' : 'var(--border-default)'}`,
      borderRadius: 'var(--radius-pill)',
      cursor: 'pointer', fontFamily: 'inherit',
    }}>
      {children}
    </button>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <section>
      <h2 style={{
        display: 'flex', alignItems: 'center', gap: 6,
        margin: '0 0 8px', fontSize: 12, fontWeight: 600,
        color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>
        {Icon && <Icon size={11} />} {title}
      </h2>
      {children}
    </section>
  );
}

function Empty() {
  return (
    <div style={{
      padding: 36, textAlign: 'center',
      background: 'var(--surface-card)',
      border: '1px dashed var(--border-default)',
      borderRadius: 'var(--radius-md)',
      color: 'var(--text-tertiary)',
    }}>
      No templates match these filters.
    </div>
  );
}

function PreviewModal({ template, onClose }) {
  const navigate = useNavigate();
  const [name, setName] = useState(template.name);
  const [busy, setBusy] = useState(false);

  // Build a one-line preview of the node sequence
  const nodeSummary = (template.nodes || []).map((n) => {
    const meta = getNodeMeta(n.type);
    return { id: n.id, label: meta.label, color: meta.color };
  });

  async function clone() {
    setBusy(true);
    try {
      const r = await botTemplateAPI.use(template.id, { name });
      toast.success('Template cloned — opening editor…');
      navigate(`/admin/bot-flows/${r.data.id}/edit`);
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not clone template');
    } finally { setBusy(false); }
  }

  return (
    <div style={backdrop} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modal}>
        <header style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 10, borderBottom: '1px solid var(--border-subtle)' }}>
          <span style={{
            width: 32, height: 32, borderRadius: 'var(--radius-sm)',
            background: 'var(--brand-primary-glow)', color: 'var(--brand-primary-hover)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Bot size={15} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{template.name}</h2>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {INDUSTRY_LABELS[template.industry] || template.industry} · {USE_CASE_LABELS[template.use_case] || template.use_case}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={iconBtn}>
            <X size={14} />
          </button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {template.description}
          </p>

          <div style={{ marginBottom: 16 }}>
            <h3 style={miniH}>Flow shape</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {nodeSummary.map((n, i) => (
                <span key={n.id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px',
                  background: 'var(--surface-sunken)',
                  border: `1px solid ${n.color}33`,
                  borderRadius: 'var(--radius-pill)',
                  fontSize: 11, color: 'var(--text-secondary)',
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: n.color }} />
                  {n.label}
                  {i < nodeSummary.length - 1 && <ArrowRight size={9} style={{ color: 'var(--text-tertiary)', marginLeft: 2 }} />}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 style={miniH}>Name your flow</h3>
            <input value={name} onChange={(e) => setName(e.target.value)}
                   style={inputStyle} />
            <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text-tertiary)' }}>
              You can rename + edit any node before publishing.
            </p>
          </div>
        </div>

        <footer style={{
          padding: '14px 20px', borderTop: '1px solid var(--border-subtle)',
          background: 'var(--surface-card)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            Cloning creates a draft — nothing goes live until you publish.
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose} style={btnGhost}>Cancel</button>
            <button type="button" onClick={clone} disabled={busy || !name.trim()} style={btnPrimary}>
              <Copy size={13} /> {busy ? 'Cloning…' : 'Clone & open editor'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

const inputStyle = { width: '100%', padding: '10px 12px', background: 'var(--surface-sunken)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', fontSize: 14, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' };
const miniH      = { margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.04em', textTransform: 'uppercase' };
const btnPrimary = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: 'var(--brand-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' };
const btnGhost   = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 12px', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' };
const iconBtn    = { width: 30, height: 30, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: 'var(--text-tertiary)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' };
const backdrop   = { position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(10,14,20,0.50)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 };
const modal      = { width: '100%', maxWidth: 560, maxHeight: '88vh', display: 'flex', flexDirection: 'column', background: 'var(--surface-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)', overflow: 'hidden' };
