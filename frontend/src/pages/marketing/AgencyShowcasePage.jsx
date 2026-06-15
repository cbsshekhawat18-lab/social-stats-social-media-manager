/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Star, MapPin, Calendar, Users, Globe,
  Mail, Phone, Briefcase, BadgeCheck, CheckCircle2, Sparkles,
} from 'lucide-react';

import MarketingLayout from '../../components/marketing/MarketingLayout';
import MeshGradient    from '../../components/marketing/MeshGradient';
import ScrollReveal    from '../../components/marketing/ScrollReveal';
import SamplePreviewBanner from '../../components/marketing/SamplePreviewBanner';
import Button          from '../../components/ui/Button';
import Meta            from '../../components/Meta';
import JsonLd, {
  buildLocalBusiness, buildBreadcrumbs, SITE_URL,
} from '../../components/JsonLd';

import { getAgency, AGENCY_LIST } from './agencyProfiles';
import ComingSoonPage from './ComingSoonPage';

/**
 * AgencyShowcasePage — /agencies/:slug
 *
 *   1. Hero (logo + name + headline metric, custom-colored)
 *   2. Profile sidebar (sticky) + about + services + portfolio
 *   3. Reviews
 *   4. Stats grid (animated)
 *   5. Contact card + similar agencies
 *   6. Bottom CTA
 *
 * Falls back to ComingSoonPage for unknown slugs.
 */
