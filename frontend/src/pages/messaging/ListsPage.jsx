/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useState } from 'react';
import { Plus, ListChecks, Trash2, Users2, Calendar } from 'lucide-react';

import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import Badge from '../../components/ui/Badge';
import { useWhatsAppLists } from '../../hooks/useWhatsApp';
import { whatsappAPI } from '../../services/api';

export default function ListsPage() {
  const { data: lists, refetch, loading } = useWhatsAppLists();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div style={{ paddingBottom: 32 }}>
      <PageHeader
        title="Lists"
        subtitle="Segment your contacts into reusable audiences"
        action={
          <Button icon={Plus} onClick={() => setShowCreate(true)}>New List</Button>
        }
      />

      <div style={{ padding: '0 24px' }}>
        {!loading && (lists || []).length === 0 && (
          <Card padding="none" style={{ overflow: 'hidden' }}>
            <EmptyState
              icon={ListChecks}
              title="Create your first list"
              description="Lists let you target specific contact segments with campaigns. Group customers by tag, location, lifecycle stage, or any other dimension."
              action={<Button icon={Plus} onClick={() => setShowCreate(true)}>New List</Button>}
            />
          </Card>
        )}

        {(lists || []).length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 16,
          }}>
            {lists.map((l) => (
              <ListCard key={l.id} list={l} onChange={refetch} />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); refetch(); }}
        />
      )}
    </div>
  );
}

function ListCard({ list, onChange }) {
  return (
    <Card interactive padding="md">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36,
          borderRadius: 'var(--radius-sm)',
          background: 'var(--brand-primary-glow)',
          color: 'var(--brand-primary-hover)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ListChecks size={16} strokeWidth={2.4} />
        </div>
        <Badge variant="default">{list.contact_count} contacts</Badge>
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
        {list.name}
      </div>
      {list.description && (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 12 }}>
          {list.description}
        </div>
      )}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 12, paddingTop: 12,
        borderTop: '1px solid var(--border-subtle)',
        fontSize: 11, color: 'var(--text-tertiary)',
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Calendar size={11} />
          {new Date(list.created_at).toLocaleDateString()}
        </span>
        <Button
          variant="ghost"
          size="sm"
          icon={Trash2}
          iconOnly
          aria-label="Delete list"
          onClick={async (e) => {
            e.preventDefault(); e.stopPropagation();
            if (window.confirm(`Delete "${list.name}"?`)) {
              await whatsappAPI.lists.delete(list.id);
              onChange();
            }
          }}
        />
      </div>
    </Card>
  );
}

function CreateModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await whatsappAPI.lists.create({ name, description });
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(10,14,20,0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200,
      }}
    >
      <Card
        onClick={(e) => e.stopPropagation()}
        padding="md"
        style={{ width: 'min(440px, 92vw)' }}
      >
        <Card.Header title="New list" subtitle="Group contacts for targeted outreach" />
        <Card.Body>
          <label style={field}>
            <span style={fieldLabel}>Name</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VIP customers"
              style={input}
            />
          </label>
          <label style={field}>
            <span style={fieldLabel}>Description (optional)</span>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What kind of contacts belong here?"
              style={{ ...input, resize: 'vertical' }}
            />
          </label>
        </Card.Body>
        <Card.Footer>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving} disabled={!name.trim()}>Create</Button>
        </Card.Footer>
      </Card>
    </div>
  );
}

const field = { display: 'block', marginBottom: 12 };
const fieldLabel = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.4,
  marginBottom: 6,
};
const input = {
  width: '100%', padding: '10px 12px',
  background: 'var(--surface-card)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  fontSize: 14, color: 'var(--text-primary)',
  outline: 'none', boxSizing: 'border-box',
};
