/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 *
 * These cover surfaces that are useful immediately and don't require new
 * backend endpoints (they all read/write to localStorage or wrap existing
 * flows). When real APIs come online, swap the local-state hooks for the
 * relevant API call.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sun, Moon, Monitor, Plus, Copy, Trash2, Eye, EyeOff,
  Download, AlertTriangle, ExternalLink, Bell, Mail, Smartphone,
  Sparkles, ArrowRight, Webhook,
} from 'lucide-react';

import { useTheme } from '../../hooks/useTheme';
import Button from '../../components/ui/Button';
import Switch from '../../components/ui/Switch';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import KeyboardShortcut from '../../components/ui/KeyboardShortcut';
import EmptyState from '../../components/ui/EmptyState';
import Input from '../../components/ui/Input';
import toast from '../../components/ui/toast';
import { apiKeysAPI, privacyAPI } from '../../services/api';

// ─────────────────────────────────────────────────────────────────────────
// 1. Notifications — per-channel × per-event matrix
// ─────────────────────────────────────────────────────────────────────────
const NOTIF_CHANNELS = [
  { id: 'in_app',    icon: Bell,       label: 'In-app' },
  { id: 'email',     icon: Mail,       label: 'Email' },
  { id: 'browser',   icon: Smartphone, label: 'Browser' },
];

const NOTIF_EVENTS = [
  { id: 'mentions',         label: 'Mentions',                description: 'Someone mentioned a tracked account.' },
  { id: 'alerts',           label: 'Performance alerts',      description: 'Engagement drops or viral posts.' },
  { id: 'reports',          label: 'Scheduled reports',       description: 'Weekly + monthly report emails.' },
  { id: 'team',             label: 'Team activity',           description: 'New members, role changes, invitations.' },
  { id: 'token_expiry',     label: 'Token expiry',            description: 'OAuth tokens about to expire.' },
];

const NOTIF_KEY = 'socialstats_notif_prefs';
const NOTIF_DEFAULT = NOTIF_EVENTS.reduce((acc, e) => {
  acc[e.id] = { in_app: true, email: e.id === 'token_expiry', browser: false };
  return acc;
}, {});