export default function AgencyShowcasePage() {
  const { slug } = useParams();
  const agency = getAgency(slug);
  if (!agency) return <ComingSoonPage />;

  const {
    name, tagline, accent, location, founded, size,
    industries, services, languages, badges, rating, pricing,
    hero, about, metric, stats, services_detail, portfolio, reviews,
    contact,
  } = agency;

  const similar = AGENCY_LIST
    .filter((a) => a.slug !== slug && a.industries.some((i) => industries.includes(i)))
    .slice(0, 3);

  return (
    <MarketingLayout>
      <Meta
        noSuffix
        title={`${name} — Social Stats Partner Agency`}
        description={tagline}
      />
      <JsonLd
        id="business"
        data={buildLocalBusiness({
          name, slug, description: tagline,
          location, rating, founded,
        })}
      />
      <JsonLd
        id="breadcrumbs"
        data={buildBreadcrumbs([
          { name: 'Home',     url: `${SITE_URL}/` },
          { name: 'Agencies', url: `${SITE_URL}/agencies` },
          { name,             url: `${SITE_URL}/agencies/${slug}` },
        ])}
      />

      <SamplePreviewBanner kind="agency" />

      {/* ╭──────────────╮
          │   1.  HERO   │
          ╰──────────────╯ */}
      <section style={{
        position: 'relative',
        padding: '120px 24px 64px',
        overflow: 'hidden',
      }}>
        <MeshGradient variant="hero" />

        <div style={{ position: 'relative', maxWidth: 1100, margin: '0 auto' }}>
          {/* Breadcrumb */}
          <Link to="/agencies" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 13,
            color: 'rgba(255,255,255,0.65)',
            textDecoration: 'none',
            marginBottom: 24,
          }}>
            <ArrowLeft size={14} /> All agencies
          </Link>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 'clamp(32px, 5vw, 56px)',
            alignItems: 'center',
          }}>
            {/* Left: title block */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <Logo agency={agency} size={64} />
                <div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={11} /> {location}
                  </div>
                  <h1 style={{
                    margin: '4px 0 0',
                    fontSize: 'clamp(32px, 4vw, 44px)',
                    fontWeight: 700,
                    color: '#fff',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.05,
                  }}>
                    {name}
                  </h1>
                </div>
              </div>

              {/* Badges */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {badges.map((b) => (
                  <span key={b} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '4px 10px',
                    fontSize: 11, fontWeight: 600,
                    color: '#00CCF5',
                    background: 'rgba(0,204,245,0.10)',
                    border: '1px solid rgba(0,204,245,0.25)',
                    borderRadius: 'var(--radius-pill)',
                  }}>
                    <BadgeCheck size={11} /> {b}
                  </span>
                ))}
              </div>

              <p style={{
                margin: 0,
                fontSize: 'clamp(18px, 2vw, 22px)',
                color: 'rgba(255,255,255,0.78)',
                lineHeight: 1.4,
                maxWidth: 540,
              }}>
                {tagline}
              </p>

              <div style={{
                marginTop: 24,
                display: 'flex', alignItems: 'center', gap: 16,
                fontSize: 13, color: 'rgba(255,255,255,0.65)',
                flexWrap: 'wrap',
              }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#facc15' }}>
                  <Star size={13} fill="#facc15" /> {rating.score}
                  <span style={{ color: 'rgba(255,255,255,0.55)', marginLeft: 2 }}>· {rating.count} reviews</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Briefcase size={13} /> From {pricing.from}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Users size={13} /> {size}
                </span>
              </div>

              <div style={{
                marginTop: 28,
                display: 'flex', gap: 10, flexWrap: 'wrap',
              }}>
                <Button as="a" href={`mailto:${contact.email}`} size="md"
                  style={{
                    background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                    color: '#0a0e14', border: 'none',
                  }}>
                  Contact agency <ArrowRight size={14} />
                </Button>
                <Button as="a" href={`https://${contact.website}`} target="_blank" rel="noopener noreferrer" size="md" variant="ghost"
                  style={{
                    color: '#fff',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.14)',
                  }}>
                  <Globe size={14} /> Visit website
                </Button>
              </div>
            </div>

            {/* Right: headline metric card */}
            <ScrollReveal delay={0.1}>
              <motion.div
                whileHover={{ y: -3 }}
                style={{
                  position: 'relative',
                  padding: 32,
                  borderRadius: 'var(--radius-xl)',
                  background: `linear-gradient(135deg, ${accent}14, rgba(255,255,255,0.04))`,
                  border: `1px solid ${accent}40`,
                  textAlign: 'center',
                  overflow: 'hidden',
                }}
              >
                <div style={{
                  position: 'absolute', inset: 0,
                  backgroundImage: `radial-gradient(circle at 50% 0%, ${accent}33, transparent 60%)`,
                  pointerEvents: 'none',
                }} />
                <div style={{ position: 'relative' }}>
                  <Sparkles size={20} color={accent} style={{ marginBottom: 8 }} />
                  <div style={{
                    fontSize: 'clamp(56px, 8vw, 96px)',
                    fontWeight: 700,
                    color: accent,
                    letterSpacing: '-0.04em',
                    lineHeight: 1,
                  }}>
                    {metric.value}
                  </div>
                  <div style={{
                    marginTop: 8,
                    fontSize: 14,
                    color: 'rgba(255,255,255,0.75)',
                  }}>
                    {metric.label}
                  </div>
                </div>
              </motion.div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ╭──────────────────────────────╮
          │   2.  PROFILE + ABOUT/SVCS   │
          ╰──────────────────────────────╯ */}
      <section style={{ padding: '64px 24px' }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 280px) minmax(0, 1fr)',
          gap: 'clamp(32px, 5vw, 64px)',
          alignItems: 'start',
        }}>
          {/* Sidebar */}
          <ScrollReveal>
            <aside style={{
              padding: 24,
              borderRadius: 'var(--radius-xl)',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              position: 'sticky', top: 96,
            }}>
              <ProfileRow icon={Calendar} label="Founded"   value={founded} />
              <ProfileRow icon={Users}    label="Team"      value={size} />
              <ProfileRow icon={MapPin}   label="Location"  value={location} />
              <ProfileRow icon={Briefcase}label="Pricing"   value={pricing.model} />

              <SidebarBlock title="Industries">
                {industries.map((i) => <Chip key={i}>{i}</Chip>)}
              </SidebarBlock>

              <SidebarBlock title="Services">
                {services.map((s) => <Chip key={s}>{s}</Chip>)}
              </SidebarBlock>

              <SidebarBlock title="Languages">
                {languages.map((l) => <Chip key={l}>{l}</Chip>)}
              </SidebarBlock>

              <div style={{
                marginTop: 18,
                paddingTop: 18,
                borderTop: '1px solid rgba(255,255,255,0.08)',
                fontSize: 12,
                color: 'rgba(255,255,255,0.55)',
              }}>
                <ContactLink icon={Globe} text={contact.website} href={`https://${contact.website}`} />
                <ContactLink icon={Mail}  text={contact.email}   href={`mailto:${contact.email}`} />
                <ContactLink icon={Phone} text={contact.phone}   href={`tel:${contact.phone.replace(/\s/g, '')}`} />
              </div>
            </aside>
          </ScrollReveal>

          {/* Long form */}
          <div style={{ minWidth: 0 }}>
            <ScrollReveal>
              <SectionLabel accent={accent}>About</SectionLabel>
              <h2 style={sectionH2}>About {name}</h2>
              {about.map((p, i) => <p key={i} style={paraStyle}>{p}</p>)}
            </ScrollReveal>

            {/* Stats */}
            <ScrollReveal>
              <div style={{
                marginTop: 40,
                padding: 'clamp(28px, 4vw, 40px)',
                borderRadius: 'var(--radius-xl)',
                background: `linear-gradient(135deg, ${accent}10, rgba(255,255,255,0.02))`,
                border: `1px solid ${accent}30`,
              }}>
                <SectionLabel accent={accent}>By the numbers</SectionLabel>
                <div style={{
                  marginTop: 18,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: 16,
                }}>
                  {stats.map((s) => (
                    <div key={s.label} style={{
                      padding: 16,
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}>
                      <div style={{
                        fontSize: 'clamp(24px, 3vw, 32px)',
                        fontWeight: 700,
                        color: accent,
                        letterSpacing: '-0.02em',
                        lineHeight: 1,
                      }}>
                        {s.value}
                      </div>
                      <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>

            {/* Services detail */}
            <ScrollReveal>
              <div style={{ marginTop: 48 }}>
                <SectionLabel accent={accent}>Services</SectionLabel>
                <h2 style={sectionH2}>What they do</h2>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 14,
                  marginTop: 18,
                }}>
                  {services_detail.map((s) => (
                    <div key={s.title} style={{
                      padding: 20,
                      borderRadius: 'var(--radius-lg)',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      height: '100%',
                    }}>
                      <CheckCircle2 size={18} color={accent} style={{ marginBottom: 8 }} />
                      <h3 style={{
                        margin: 0,
                        fontSize: 15, fontWeight: 600,
                        color: '#fff',
                      }}>
                        {s.title}
                      </h3>
                      <p style={{
                        margin: '6px 0 0',
                        fontSize: 13,
                        color: 'rgba(255,255,255,0.65)',
                        lineHeight: 1.55,
                      }}>
                        {s.body}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>

            {/* Portfolio */}
            <ScrollReveal>
              <div style={{ marginTop: 48 }}>
                <SectionLabel accent={accent}>Portfolio</SectionLabel>
                <h2 style={sectionH2}>Featured work</h2>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 14,
                  marginTop: 18,
                }}>
                  {portfolio.map((p) => (
                    <div key={p.brand} style={{
                      padding: 18,
                      borderRadius: 'var(--radius-lg)',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                        {p.brand}
                      </div>
                      <div style={{
                        marginTop: 4,
                        fontSize: 22, fontWeight: 700,
                        color: accent,
                        letterSpacing: '-0.02em',
                      }}>
                        {p.metric}
                      </div>
                      <div style={{
                        marginTop: 4, fontSize: 12,
                        color: 'rgba(255,255,255,0.55)',
                      }}>
                        {p.note}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>

            {/* Reviews */}
            <ScrollReveal>
              <div style={{ marginTop: 48 }}>
                <SectionLabel accent={accent}>Reviews</SectionLabel>
                <h2 style={sectionH2}>What customers say</h2>
                <div style={{ marginTop: 18, display: 'grid', gap: 12 }}>
                  {reviews.map((r, i) => (
                    <article key={i} style={{
                      padding: 20,
                      borderRadius: 'var(--radius-lg)',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        marginBottom: 8,
                      }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                            {r.name}
                          </div>
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                            {r.role}
                          </div>
                        </div>
                        <div style={{ display: 'inline-flex', gap: 2 }}>
                          {Array.from({ length: 5 }).map((_, idx) => (
                            <Star
                              key={idx}
                              size={12}
                              fill={idx < r.rating ? '#facc15' : 'transparent'}
                              color={idx < r.rating ? '#facc15' : 'rgba(255,255,255,0.30)'}
                            />
                          ))}
                        </div>
                      </div>
                      <p style={{
                        margin: 0,
                        fontSize: 14,
                        fontStyle: 'italic',
                        color: 'rgba(255,255,255,0.78)',
                        lineHeight: 1.55,
                      }}>
                        &quot;{r.body}&quot;
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ╭──────────────────────────╮
          │   3.  SIMILAR AGENCIES   │
          ╰──────────────────────────╯ */}
      {similar.length > 0 && (
        <section style={{ padding: '64px 24px', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <h2 style={{
              margin: '0 0 20px',
              fontSize: 13, fontWeight: 600,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.55)',
              textAlign: 'center',
            }}>
              Similar agencies
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16,
            }}>
              {similar.map((a) => (
                <Link key={a.slug} to={`/agencies/${a.slug}`} style={{
                  textDecoration: 'none',
                  padding: 20,
                  borderRadius: 'var(--radius-lg)',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                }}>
                  <Logo agency={a} size={40} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{a.name}</div>
                    <div style={{
                      fontSize: 12, color: 'rgba(255,255,255,0.65)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {a.tagline}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ╭──────────────╮
          │   4.  CTA    │
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
            Ready to work with {name}?
          </h2>

          <p style={{
            margin: '20px auto 32px',
            maxWidth: 480,
            fontSize: 17,
            color: 'rgba(255,255,255,0.75)',
            lineHeight: 1.55,
          }}>
            All Social Stats partner agencies use the same product you would. You stay in control of your data, permissions, and access.
          </p>

          <div style={{
            display: 'flex', gap: 12,
            justifyContent: 'center', flexWrap: 'wrap',
          }}>
            <Button as="a" href={`mailto:${contact.email}`} size="lg"
              style={{
                background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                color: '#0a0e14', border: 'none',
              }}>
              Contact {name} <ArrowRight size={15} />
            </Button>
            <Button as={Link} to="/agencies" size="lg" variant="ghost"
              style={{
                color: '#fff',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.18)',
              }}>
              <ArrowLeft size={15} /> All agencies
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}

// ── helpers ────────────────────────────────────────────────────────────
const sectionH2 = {
  margin: '8px 0 16px',
  fontSize: 'clamp(24px, 3.2vw, 32px)',
  fontWeight: 700,
  color: '#fff',
  letterSpacing: '-0.02em',
  lineHeight: 1.2,
};

const paraStyle = {
  margin: '0 0 16px',
  fontSize: 16,
  lineHeight: 1.65,
  color: 'rgba(255,255,255,0.78)',
};

function SectionLabel({ accent, children }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 11, fontWeight: 600,
      letterSpacing: 2, textTransform: 'uppercase',
      color: accent,
    }}>
      {children}
    </div>
  );
}

function ProfileRow({ icon: Icon, label, value }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      fontSize: 13,
    }}>
      <Icon size={13} color="rgba(255,255,255,0.55)" />
      <span style={{ color: 'rgba(255,255,255,0.55)', flex: 1 }}>{label}</span>
      <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function SidebarBlock({ title, children }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{
        fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.45)', marginBottom: 10,
      }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{children}</div>
    </div>
  );
}

function Chip({ children }) {
  return (
    <span style={{
      padding: '3px 10px',
      fontSize: 11, fontWeight: 600,
      color: 'rgba(255,255,255,0.75)',
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.10)',
      borderRadius: 'var(--radius-pill)',
    }}>
      {children}
    </span>
  );
}

function ContactLink({ icon: Icon, text, href }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 0',
      color: 'rgba(255,255,255,0.65)',
      textDecoration: 'none',
    }}>
      <Icon size={12} /> {text}
    </a>
  );
}

function Logo({ agency: a, size = 40 }) {
  return (
    <div style={{
      flexShrink: 0,
      width: size, height: size,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 12,
      background: `linear-gradient(135deg, ${a.hero.cover[0]}, ${a.hero.cover[1]})`,
      color: '#fff',
      fontWeight: 700,
      fontSize: Math.round(size * 0.4),
    }}>
      {a.hero.logoText}
    </div>
  );
}
