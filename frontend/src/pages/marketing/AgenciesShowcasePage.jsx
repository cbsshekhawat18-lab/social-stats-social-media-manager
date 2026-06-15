/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search, Sparkles, Star, MapPin, Users, ArrowRight, ArrowUpRight,
  ShieldCheck, BadgeCheck,
} from 'lucide-react';

import MarketingLayout from '../../components/marketing/MarketingLayout';
import MeshGradient    from '../../components/marketing/MeshGradient';
import ScrollReveal    from '../../components/marketing/ScrollReveal';
import Button          from '../../components/ui/Button';
import Meta            from '../../components/Meta';

import {
  AGENCY_LIST, listIndustries, listServices,
} from './agencyProfiles';

/**
 * AgenciesShowcasePage — /agencies
 *
 * Static, SEO-friendly partner-agency showcase. Uses MarketingLayout chrome.
 * Distinct from the functional /marketplace which talks to the live
 * marketplace API for end-user invitation flows.
 *
 *   1. Hero with search + "find an agency" pitch
 *   2. Trust strip (verified · SOC2 · vetted)
 *   3. Featured trio (top-rated)
 *   4. Industry / service / language filters
 *   5. Full grid (filterable + searchable)
 *   6. Become-a-partner CTA
 *   7. Bottom CTA
 */

