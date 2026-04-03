import { useState, useEffect, useCallback } from 'react';
import { managementAPI } from '../services/api';
import {
  Users, UserCog, Shield, ChevronDown, ChevronRight,
  Plus, Trash2, X, RefreshCw, Eye,
  ToggleLeft, ToggleRight, Save,
} from 'lucide-react';

// ─── helpers ────────────────────────────────────────────────────────────────

function Loader() {
  return (
    <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
      Loading…
    </div>
  );
}

function ErrorMsg({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ padding: '10px 14px', background: '#fef2f2', color: '#dc2626', borderRadius: 10, marginBottom: 14, fontSize: 13 }}>
      {msg}
    </div>
  );
}

function Chip({ label, color = '#00d7ff', bg = '#e6fbff' }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999, background: bg, color, fontSize: 11, fontWeight: 700 }}>
      {label}
    </span>
  );
}

// Convert dict response from get_permissions_grouped to array for rendering
function dictToGroupsArray(dictData) {
  return Object.entries(dictData).map(([page, group]) => ({
    page,
    page_label: group.label,
    permissions: group.permissions.map(p => ({
      ...p,
      value: p.effective !== undefined ? p.effective : p.is_granted,
    })),
  }));
}

// ─── Permission toggle row ───────────────────────────────────────────────────

