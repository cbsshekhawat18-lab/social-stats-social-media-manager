import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientsAPI } from '../services/api';
import { ArrowLeft } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';

export default function EditClientPage({ clientId, onSelectClient }) {
  const navigate       = useNavigate();
  const [form, setForm]= useState({ company:'', name:'', email:'', phone:'', website:'' });
  const [saving, setSaving]   = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg]         = useState('');

  useEffect(() => {
    clientsAPI.get(clientId).then(res => {
      const c = res.data;
      setForm({
        company: c.company || '',
        name:    c.name    || '',
        email:   c.email   || '',
        phone:   c.phone   || '',
        website: c.website || '',
      });
      setLoading(false);
    }).catch(() => { setMsg('❌ Failed to load client.'); setLoading(false); });
  }, [clientId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setMsg('');
    try {
      const res = await clientsAPI.update(clientId, form);
      onSelectClient?.(res.data);
      setMsg('✅ Client updated successfully.');
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.error || JSON.stringify(err.response?.data) || 'Update failed'));
    } finally { setSaving(false); }
  };

  if (loading) return <div style={styles.loading}>Loading…</div>;

  return (
    <div style={styles.page}>
      <PageHeader
        title="Edit User"
        subtitle="Update user details"
        actions={(
          <button onClick={() => navigate(-1)} style={styles.backBtn}>
            <span style={styles.backBtnInner}><ArrowLeft size={16} /> Back</span>
          </button>
        )}
      />

      <div style={styles.card}>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.row}>
            <label style={styles.label}>Company Name *</label>
            <input
              value={form.company}
              onChange={e => setForm(f => ({...f, company: e.target.value}))}
              required style={styles.input}
              placeholder="Acme Corp"
            />
          </div>
          <div style={styles.row}>
            <label style={styles.label}>Contact Name *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({...f, name: e.target.value}))}
              required style={styles.input}
              placeholder="John Smith"
            />
          </div>
          <div style={styles.row}>
            <label style={styles.label}>Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({...f, email: e.target.value}))}
              required style={styles.input}
              placeholder="john@acme.com"
            />
          </div>
          <div style={styles.row}>
            <label style={styles.label}>Phone</label>
            <input
              value={form.phone}
              onChange={e => setForm(f => ({...f, phone: e.target.value}))}
              style={styles.input}
              placeholder="+1 555 000 0000"
            />
          </div>
          <div style={styles.row}>
            <label style={styles.label}>Website</label>
            <input
              value={form.website}
              onChange={e => setForm(f => ({...f, website: e.target.value}))}
              style={styles.input}
              placeholder="https://acme.com"
            />
          </div>

          {msg && <div style={msg.startsWith('✅') ? styles.success : styles.error}>{msg}</div>}

          <div style={styles.actions}>
            <button type="button" onClick={() => navigate(-1)} style={styles.cancelBtn}>
              Cancel
            </button>
            <button type="submit" disabled={saving} style={styles.saveBtn}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  page:     { padding: '28px 32px', maxWidth: 700, margin: '0 auto' },
  loading:  { padding: 60, textAlign: 'center', color: '#94a3b8' },
  backBtn: {
    padding: '8px 16px', borderRadius: 8, border: '1.5px solid #e5e7eb',
    background: '#fff', color: '#374151', cursor: 'pointer', fontWeight: 600, fontSize: 13,
  },
  backBtnInner: { display: 'flex', alignItems: 'center', gap: 6 },
  card: {
    background: '#fff', borderRadius: 14, padding: 32,
    boxShadow: '0 1px 6px rgba(0,0,0,.07)',
  },
  form:    { display: 'flex', flexDirection: 'column', gap: 20 },
  row:     { display: 'flex', flexDirection: 'column', gap: 6 },
  label:   { fontSize: 13, fontWeight: 600, color: '#374151' },
  input: {
    padding: '10px 14px', borderRadius: 8, border: '1.5px solid #e5e7eb',
    fontSize: 14, outline: 'none', color: '#0f172a',
  },
  success: { padding: '10px 14px', borderRadius: 8, background: '#dcfce7', color: '#16a34a', fontSize: 13 },
  error:   { padding: '10px 14px', borderRadius: 8, background: '#fee2e2', color: '#dc2626', fontSize: 13 },
  actions: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 },
  cancelBtn: {
    padding: '10px 20px', borderRadius: 8, border: '1.5px solid #e5e7eb',
    background: '#fff', color: '#374151', cursor: 'pointer', fontWeight: 600, fontSize: 13,
  },
  saveBtn: {
    padding: '10px 24px', borderRadius: 8, border: 'none',
    background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13,
  },
};
