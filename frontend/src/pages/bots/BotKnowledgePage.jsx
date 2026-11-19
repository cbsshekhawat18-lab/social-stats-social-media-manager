/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * BotKnowledgePage — the workspace's knowledge base for AI chat nodes.
 *
 * Documents are plain text (FAQs, price lists, policies). An AI Chat node with
 * "Answer only from the knowledge base" gets the best-matching passages for
 * each customer message. "Try a question" shows exactly which passages that
 * would be, so authors can check coverage before going live.
 */
import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Plus, Pencil, Trash2, Search, X } from 'lucide-react';

import { botKnowledgeAPI } from '../../services/api';
import { useAppStore } from '../../stores/appStore';
import toast from '../../components/ui/toast';

const MAX_CONTENT = 100000;

export default function BotKnowledgePage() {
  const clientId = useAppStore((s) => s.currentClientId);
  const params = clientId ? { client_id: clientId } : undefined;

  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);     // null | {id?, title, content}
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    botKnowledgeAPI.list(clientId ? { client_id: clientId } : undefined)
      .then((r) => setDocs(r.data.results || r.data || []))
      .catch(() => toast.error('Could not load the knowledge base'))
      .finally(() => setLoading(false));
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    const title = (editing.title || '').trim();
    const content = (editing.content || '').trim();
    if (!title) return toast.error('Give the document a title');
    if (!content) return toast.error('The document is empty');
    setSaving(true);
    try {
      if (editing.id) await botKnowledgeAPI.update(editing.id, { title, content });
      else await botKnowledgeAPI.create({ title, content, ...(clientId ? { client: clientId } : {}) }, params);
      toast.success(editing.id ? 'Document updated' : 'Document added');
      setEditing(null);
      setResults(null);
      load();
    } catch (e) {
      const data = e?.response?.data || {};
      toast.error(data.content?.[0] || data.title?.[0] || data.detail || 'Could not save the document');
    } finally {
      setSaving(false);
    }
  }

  async function remove(doc) {
    if (!window.confirm(`Delete “${doc.title}”? AI chat nodes will stop using it.`)) return;
    try {
      await botKnowledgeAPI.delete(doc.id);
      setDocs((ds) => ds.filter((d) => d.id !== doc.id));
      setResults(null);
    } catch {
      toast.error('Could not delete the document');
    }
  }

  async function runSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const r = await botKnowledgeAPI.search(query.trim(), params);
      setResults(r.data.results || []);
    } catch {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={iconWrap}><BookOpen size={18} /></span>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Knowledge base
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            What your AI chat is allowed to answer from. Add FAQs, prices and policies as plain text.
          </p>
        </div>
        <button type="button" style={btnPrimary} onClick={() => setEditing({ title: '', content: '' })}>
          <Plus size={14} /> Add document
        </button>
      </header>

      {/* Try a question */}
      <section style={card}>
        <form onSubmit={runSearch} style={{ display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-tertiary)' }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)}
                   aria-label="Try a customer question"
                   placeholder="Try a customer question, e.g. “what are your timings?”"
                   style={{ ...input, paddingLeft: 30 }} />
          </div>
          <button type="submit" style={btnGhost} disabled={searching || !query.trim()}>
            {searching ? 'Searching…' : 'See what the AI gets'}
          </button>
        </form>
        {results && (
          <div style={{ marginTop: 12 }}>
            {results.length === 0 ? (
              <p style={muted}>
                Nothing matches. The AI would say it doesn't have that information and offer a teammate.
              </p>
            ) : results.map((p, i) => (
              <div key={i} style={{ ...passage, marginTop: i ? 8 : 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                  {p.title}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{p.text}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Documents */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          <p style={muted}>Loading…</p>
        ) : docs.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', padding: 32 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>No documents yet</p>
            <p style={{ ...muted, margin: '6px 0 0' }}>
              Add one, then tick “Answer only from the knowledge base” on an AI Chat node.
            </p>
          </div>
        ) : docs.map((d) => (
          <article key={d.id} style={{ ...card, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{d.title}</div>
              <div style={{
                fontSize: 13, color: 'var(--text-secondary)', marginTop: 4,
                overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              }}>{d.content}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
                {d.content.length.toLocaleString()} characters · updated {new Date(d.updated_at).toLocaleDateString()}
              </div>
            </div>
            <button type="button" style={iconBtn} aria-label={`Edit ${d.title}`}
                    onClick={() => setEditing({ id: d.id, title: d.title, content: d.content })}>
              <Pencil size={14} />
            </button>
            <button type="button" style={iconBtn} aria-label={`Delete ${d.title}`} onClick={() => remove(d)}>
              <Trash2 size={14} />
            </button>
          </article>
        ))}
      </section>

      {editing && (
        <div style={overlay} onClick={() => !saving && setEditing(null)}>
          <div role="dialog" aria-modal="true" aria-label={editing.id ? 'Edit document' : 'Add document'}
               style={dialog} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>
                {editing.id ? 'Edit document' : 'Add document'}
              </h2>
              <button type="button" style={iconBtn} aria-label="Close" onClick={() => setEditing(null)}>
                <X size={14} />
              </button>
            </div>
            <label style={label} htmlFor="kb-title">Title</label>
            <input id="kb-title" value={editing.title} style={input} maxLength={200} autoFocus
                   placeholder="e.g. Opening hours and location"
                   onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            <label style={{ ...label, marginTop: 12 }} htmlFor="kb-content">Content</label>
            <textarea id="kb-content" value={editing.content} rows={14} maxLength={MAX_CONTENT}
                      placeholder={'Write it the way you would explain it to a customer.\n\nLeave a blank line between topics — each paragraph is matched on its own.'}
                      style={{ ...input, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
                      onChange={(e) => setEditing({ ...editing, content: e.target.value })} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <span style={{ ...muted, flex: 1 }}>
                {(editing.content || '').length.toLocaleString()} / {MAX_CONTENT.toLocaleString()} characters
              </span>
              <button type="button" style={btnGhost} onClick={() => setEditing(null)} disabled={saving}>Cancel</button>
              <button type="button" style={btnPrimary} onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const iconWrap = {
  width: 40, height: 40, borderRadius: 'var(--radius-md)', flexShrink: 0,
  background: 'var(--brand-primary-soft)', color: 'var(--brand-primary-hover, var(--brand-primary))',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};
const card = {
  padding: 16, background: 'var(--surface-card)',
  border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
};
const passage = {
  padding: 10, background: 'var(--surface-sunken)',
  border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
};
const input = {
  width: '100%', padding: '8px 10px', fontSize: 13, boxSizing: 'border-box',
  background: 'var(--surface-sunken)', color: 'var(--text-primary)',
  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', outline: 'none',
};
const label = {
  display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
  textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 4,
};
const muted = { margin: 0, fontSize: 12, color: 'var(--text-tertiary)' };
const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
  background: 'var(--brand-primary)', color: '#fff', border: 'none',
  borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
};
const btnGhost = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px',
  background: 'var(--surface-card)', color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
};
const iconBtn = {
  width: 30, height: 30, padding: 0, minHeight: 'unset', flexShrink: 0,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent', color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
};
const overlay = {
  position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
};
const dialog = {
  width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', padding: 20,
  background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--border-default)', boxShadow: '0 25px 60px rgba(0,0,0,.35)',
};
