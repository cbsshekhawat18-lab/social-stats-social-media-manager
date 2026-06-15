/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * MetaAdsPicker — searchable, multi-select picker for Meta CTWA ads.
 *
 * Three-stage drill-down:
 *   1. Pick an ad account (loads /me/adaccounts)
 *   2. Pick one or more campaigns (filters down)
 *   3. Multi-select the ads (badged when CTWA-eligible)
 *
 * Degrades cleanly when Meta isn't connected: shows a "Connect Meta Ads"
 * notice with a link to the platform-settings page rather than an error.
 *
 * Returns the selection via `onChange({ ad_account_id, campaign_ids, ad_ids })`.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Search, Building2, Megaphone, Sparkles, ShieldCheck, AlertTriangle,
  ChevronRight,
} from 'lucide-react';

import { metaAdsAPI } from '../../services/api';
import toast from '../ui/toast';

export default function MetaAdsPicker({ value, onChange }) {
  const [accounts,   setAccounts]   = useState(null);     // null = loading, [] = none, list = loaded
  const [account,    setAccount]    = useState(value?.ad_account_id || '');
  const [campaigns,  setCampaigns]  = useState([]);
  const [ads,        setAds]        = useState([]);
  const [loadingAds, setLoadingAds] = useState(false);
  const [search,     setSearch]     = useState('');

  const selectedAdIds = useMemo(() => new Set(value?.ad_ids || []), [value]);

  // Load accounts on mount
  useEffect(() => {
    metaAdsAPI.accounts()
      .then((r) => {
        const list = r.data?.accounts || [];
        setAccounts(list);
        // If only one account, pre-pick it
        if (list.length === 1 && !account) setAccount(list[0].id);
      })
      .catch(() => setAccounts([]));
    // eslint-disable-next-line
  }, []);

  // Load campaigns when account changes
  useEffect(() => {
    if (!account) { setCampaigns([]); return; }
    metaAdsAPI.campaigns(account)
      .then((r) => setCampaigns(r.data?.campaigns || []))
      .catch(() => toast.error('Could not load campaigns'));
  }, [account]);

  // Load ads when campaign(s) selected
  const selectedCampaignIds = value?.campaign_ids || [];
  useEffect(() => {
    if (!selectedCampaignIds.length) { setAds([]); return; }
    setLoadingAds(true);
    Promise.all(selectedCampaignIds.map((cid) => metaAdsAPI.ads(cid)))
      .then((rs) => {
        const merged = rs.flatMap((r) => r.data?.ads || []);
        setAds(merged);
      })
      .catch(() => toast.error('Could not load ads'))
      .finally(() => setLoadingAds(false));
  }, [selectedCampaignIds.join('|')]); // eslint-disable-line

  function toggleCampaign(cid) {
    const cur = value?.campaign_ids || [];
    const next = cur.includes(cid) ? cur.filter((x) => x !== cid) : [...cur, cid];
    onChange({ ...(value || {}), ad_account_id: account, campaign_ids: next, ad_ids: value?.ad_ids || [] });
  }
  function toggleAd(adId) {
    const cur = value?.ad_ids || [];
    const next = cur.includes(adId) ? cur.filter((x) => x !== adId) : [...cur, adId];
    onChange({ ...(value || {}), ad_account_id: account, campaign_ids: value?.campaign_ids || [], ad_ids: next });
  }

  if (accounts === null) {
    return <div style={{ padding: 14, color: 'var(--text-tertiary)', fontSize: 13 }}>Loading Meta ads…</div>;
  }
  if (accounts.length === 0) {
    return (
      <div style={emptyBox}>
        <AlertTriangle size={20} style={{ color: 'var(--warning)' }} />
        <div>
          <strong>Meta Ads not connected</strong>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
            Connect a Facebook Page with the Marketing API access token first, then come back here.
            You can still publish and trigger this flow with keywords or first-message rules in the meantime.
          </p>
        </div>
      </div>
    );
  }

  const filteredAds = ads.filter((a) =>
    !search.trim()
    || (a.name || '').toLowerCase().includes(search.toLowerCase())
    || (a.id || '').includes(search)
  );

  return (
    <div>
      {/* 1. Account picker */}
      <Field label="Ad account">
        <select value={account}
                onChange={(e) => {
                  setAccount(e.target.value);
                  onChange({ ad_account_id: e.target.value, campaign_ids: [], ad_ids: [] });
                }}
                style={inputStyle}>
          <option value="">Pick an account…</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} {a.currency ? `· ${a.currency}` : ''}
            </option>
          ))}
        </select>
      </Field>

      {/* 2. Campaign picker */}
      {account && (
        <Field label={`Campaigns (${selectedCampaignIds.length} selected)`}>
          <div style={listBox}>
            {campaigns.length === 0
              ? <div style={emptyRow}>No campaigns in this account yet.</div>
              : campaigns.map((c) => {
                  const selected = selectedCampaignIds.includes(c.id);
                  return (
                    <button key={c.id} type="button" onClick={() => toggleCampaign(c.id)}
                            style={{ ...row, background: selected ? 'var(--brand-primary-soft)' : 'transparent' }}>
                      <Megaphone size={13} style={{ color: 'var(--text-tertiary)' }} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: selected ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.name}
                      </span>
                      {c.objective && (
                        <span style={chip}>{(c.objective || '').replace('OUTCOME_', '').toLowerCase()}</span>
                      )}
                      {c.effective_status === 'ACTIVE' && (
                        <span style={{ ...chip, color: 'var(--success)', borderColor: 'var(--success)' }}>active</span>
                      )}
                      <input type="checkbox" checked={selected} onChange={() => {}} style={{ marginLeft: 4 }} />
                    </button>
                  );
                })}
          </div>
        </Field>
      )}

      {/* 3. Ads picker */}
      {selectedCampaignIds.length > 0 && (
        <Field label={`Ads (${(value?.ad_ids || []).length} selected)`}>
          <div style={{ position: 'relative', marginBottom: 6 }}>
            <Search size={11} style={{ position: 'absolute', top: 9, left: 8, color: 'var(--text-tertiary)' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
                   placeholder="Filter by name…"
                   style={{ ...inputStyle, paddingLeft: 26 }} />
          </div>
          <div style={listBox}>
            {loadingAds ? (
              <div style={emptyRow}>Loading…</div>
            ) : filteredAds.length === 0 ? (
              <div style={emptyRow}>No ads match.</div>
            ) : (
              filteredAds.map((a) => {
                const selected = selectedAdIds.has(a.id);
                return (
                  <button key={a.id} type="button" onClick={() => toggleAd(a.id)}
                          style={{ ...row, background: selected ? 'var(--brand-primary-soft)' : 'transparent' }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: selected ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.name || a.id}
                    </span>
                    {a.is_ctwa && (
                      <span style={{ ...chip, color: 'var(--brand-primary-hover)', borderColor: 'var(--brand-primary)' }}>
                        <Sparkles size={9} /> CTWA
                      </span>
                    )}
                    {a.effective_status === 'ACTIVE' && (
                      <span style={{ ...chip, color: 'var(--success)', borderColor: 'var(--success)' }}>active</span>
                    )}
                    <input type="checkbox" checked={selected} onChange={() => {}} style={{ marginLeft: 4 }} />
                  </button>
                );
              })
            )}
          </div>
        </Field>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{
        display: 'block', fontSize: 11, fontWeight: 600,
        letterSpacing: '0.04em', textTransform: 'uppercase',
        color: 'var(--text-tertiary)', marginBottom: 4,
      }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '8px 10px',
  background: 'var(--surface-sunken)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 13, color: 'var(--text-primary)',
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
};

const listBox = {
  background: 'var(--surface-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)',
  maxHeight: 200, overflowY: 'auto',
  display: 'flex', flexDirection: 'column',
};

const row = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '8px 10px', textAlign: 'left',
  background: 'transparent', border: 'none',
  borderBottom: '1px solid var(--border-subtle)',
  cursor: 'pointer', fontFamily: 'inherit',
};

const emptyRow = {
  padding: 14, textAlign: 'center', fontSize: 12,
  color: 'var(--text-tertiary)',
};

const chip = {
  padding: '2px 7px',
  fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
  border: '1px solid var(--border-default)', color: 'var(--text-tertiary)',
  background: 'var(--surface-sunken)',
  borderRadius: 'var(--radius-pill)',
  display: 'inline-flex', alignItems: 'center', gap: 3,
};

const emptyBox = {
  display: 'flex', gap: 12, padding: 14,
  background: 'var(--warning-bg)',
  border: '1px solid var(--warning)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
};
