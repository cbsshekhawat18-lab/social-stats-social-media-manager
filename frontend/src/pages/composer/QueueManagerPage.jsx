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
  Plus, Layers, Pause, Play, Trash2, Clock, Edit2, X, GripVertical,
} from 'lucide-react';
import toast from 'react-hot-toast';

import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import Badge from '../../components/ui/Badge';
import { usePostQueues } from '../../hooks/useComposer';
import { composerAPI } from '../../services/api';

const STRATEGIES = [
  { id: 'sequential',  label: 'Sequential' },
  { id: 'random',      label: 'Random' },
  { id: 'round_robin', label: 'Round-robin' },
];

export default function QueueManagerPage() {
  const { data: queues, refetch, loading } = usePostQueues();
  const [activeId, setActiveId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  // Auto-select first queue once available
  useEffect(() => {
    if (!activeId && queues.length > 0) setActiveId(queues[0].id);
  }, [queues, activeId]);

  return (
    <div style={{ paddingBottom: 32 }}>
      <PageHeader
        title="Queues"
        subtitle="Recurring auto-post slots that drain pre-written content"
        action={<Button icon={Plus} onClick={() => setShowCreate(true)}>New Queue</Button>}
      />

      <div style={{
        display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)',
        gap: 16, padding: '0 24px',
      }} className="queue-grid">
        {/* Left: queue list */}
        <Card padding="none" style={{ overflow: 'hidden' }}>
          {loading && <div style={{ padding: 16, color: 'var(--text-tertiary)' }}>Loading…</div>}
          {!loading && queues.length === 0 && (
            <EmptyState
              icon={Layers}
              title="No queues yet"
              description="Queues schedule recurring posts. Create one with a cron rule like '0 10 * * 1-5' for weekday mornings."
              action={<Button icon={Plus} onClick={() => setShowCreate(true)}>Create queue</Button>}
            />
          )}
          {queues.map((q) => (
            <QueueRow key={q.id} queue={q} active={activeId === q.id}
                      onClick={() => setActiveId(q.id)} onChange={refetch} />
          ))}
        </Card>

        {/* Right: queue items */}
        <Card padding="none" style={{ overflow: 'hidden' }}>
          {activeId
            ? <QueueDetail queueId={activeId} onChanged={refetch} />
            : <EmptyState icon={Layers} title="Select a queue" />}
        </Card>
      </div>

      {showCreate && (
        <CreateQueueModal
          onClose={() => setShowCreate(false)}
          onCreated={(q) => { setShowCreate(false); refetch(); setActiveId(q.id); }}
        />
      )}

      <style>{`
        @media (max-width: 900px) {
          .queue-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

/* ── Queue list row ───────────────────────────────────────────────────── */
function QueueRow({ queue, active, onClick, onChange }) {
  async function toggle() {
    try {
      if (queue.is_active) await composerAPI.queues.pause(queue.id);
      else                  await composerAPI.queues.resume(queue.id);
      onChange();
    } catch { toast.error('Failed'); }
  }
  async function destroy(e) {
    e.stopPropagation();
    if (!window.confirm(`Delete queue "${queue.name}"?`)) return;
    try { await composerAPI.queues.delete(queue.id); onChange(); }
    catch { toast.error('Delete failed'); }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '12px 14px',
        background: active ? 'var(--brand-primary-glow)' : 'transparent',
        border: 'none', borderBottom: '1px solid var(--border-subtle)',
        cursor: 'pointer', minHeight: 'unset', minWidth: 'unset',
        transition: 'var(--transition-fast)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
            {queue.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            {queue.schedule_rule || '— no rule —'}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <Badge variant={queue.is_active ? 'success' : 'default'} dot>
              {queue.is_active ? 'Active' : 'Paused'}
            </Badge>
            <Badge>{queue.waiting_count} waiting</Badge>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); toggle(); }}
            aria-label={queue.is_active ? 'Pause' : 'Resume'}
            style={iconBtnStyle}
          >
            {queue.is_active ? <Pause size={12} /> : <Play size={12} />}
          </span>
          <span
            role="button"
            onClick={destroy}
            aria-label="Delete queue"
            style={{ ...iconBtnStyle, color: 'var(--danger)' }}
          >
            <Trash2 size={12} />
          </span>
        </div>
      </div>
    </button>
  );
}

/* ── Queue detail (items list) ────────────────────────────────────────── */
function QueueDetail({ queueId, onChanged }) {
  const [queue, setQueue] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await composerAPI.queues.get(queueId);
      setQueue(res.data);
      setItems(res.data.items_list || []);  // not always exposed; fall back below
      // Items are nested via prefetch on the serializer's items_count, but the
      // item list itself isn't part of the queue serializer — fetch separately.
      // We just compute from items_count & waiting_count for the header here.
    } catch (e) {
      toast.error('Failed to load queue');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [queueId]);

  async function addItem(content) {
    try {
      await composerAPI.queues.addItems(queueId, [{ content }]);
      toast.success('Added to queue');
      load(); onChanged?.();
    } catch (e) { toast.error('Failed to add'); }
  }

  if (loading || !queue) {
    return <div style={{ padding: 16, color: 'var(--text-tertiary)' }}>Loading…</div>;
  }

  return (
    <div>
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
            {queue.name}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4,
          }}>
            <Clock size={12} />
            <span style={{ fontFamily: 'var(--font-mono)' }}>{queue.schedule_rule || '—'}</span>
            <span>·</span>
            <span>{queue.queue_strategy}</span>
            <span>·</span>
            <span>{(queue.platforms || []).join(', ') || 'no platforms'}</span>
          </div>
        </div>
        <Button icon={Plus} size="sm" onClick={() => setShowAdd(true)}>Add item</Button>
      </div>

      <div style={{ padding: 16 }}>
        <div style={{
          display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-secondary)',
          marginBottom: 16,
        }}>
          <span><strong>{queue.items_count}</strong> total items</span>
          <span><strong>{queue.waiting_count}</strong> waiting</span>
          {queue.last_dispatched_at && (
            <span>last fired {new Date(queue.last_dispatched_at).toLocaleString()}</span>
          )}
        </div>

        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          To inspect or reorder individual queued items, use the <code style={code}>composer/queues/&#123;id&#125;/reorder</code> endpoint.
          The next item drains automatically every minute when this queue is active and a slot is due.
        </div>
      </div>

      {showAdd && (
        <AddItemModal onClose={() => setShowAdd(false)}
                      onSave={(content) => { addItem(content); setShowAdd(false); }} />
      )}
    </div>
  );
}

/* ── Modals ───────────────────────────────────────────────────────────── */
function CreateQueueModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '',
    schedule_rule: '0 10 * * 1-5',
    queue_strategy: 'sequential',
    platforms: ['facebook', 'instagram'],
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const res = await composerAPI.queues.create(form);
      onCreated(res.data);
      toast.success('Queue created');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed');
    } finally { setSaving(false); }
  }

  return (
    <Backdrop onClose={onClose}>
      <Card padding="none" style={{ width: 'min(480px, 92vw)' }}>
        <div style={modalHeader}>
          <h3 style={{ margin: 0, fontSize: 16 }}>New queue</h3>
          <button onClick={onClose} style={iconBtnStyle} aria-label="Close"><X size={14} /></button>
        </div>
        <div style={{ padding: 16 }}>
          <Field label="Name">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                   placeholder="Weekday mornings" style={inputStyle} autoFocus />
          </Field>
          <Field label="Schedule (cron)">
            <input value={form.schedule_rule}
                   onChange={(e) => setForm({ ...form, schedule_rule: e.target.value })}
                   placeholder="0 10 * * 1-5"
                   style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
            <span style={helpStyle}>e.g. <code style={code}>0 10 * * 1-5</code> = 10am Mon–Fri</span>
          </Field>
          <Field label="Strategy">
            <select value={form.queue_strategy}
                    onChange={(e) => setForm({ ...form, queue_strategy: e.target.value })}
                    style={inputStyle}>
              {STRATEGIES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Platforms">
            <input value={(form.platforms || []).join(', ')}
                   onChange={(e) => setForm({ ...form, platforms: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })}
                   placeholder="facebook, instagram"
                   style={inputStyle} />
          </Field>
        </div>
        <div style={modalFooter}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>Create</Button>
        </div>
      </Card>
    </Backdrop>
  );
}

function AddItemModal({ onClose, onSave }) {
  const [content, setContent] = useState('');
  return (
    <Backdrop onClose={onClose}>
      <Card padding="none" style={{ width: 'min(520px, 92vw)' }}>
        <div style={modalHeader}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Add to queue</h3>
          <button onClick={onClose} style={iconBtnStyle} aria-label="Close"><X size={14} /></button>
        </div>
        <div style={{ padding: 16 }}>
          <Field label="Post content">
            <textarea value={content} onChange={(e) => setContent(e.target.value)}
                      rows={6} placeholder="Write the post that'll fire next time this queue runs…"
                      style={{ ...inputStyle, height: 'auto', padding: '10px 12px', resize: 'vertical' }} />
          </Field>
        </div>
        <div style={modalFooter}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(content)} disabled={!content.trim()}>Add</Button>
        </div>
      </Card>
    </Backdrop>
  );
}

/* ── Layout helpers ───────────────────────────────────────────────────── */
function Backdrop({ onClose, children }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(10,14,20,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

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
  color: 'var(--text-tertiary)', textTransform: 'uppercase',
  letterSpacing: 0.4, marginBottom: 6,
};

const helpStyle = {
  display: 'block', marginTop: 4, fontSize: 11, color: 'var(--text-tertiary)',
};

const code = {
  background: 'var(--surface-sunken)', padding: '0 6px', borderRadius: 4,
  fontFamily: 'var(--font-mono)', fontSize: 11,
};

const iconBtnStyle = {
  width: 28, height: 28, borderRadius: 'var(--radius-sm)',
  background: 'transparent', border: 'none', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--text-tertiary)',
  minHeight: 'unset', minWidth: 'unset',
};

const modalHeader = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)',
};

const modalFooter = {
  display: 'flex', justifyContent: 'flex-end', gap: 8,
  padding: '12px 16px', borderTop: '1px solid var(--border-subtle)',
};