export default function AgenciesShowcasePage() {
  const [query,    setQuery]    = useState('');
  const [industry, setIndustry] = useState('');
  const [service,  setService]  = useState('');

  const industries = useMemo(listIndustries, []);
  const services   = useMemo(listServices,   []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return AGENCY_LIST
      .filter((a) => !industry || a.industries.includes(industry))
      .filter((a) => !service  || a.services.includes(service))
      .filter((a) => !q
        || a.name.toLowerCase().includes(q)
        || a.tagline.toLowerCase().includes(q)
        || a.location.toLowerCase().includes(q)
        || a.industries.some((i) => i.toLowerCase().includes(q))
        || a.services.some((s) => s.toLowerCase().includes(q)));
  }, [query, industry, service]);

  const featured = AGENCY_LIST.slice().sort((a, b) => b.rating.score - a.rating.score).slice(0, 3);
  const isPristine = !query && !industry && !service;

  return (
    <MarketingLayout>
      <Meta
        noSuffix
        title="Partner Agencies — Social Stats"
        description="Find a verified marketing agency built on Social Stats. 50+ partner agencies across India, vetted for compliance, capability, and customer outcomes."
      />

      {/* ╭──────────────╮
          │   1.  HERO   │
          ╰──────────────╯ */}
      <section style={{
        position: 'relative',
        padding: '120px 24px 64px',
        textAlign: 'center',
        overflow: 'hidden',
      }}>
        <MeshGradient variant="hero" />

        <div style={{ position: 'relative', maxWidth: 720, margin: '0 auto' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', marginBottom: 20,
            fontSize: 12, fontWeight: 600,
            color: '#00CCF5',
            background: 'rgba(0,204,245,0.10)',
            border: '1px solid rgba(0,204,245,0.25)',
            borderRadius: 'var(--radius-pill)',
          }}>
            <Sparkles size={12} /> Partner agencies
          </span>

          <h1 style={{
            margin: 0,
            fontSize: 'clamp(40px, 6vw, 64px)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#fff',
            lineHeight: 1.05,
          }}>
            Find a marketing agency<br />
            <span style={{ background: 'linear-gradient(135deg, #00CCF5, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              that already runs on Social Stats
            </span>
          </h1>

          <p style={{
            margin: '20px auto 32px',
            maxWidth: 560,
            fontSize: 'clamp(16px, 1.8vw, 19px)',
            color: 'rgba(255,255,255,0.75)',
            lineHeight: 1.55,
          }}>
            50+ vetted agencies across India. Verified credentials. Real customer reviews. The agency you hire here uses the same tools you'll use to monitor them.
          </p>

          {/* Search */}
          <label style={{
            display: 'flex', alignItems: 'center', gap: 10,
            maxWidth: 480, margin: '0 auto',
            padding: '12px 16px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 'var(--radius-pill)',
            backdropFilter: 'blur(12px)',
          }}>
            <Search size={16} color="rgba(255,255,255,0.55)" />
            <input
              type="search"
              aria-label="Search agencies"
              placeholder="Search by name, industry, or city…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                flex: 1, minWidth: 0,
                background: 'transparent',
                border: 'none', outline: 'none',
                color: '#fff',
                fontSize: 15,
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                style={{
                  background: 'transparent', border: 'none',
                  color: 'rgba(255,255,255,0.55)',
                  cursor: 'pointer', fontSize: 14,
                }}
              >
                ×
              </button>
            )}
          </label>
        </div>
      </section>

      {/* ╭──────────────────────╮
          │  2.  TRUST STRIP     │
          ╰──────────────────────╯ */}
      <section style={{ padding: '24px 24px 40px' }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto',
          display: 'flex', gap: 24, flexWrap: 'wrap',
          justifyContent: 'center', alignItems: 'center',
          fontSize: 13, color: 'rgba(255,255,255,0.65)',
        }}>
          <TrustItem icon={ShieldCheck} text="Every partner verified" />
          <TrustItem icon={BadgeCheck}  text="Social Stats Native trained" />
          <TrustItem icon={Star}        text="4.8+ avg. customer rating" />
          <TrustItem icon={Users}       text="50,000+ campaigns delivered" />
        </div>
      </section>

      {/* ╭──────────────────────╮
          │   3.  FEATURED       │
          ╰──────────────────────╯ */}
      {isPristine && (
        <section style={{ padding: '32px 24px 48px' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <ScrollReveal>
              <div style={{
                fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.55)', marginBottom: 16,
                textAlign: 'center',
              }}>
                Featured · Top rated
              </div>
            </ScrollReveal>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16,
            }}>
              {featured.map((a, i) => (
                <ScrollReveal key={a.slug} delay={i * 0.06}>
                  <FeaturedCard a={a} />
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ╭──────────────────────╮
          │   4.  FILTERS + GRID │
          ╰──────────────────────╯ */}
      <section style={{ padding: '40px 24px 80px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {/* Filter chips row */}
          <div style={{
            display: 'flex', gap: 12, flexWrap: 'wrap',
            justifyContent: 'center',
            marginBottom: 28,
          }}>
            <ChipSelect
              label="Industry"
              value={industry}
              options={industries}
              onChange={setIndustry}
            />
            <ChipSelect
              label="Service"
              value={service}
              options={services}
              onChange={setService}
            />
            {(industry || service || query) && (
              <button
                type="button"
                onClick={() => { setIndustry(''); setService(''); setQuery(''); }}
                style={{
                  padding: '8px 14px',
                  fontSize: 13, fontWeight: 600,
                  color: '#fff',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  borderRadius: 'var(--radius-pill)',
                  cursor: 'pointer',
                }}
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Heading */}
          <h2 style={{
            margin: '0 0 20px',
            fontSize: 13, fontWeight: 600,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.55)',
            textAlign: 'center',
          }}>
            {filtered.length} {filtered.length === 1 ? 'agency' : 'agencies'}
            {industry && <> in <span style={{ color: '#fff' }}>{industry}</span></>}
            {service  && <> for <span style={{ color: '#fff' }}>{service}</span></>}
          </h2>

          {filtered.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 16,
            }}>
              {filtered.map((a) => <AgencyCard key={a.slug} a={a} />)}
            </div>
          ) : (
            <div style={{
              padding: 56, textAlign: 'center',
              color: 'rgba(255,255,255,0.55)',
              border: '1px dashed rgba(255,255,255,0.12)',
              borderRadius: 'var(--radius-xl)',
            }}>
              <p style={{ margin: 0, fontSize: 15 }}>
                No agencies match these filters yet.
              </p>
              <p style={{ margin: '8px 0 16px', fontSize: 13 }}>
                Try widening your search — or apply to be the first.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ╭──────────────────────────╮
          │   5.  BECOME A PARTNER   │
          ╰──────────────────────────╯ */}
      <section style={{ padding: '80px 24px', background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 32,
            alignItems: 'center',
            padding: 'clamp(32px, 5vw, 56px)',
            background: 'linear-gradient(135deg, rgba(0,204,245,0.06), rgba(139,92,246,0.06))',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 'var(--radius-xl)',
          }}>
            <div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', marginBottom: 14,
                fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase',
                color: '#00CCF5',
                background: 'rgba(0,204,245,0.10)',
                border: '1px solid rgba(0,204,245,0.25)',
                borderRadius: 'var(--radius-pill)',
              }}>
                For agencies
              </div>
              <h2 style={{
                margin: 0,
                fontSize: 'clamp(26px, 3.5vw, 36px)',
                fontWeight: 700,
                color: '#fff',
                letterSpacing: '-0.02em',
                lineHeight: 1.15,
              }}>
                Run your agency on Social Stats.<br />
                Get listed here. Earn referral revenue.
              </h2>
              <p style={{
                margin: '14px 0 24px',
                fontSize: 16,
                color: 'rgba(255,255,255,0.75)',
                lineHeight: 1.55,
              }}>
                Agencies on the Social Stats Partner Program get listed in this directory, earn 30% on referred customers, and receive priority support.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Button as={Link} to="/for-agencies" size="md"
                  style={{
                    background: 'linear-gradient(135deg, #00CCF5, #00A8D8)',
                    color: '#0a0e14', border: 'none',
                  }}>
                  Become a partner <ArrowRight size={14} />
                </Button>
                <Button as={Link} to="/contact?topic=partnership" size="md" variant="ghost"
                  style={{
                    color: '#fff',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.14)',
                  }}>
                  Talk to partnerships
                </Button>
              </div>
            </div>

            {/* Mini stats */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 12,
            }}>
              {[
                { value: '50+',  label: 'partner agencies'   },
                { value: '30%',  label: 'referral commission'},
                { value: '4.8',  label: 'avg. partner rating'},
                { value: '14d',  label: 'avg. onboarding'   },
              ].map((s) => (
                <div key={s.label} style={{
                  padding: 18,
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#00CCF5', letterSpacing: '-0.02em' }}>
                    {s.value}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ╭──────────────╮
          │   6.  CTA    │
          ╰──────────────╯ */}
      <section style={{
        position: 'relative',
        padding: '120px 24px',
        textAlign: 'center',
        overflow: 'hidden',
      }}>
        <MeshGradient variant="cta" />

        <div style={{ position: 'relative', maxWidth: 640, margin: '0 auto' }}>
          <h2 style={{
            margin: 0,
            fontSize: 'clamp(32px, 4.5vw, 48px)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#fff',
            lineHeight: 1.1,
          }}>
            Or skip the agency<br />
            <span style={{ background: 'linear-gradient(135deg, #00CCF5, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              and run it in-house
            </span>
          </h2>

          <p style={{
            margin: '20px auto 32px',
            maxWidth: 480,
            fontSize: 17,
            color: 'rgba(255,255,255,0.75)',
            lineHeight: 1.55,
          }}>
            Social Stats is built so a 1-person team can do what a 5-person agency does. Start free and see for yourself.
          </p>

          <div style={{
            display: 'flex', gap: 12,
            justifyContent: 'center', flexWrap: 'wrap',
          }}>
            <Button as={Link} to="/signup" size="lg"
              style={{
                background: 'linear-gradient(135deg, #00CCF5, #00A8D8)',
                color: '#0a0e14', border: 'none',
              }}>
              Start free <ArrowRight size={15} />
            </Button>
            <Button as={Link} to="/pricing" size="lg" variant="ghost"
              style={{
                color: '#fff',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.18)',
              }}>
              See pricing
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}

// ── components ─────────────────────────────────────────────────────────
function TrustItem({ icon: Icon, text }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Icon size={14} color="#00CCF5" />
      {text}
    </div>
  );
}

function ChipSelect({ label, value, options, onChange }) {
  return (
    <label style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '8px 12px',
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.14)',
      borderRadius: 'var(--radius-pill)',
      fontSize: 13,
      color: 'rgba(255,255,255,0.75)',
    }}>
      <span style={{
        fontSize: 11, fontWeight: 600,
        letterSpacing: 1, textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.55)',
      }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: 'transparent',
          border: 'none', outline: 'none',
          color: '#fff',
          fontSize: 13, fontWeight: 600,
          cursor: 'pointer',
          appearance: 'none',
          paddingRight: 14,
          backgroundImage: 'linear-gradient(45deg, transparent 50%, rgba(255,255,255,0.6) 50%), linear-gradient(135deg, rgba(255,255,255,0.6) 50%, transparent 50%)',
          backgroundPosition: 'right 4px center, right 0px center',
          backgroundSize: '4px 4px, 4px 4px',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <option value="">Any</option>
        {options.map((o) => (
          <option key={o} value={o} style={{ background: '#0a0e14', color: '#fff' }}>{o}</option>
        ))}
      </select>
    </label>
  );
}

