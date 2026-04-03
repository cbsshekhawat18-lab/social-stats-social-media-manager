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
  const [errors, setErrors]    = useState({});
  const [creating, setCreating]= useState(false);
  const [createMsg, setCreateMsg] = useState('');
  const [search, setSearch]    = useState('');

  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    return !q || c.company?.toLowerCase().includes(q) || c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
  });

  const handleFieldChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validateCreateForm = () => {
    const nextErrors = {};
    if (!form.company.trim()) nextErrors.company = 'Company name is required.';
    if (!form.name.trim()) nextErrors.name = 'Contact name is required.';
    if (!form.email.trim()) nextErrors.email = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(form.email)) nextErrors.email = 'Enter a valid email address.';
    if (!form.password.trim()) nextErrors.password = 'Password is required.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!validateCreateForm()) {
      setCreateMsg('❌ Please fix the highlighted fields.');
      return;
    }
    setCreating(true); setCreateMsg('');
    try {
      await adminAPI.createClient(form);
      setCreateMsg('✅ User created! They can now log in.');
      setForm({ company:'', name:'', email:'', password:'' });
      setErrors({});
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
            <div style={styles.field}>
              <label style={styles.label}>Company Name <span style={styles.requiredAsterisk}>*</span></label>
              <input
                placeholder="Acme Corp"
                value={form.company}
                onChange={e => handleFieldChange('company', e.target.value)}
                style={{ ...styles.formInput, ...(errors.company ? styles.inputError : {}) }}
              />
              {errors.company && <div style={styles.errorText}>{errors.company}</div>}
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Contact Name <span style={styles.requiredAsterisk}>*</span></label>
              <input
                placeholder="John Smith"
                value={form.name}
                onChange={e => handleFieldChange('name', e.target.value)}
                style={{ ...styles.formInput, ...(errors.name ? styles.inputError : {}) }}
              />
              {errors.name && <div style={styles.errorText}>{errors.name}</div>}
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Email <span style={styles.requiredAsterisk}>*</span></label>
              <input
                placeholder="john@acme.com"
                type="email"
                value={form.email}
                onChange={e => handleFieldChange('email', e.target.value)}
                style={{ ...styles.formInput, ...(errors.email ? styles.inputError : {}) }}
              />
              {errors.email && <div style={styles.errorText}>{errors.email}</div>}
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Password <span style={styles.requiredAsterisk}>*</span></label>
              <input
                placeholder="Create a password"
                type="password"
                value={form.password}
                onChange={e => handleFieldChange('password', e.target.value)}
                style={{ ...styles.formInput, ...(errors.password ? styles.inputError : {}) }}
              />
              {errors.password && <div style={styles.errorText}>{errors.password}</div>}
            </div>
            <button type="submit" disabled={creating} style={styles.createBtn}>
              {creating ? 'Creating…' : 'Create User'}
            </button>
          </form>
          {createMsg && <div style={createMsg.startsWith('✅') ? styles.successMsg : styles.errorMsg}>{createMsg}</div>}
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
                      <span style={styles.btnInner}><Settings size={13} /> Account</span>
                    </button>
                    {/* <button
                      onClick={() => { onSelectClient?.(c); navigate(`/admin/client/${c.id}/edit`); }}
                      style={styles.iconBtn}
                    >
                      <span style={styles.btnInner}><Pencil size={13} /> Edit</span>
                    </button> */}
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
  createForm:  { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-start' },
  field: { flex: '1 1 220px', minWidth: 0 },
  label: { display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#374151' },
  requiredAsterisk: { color: '#ef4444', marginLeft: 2, fontWeight: 800 },
  formInput: {
    flex: '1 1 180px', padding: '10px 14px', borderRadius: 8,
    border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  inputError: { borderColor: '#ef4444', background: '#fef2f2' },
  errorText: { marginTop: 6, fontSize: 12, color: '#dc2626' },
  createBtn: {
    padding: '10px 24px', borderRadius: 8, border: 'none',
    background: '#0369a1', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13, alignSelf: 'flex-start',
  },
  successMsg: { marginTop: 12, padding: '10px 14px', borderRadius: 8, background: '#dcfce7', color: '#16a34a', fontSize: 13 },
  errorMsg: { marginTop: 12, padding: '10px 14px', borderRadius: 8, background: '#fee2e2', color: '#dc2626', fontSize: 13 },
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
