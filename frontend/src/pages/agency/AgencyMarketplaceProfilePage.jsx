/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * AgencyMarketplaceProfilePage — agency owner/admin edits their public profile.
 *
 * Reachable to logged-in agency members. Resolves the user's agency via
 * /auth/me/ → profile.primary_agency, then fetches /agency/<slug>/ in full
 * mode and lets the owner update display fields plus the marketplace toggle.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Save, ExternalLink, ShieldCheck, Globe, MapPin, Building2, Plus, X,
  FileText,
} from 'lucide-react';

import { agencyAPI, authAPI, verificationAPI } from '../../services/api';
import toast from '../../components/ui/toast';

export default function AgencyMarketplaceProfilePage() {
  const [slug,    setSlug]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [draft,   setDraft]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  // Resolve current user's primary agency slug
  useEffect(() => {
    let cancelled = false;
    authAPI.me()
      .then((r) => {
        if (cancelled) return;
        const s = r.data?.primary_agency_slug;
        if (s) setSlug(s);
        else { setLoading(false); toast.error('No agency profile resolved for your account.'); }
      })
      .catch(() => { setLoading(false); toast.error('Could not load profile'); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!slug) return;
    agencyAPI.get(slug)
      .then((r) => { setProfile(r.data); setDraft(r.data); })
      .catch(() => toast.error('Could not load agency'))
      .finally(() => setLoading(false));
  }, [slug]);

  const dirty = useMemo(() => {
    if (!profile || !draft) return false;
    return JSON.stringify(profile) !== JSON.stringify(draft);
  }, [profile, draft]);

  function set(key, value) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function setListOp(field, op, value) {
    setDraft((d) => {
      const list = Array.isArray(d?.[field]) ? [...d[field]] : [];
      if (op === 'add' && value && !list.includes(value)) list.push(value);
      if (op === 'remove') {
        const idx = list.indexOf(value);
        if (idx >= 0) list.splice(idx, 1);
      }
      return { ...d, [field]: list };
    });
  }

  async function save() {
    if (!dirty) return;
    setSaving(true);
    try {
      const payload = {};
      const fields = [
        'name', 'logo_url', 'description', 'website',
        'location_city', 'location_country',
        'industries_served', 'services_offered',
        'pricing_starting_at', 'pricing_currency',
        'is_listed_in_marketplace',
      ];
      fields.forEach((f) => {
        if (JSON.stringify(profile[f]) !== JSON.stringify(draft[f])) {
          payload[f] = draft[f];
        }
      });
      const r = await agencyAPI.update(slug, payload);
      setProfile(r.data); setDraft(r.data);
      toast.success('Profile updated');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ padding: 32, color: 'var(--text-tertiary)' }}>Loading…</div>;
  if (!profile) {
    return (
      <div style={{ padding: 32, color: 'var(--text-secondary)' }}>
        We couldn't find an agency for your account. If your team owns an agency,
        ask them to add you, then come back here.
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Marketplace profile
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>
            How you appear to potential clients in the Social Stats marketplace.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to={`/agencies/${slug}`} style={btnGhost} target="_blank" rel="noreferrer">
            <ExternalLink size={13} /> Preview
          </Link>
          <button type="button" onClick={save} disabled={!dirty || saving} style={dirty && !saving ? btnPrimary : btnDisabled}>
            <Save size={13} /> {saving ? 'Saving…' : (dirty ? 'Save changes' : 'No changes')}
          </button>
        </div>
      </header>

      {/* Marketplace toggle */}
      <Section>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={!!draft.is_listed_in_marketplace}
            onChange={(e) => set('is_listed_in_marketplace', e.target.checked)}
            style={{ marginTop: 4 }}
          />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>List in marketplace</div>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              When on, your agency shows up in <strong>/agencies</strong> with the fields below. Off-market agencies can still receive direct invitations.
            </p>
            {profile.is_verified ? (
              <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--success)' }}>
                <ShieldCheck size={12} /> Verified · trust signals fully active
              </div>
            ) : (
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>
                Not yet verified — verification badge unlocks higher placement and a green "Verified" mark.
              </div>
            )}
          </div>
        </label>
      </Section>

      {/* Identity */}
      <Section title="Identity">
        <Field label="Agency name" value={draft.name} onChange={(v) => set('name', v)} />
        <Field label="Logo URL"   value={draft.logo_url || ''} onChange={(v) => set('logo_url', v)} placeholder="https://…" icon={Building2} />
        <Field label="Website"    value={draft.website || ''}  onChange={(v) => set('website', v)} placeholder="https://…" icon={Globe} />
      </Section>

      {/* Location */}
      <Section title="Location">
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
          <Field label="City"      value={draft.location_city || ''}    onChange={(v) => set('location_city', v)}    icon={MapPin} />
          <Field label="Country"   value={draft.location_country || ''} onChange={(v) => set('location_country', v.toUpperCase().slice(0, 2))} placeholder="IN" />
        </div>
      </Section>

      {/* About */}
      <Section title="About">
        <Label>Description</Label>
        <textarea
          rows={5}
          value={draft.description || ''}
          onChange={(e) => set('description', e.target.value)}
          placeholder="What does your agency do? Who do you serve? What outcomes do you deliver?"
          style={textareaStyle}
        />
      </Section>

      {/* Industries + services */}
      <Section title="Industries served">
        <ListEditor
          values={draft.industries_served || []}
          onAdd={(v)    => setListOp('industries_served', 'add', v.trim().toLowerCase().replace(/\s+/g, '_'))}
          onRemove={(v) => setListOp('industries_served', 'remove', v)}
          placeholder="e.g., real_estate, restaurant, clinic"
        />
      </Section>

      <Section title="Services offered">
        <ListEditor
          values={draft.services_offered || []}
          onAdd={(v)    => setListOp('services_offered', 'add', v.trim().toLowerCase().replace(/\s+/g, '_'))}
          onRemove={(v) => setListOp('services_offered', 'remove', v)}
          placeholder="e.g., content, analytics, ads"
        />
      </Section>

      {/* Verification panel*/}
      <VerificationPanel slug={slug} profile={profile} onChanged={(p) => { setProfile(p); setDraft(p); }} />

      {/* Pricing */}
      <Section title="Pricing">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 10 }}>
          <Field
            label="Starting price (per month)"
            type="number"
            value={draft.pricing_starting_at ?? ''}
            onChange={(v) => set('pricing_starting_at', v === '' ? null : Number(v))}
            placeholder="5000"
          />
          <div>
            <Label>Currency</Label>
            <select value={draft.pricing_currency || 'INR'} onChange={(e) => set('pricing_currency', e.target.value)} style={inputStyle}>
              <option value="INR">INR</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
        </div>
      </Section>
    </div>
  );
}

