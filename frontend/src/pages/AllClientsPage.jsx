import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClients } from '../hooks/useData';
import { adminAPI } from '../services/api';
import { Plus, Search, ChevronRight, Settings, Pencil } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';

export default function AllClientsPage({ onSelectClient }) {
  const navigate               = useNavigate();
  const { clients, refetch }   = useClients();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm]        = useState({ company:'', name:'', email:'', password:'' });
  const [creating, setCreating]= useState(false);
  const [createMsg, setCreateMsg] = useState('');
  const [search, setSearch]    = useState('');

  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    return !q || c.company?.toLowerCase().includes(q) || c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
  });

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true); setCreateMsg('');
    try {
      await adminAPI.createClient(form);
      setCreateMsg('✅ User created! They can now log in.');
      setForm({ company:'', name:'', email:'', password:'' });
      refetch();
    } catch (err) {
      setCreateMsg('❌ ' + (err.response?.data?.error || 'Error creating user'));
    } finally { setCreating(false); }
  };

  return (
    <div style={styles.page}>
      <PageHeader
        title="All Users"
        subtitle={`${filtered.length} of ${clients.length} user${clients.length !== 1 ? 's' : ''}`}
        actions={(
          <button onClick={() => setShowCreate(s => !s)} style={styles.addBtn}>
            <span style={styles.btnInner}><Plus size={16} /> Add New User</span>
          </button>
        )}
      />

      {showCreate && (
        <div style={styles.createBox}>
          <h3 style={styles.createTitle}>Create User Account</h3>
          <form onSubmit={handleCreate} style={styles.createForm}>
            <input placeholder="Company name *" value={form.company}
              onChange={e => setForm(f => ({...f, company: e.target.value}))}
              required style={styles.formInput} />
            <input placeholder="Contact name *" value={form.name}
              onChange={e => setForm(f => ({...f, name: e.target.value}))}
              required style={styles.formInput} />
            <input placeholder="Email (login) *" type="email" value={form.email}
              onChange={e => setForm(f => ({...f, email: e.target.value}))}
              required style={styles.formInput} />
            <input placeholder="Password *" type="password" value={form.password}
              onChange={e => setForm(f => ({...f, password: e.target.value}))}
              required style={styles.formInput} />
            <button type="submit" disabled={creating} style={styles.createBtn}>
              {creating ? 'Creating…' : 'Create User'}
            </button>
          </form>
          {createMsg && <div style={styles.createMsg}>{createMsg}</div>}
        </div>
      )}

      {/* Filter bar */}
      <div style={styles.filterBar}>
        <div style={styles.searchWrapper}>
          <Search size={15} style={styles.searchIcon} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by company, name or email…"
            style={styles.searchInput}
          />
        </div>
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              {['Company','Contact','Email','Website','Actions'].map(h => (
                <th key={h} style={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} style={styles.empty}>
                {clients.length === 0 ? 'No users yet. Add your first user above.' : 'No users match your search.'}
              </td></tr>
            ) : filtered.map(c => (
              <tr key={c.id} style={styles.tr}>
                <td style={{ ...styles.td, fontWeight: 600 }}>{c.company}</td>
                <td style={styles.td}>{c.name}</td>
                <td style={styles.td}>{c.email}</td>
                <td style={styles.td}>
                  {c.website
                    ? <a href={c.website} target="_blank" rel="noreferrer" style={styles.link}>{c.website}</a>
                    : '—'}
                </td>
                <td style={styles.td}>
                  <div style={styles.actions}>
                    <button
                      onClick={() => { onSelectClient?.(c); navigate(`/admin/client/${c.id}`); }}
                      style={styles.viewBtn}
                    >
                      <span style={styles.btnInner}>Dashboard <ChevronRight size={13} /></span>
                    </button>
                    <button
                      onClick={() => { onSelectClient?.(c); navigate(`/admin/client/${c.id}/settings`); }}
                      style={styles.iconBtn}
                    >
                      <span style={styles.btnInner}><Settings size={13} /> Connect</span>
                    </button>
                    <button
                      onClick={() => { onSelectClient?.(c); navigate(`/admin/client/${c.id}/edit`); }}
                      style={styles.iconBtn}
                    >
                      <span style={styles.btnInner}><Pencil size={13} /> Edit</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles = {
  page:     { padding: '28px 32px', maxWidth: 1400, margin: '0 auto' },
  addBtn: {
    padding: '10px 20px', borderRadius: 10, border: 'none',
    background: '#00d7ff', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13,
  },
  btnInner: { display: 'flex', alignItems: 'center', gap: 6 },
  createBox: {
    background: '#f0f9ff', border: '1.5px solid #bae6fd', borderRadius: 14,
    padding: 24, marginBottom: 24,
  },
  createTitle: { margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#0369a1' },
  createForm:  { display: 'flex', flexWrap: 'wrap', gap: 10 },
  formInput: {
    flex: '1 1 180px', padding: '10px 14px', borderRadius: 8,
    border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none',
  },
  createBtn: {
    padding: '10px 24px', borderRadius: 8, border: 'none',
    background: '#0369a1', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13,
  },
  createMsg: { marginTop: 12, fontSize: 14 },
  filterBar: { marginBottom: 16 },
  searchWrapper: {
    position: 'relative', display: 'inline-flex', alignItems: 'center',
    width: '100%', maxWidth: 360,
  },
  searchIcon: {
    position: 'absolute', left: 10, color: '#94a3b8', pointerEvents: 'none',
  },
  searchInput: {
    width: '100%', padding: '9px 14px 9px 32px', borderRadius: 8,
    border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none', boxSizing: 'border-box',
  },
  tableWrap: {
    background: '#fff', borderRadius: 14, padding: 24,
    boxShadow: '0 1px 6px rgba(0,0,0,.07)', overflowX: 'auto',
  },
  table:  { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left', padding: '10px 12px', background: '#f0f4f9',
    color: '#64748b', fontWeight: 600, fontSize: 12, borderBottom: '1px solid #e5e7eb',
    whiteSpace: 'nowrap',
  },
  tr:   { borderBottom: '1px solid #f1f5f9' },
  td:   { padding: '12px 12px', color: '#374151' },
  empty:{ padding: '40px 12px', textAlign: 'center', color: '#94a3b8' },
  link: { color: '#00d7ff', textDecoration: 'none' },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  viewBtn: {
    padding: '6px 14px', borderRadius: 8, border: '1.5px solid #00d7ff',
    background: 'transparent', color: '#00d7ff', cursor: 'pointer', fontWeight: 600, fontSize: 12,
  },
  iconBtn: {
    padding: '6px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb',
    background: 'transparent', color: '#64748b', cursor: 'pointer', fontWeight: 600, fontSize: 12,
  },
};
