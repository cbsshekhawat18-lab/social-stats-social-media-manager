/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * MarketplacePage — public agency browse.
 *
 * Reachable at /agencies (public) and /u/agency/find (linked from end-user shell).
 * Anyone — logged in or not — can browse. Logged-in end-users get an
 * "Invite this agency" CTA on each profile.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search, ShieldCheck, Sparkles, Star, Filter, Building2, ChevronRight, MapPin,
} from 'lucide-react';

import { marketplaceAPI } from '../../services/api';
import toast from '../../components/ui/toast';

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'rating',    label: 'Top rated' },
  { value: 'newest',    label: 'Newest' },
  { value: 'cheapest',  label: 'Best price' },
];

export default function MarketplacePage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [agencies,   setAgencies]   = useState([]);
  const [featured,   setFeatured]   = useState([]);
  const [categories, setCategories] = useState({ industries: [], services: [] });
  const [count,      setCount]      = useState(0);
  const [loading,    setLoading]    = useState(true);

  const filters = useMemo(() => ({
    q:        searchParams.get('q')        || '',
    industry: searchParams.get('industry') || '',
    service:  searchParams.get('service')  || '',
    verified: searchParams.get('verified') === '1',
    rating_min: searchParams.get('rating_min') || '',
    sort:     searchParams.get('sort') || 'relevance',
  }), [searchParams]);

  function setFilter(key, value) {
    const next = new URLSearchParams(searchParams);
    if (!value || value === '') next.delete(key);
    else next.set(key, String(value));
    setSearchParams(next);
  }

  // Load list whenever filters change
  useEffect(() => {
    setLoading(true);
    const params = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v === true ? '1' : v; });
    marketplaceAPI.list(params)
      .then((r) => { setAgencies(r.data?.agencies || []); setCount(r.data?.count || 0); })
      .catch(() => toast.error('Could not load marketplace'))
      .finally(() => setLoading(false));
  }, [filters]);

  // Featured + categories — fire once
  useEffect(() => {
    Promise.all([marketplaceAPI.featured(), marketplaceAPI.categories()])
      .then(([rF, rC]) => {
        setFeatured(rF.data?.agencies || []);
        setCategories(rC.data || { industries: [], services: [] });
      })
      .catch(() => {});
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-page)', padding: '32px 16px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <header style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--brand-primary-hover)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Marketplace
          </span>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Find an agency that fits your business
          </h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 15 }}>
            Verified agencies. You stay in control of your data, permissions, and access.
          </p>
        </header>

        {/* Search bar */}
        <div style={searchBar}>
          <Search size={16} color="var(--text-tertiary)" />
          <input
            type="text"
            value={filters.q}
            onChange={(e) => setFilter('q', e.target.value)}
            placeholder="Search agencies by name, industry, or location"
            style={searchInput}
          />
          <select
            value={filters.sort}
            onChange={(e) => setFilter('sort', e.target.value)}
            style={selectStyle}
          >
            {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        {/* Featured */}
        {featured.length > 0 && !filters.q && !filters.industry && !filters.service && (
          <section style={{ marginTop: 24 }}>
            <h2 style={sectionTitle}>
              <Sparkles size={14} style={{ color: 'var(--brand-primary-hover)' }} /> Featured
            </h2>
            <div style={cardGrid}>
              {featured.map((a) => <AgencyCard key={a.id} agency={a} />)}
            </div>
          </section>
        )}

        {/* Filter chips */}
        <section style={{ marginTop: 28 }}>
          <h2 style={sectionTitle}>
            <Filter size={13} style={{ color: 'var(--text-tertiary)' }} /> Filters
          </h2>
          <FilterChips
            label="Industry"
            value={filters.industry}
            options={categories.industries}
            onChange={(v) => setFilter('industry', v)}
          />
          <FilterChips
            label="Service"
            value={filters.service}
            options={categories.services}
            onChange={(v) => setFilter('service', v)}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={filters.verified}
                onChange={(e) => setFilter('verified', e.target.checked ? '1' : '')}
              />
              Verified only
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
              Min rating:
              <select value={filters.rating_min} onChange={(e) => setFilter('rating_min', e.target.value)} style={miniSelect}>
                <option value="">Any</option>
                <option value="3">★ 3+</option>
                <option value="4">★ 4+</option>
                <option value="4.5">★ 4.5+</option>
              </select>
            </label>
          </div>
        </section>

        {/* Results */}
        <section style={{ marginTop: 28 }}>
          <h2 style={sectionTitle}>
            All agencies <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-tertiary)' }}>· {count}</span>
          </h2>
          {loading ? (
            <div style={{ padding: 36, textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading…</div>
          ) : agencies.length === 0 ? (
            <div style={emptyBox}>No agencies match your filters yet. Try widening the search.</div>
          ) : (
            <div style={cardGrid}>
              {agencies.map((a) => <AgencyCard key={a.id} agency={a} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function FilterChips({ label, value, options, onChange }) {
  if (!options || options.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginRight: 4 }}>
        {label}
      </span>
      <Chip active={!value} onClick={() => onChange('')}>All</Chip>
      {options.map((opt) => (
        <Chip key={opt.value} active={value === opt.value} onClick={() => onChange(opt.value)}>
          {opt.value} <em style={{ fontStyle: 'normal', color: 'var(--text-tertiary)', marginLeft: 4 }}>{opt.count}</em>
        </Chip>
      ))}
    </div>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '5px 10px',
        fontSize: 12, fontWeight: active ? 600 : 500,
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        background: active ? 'var(--brand-primary-soft)' : 'var(--surface-card)',
        border: `1px solid ${active ? 'var(--brand-primary)' : 'var(--border-default)'}`,
        borderRadius: 'var(--radius-pill)',
        cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

function AgencyCard({ agency }) {
  return (
    <Link
      to={`/agencies/${agency.slug}`}
      style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        padding: 16,
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        textDecoration: 'none', color: 'inherit',
        transition: 'transform 120ms var(--ease-out), box-shadow 120ms var(--ease-out)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          width: 40, height: 40,
          background: 'var(--brand-primary-glow)', color: 'var(--brand-primary-hover)',
          borderRadius: 'var(--radius-sm)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {agency.logo_url
            ? <img src={agency.logo_url} alt="" style={{ width: 36, height: 36, borderRadius: 4, objectFit: 'cover' }} />
            : <Building2 size={18} />}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{agency.name}</span>
            {agency.is_verified && <ShieldCheck size={13} color="var(--success)" aria-label="Verified" />}
          </div>
          {agency.location && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <MapPin size={11} /> {agency.location}
            </div>
          )}
        </div>
      </div>

      {agency.description && (
        <p style={{
          margin: 0, fontSize: 13,
          color: 'var(--text-secondary)', lineHeight: 1.55,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {agency.description}
        </p>
      )}

      {agency.services_offered?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {agency.services_offered.slice(0, 4).map((s) => (
            <span key={s} style={{
              padding: '2px 8px',
              background: 'var(--surface-sunken)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              borderRadius: 'var(--radius-pill)',
              fontSize: 11,
            }}>{s}</span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 'auto' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
          {agency.review_count > 0 ? (
            <><Star size={12} fill="var(--warning)" stroke="var(--warning)" /> {agency.avg_rating.toFixed(1)} <span style={{ color: 'var(--text-tertiary)' }}>({agency.review_count})</span></>
          ) : (
            <span style={{ color: 'var(--text-tertiary)' }}>No reviews yet</span>
          )}
        </div>
        {agency.pricing_starting_at && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            from <strong style={{ color: 'var(--text-primary)' }}>{agency.pricing_currency} {Number(agency.pricing_starting_at).toLocaleString()}</strong>/mo
          </div>
        )}
      </div>

      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--brand-primary-hover)' }}>
        View profile <ChevronRight size={12} />
      </div>
    </Link>
  );
}

const searchBar = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '8px 12px',
  background: 'var(--surface-card)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
};

const searchInput = {
  flex: 1, padding: '8px 4px',
  background: 'transparent', border: 'none', outline: 'none',
  fontSize: 14, color: 'var(--text-primary)', fontFamily: 'inherit',
};

const selectStyle = {
  padding: '6px 10px',
  background: 'var(--surface-sunken)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'inherit',
};

const miniSelect = { ...selectStyle, padding: '4px 8px' };

const sectionTitle = {
  margin: '0 0 8px',
  fontSize: 13, fontWeight: 600,
  color: 'var(--text-tertiary)',
  letterSpacing: '0.06em', textTransform: 'uppercase',
  display: 'inline-flex', alignItems: 'center', gap: 6,
};

const cardGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: 14,
};

const emptyBox = {
  padding: 32, textAlign: 'center',
  background: 'var(--surface-card)',
  border: '1px dashed var(--border-default)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-tertiary)', fontSize: 14,
};