function VerificationPanel({ slug, profile, onChanged }) {
  const docs = profile?.documents || {};
  const decision = docs.decision || (profile?.is_verified ? 'approved' : 'none');
  const items = docs.documents || [];
  const [draft, setDraft] = useState([{ type: 'gst', url: '', note: '' }]);
  const [busy, setBusy]   = useState(false);

  function setRow(i, key, val) {
    setDraft((rows) => rows.map((r, idx) => idx === i ? { ...r, [key]: val } : r));
  }
  function addRow() { setDraft((r) => [...r, { type: 'business_reg', url: '', note: '' }]); }
  function removeRow(i) { setDraft((r) => r.filter((_, idx) => idx !== i)); }

  async function submit() {
    const cleaned = draft.filter((r) => r.url && r.url.trim());
    if (cleaned.length === 0) return toast.error('At least one document URL is required');
    setBusy(true);
    try {
      const r = await verificationAPI.submit(slug, cleaned);
      toast.success('Verification submitted — admins will review shortly');
      onChanged?.({ ...profile, ...r.data, documents: r.data.documents });
      setDraft([{ type: 'gst', url: '', note: '' }]);
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not submit');
    } finally { setBusy(false); }
  }

  return (
    <Section title="Verification">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{
          padding: '2px 10px', fontSize: 11, fontWeight: 600,
          letterSpacing: '0.04em', textTransform: 'uppercase',
          borderRadius: 'var(--radius-pill)',
          color:      profile?.is_verified ? 'var(--success)' : decision === 'pending' ? 'var(--warning)' : decision === 'rejected' ? 'var(--danger)' : 'var(--text-tertiary)',
          background: profile?.is_verified ? 'var(--success-bg)' : decision === 'pending' ? 'var(--warning-bg)' : decision === 'rejected' ? 'var(--danger-bg)' : 'var(--surface-sunken)',
          border: '1px solid currentColor',
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <ShieldCheck size={11} />
          {profile?.is_verified ? 'Verified' : decision === 'pending' ? 'Pending review' : decision === 'rejected' ? 'Needs more info' : 'Not submitted'}
        </span>
      </div>

      {decision === 'rejected' && docs.decision_note && (
        <div style={{ marginBottom: 14, padding: 10, background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--text-primary)' }}>
          <strong>Reviewer note:</strong> {docs.decision_note}
        </div>
      )}

      {items.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <Label>Submitted documents</Label>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {items.map((d, i) => (
              <li key={i} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                <FileText size={11} style={{ verticalAlign: '-1px', marginRight: 4 }} />
                <span style={{ color: 'var(--text-tertiary)' }}>{d.type}</span> · {d.url}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(decision !== 'approved') && (
        <div>
          <Label>{decision === 'pending' ? 'Re-submit (overrides previous)' : 'Submit documents'}</Label>
          <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.55 }}>
            Upload to a private URL (Drive, S3, etc.) and paste the link here. Acceptable: GST cert, business registration, ID proof.
          </p>
          {draft.map((row, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 30px', gap: 6, marginBottom: 6 }}>
              <select value={row.type} onChange={(e) => setRow(i, 'type', e.target.value)} style={inputStyle}>
                <option value="gst">GST</option>
                <option value="business_reg">Business reg</option>
                <option value="id_proof">ID proof</option>
                <option value="other">Other</option>
              </select>
              <input
                type="url"
                value={row.url}
                onChange={(e) => setRow(i, 'url', e.target.value)}
                placeholder="https://…"
                style={inputStyle}
              />
              <button type="button" onClick={() => removeRow(i)} aria-label="Remove" style={{ ...btnGhost, padding: '8px 8px', justifyContent: 'center' }}>
                <X size={13} />
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={addRow} style={btnGhost}><Plus size={13} /> Add document</button>
            <button type="button" onClick={submit} disabled={busy} style={btnPrimary}>
              <FileText size={13} /> {busy ? 'Submitting…' : 'Submit for review'}
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}

function Section({ title, children }) {
  return (
    <section style={{
      padding: 18,
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
    }}>
      {title && <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h3>}
      {children}
    </section>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', icon: Icon }) {
  return (
    <div>
      <Label>{label}</Label>
      <div style={{ position: 'relative' }}>
        {Icon && (
          <Icon size={13} color="var(--text-tertiary)" style={{ position: 'absolute', top: 11, left: 10, pointerEvents: 'none' }} />
        )}
        <input
          type={type}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ ...inputStyle, paddingLeft: Icon ? 30 : 12 }}
        />
      </div>
    </div>
  );
}

function Label({ children }) {
  return (
    <label style={{
      display: 'block', fontSize: 11, fontWeight: 600,
      letterSpacing: '0.04em', textTransform: 'uppercase',
      color: 'var(--text-tertiary)', marginBottom: 4,
    }}>{children}</label>
  );
}

function ListEditor({ values, onAdd, onRemove, placeholder }) {
  const [draft, setDraft] = useState('');
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {values.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>None yet — add one below.</span>}
        {values.map((v) => (
          <span key={v} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 4px 3px 10px',
            background: 'var(--brand-primary-soft)',
            color: 'var(--brand-primary-hover)',
            border: '1px solid var(--brand-primary-glow)',
            borderRadius: 'var(--radius-pill)',
            fontSize: 12, fontWeight: 500,
          }}>
            {v}
            <button type="button" onClick={() => onRemove(v)} aria-label={`Remove ${v}`} style={{
              width: 18, height: 18, padding: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', color: 'inherit',
              border: 'none', cursor: 'pointer', borderRadius: 999,
            }}>
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { if (draft.trim()) { onAdd(draft); setDraft(''); } e.preventDefault(); } }}
          placeholder={placeholder}
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          type="button"
          onClick={() => { if (draft.trim()) { onAdd(draft); setDraft(''); } }}
          style={btnGhost}
        >
          <Plus size={13} /> Add
        </button>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '10px 12px',
  background: 'var(--surface-sunken)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 13, color: 'var(--text-primary)',
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
};

const textareaStyle = { ...inputStyle, resize: 'vertical', minHeight: 100 };

const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px',
  background: 'var(--brand-primary)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius-md)',
  fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
  textDecoration: 'none',
};

const btnDisabled = { ...btnPrimary, background: 'var(--border-default)', color: 'var(--text-tertiary)', cursor: 'default' };

const btnGhost = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 12px',
  background: 'transparent', color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
  textDecoration: 'none',
};