export function NotificationsSection() {
  const [prefs, setPrefs] = useState(() => {
    try {
      const raw = localStorage.getItem(NOTIF_KEY);
      return raw ? { ...NOTIF_DEFAULT, ...JSON.parse(raw) } : NOTIF_DEFAULT;
    } catch { return NOTIF_DEFAULT; }
  });

  function toggle(eventId, channelId) {
    setPrefs((p) => ({
      ...p,
      [eventId]: { ...p[eventId], [channelId]: !p[eventId]?.[channelId] },
    }));
  }

  function save() {
    try {
      localStorage.setItem(NOTIF_KEY, JSON.stringify(prefs));
      toast.success('Notification preferences saved');
    } catch {
      toast.error('Could not save preferences');
    }
  }

  return (
    <SectionContainer
      title="Notifications"
      description="Choose which events you'd like to be notified about, and where."
      action={<Button onClick={save} size="sm">Save preferences</Button>}
    >
      <Card padding="none">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 560 }}>
            <thead>
              <tr style={{ background: 'var(--surface-sunken)' }}>
                <th scope="col" style={notifThStyle}>Event</th>
                {NOTIF_CHANNELS.map((c) => (
                  <th key={c.id} scope="col" style={{ ...notifThStyle, textAlign: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <c.icon size={12} /> {c.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {NOTIF_EVENTS.map((e, i) => (
                <tr key={e.id} style={{ borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{e.label}</div>
                    <div style={{ marginTop: 2, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{e.description}</div>
                  </td>
                  {NOTIF_CHANNELS.map((c) => (
                    <td key={c.id} style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <Switch
                        checked={!!prefs[e.id]?.[c.id]}
                        onChange={() => toggle(e.id, c.id)}
                        size="sm"
                        aria-label={`${c.label} notifications for ${e.label}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </SectionContainer>
  );
}

const notifThStyle = {
  textAlign: 'left',
  padding: '12px 16px',
  fontSize: 11, fontWeight: 600,
  letterSpacing: '0.06em', textTransform: 'uppercase',
  color: 'var(--text-tertiary)',
};

// ─────────────────────────────────────────────────────────────────────────
// 2. Appearance — theme + density
// ─────────────────────────────────────────────────────────────────────────
const DENSITY_KEY = 'socialstats_density';

export function AppearanceSection() {
  const { preference, setTheme } = useTheme();
  const [density, setDensity] = useState(() => {
    try { return localStorage.getItem(DENSITY_KEY) || 'comfortable'; }
    catch { return 'comfortable'; }
  });

  function changeDensity(value) {
    setDensity(value);
    try {
      localStorage.setItem(DENSITY_KEY, value);
      document.documentElement.dataset.density = value;
      toast.success(`Density set to ${value}`);
    } catch {}
  }

  return (
    <SectionContainer
      title="Appearance"
      description="Customise how Social Stats looks and feels."
    >
      <Card padding="md">
        <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Theme</div>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
          Choose a light or dark theme. "System" matches your OS preference.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
          <ThemeCard active={preference === 'light'}  icon={Sun}     label="Light"  onClick={() => setTheme('light')} />
          <ThemeCard active={preference === 'dark'}   icon={Moon}    label="Dark"   onClick={() => setTheme('dark')} />
          <ThemeCard active={preference === 'system'} icon={Monitor} label="System" onClick={() => setTheme('system')} />
        </div>
      </Card>

      <Card padding="md" style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Density</div>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
          Show more or less content per screen. "Compact" reduces row heights and padding.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { value: 'comfortable', label: 'Comfortable' },
            { value: 'compact',     label: 'Compact' },
          ].map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => changeDensity(d.value)}
              style={{
                padding: '8px 14px',
                minHeight: 'unset', minWidth: 'unset',
                background: density === d.value ? 'var(--brand-primary-soft)' : 'var(--surface-card)',
                color: density === d.value ? 'var(--brand-primary-hover)' : 'var(--text-secondary)',
                border: `1px solid ${density === d.value ? 'var(--brand-primary)' : 'var(--border-default)'}`,
                borderRadius: 'var(--radius-pill)',
                fontSize: 13, fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
      </Card>
    </SectionContainer>
  );
}

function ThemeCard({ active, icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        padding: 18,
        minHeight: 'unset', minWidth: 'unset',
        background: active ? 'var(--brand-primary-soft)' : 'var(--surface-card)',
        border: `1px solid ${active ? 'var(--brand-primary)' : 'var(--border-default)'}`,
        boxShadow: active ? 'var(--shadow-glow)' : 'var(--shadow-xs)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        fontFamily: 'inherit',
        color: active ? 'var(--brand-primary-hover)' : 'var(--text-secondary)',
        transition: 'var(--transition-fast)',
      }}
    >
      <Icon size={20} strokeWidth={2} />
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 3. Keyboard Shortcuts — list of all shortcuts
// ─────────────────────────────────────────────────────────────────────────
const SHORTCUTS = [
  { keys: 'cmd+k',         label: 'Open command palette',       category: 'Global' },
  { keys: 'cmd+/',         label: 'Show shortcuts',             category: 'Global' },
  { keys: 'esc',           label: 'Close modal / palette',      category: 'Global' },
  { keys: 'cmd+j',         label: 'Open AI assistant',          category: 'Global' },
  { keys: 'g+d',           label: 'Go to dashboard',            category: 'Navigation' },
  { keys: 'g+a',           label: 'Go to analytics',            category: 'Navigation' },
  { keys: 'g+r',           label: 'Go to reports',              category: 'Navigation' },
  { keys: 'g+i',           label: 'Go to inbox',                category: 'Navigation' },
  { keys: 'cmd+enter',     label: 'Submit composer / form',     category: 'Composer' },
  { keys: 'cmd+s',         label: 'Save draft',                 category: 'Composer' },
  { keys: 'cmd+shift+p',   label: 'Publish now',                category: 'Composer' },
  { keys: 'r',             label: 'Reply',                       category: 'Inbox' },
  { keys: 'a',             label: 'Archive conversation',        category: 'Inbox' },
  { keys: 'shift+u',       label: 'Toggle unread',               category: 'Inbox' },
];

export function KeyboardShortcutsSection() {
  const grouped = SHORTCUTS.reduce((acc, s) => {
    (acc[s.category] = acc[s.category] || []).push(s);
    return acc;
  }, {});
  return (
    <SectionContainer
      title="Keyboard Shortcuts"
      description="Speed up your workflow with these keyboard shortcuts."
    >
      {Object.entries(grouped).map(([cat, items]) => (
        <Card key={cat} padding="none" style={{ marginBottom: 14 }}>
          <div style={{
            padding: '12px 18px',
            borderBottom: '1px solid var(--border-subtle)',
            fontSize: 11, fontWeight: 600,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
            background: 'var(--surface-sunken)',
          }}>
            {cat}
          </div>
          {items.map((s, i) => (
            <div
              key={s.keys}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 18px',
                borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none',
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{s.label}</span>
              <KeyboardShortcut keys={s.keys} size="md" />
            </div>
          ))}
        </Card>
      ))}
      <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text-tertiary)' }}>
        Custom keybindings coming soon. Press <KeyboardShortcut keys="cmd+/" size="sm" /> from anywhere to view this list.
      </p>
    </SectionContainer>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 4. API Keys — generate / revoke (: now wired to /api/api-keys/)
// ─────────────────────────────────────────────────────────────────────────
export function APIKeysSection() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState('');
  // The plaintext key is shown ONCE on creation. After that, only key_prefix.
  const [justCreated, setJustCreated] = useState(null);
  const [creating, setCreating] = useState(false);

  function load() {
    setLoading(true);
    apiKeysAPI.list()
      .then((r) => setKeys(r.data?.keys || []))
      .catch(() => toast.error('Could not load API keys'))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function generate() {
    if (!name.trim()) { toast.error('Give the key a name first'); return; }
    setCreating(true);
    try {
      const payload = {
        name: name.trim(),
        scopes: scopes.split(',').map(s => s.trim()).filter(Boolean),
      };
      const r = await apiKeysAPI.create(payload);
      setJustCreated(r.data);
      setKeys((ks) => [r.data, ...ks]);
      setName('');
      setScopes('');
      toast.success('API key created');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not create key');
    } finally { setCreating(false); }
  }

  async function revoke(id) {
    if (!window.confirm('Revoke this key? Any application using it will stop working.')) return;
    try {
      await apiKeysAPI.revoke(id);
      toast.success('Key revoked');
      load();
    } catch { toast.error('Could not revoke'); }
  }

  function copyKey(value) {
    try { navigator.clipboard.writeText(value); toast.success('Copied to clipboard'); }
    catch { toast.error('Could not copy'); }
  }

  return (
    <SectionContainer
      title="API Keys"
      description="Programmatic access for your scripts and integrations. Keys are stored as SHA-256 hashes — we never see the plaintext after creation."
    >
      <Card padding="md" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
          Generate a new key
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '2 1 220px', minWidth: 0 }}>
            <Input size="md" placeholder='e.g. "Production deploy"'
                   value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div style={{ flex: '2 1 220px', minWidth: 0 }}>
            <Input size="md" placeholder='Scopes (comma-separated, e.g. read:posts, write:leads)'
                   value={scopes} onChange={(e) => setScopes(e.target.value)} />
          </div>
          <Button onClick={generate} icon={Plus} size="md" disabled={creating}>
            {creating ? 'Creating…' : 'Generate'}
          </Button>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
          Keys are shown once at generation — copy and store them securely.
        </p>
      </Card>

      {justCreated && justCreated.plaintext_key && (
        <Card padding="md" style={{ marginBottom: 16, borderColor: 'var(--warning)', background: 'var(--warning-bg)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--warning)', marginBottom: 8,
                        display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={14} /> Save this key now — it will not be shown again
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 12,
            background: 'var(--surface-sunken)', padding: '8px 12px',
            borderRadius: 'var(--radius-xs)',
            wordBreak: 'break-all', userSelect: 'all',
          }}>{justCreated.plaintext_key}</div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <Button size="sm" icon={Copy} onClick={() => copyKey(justCreated.plaintext_key)}>
              Copy
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setJustCreated(null)}>
              I've saved it
            </Button>
          </div>
        </Card>
      )}

      {loading ? (
        <Card padding="md"><div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Loading…</div></Card>
      ) : keys.length === 0 ? (
        <Card padding="none">
          <EmptyState icon={Sparkles} title="No API keys yet"
                      description="Generate your first key above to start integrating Social Stats with your other tools."
                      compact />
        </Card>
      ) : (
        <Card padding="none">
          {keys.map((k, i) => (
            <div key={k.id} style={{
              display: 'grid', gridTemplateColumns: '1fr auto', gap: 12,
              alignItems: 'center', padding: '14px 18px',
              borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none',
              opacity: k.is_active ? 1 : 0.6,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {k.name}
                  {!k.is_active && (
                    <Badge style={{ marginLeft: 8 }}>{k.is_expired ? 'Expired' : 'Revoked'}</Badge>
                  )}
                </div>
                <div style={{ marginTop: 2, fontSize: 12, color: 'var(--text-tertiary)',
                              display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span>Created {new Date(k.created_at).toLocaleDateString()}</span>
                  <span>{k.last_used_at ? `Last used ${new Date(k.last_used_at).toLocaleDateString()}` : 'Never used'}</span>
                  <span>{k.use_count} call{k.use_count === 1 ? '' : 's'}</span>
                  {k.scopes?.length > 0 && <span>Scopes: {k.scopes.join(', ')}</span>}
                </div>
                <div style={{
                  marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 12,
                  color: 'var(--text-secondary)', background: 'var(--surface-sunken)',
                  padding: '4px 8px', borderRadius: 'var(--radius-xs)',
                  display: 'inline-block',
                }}>
                  {k.key_prefix}{'•'.repeat(24)}
                </div>
              </div>
              {k.is_active && (
                <Button variant="ghost" size="sm" iconOnly icon={Trash2}
                        aria-label="Revoke key" onClick={() => revoke(k.id)} />
              )}
            </div>
          ))}
        </Card>
      )}
    </SectionContainer>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 5. Data & Privacy — export + delete account
// ─────────────────────────────────────────────────────────────────────────
const CONSENT_LABELS = {
  marketing_emails:     'Marketing emails',
  product_emails:       'Product update emails',
  cookies_analytics:    'Analytics cookies',
  cookies_marketing:    'Marketing cookies',
  ai_processing_optout: 'AI processing — opt out',
  whatsapp_marketing:   'WhatsApp marketing messages',
  data_processing:      'Core service data processing',
};

export function DataPrivacySection() {
  const [exports, setExports] = useState([]);
  const [exportBusy, setExportBusy] = useState(false);
  const [consents, setConsents] = useState({});
  const [processingPaused, setProcessingPaused] = useState(false);
  const [pendingDeletion, setPendingDeletion] = useState(null);
  const [loading, setLoading] = useState(true);

  function loadAll() {
    setLoading(true);
    Promise.all([
      privacyAPI.exportList().catch(() => ({ data: { requests: [] } })),
      privacyAPI.consents().catch(()  => ({ data: { consents: {} } })),
      privacyAPI.processingStatus().catch(() => ({ data: { workspaces: [] } })),
    ]).then(([ex, co, ps]) => {
      setExports(ex.data?.requests || []);
      setConsents(co.data?.consents || {});
      const ws = ps.data?.workspaces || [];
      setProcessingPaused(ws.length > 0 && ws.every(w => w.is_processing_paused));
      // Canceled deletions get filtered out client-side; "queued" is the actionable one.
      const queued = (ex.data?.requests || []).find(() => false);  // exports list, not deletions
      setPendingDeletion(queued || null);
    }).finally(() => setLoading(false));
  }
  useEffect(() => { loadAll(); }, []);

  async function requestExport() {
    setExportBusy(true);
    try {
      await privacyAPI.exportRequest();
      toast.success('Export queued — we will email you when it is ready');
      loadAll();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not queue export');
    } finally { setExportBusy(false); }
  }

  async function toggleConsent(type, given) {
    try {
      await privacyAPI.setConsent(type, given);
      setConsents((c) => ({ ...c, [type]: given }));
    } catch { toast.error('Could not save consent'); }
  }

  async function toggleProcessing(paused) {
    try {
      await privacyAPI.setProcessingPaused(paused);
      setProcessingPaused(paused);
      toast.success(paused ? 'Processing paused' : 'Processing resumed');
    } catch { toast.error('Could not update'); }
  }

  async function deleteAccount() {
    const reason = window.prompt('Tell us why (optional). Your account will be permanently deleted in 30 days unless canceled.');
    if (reason === null) return;
    try {
      const r = await privacyAPI.deleteAccount(reason || '');
      setPendingDeletion(r.data);
      toast.success('Deletion scheduled — you have 30 days to cancel');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not schedule deletion');
    }
  }

  async function cancelDeletion() {
    try {
      await privacyAPI.cancelDeleteAccount();
      setPendingDeletion(null);
      toast.success('Deletion canceled');
    } catch { toast.error('Could not cancel'); }
  }

  if (loading) {
    return <SectionContainer title="Data & Privacy" description="Loading…"><Card padding="md" /></SectionContainer>;
  }

  return (
    <SectionContainer
      title="Data & Privacy"
      description="Your data, your rights. Export everything, manage consents, pause processing, or delete your account."
    >
      {/* Export */}
      <Card padding="md" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <span style={{
            display: 'inline-flex', flexShrink: 0,
            width: 40, height: 40, borderRadius: 'var(--radius-md)',
            background: 'var(--brand-primary-soft)', color: 'var(--brand-primary-hover)',
            alignItems: 'center', justifyContent: 'center',
          }}><Download size={18} strokeWidth={2.2} /></span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Export your data</div>
            <p style={{ margin: '4px 0 12px', fontSize: 13, color: 'var(--text-secondary)' }}>
              Download a ZIP with your profile, owned workspaces, consent log, and request history.
              Delivered via email link (expires in 7 days).
            </p>
            <Button size="sm" icon={Download} disabled={exportBusy} onClick={requestExport}>
              {exportBusy ? 'Queueing…' : 'Request export'}
            </Button>
            {exports.length > 0 && (
              <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none',
                           fontSize: 12, color: 'var(--text-tertiary)' }}>
                {exports.slice(0, 3).map((e) => (
                  <li key={e.id} style={{ padding: '4px 0' }}>
                    #{e.id} · {e.status}
                    {e.completed_at && <> · {new Date(e.completed_at).toLocaleDateString()}</>}
                    {e.download_url && e.status === 'completed' && (
                      <> · <a href={e.download_url} target="_blank" rel="noreferrer"
                              style={{ color: 'var(--brand-primary-hover)' }}>Download</a></>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>

      {/* Consents */}
      <Card padding="md" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Your consents</div>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-secondary)' }}>
          Toggle communication and tracking preferences. Withdrawals take effect immediately.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Object.entries(CONSENT_LABELS).map(([key, label]) => (
            <div key={key} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0', borderBottom: '1px solid var(--border-subtle)',
            }}>
              <span style={{ fontSize: 13 }}>{label}</span>
              <Switch checked={!!consents[key]} onChange={(v) => toggleConsent(key, v)} />
            </div>
          ))}
        </div>
      </Card>

      {/* Processing pause */}
      <Card padding="md" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Pause data processing</div>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
              When paused, sync tasks skip your workspaces, AI features are disabled, and
              the composer goes read-only. You can still log in to view existing data.
            </p>
          </div>
          <Switch checked={processingPaused} onChange={toggleProcessing} />
        </div>
      </Card>

      {/* Danger zone */}
      <Card padding="md" style={{ borderColor: 'var(--danger)' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <span style={{
            display: 'inline-flex', flexShrink: 0,
            width: 40, height: 40, borderRadius: 'var(--radius-md)',
            background: 'var(--danger-bg)', color: 'var(--danger)',
            alignItems: 'center', justifyContent: 'center',
          }}><AlertTriangle size={18} strokeWidth={2.2} /></span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--danger)' }}>Delete account</div>
            <p style={{ margin: '4px 0 12px', fontSize: 13, color: 'var(--text-secondary)' }}>
              Permanently delete your account, sessions, MFA, API keys, and personal data
              after a 30-day grace period. Audit logs are anonymised but retained for compliance.
            </p>
            {pendingDeletion ? (
              <div style={{
                padding: '10px 12px',
                background: 'var(--warning-bg)', color: 'var(--warning)',
                border: '1px solid var(--warning)', borderRadius: 'var(--radius-sm)',
                fontSize: 12, marginBottom: 8,
              }}>
                Deletion scheduled — completes on{' '}
                {new Date(pendingDeletion.grace_until).toLocaleDateString()}
                {' '}<Button size="xs" variant="ghost" onClick={cancelDeletion}>Cancel</Button>
              </div>
            ) : (
              <Button variant="danger" size="sm" icon={Trash2} onClick={deleteAccount}>
                Delete my account
              </Button>
            )}
          </div>
        </div>
      </Card>
    </SectionContainer>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 6. Webhooks — external endpoint subscriptions (stub)
// ─────────────────────────────────────────────────────────────────────────
const WEBHOOK_KEY = 'socialstats_webhook_endpoints';
const WEBHOOK_EVENTS = [
  'composer.post_published',
  'composer.post_failed',
  'inbox.new_message',
  'credential.token_expired',
  'goal.milestone_hit',
];

export function WebhooksSection() {
  const [endpoints, setEndpoints] = useState(() => {
    try { return JSON.parse(localStorage.getItem(WEBHOOK_KEY) || '[]'); }
    catch { return []; }
  });
  const [url, setUrl] = useState('');

  function save(next) {
    setEndpoints(next);
    try { localStorage.setItem(WEBHOOK_KEY, JSON.stringify(next)); } catch {}
  }

  function add() {
    if (!/^https:\/\//.test(url)) { toast.error('Endpoint must use HTTPS'); return; }
    save([{ id: `wh_${Date.now()}`, url: url.trim(), events: WEBHOOK_EVENTS, active: true }, ...endpoints]);
    setUrl('');
    toast.success('Endpoint added');
  }

  function remove(id) {
    save(endpoints.filter((e) => e.id !== id));
    toast.success('Endpoint removed');
  }

  return (
    <SectionContainer
      title="Webhooks"
      description="Receive HTTP POST notifications when events happen in your workspace."
    >
      <Card padding="md" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
          Add an endpoint
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 280px', minWidth: 0 }}>
            <Input
              size="md"
              type="url"
              placeholder="https://your-server.com/webhooks/socialstats"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <Button onClick={add} icon={Plus} size="md">Add</Button>
        </div>
      </Card>

      {endpoints.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={Webhook}
            title="No webhook endpoints"
            description="Add an HTTPS endpoint above to start receiving events."
            compact
          />
        </Card>
      ) : (
        <Card padding="none">
          {endpoints.map((e, i) => (
            <div
              key={e.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 18px',
                borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none',
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  color: 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {e.url}
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {e.events.length} events subscribed
                </div>
              </span>
              <Badge variant={e.active ? 'success' : 'default'} size="sm" dot>
                {e.active ? 'Active' : 'Paused'}
              </Badge>
              <Button variant="ghost" size="sm" iconOnly icon={Trash2} aria-label="Remove" onClick={() => remove(e.id)} />
            </div>
          ))}
        </Card>
      )}
    </SectionContainer>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 7. Cross-link cards — for sections that live as separate pages
// ─────────────────────────────────────────────────────────────────────────
export function CrossLinksSection({ user }) {
  const isStaff = user?.role === 'superadmin' || user?.role === 'staff';
  const base = isStaff ? '/admin' : '/dashboard';

  const LINKS = [
    { to: `${base}/management`, label: 'Team & permissions',  description: 'Invite teammates, assign roles, override permissions.', staffOnly: true },
    { to: `${base}/clients`,    label: 'Workspaces (clients)', description: 'Manage every client account in your agency.',         staffOnly: true },
    { to: `${base}/analytics/audit-log`, label: 'Audit log',     description: 'Search every action across your account.',             staffOnly: true },
    { to: '/help',              label: 'Help center',          description: 'Setup guides, troubleshooting, FAQs.',                  staffOnly: false },
  ].filter((l) => !l.staffOnly || isStaff);

  return (
    <SectionContainer
      title="More settings"
      description="Some areas live as their own pages. Jump to them here."
    >
      <div style={{ display: 'grid', gap: 10 }}>
        {LINKS.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              padding: 16,
              background: 'var(--surface-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-xs)',
              textDecoration: 'none',
              transition: 'var(--transition-fast)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-xs)'; }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{l.label}</div>
              <div style={{ marginTop: 2, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{l.description}</div>
            </div>
            <ArrowRight size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          </Link>
        ))}
      </div>
    </SectionContainer>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Shared section container
// ─────────────────────────────────────────────────────────────────────────
function SectionContainer({ title, description, action, children }) {
  return (
    <div className="settings-section">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
        <h2 style={{
          margin: 0,
          fontSize: 20, fontWeight: 600,
          letterSpacing: '-0.015em',
          color: 'var(--text-primary)',
        }}>
          {title}
        </h2>
        {action}
      </div>
      <p style={{ margin: '4px 0 24px', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
        {description}
      </p>
      {children}

      <style>{`
        .settings-section { padding: 32px 36px; }
        @media (max-width: 768px) {
          .settings-section { padding: 22px 18px; }
        }
      `}</style>
    </div>
  );
}