function PermRow({ code, label, description, value, isOverride, onChange }) {
  return (
    <div style={permRowStyles.row}>
      <div style={permRowStyles.info}>
        <div style={permRowStyles.label}>{label}</div>
        {description && <div style={permRowStyles.desc}>{description}</div>}
        {isOverride && <Chip label="Custom override" color="#00d7ff" bg="#f3e8ff" />}
      </div>
      <button
        type="button"
        onClick={() => onChange(code, !value)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
      >
        {value
          ? <ToggleRight size={28} color="#00d7ff" />
          : <ToggleLeft size={28} color="#94a3b8" />}
      </button>
    </div>
  );
}

const permRowStyles = {
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' },
  info: { flex: 1, minWidth: 0, paddingRight: 12 },
  label: { fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 2 },
  desc: { fontSize: 12, color: '#64748b', marginBottom: 4 },
};

// ─── Permission panel (shared by staff + client) ─────────────────────────────

function PermissionsPanel({ entityId, entityType }) {
  const [groups, setGroups]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [changed, setChanged]   = useState({});
  const [open, setOpen]         = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const fn = entityType === 'staff'
        ? managementAPI.getStaffPermissions
        : managementAPI.getClientPermissions;
      const res = await fn(entityId);
      const arr = dictToGroupsArray(res.data);
      setGroups(arr);
      setChanged({});
      if (arr.length > 0) {
        setOpen({ [arr[0].page]: true });
      }
    } catch {
      setError('Failed to load permissions.');
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType]);

  useEffect(() => { load(); }, [load]);

  const handleToggle = (code, val) => {
    setChanged(prev => ({ ...prev, [code]: val }));
    setGroups(prev => prev.map(g => ({
      ...g,
      permissions: g.permissions.map(p => p.code === code ? { ...p, value: val } : p),
    })));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const grants  = Object.entries(changed).filter(([, v]) => v).map(([c]) => c);
      const revokes = Object.entries(changed).filter(([, v]) => !v).map(([c]) => c);
      const fn = entityType === 'staff'
        ? managementAPI.setStaffPermissions
        : managementAPI.setClientPermissions;
      await fn(entityId, { grants, revokes });
      await load();
    } catch {
      setError('Failed to save permissions.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    setError('');
    try {
      const fn = entityType === 'staff'
        ? managementAPI.setStaffPermissions
        : managementAPI.setClientPermissions;
      await fn(entityId, { reset_all: true });
      await load();
    } catch {
      setError('Failed to reset permissions.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader />;

  const hasChanges = Object.keys(changed).length > 0;

  return (
    <div>
      <ErrorMsg msg={error} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          style={{ ...btnStyles.primary, opacity: !hasChanges ? 0.5 : 1 }}
        >
          <Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}
        </button>
        <button onClick={handleReset} disabled={saving} style={btnStyles.ghost}>
          <RefreshCw size={14} /> Reset to Defaults
        </button>
      </div>
      {groups.map(group => (
        <div key={group.page} style={panelStyles.group}>
          <button
            type="button"
            onClick={() => setOpen(o => ({ ...o, [group.page]: !o[group.page] }))}
            style={panelStyles.groupHeader}
          >
            <span style={panelStyles.groupTitle}>{group.page_label}</span>
            <span style={{ fontSize: 11, color: '#64748b' }}>{group.permissions.length} permissions</span>
            {open[group.page] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          {open[group.page] && (
            <div style={{ padding: '0 16px 8px' }}>
              {group.permissions.map(p => (
                <PermRow
                  key={p.code}
                  code={p.code}
                  label={p.label}
                  description={p.description}
                  value={p.value}
                  isOverride={p.is_override}
                  onChange={handleToggle}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const panelStyles = {
  group: { marginBottom: 10, border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' },
  groupHeader: { width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#f0f4f9', border: 'none', cursor: 'pointer', textAlign: 'left' },
  groupTitle: { flex: 1, fontSize: 13, fontWeight: 700, color: '#0f172a' },
};

// ─── Portal Config panel (client only) ──────────────────────────────────────

function PortalConfigPanel({ clientId }) {
  const [cfg, setCfg]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [saved, setSaved]     = useState(false);

  useEffect(() => {
    managementAPI.getClientPortalConfig(clientId)
      .then(res => setCfg(res.data))
      .catch(() => setError('Failed to load portal config.'))
      .finally(() => setLoading(false));
  }, [clientId]);

  const handleSave = async () => {
    setSaving(true); setError(''); setSaved(false);
    try {
      await managementAPI.saveClientPortalConfig(clientId, cfg);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader />;
  if (!cfg) return <ErrorMsg msg={error || 'No config found.'} />;

  const toggles = [
    { key: 'show_posts_section',   label: 'Posts Section' },
    { key: 'show_roi_section',     label: 'ROI Section' },
    { key: 'show_calendar',        label: 'Content Calendar' },
    { key: 'show_reviews_section', label: 'Reviews Section' },
    { key: 'show_export_button',   label: 'Export Button' },
    { key: 'show_sync_button',     label: 'Sync Button' },
  ];

  return (
    <div>
      <ErrorMsg msg={error} />
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12 }}>Visible Sections</div>
        {toggles.map(t => (
          <div key={t.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 14, color: '#1e293b' }}>{t.label}</span>
            <button
              type="button"
              onClick={() => setCfg(prev => ({ ...prev, [t.key]: !prev[t.key] }))}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {cfg[t.key] ? <ToggleRight size={28} color="#00d7ff" /> : <ToggleLeft size={28} color="#94a3b8" />}
            </button>
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={fieldStyles.label}>Portal Title</label>
        <input
          type="text"
          value={cfg.portal_title || ''}
          onChange={e => setCfg(prev => ({ ...prev, portal_title: e.target.value }))}
          placeholder="Custom portal title…"
          style={fieldStyles.input}
        />
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={fieldStyles.label}>Accent Color</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="color"
            value={cfg.custom_accent_color || '#00d7ff'}
            onChange={e => setCfg(prev => ({ ...prev, custom_accent_color: e.target.value }))}
            style={{ width: 40, height: 36, borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer', padding: 2 }}
          />
          <span style={{ fontSize: 13, color: '#64748b' }}>{cfg.custom_accent_color || '#00d7ff'}</span>
        </div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={fieldStyles.label}>Welcome Message</label>
        <textarea
          value={cfg.welcome_message || ''}
          onChange={e => setCfg(prev => ({ ...prev, welcome_message: e.target.value }))}
          placeholder="Optional message shown on user dashboard…"
          rows={3}
          style={fieldStyles.textarea}
        />
      </div>
      <button onClick={handleSave} disabled={saving} style={btnStyles.primary}>
        <Save size={14} /> {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Config'}
      </button>
    </div>
  );
}

const fieldStyles = {
  label: { display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' },
  input: { width: '100%', padding: '9px 12px', border: '1px solid #dbe5f3', borderRadius: 10, fontSize: 13, color: '#1e293b', background: '#fff', outline: 'none', boxSizing: 'border-box' },
  textarea: { width: '100%', padding: '9px 12px', border: '1px solid #dbe5f3', borderRadius: 10, fontSize: 13, color: '#1e293b', background: '#fff', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' },
};

// ─── Staff Client Assignments panel ─────────────────────────────────────────

function StaffClientsPanel({ staffId }) {
  const [assigned, setAssigned]   = useState([]);
  const [available, setAvailable] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [assignedRes, allRes] = await Promise.all([
        managementAPI.getStaffClients(staffId),
        managementAPI.listClients(),
      ]);
      const assignedList = assignedRes.data;
      const assignedIds = new Set(assignedList.map(c => c.id));
      setAssigned(assignedList);
      setAvailable(allRes.data.filter(c => !assignedIds.has(c.id)));
    } catch {
      setError('Failed to load client assignments.');
    } finally {
      setLoading(false);
    }
  }, [staffId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (clientId) => {
    setSaving(true);
    try {
      await managementAPI.setStaffClients(staffId, { add: [{ client_id: clientId }], remove: [] });
      await load();
    } catch { setError('Failed to add client.'); }
    finally { setSaving(false); }
  };

  const handleRemove = async (clientId) => {
    setSaving(true);
    try {
      await managementAPI.setStaffClients(staffId, { add: [], remove: [clientId] });
      await load();
    } catch { setError('Failed to remove client.'); }
    finally { setSaving(false); }
  };

  if (loading) return <Loader />;

  return (
    <div>
      <ErrorMsg msg={error} />
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
          Assigned Users ({assigned.length})
        </div>
        {assigned.length === 0 && <div style={{ fontSize: 13, color: '#94a3b8' }}>No users assigned yet.</div>}
        {assigned.map(c => (
          <div key={c.id} style={assignStyles.row}>
            <span style={assignStyles.name}>{c.company}</span>
            <button onClick={() => handleRemove(c.id)} disabled={saving} style={assignStyles.removeBtn}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      {available.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
            Add User
          </div>
          {available.map(c => (
            <div key={c.id} style={assignStyles.row}>
              <span style={assignStyles.name}>{c.company}</span>
              <button onClick={() => handleAdd(c.id)} disabled={saving} style={assignStyles.addBtn}>
                <Plus size={14} /> Add
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const assignStyles = {
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 10, background: '#f0f4f9', marginBottom: 6 },
  name: { fontSize: 13, fontWeight: 600, color: '#1e293b' },
  removeBtn: { display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', border: '1px solid #fca5a5', borderRadius: 8, background: '#fff', color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  addBtn: { display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', border: '1px solid #99eeff', borderRadius: 8, background: '#fff', color: '#00d7ff', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
};

// ─── Create Staff Modal ──────────────────────────────────────────────────────

function CreateStaffModal({ onClose, onCreated }) {
  const [form, setForm]     = useState({ name: '', email: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const res = await managementAPI.createStaff(form);
      onCreated(res.data);
      onClose();
    } catch (err) {
      const data = err.response?.data;
      setError(data?.error || (typeof data === 'object' ? JSON.stringify(data) : 'Failed to create staff.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.box}>
        <div style={modalStyles.header}>
          <span style={modalStyles.title}>Add Staff Member</span>
          <button onClick={onClose} style={modalStyles.closeBtn}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <ErrorMsg msg={error} />
          {[
            { key: 'name',     label: 'Full Name', placeholder: 'Jane Smith' },
            { key: 'email',    label: 'Email',     placeholder: 'jane@agency.com', type: 'email' },
            { key: 'password', label: 'Password',  placeholder: '••••••••',        type: 'password' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 14 }}>
              <label style={fieldStyles.label}>{f.label}</label>
              <input
                type={f.type || 'text'}
                placeholder={f.placeholder}
                value={form[f.key]}
                onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                required
                style={fieldStyles.input}
              />
            </div>
          ))}
          <button type="submit" disabled={saving} style={{ ...btnStyles.primary, width: '100%', justifyContent: 'center' }}>
            {saving ? 'Creating…' : 'Create Staff Member'}
          </button>
        </form>
      </div>
    </div>
  );
}

const modalStyles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  box: { background: '#fff', borderRadius: 20, padding: 32, width: 420, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(15,23,42,0.18)' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  title: { fontSize: 18, fontWeight: 800, color: '#0f172a' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' },
};

// ─── Staff Tab ───────────────────────────────────────────────────────────────

function StaffTab() {
  const [staff, setStaff]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [selected, setSelected]   = useState(null);
  const [activePanel, setPanel]   = useState('permissions');
  const [createOpen, setCreate]   = useState(false);
  const [deleting, setDeleting]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await managementAPI.listStaff();
      setStaff(res.data);
    } catch { setError('Failed to load staff.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!window.confirm('Deactivate this staff member?')) return;
    setDeleting(id);
    try {
      await managementAPI.deleteStaff(id);
      setStaff(prev => prev.map(s => s.id === id ? { ...s, is_active: false } : s));
      if (selected?.id === id) setSelected(null);
    } catch { setError('Failed to deactivate.'); }
    finally { setDeleting(null); }
  };

  if (loading) return <Loader />;

  return (
    <div style={splitStyles.container}>
      <div style={splitStyles.list}>
        <div style={splitStyles.listHeader}>
          <span style={splitStyles.listTitle}>Staff Members ({staff.length})</span>
          <button onClick={() => setCreate(true)} style={btnStyles.primary}>
            <Plus size={14} /> Add
          </button>
        </div>
        <ErrorMsg msg={error} />
        {staff.length === 0 && <div style={{ fontSize: 13, color: '#94a3b8', padding: '12px 16px' }}>No staff yet.</div>}
        {staff.map(s => {
          const initials = (s.name || s.email || '?').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
          return (
            <div
              key={s.id}
              onClick={() => setSelected(s)}
              style={{ ...splitStyles.listItem, ...(selected?.id === s.id ? splitStyles.listItemActive : {}) }}
            >
              <div style={splitStyles.itemAvatar}>{initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={splitStyles.itemName}>{s.name || s.email}</div>
                <div style={splitStyles.itemEmail}>{s.email}</div>
              </div>
              {!s.is_active && <Chip label="Inactive" color="#64748b" bg="#f1f5f9" />}
              <button
                onClick={e => { e.stopPropagation(); handleDelete(s.id); }}
                disabled={deleting === s.id}
                style={splitStyles.deleteBtn}
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>

      <div style={splitStyles.detail}>
        {!selected ? (
          <div style={splitStyles.emptyDetail}>
            <UserCog size={36} color="#cbd5e1" />
            <p>Select a staff member to manage permissions and user access.</p>
          </div>
        ) : (
          <>
            <div style={splitStyles.detailHeader}>
              <div>
                <div style={splitStyles.detailName}>{selected.name || selected.email}</div>
                <div style={splitStyles.detailEmail}>{selected.email}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {['permissions', 'clients'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setPanel(tab)}
                    style={{ ...btnStyles.tab, ...(activePanel === tab ? btnStyles.tabActive : {}) }}
                  >
                    {tab === 'permissions' ? <Shield size={13} /> : <Users size={13} />}
                    {tab === 'permissions' ? 'Permissions' : 'Users'}
                  </button>
                ))}
              </div>
            </div>
            {activePanel === 'permissions'
              ? <PermissionsPanel entityId={selected.id} entityType="staff" />
              : <StaffClientsPanel staffId={selected.id} />
            }
          </>
        )}
      </div>

      {createOpen && (
        <CreateStaffModal
          onClose={() => setCreate(false)}
          onCreated={s => { setStaff(prev => [...prev, s]); setSelected(s); }}
        />
      )}
    </div>
  );
}

// ─── Clients Tab ────────────────────────────────────────────────────────────

function ClientsTab() {
  const [clients, setClients]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [selected, setSelected]   = useState(null);
  const [activePanel, setPanel]   = useState('permissions');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await managementAPI.listClients();
      setClients(res.data);
    } catch { setError('Failed to load users.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loader />;

  return (
    <div style={splitStyles.container}>
      <div style={splitStyles.list}>
        <div style={splitStyles.listHeader}>
          <span style={splitStyles.listTitle}>Users ({clients.length})</span>
        </div>
        <ErrorMsg msg={error} />
        {clients.length === 0 && <div style={{ fontSize: 13, color: '#94a3b8', padding: '12px 16px' }}>No users found.</div>}
        {clients.map(c => (
          <div
            key={c.id}
            onClick={() => setSelected(c)}
            style={{ ...splitStyles.listItem, ...(selected?.id === c.id ? splitStyles.listItemActive : {}) }}
          >
            <div style={splitStyles.itemAvatar}>{(c.company?.[0] || '?').toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={splitStyles.itemName}>{c.company}</div>
              <div style={splitStyles.itemEmail}>{c.email || '—'}</div>
            </div>
            {c.is_active
              ? <Chip label="Active" color="#15803d" bg="#dcfce7" />
              : <Chip label="Inactive" color="#64748b" bg="#f1f5f9" />}
          </div>
        ))}
      </div>

      <div style={splitStyles.detail}>
        {!selected ? (
          <div style={splitStyles.emptyDetail}>
            <Users size={36} color="#cbd5e1" />
            <p>Select a user to manage their permissions and portal configuration.</p>
          </div>
        ) : (
          <>
            <div style={splitStyles.detailHeader}>
              <div>
                <div style={splitStyles.detailName}>{selected.company}</div>
                <div style={splitStyles.detailEmail}>{selected.email || 'No email'}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {['permissions', 'portal'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setPanel(tab)}
                    style={{ ...btnStyles.tab, ...(activePanel === tab ? btnStyles.tabActive : {}) }}
                  >
                    {tab === 'permissions' ? <Shield size={13} /> : <Eye size={13} />}
                    {tab === 'permissions' ? 'Permissions' : 'Portal Config'}
                  </button>
                ))}
              </div>
            </div>
            {activePanel === 'permissions'
              ? <PermissionsPanel entityId={selected.id} entityType="client" />
              : <PortalConfigPanel clientId={selected.id} />
            }
          </>
        )}
      </div>
    </div>
  );
}

// ─── Role Defaults Tab ───────────────────────────────────────────────────────

function RoleDefaultsTab() {
  const [role, setRole]           = useState('staff');
  const [groups, setGroups]       = useState([]);
  const [origValues, setOrig]     = useState({});  // { code: bool } — snapshot for diffing
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [open, setOpen]           = useState({});
  const [saved, setSaved]         = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await managementAPI.getRoleDefaults(role);
      // res.data = { role, groups: { page_key: { label, permissions: [{code, label, is_granted}] } } }
      const arr = Object.entries(res.data.groups || {}).map(([page, g]) => ({
        page,
        page_label: g.label,
        permissions: g.permissions.map(p => ({ ...p, value: p.is_granted })),
      }));
      setGroups(arr);
      // Build original snapshot for diffing
      const snap = {};
      arr.forEach(g => g.permissions.forEach(p => { snap[p.code] = p.is_granted; }));
      setOrig(snap);
      if (arr.length > 0) setOpen({ [arr[0].page]: true });
    } catch { setError('Failed to load role defaults.'); }
    finally { setLoading(false); }
  }, [role]);

  useEffect(() => { load(); }, [load]);

  const handleToggle = (code, val) => {
    setGroups(prev => prev.map(g => ({
      ...g,
      permissions: g.permissions.map(p => p.code === code ? { ...p, value: val } : p),
    })));
  };

  const handleSave = async () => {
    setSaving(true); setError(''); setSaved(false);
    // Diff current vs original to build grants/revokes
    const grants = [];
    const revokes = [];
    groups.forEach(g => g.permissions.forEach(p => {
      if (p.value !== origValues[p.code]) {
        (p.value ? grants : revokes).push(p.code);
      }
    }));
    try {
      await managementAPI.setRoleDefaults(role, { grants, revokes });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await load();
    } catch { setError('Failed to save role defaults.'); }
    finally { setSaving(false); }
  };

  // Detect any changes from original
  const hasChanges = groups.some(g => g.permissions.some(p => p.value !== origValues[p.code]));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>Role:</span>
        {['staff', 'client'].map(r => (
          <button
            key={r}
            onClick={() => setRole(r)}
            style={{ ...btnStyles.tab, ...(role === r ? btnStyles.tabActive : {}) }}
          >
            {r.charAt(0).toUpperCase() + r.slice(1)}
          </button>
        ))}
      </div>
      <ErrorMsg msg={error} />
      {loading ? <Loader /> : (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              style={{ ...btnStyles.primary, opacity: !hasChanges ? 0.5 : 1 }}
            >
              <Save size={14} /> {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Defaults'}
            </button>
          </div>
          {groups.map(group => (
            <div key={group.page} style={panelStyles.group}>
              <button
                type="button"
                onClick={() => setOpen(o => ({ ...o, [group.page]: !o[group.page] }))}
                style={panelStyles.groupHeader}
              >
                <span style={panelStyles.groupTitle}>{group.page_label}</span>
                <span style={{ fontSize: 11, color: '#64748b' }}>{group.permissions.length} permissions</span>
                {open[group.page] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              {open[group.page] && (
                <div style={{ padding: '0 16px 8px' }}>
                  {group.permissions.map(p => (
                    <PermRow
                      key={p.code}
                      code={p.code}
                      label={p.label}
                      description={p.description}
                      value={p.value}
                      isOverride={false}
                      onChange={handleToggle}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ─── Shared styles ───────────────────────────────────────────────────────────

const btnStyles = {
  primary: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '9px 16px', borderRadius: 10, border: 'none',
    background: '#00d7ff',
    color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  },
  ghost: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '9px 16px', borderRadius: 10, border: '1px solid #dbe5f3',
    background: '#fff', color: '#475569', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  },
  tab: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '7px 14px', borderRadius: 9, border: '1px solid #e2e8f0',
    background: '#fff', color: '#64748b', fontSize: 12, fontWeight: 700, cursor: 'pointer',
  },
  tabActive: {
    background: '#e6fbff', borderColor: '#e6fbff', color: '#00d7ff',
  },
};

const splitStyles = {
  container: { display: 'flex', gap: 0, minHeight: 500, border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' },
  list: { width: 280, flexShrink: 0, borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflowY: 'auto' },
  listHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 },
  listTitle: { fontSize: 13, fontWeight: 700, color: '#0f172a' },
  listItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f8fafc', transition: 'background 0.15s' },
  listItemActive: { background: '#e6fbff' },
  itemAvatar: { width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(180deg, #e6fbff 0%, #e6fbff 100%)', color: '#00d7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 },
  itemName: { fontSize: 13, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  itemEmail: { fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  deleteBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, flexShrink: 0 },
  detail: { flex: 1, padding: 24, overflowY: 'auto' },
  detailHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #f1f5f9' },
  detailName: { fontSize: 16, fontWeight: 800, color: '#0f172a' },
  detailEmail: { fontSize: 12, color: '#64748b', marginTop: 2 },
  emptyDetail: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: 13, gap: 12, textAlign: 'center' },
};

// ─── Main ManagementPage ─────────────────────────────────────────────────────

const TABS = [
  { id: 'staff',    label: 'Staff Members', icon: UserCog },
  { id: 'clients',  label: 'User Access', icon: Users },
  { id: 'defaults', label: 'Role Defaults', icon: Shield },
];

export default function ManagementPage() {
  const [activeTab, setTab] = useState('staff');

  return (
    <div style={pageStyles.page}>
      <div style={pageStyles.header}>
        <h1 style={pageStyles.title}>Access Management</h1>
        <p style={pageStyles.sub}>Manage staff permissions, user access, and role defaults</p>
      </div>

      <div style={pageStyles.tabBar}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{ ...pageStyles.tab, ...(activeTab === t.id ? pageStyles.tabActive : {}) }}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      <div style={pageStyles.body}>
        {activeTab === 'staff'    && <StaffTab />}
        {activeTab === 'clients'  && <ClientsTab />}
        {activeTab === 'defaults' && <RoleDefaultsTab />}
      </div>
    </div>
  );
}

const pageStyles = {
  page: { padding: '32px 36px', maxWidth: 1200, margin: '0 auto' },
  header: { marginBottom: 28 },
  title: { fontSize: 26, fontWeight: 800, color: '#0f172a', margin: 0 },
  sub: { fontSize: 14, color: '#64748b', marginTop: 4 },
  tabBar: { display: 'flex', gap: 6, marginBottom: 24, borderBottom: '2px solid #f1f5f9', paddingBottom: 0 },
  tab: {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    padding: '10px 18px', border: 'none', background: 'none',
    color: '#64748b', fontSize: 14, fontWeight: 600, cursor: 'pointer',
    borderBottom: '2px solid transparent', marginBottom: -2, transition: 'all 0.15s',
  },
  tabActive: {
    color: '#00d7ff', borderBottomColor: '#00d7ff',
  },
  body: { paddingTop: 8 },
};
