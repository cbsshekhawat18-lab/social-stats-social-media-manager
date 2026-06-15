/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useRef, useState } from 'react';
import {
  Plus, Upload, Search, Trash2, CheckSquare, XSquare,
  AlertCircle, Loader2, ListPlus, Download,
} from 'lucide-react';

import PageHeader from '../components/layout/PageHeader';
import { useWhatsAppContacts, useWhatsAppLists } from '../hooks/useWhatsApp';
import { whatsappAPI } from '../services/api';

const COLORS = {
  primary: '#00CCF5', primaryD: '#00A8D8',
  border: 'var(--border-default)', text: 'var(--text-primary)', muted: 'var(--text-secondary)',
  success: '#10b981', danger: '#dc2626',
};

const OPT_COLORS = {
  pending:   { bg: '#fef3c7', color: '#a16207', label: 'Pending' },
  opted_in:  { bg: '#dcfce7', color: '#15803d', label: 'Opted in' },
  opted_out: { bg: '#fee2e2', color: '#b91c1c', label: 'Opted out' },
};

export default function WhatsAppContactsPage() {
  const [search, setSearch] = useState('');
  const [optIn, setOptIn] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInput = useRef(null);

  const params = {};
  if (search) params.search = search;
  if (optIn) params.opt_in_status = optIn;
  const { data: contacts, refetch, loading } = useWhatsAppContacts(params);
  const { data: lists, refetch: refetchLists } = useWhatsAppLists();

  function toggle(id) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }
  function toggleAll() {
    if (selected.size === contacts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(contacts.map((c) => c.id)));
    }
  }

  async function importCSV(file) {
    setImporting(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await whatsappAPI.contacts.importCSV(fd);
      setImportResult(res.data);
      await refetch();
    } catch (e) {
      setImportResult({ error: e.response?.data?.error || e.message });
    } finally {
      setImporting(false);
    }
  }

  async function bulkOptIn() {
    await whatsappAPI.contacts.bulkOptIn(Array.from(selected));
    setSelected(new Set());
    refetch();
  }
  async function bulkOptOut() {
    await whatsappAPI.contacts.bulkOptOut(Array.from(selected));
    setSelected(new Set());
    refetch();
  }
  async function exportCSV() {
    const res = await whatsappAPI.contacts.exportCSV();
    const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'whatsapp_contacts.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ paddingBottom: 32 }}>
      <PageHeader
        title="Contacts"
        subtitle={`${contacts?.length || 0} contacts`}
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => fileInput.current?.click()} style={btnSecondary}>
              <Upload size={14} /> Import CSV
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => e.target.files?.[0] && importCSV(e.target.files[0])}
            />
            <button onClick={() => setShowCreate(true)} style={btnPrimary}>
              <Plus size={14} /> New Contact
            </button>
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 280px', gap: 16, padding: '0 16px' }}>
        {/* Main */}
        <div>
          {/* Toolbar */}
          <div style={{ ...card, padding: 12, marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={14} color={COLORS.muted}
                      style={{ position: 'absolute', top: 11, left: 10 }} />
              <input
                placeholder="Search phone, name, email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ ...input, paddingLeft: 32 }}
              />
            </div>
            <select value={optIn} onChange={(e) => setOptIn(e.target.value)} style={input}>
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="opted_in">Opted in</option>
              <option value="opted_out">Opted out</option>
            </select>
            <button onClick={exportCSV} style={btnSecondary}><Download size={14} /> Export</button>
          </div>

          {importResult && (
            <ImportResult result={importResult} onDismiss={() => setImportResult(null)} />
          )}
          {importing && <div style={infoBox}><Loader2 size={14} className="spin" /> Importing…</div>}

          {/* Bulk actions */}
          {selected.size > 0 && (
            <div style={{ ...card, padding: 10, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: COLORS.muted }}>{selected.size} selected</span>
              <button onClick={bulkOptIn} style={btnSecondary}><CheckSquare size={14} /> Opt-in</button>
              <button onClick={bulkOptOut} style={btnSecondary}><XSquare size={14} /> Opt-out</button>
              <BulkAddToList lists={lists} ids={Array.from(selected)} onDone={() => { setSelected(new Set()); refetch(); refetchLists(); }} />
            </div>
          )}

          {/* Table */}
          <div style={card}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={th}>
                    <input type="checkbox"
                           checked={contacts.length > 0 && selected.size === contacts.length}
                           onChange={toggleAll} />
                  </th>
                  <th style={th}>Phone</th>
                  <th style={th}>Name</th>
                  <th style={th}>Email</th>
                  <th style={th}>Tags</th>
                  <th style={th}>Status</th>
                  <th style={th}>24h</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={8} style={emptyRow}><Loader2 size={14} className="spin" /> Loading…</td></tr>
                )}
                {!loading && contacts.length === 0 && (
                  <tr><td colSpan={8} style={emptyRow}>No contacts. Import a CSV or add one manually.</td></tr>
                )}
                {contacts.map((c) => {
                  const opt = OPT_COLORS[c.opt_in_status] || OPT_COLORS.pending;
                  return (
                    <tr key={c.id}>
                      <td style={td}>
                        <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                      </td>
                      <td style={{ ...td, fontFamily: 'monospace' }}>{c.phone}</td>
                      <td style={td}>{c.name}</td>
                      <td style={td}>{c.email}</td>
                      <td style={td}>{(c.tags || []).map((t) => <span key={t} style={tag}>{t}</span>)}</td>
                      <td style={td}>
                        <span style={{ ...badge, background: opt.bg, color: opt.color }}>{opt.label}</span>
                      </td>
                      <td style={td}>
                        {c.within_24h_window
                          ? <span style={{ ...badge, background: '#dcfce7', color: '#15803d' }}>open</span>
                          : <span style={{ ...badge, background: 'var(--surface-sunken)', color: 'var(--text-secondary)' }}>closed</span>}
                      </td>
                      <td style={td}>
                        <button onClick={() => deleteContact(c.id, refetch)}
                                style={{ ...iconBtn, color: COLORS.danger }}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lists side panel */}
        <ListsPanel lists={lists} refetch={refetchLists} />
      </div>

      {showCreate && (
        <CreateContactModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refetch(); }} />
      )}

      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

async function deleteContact(id, refetch) {
  if (!window.confirm('Delete this contact?')) return;
  await whatsappAPI.contacts.delete(id);
  refetch();
}

function ImportResult({ result, onDismiss }) {
  if (result.error) {
    return (
      <div style={{ ...errorBox, marginBottom: 12 }}>
        <AlertCircle size={14} /> Import failed: {result.error}
        <button onClick={onDismiss} style={{ marginLeft: 'auto', ...iconBtn }}>×</button>
      </div>
    );
  }
  return (
    <div style={{ ...infoBox, marginBottom: 12 }}>
      <span>
        Imported {result.created} created · {result.updated} updated · {result.skipped} skipped
        {result.errors?.length ? ` · ${result.errors.length} errors` : ''}
      </span>
      <button onClick={onDismiss} style={{ marginLeft: 'auto', ...iconBtn }}>×</button>
    </div>
  );
}

function ListsPanel({ lists, refetch }) {
  const [name, setName] = useState('');
  async function create() {
    if (!name.trim()) return;
    await whatsappAPI.lists.create({ name });
    setName('');
    refetch();
  }
  return (
    <aside style={card}>
      <header style={cardHeader}><h3 style={cardTitle}>Lists</h3></header>
      <div style={{ padding: 14 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New list name"
            style={input}
          />
          <button onClick={create} style={btnPrimary}><Plus size={14} /></button>
        </div>
        {(lists || []).length === 0 && (
          <div style={{ fontSize: 12, color: COLORS.muted }}>No lists yet.</div>
        )}
        {(lists || []).map((l) => (
          <div key={l.id} style={listRow}>
            <span style={{ fontWeight: 600, color: COLORS.text }}>{l.name}</span>
            <span style={{ fontSize: 12, color: COLORS.muted }}>{l.contact_count} contacts</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

function BulkAddToList({ lists, ids, onDone }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen((v) => !v)} style={btnSecondary}>
        <ListPlus size={14} /> Add to list
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4,
          background: 'var(--surface-card)', border: `1px solid ${COLORS.border}`, borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)', minWidth: 200, zIndex: 10,
        }}>
          {(lists || []).length === 0 && (
            <div style={{ padding: 12, fontSize: 13, color: COLORS.muted }}>No lists. Create one first.</div>
          )}
          {(lists || []).map((l) => (
            <button
              key={l.id}
              onClick={async () => {
                await whatsappAPI.contacts.addToList(ids, l.id);
                setOpen(false);
                onDone?.();
              }}
              style={dropdownItem}
            >
              {l.name} <span style={{ marginLeft: 'auto', color: COLORS.muted, fontSize: 11 }}>{l.contact_count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateContactModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ phone: '', name: '', email: '', opt_in_status: 'pending' });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await whatsappAPI.contacts.create(form);
      onCreated();
    } catch (e) {
      setError(e.response?.data?.detail || JSON.stringify(e.response?.data) || e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={modalBackdrop} onClick={onClose}>
      <div style={modalBox} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0, color: COLORS.text }}>New Contact</h3>
        <Field label="Phone (E.164)" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="+91XXXXXXXXXX" />
        <Field label="Name"  value={form.name}  onChange={(v) => setForm({ ...form, name: v })} />
        <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={fieldLabel}>Opt-in</span>
          <select value={form.opt_in_status} onChange={(e) => setForm({ ...form, opt_in_status: e.target.value })} style={input}>
            <option value="pending">Pending</option>
            <option value="opted_in">Opted in</option>
            <option value="opted_out">Opted out</option>
          </select>
        </label>
        {error && <div style={errorBox}><AlertCircle size={14} /> {String(error)}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
          <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? 'Saving…' : 'Create'}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={fieldLabel}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={input} />
    </label>
  );
}

const card = { background: 'var(--surface-card)', border: `1px solid ${COLORS.border}`, borderRadius: 12 };
const cardHeader = {
  padding: '12px 16px', borderBottom: `1px solid ${COLORS.border}`,
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};
const cardTitle = { margin: 0, fontSize: 14, fontWeight: 700, color: COLORS.text };
const input = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: `1px solid ${COLORS.border}`, fontSize: 13, outline: 'none', boxSizing: 'border-box',
};
const fieldLabel = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.04em',
  marginBottom: 4,
};
const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 8, border: 'none',
  background: 'linear-gradient(135deg, #00CCF5, #00A8D8)', color: '#fff',
  fontWeight: 600, fontSize: 13, cursor: 'pointer',
};
const btnSecondary = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 8, border: `1px solid ${COLORS.border}`,
  background: 'var(--surface-card)', color: COLORS.text, fontWeight: 600, fontSize: 13, cursor: 'pointer',
};
const iconBtn = {
  background: 'transparent', border: 'none', padding: 4, cursor: 'pointer',
};
const th = {
  textAlign: 'left', padding: '10px 14px', fontSize: 11,
  textTransform: 'uppercase', letterSpacing: '0.04em',
  color: COLORS.muted, fontWeight: 600, borderBottom: `1px solid ${COLORS.border}`,
};
const td = { padding: '10px 14px', borderBottom: '1px solid var(--surface-sunken)', color: COLORS.text };
const emptyRow = { padding: 24, textAlign: 'center', color: COLORS.muted };
const badge = { display: 'inline-flex', padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600 };
const tag = {
  display: 'inline-block', padding: '2px 8px', borderRadius: 999,
  background: 'var(--surface-sunken)', color: 'var(--text-secondary)', fontSize: 11, marginRight: 4,
};
const listRow = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '8px 10px', borderRadius: 8, marginBottom: 4, background: 'var(--surface-sunken)',
};
const dropdownItem = {
  display: 'flex', alignItems: 'center', width: '100%',
  padding: '8px 12px', background: 'transparent', border: 'none',
  textAlign: 'left', cursor: 'pointer', fontSize: 13, color: COLORS.text,
};
const errorBox = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '8px 12px', borderRadius: 8,
  background: '#fef2f2', color: COLORS.danger,
  border: '1px solid #fecaca', fontSize: 12,
};
const infoBox = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '10px 12px', borderRadius: 8,
  background: '#eff6ff', color: '#1d4ed8',
  border: '1px solid #bfdbfe', fontSize: 13,
};
const modalBackdrop = {
  position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
};
const modalBox = {
  background: 'var(--surface-card)', borderRadius: 14, padding: 24,
  width: '100%', maxWidth: 460, boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
};
