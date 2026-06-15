/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useEffect, useState } from 'react';
import { Bell, Loader2, Save } from 'lucide-react';
import toast from 'react-hot-toast';

import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { notificationsAPI } from '../../services/api';

export default function NotificationPreferencesPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    notificationsAPI.getPreferences()
      .then((r) => setData(r.data))
      .catch(() => toast.error('Could not load preferences'))
      .finally(() => setLoading(false));
  }, []);

  function toggle(eventId, channelId) {
    setData((d) => {
      const matrix = d.matrix.map((row) => row.event_type === eventId
        ? { ...row, [channelId]: !row[channelId] }
        : row);
      return { ...d, matrix };
    });
  }

  async function save() {
    if (!data) return;
    setSaving(true);
    try {
      const flat = [];
      for (const row of data.matrix) {
        for (const ch of data.channels) {
          flat.push({ event_type: row.event_type, channel: ch.id, enabled: !!row[ch.id] });
        }
      }
      await notificationsAPI.putPreferences(flat);
      toast.success('Preferences saved');
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={{ padding: 32, textAlign: 'center' }}>
      <Loader2 size={20} className="ds-spin" color="var(--text-tertiary)" />
      <style>{`.ds-spin { animation: ds-spin 0.9s linear infinite; } @keyframes ds-spin { to { transform: rotate(360deg); } }`}</style>
    </div>;
  }

  return (
    <div style={{ paddingBottom: 32 }}>
      <PageHeader
        title="Notification preferences"
        subtitle="Pick the channels for each event type"
        action={<Button icon={Save} onClick={save} loading={saving}>Save</Button>}
      />

      <div style={{ padding: '0 24px' }}>
        <Card padding="none" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={th}>Event</th>
                  {data.channels.map((c) => (
                    <th key={c.id} style={{ ...th, textAlign: 'center', minWidth: 90 }}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.matrix.map((row) => {
                  const meta = data.events.find((e) => e.id === row.event_type) || { label: row.event_type };
                  return (
                    <tr key={row.event_type}>
                      <td style={td}>
                        <Bell size={12} color="var(--text-tertiary)"
                              style={{ marginRight: 8, verticalAlign: 'middle' }} />
                        {meta.label}
                      </td>
                      {data.channels.map((c) => (
                        <td key={c.id} style={{ ...td, textAlign: 'center' }}>
                          <Toggle
                            value={!!row[c.id]}
                            onChange={() => toggle(row.event_type, c.id)}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={onChange}
      role="switch"
      aria-checked={value}
      style={{
        width: 40, height: 22, borderRadius: 999,
        background: value ? 'var(--brand-primary)' : 'var(--surface-sunken)',
        border: `1px solid ${value ? 'transparent' : 'var(--border-default)'}`,
        cursor: 'pointer', padding: 2,
        position: 'relative', display: 'inline-block',
        minHeight: 'unset', minWidth: 'unset',
        transition: 'var(--transition-fast)',
      }}
    >
      <span style={{
        position: 'absolute', top: 2,
        left: value ? 20 : 2,
        width: 16, height: 16, borderRadius: 999,
        background: 'var(--surface-card)',
        transition: 'left var(--transition-fast)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}

const th = {
  textAlign: 'left', padding: '12px 14px', fontSize: 11,
  fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4,
  color: 'var(--text-tertiary)',
  borderBottom: '1px solid var(--border-subtle)',
  background: 'var(--surface-sunken)',
};
const td = { padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)' };