function FeaturedCard({ a }) {
  return (
    <Link to={`/agencies/${a.slug}`} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
      <motion.article
        whileHover={{ y: -5 }}
        style={{
          position: 'relative',
          padding: 24,
          borderRadius: 'var(--radius-xl)',
          background: `linear-gradient(135deg, ${a.accent}1A, rgba(255,255,255,0.04))`,
          border: `1px solid ${a.accent}40`,
          overflow: 'hidden',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          marginBottom: 14,
        }}>
          <Logo a={a} size={48} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>{a.name}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={11} /> {a.location}
            </div>
          </div>
        </div>

        <p style={{
          margin: 0,
          fontSize: 14,
          color: 'rgba(255,255,255,0.75)',
          lineHeight: 1.55,
          flex: 1,
        }}>
          {a.tagline}
        </p>

        <div style={{
          marginTop: 16, display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 12, color: 'rgba(255,255,255,0.65)',
          flexWrap: 'wrap',
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#facc15' }}>
            <Star size={12} fill="#facc15" /> {a.rating.score} · {a.rating.count} reviews
          </span>
          <span>· From {a.pricing.from}</span>
        </div>

        <div style={{
          marginTop: 16, paddingTop: 14,
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 13, fontWeight: 600,
          color: a.accent,
        }}>
          View profile <ArrowUpRight size={13} />
        </div>
      </motion.article>
    </Link>
  );
}

function AgencyCard({ a }) {
  return (
    <Link to={`/agencies/${a.slug}`} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
      <motion.div
        whileHover={{ y: -3 }}
        style={{
          padding: 20,
          borderRadius: 'var(--radius-lg)',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          transition: 'border-color 0.2s',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <Logo a={a} size={40} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{a.name}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
              {a.location}
            </div>
          </div>
          {a.badges.includes('Top 1%') && (
            <span style={{
              padding: '2px 7px',
              fontSize: 10, fontWeight: 600,
              color: '#fbbf24',
              background: 'rgba(251,191,36,0.10)',
              border: '1px solid rgba(251,191,36,0.30)',
              borderRadius: 'var(--radius-pill)',
              whiteSpace: 'nowrap',
            }}>Top 1%</span>
          )}
        </div>

        <p style={{
          margin: 0, flex: 1,
          fontSize: 13,
          color: 'rgba(255,255,255,0.65)',
          lineHeight: 1.55,
        }}>
          {a.tagline}
        </p>

        <div style={{
          marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 6,
        }}>
          {a.industries.slice(0, 3).map((ind) => (
            <span key={ind} style={{
              padding: '2px 8px',
              fontSize: 11, fontWeight: 500,
              color: 'rgba(255,255,255,0.65)',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 'var(--radius-pill)',
            }}>
              {ind}
            </span>
          ))}
        </div>

        <div style={{
          marginTop: 14, paddingTop: 12,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 12, color: 'rgba(255,255,255,0.65)',
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#facc15' }}>
            <Star size={11} fill="#facc15" /> {a.rating.score}
            <span style={{ color: 'rgba(255,255,255,0.45)', marginLeft: 4 }}>· {a.rating.count}</span>
          </span>
          <span>From {a.pricing.from}</span>
        </div>
      </motion.div>
    </Link>
  );
}

function Logo({ a, size = 40 }) {
  return (
    <div style={{
      flexShrink: 0,
      width: size, height: size,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 10,
      background: `linear-gradient(135deg, ${a.hero.cover[0]}, ${a.hero.cover[1]})`,
      color: '#fff',
      fontWeight: 700,
      fontSize: size <= 40 ? 16 : 20,
    }}>
      {a.hero.logoText}
    </div>
  );
}
