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
import { ArrowRight, Search, Sparkles } from 'lucide-react';

import MarketingLayout from '../components/marketing/MarketingLayout';
import Badge from '../components/ui/Badge';
import Avatar from '../components/ui/Avatar';
import Meta from '../components/Meta';
import { track } from '../services/analytics';

import POSTS from './marketing/blogPosts';

/**
 * BlogIndexPage — /blog
 *
 *   1. Hero with search
 *   2. Category filter pills
 *   3. Featured post (top of list, full-width card)
 *   4. Recent posts grid
 *   5. Newsletter signup
 *
 * Filter & search both narrow the list. When filtering, the featured card is
 * hidden and all matching posts go into the grid.
 */

const CATEGORIES = ['All', ...Array.from(new Set(POSTS.map((p) => p.category)))];

export default function BlogIndexPage() {
  const [filter, setFilter] = useState('All');
  const [query,  setQuery]  = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return POSTS
      .filter((p) => filter === 'All' || p.category === filter)
      .filter((p) => !q
        || p.title.toLowerCase().includes(q)
        || p.excerpt.toLowerCase().includes(q)
        || (p.tags || []).some((t) => t.toLowerCase().includes(q)));
  }, [filter, query]);

  const isPristine = filter === 'All' && !query;
  const featured   = isPristine ? POSTS[0] : null;
  const grid       = isPristine ? POSTS.slice(1) : filtered;

  return (
    <MarketingLayout>
      <Meta
        title="Blog"
        description="Product updates, agency playbooks, AI experiments, and design decisions from the team building Social Stats."
      />

      {/* ╭──────────────╮
          │   1.  HERO   │
          ╰──────────────╯ */}
      <section style={{ padding: '128px 32px 32px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0,
            background: 'var(--brand-mesh)',
            opacity: 0.20, filter: 'blur(80px) saturate(140%)',
          }}
        />
        <div style={{ position: 'relative', maxWidth: 720, margin: '0 auto' }}>
          <Badge variant="brand" size="md">Blog</Badge>
          <h1 style={{
            margin: '20px 0 12px',
            fontSize: 'clamp(36px, 4.4vw, 48px)',
            lineHeight: 1.05,
            letterSpacing: '-0.025em',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}>
            The Social Stats journal.
          </h1>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            Product updates, agency playbooks, AI experiments, design decisions — written by the team building Social Stats.
          </p>

          {/* Search */}
          <label style={{
            marginTop: 28,
            display: 'flex', alignItems: 'center', gap: 10,
            maxWidth: 480, marginLeft: 'auto', marginRight: 'auto',
            padding: '10px 14px',
            background: 'var(--surface-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-pill)',
          }}>
            <Search size={15} color="var(--text-tertiary)" />
            <input
              type="search"
              aria-label="Search blog posts"
              placeholder="Search articles, tags, topics…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                flex: 1, minWidth: 0,
                background: 'transparent',
                border: 'none', outline: 'none',
                color: 'var(--text-primary)',
                fontSize: 14,
                fontFamily: 'inherit',
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                style={{
                  background: 'transparent', border: 'none',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer', fontSize: 14, padding: 0,
                }}
              >×</button>
            )}
          </label>
        </div>
      </section>

      {/* ╭──────────────────────╮
          │   2.  FILTER PILLS   │
          ╰──────────────────────╯ */}
      <section style={{ padding: '8px 32px 24px' }}>
        <div style={{
          maxWidth: 'var(--container-xl)', margin: '0 auto',
          display: 'flex', flexWrap: 'wrap', gap: 8,
          justifyContent: 'center',
        }}>
          {CATEGORIES.map((cat) => {
            const active = filter === cat;
            const count = cat === 'All' ? POSTS.length : POSTS.filter((p) => p.category === cat).length;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setFilter(cat)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: active ? '#fff' : 'var(--text-secondary)',
                  background: active ? 'var(--brand-gradient)' : 'var(--surface-card)',
                  border: active ? '1px solid transparent' : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-pill)',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)',
                }}
              >
                {cat}
                <span style={{ opacity: 0.7, fontSize: 11 }}>{count}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ╭──────────────────────╮
          │   3.  FEATURED       │
          ╰──────────────────────╯ */}
      {featured && (
        <section style={{ padding: '16px 32px 48px' }}>
          <div style={{ maxWidth: 'var(--container-xl)', margin: '0 auto' }}>
            <Link
              to={`/blog/${featured.slug}`}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                gap: 32,
                padding: 32,
                background: 'var(--surface-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-2xl)',
                boxShadow: 'var(--shadow-md)',
                textDecoration: 'none',
                transition: 'var(--transition-default)',
                alignItems: 'center',
              }}
              className="blog-featured"
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
            >
              {/* Visual side */}
              <div
                style={{
                  aspectRatio: '4 / 3',
                  borderRadius: 'var(--radius-xl)',
                  background: `linear-gradient(135deg, ${featured.accent}33, transparent 80%), var(--surface-sunken)`,
                  border: '1px solid var(--border-subtle)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 32,
                }}
              >
                <div style={{
                  fontSize: 'clamp(28px, 4vw, 40px)',
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                  textAlign: 'center',
                  color: 'var(--text-primary)',
                  opacity: 0.85,
                }}>
                  {featured.title.split(' ').slice(0, 4).join(' ')}…
                </div>
              </div>

              {/* Copy side */}
              <div>
                <Badge variant="brand" size="sm">
                  <Sparkles size={11} style={{ marginRight: 4, verticalAlign: -1 }} />
                  Featured · {featured.category}
                </Badge>
                <h2 style={{
                  margin: '12px 0 12px',
                  fontSize: 'clamp(24px, 3vw, 32px)',
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  color: 'var(--text-primary)',
                  lineHeight: 1.2,
                }}>
                  {featured.title}
                </h2>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
                  {featured.excerpt}
                </p>
                <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar name={featured.author.name} size="sm" />
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{featured.author.name}</span>
                    {' · '}
                    {new Date(featured.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    {' · '}
                    {featured.readTime}
                  </div>
                </div>
                <div style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-link)', fontWeight: 600, fontSize: 13 }}>
                  Read article <ArrowRight size={13} />
                </div>
              </div>
            </Link>

            <style>{`
              @media (max-width: 880px) {
                .blog-featured { grid-template-columns: 1fr !important; }
              }
            `}</style>
          </div>
        </section>
      )}

      {/* ╭──────────────────────╮
          │   4.  RECENT GRID    │
          ╰──────────────────────╯ */}
      <section style={{ padding: '0 32px 96px' }}>
        <div style={{ maxWidth: 'var(--container-xl)', margin: '0 auto' }}>
          <h2 style={{
            margin: '0 0 20px',
            fontSize: 14, fontWeight: 600,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
          }}>
            {isPristine ? 'Recent posts' : `${filtered.length} ${filtered.length === 1 ? 'post' : 'posts'}`}
            {!isPristine && filter !== 'All' && (
              <> in <span style={{ color: 'var(--text-secondary)' }}>{filter}</span></>
            )}
            {!isPristine && query && (
              <> matching <span style={{ color: 'var(--text-secondary)' }}>"{query}"</span></>
            )}
          </h2>

          {grid.length === 0 ? (
            <div style={{
              padding: 56, textAlign: 'center',
              background: 'var(--surface-card)',
              border: '1px dashed var(--border-default)',
              borderRadius: 'var(--radius-xl)',
              color: 'var(--text-tertiary)',
            }}>
              <p style={{ margin: 0, fontSize: 14 }}>No posts match your filter.</p>
              <button
                type="button"
                onClick={() => { setFilter('All'); setQuery(''); }}
                style={{
                  marginTop: 14,
                  padding: '8px 14px',
                  background: 'var(--surface-page)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: 13, fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 20,
              }}
              className="blog-grid"
            >
              {grid.map((p) => <PostCard key={p.slug} post={p} />)}
            </div>
          )}

          <style>{`
            @media (max-width: 980px) { .blog-grid { grid-template-columns: 1fr 1fr !important; } }
            @media (max-width: 640px) { .blog-grid { grid-template-columns: 1fr !important; } }
          `}</style>
        </div>
      </section>

      {/* ╭──────────────────────╮
          │   5.  NEWSLETTER     │
          ╰──────────────────────╯ */}
      <section style={{ padding: '0 32px 120px' }}>
        <div
          style={{
            maxWidth: 720, margin: '0 auto',
            padding: 36,
            background: 'var(--surface-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-2xl)',
            boxShadow: 'var(--shadow-sm)',
            textAlign: 'center',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em', color: 'var(--text-primary)' }}>
            Get our best playbooks, monthly.
          </h3>
          <p style={{ margin: '8px auto 18px', maxWidth: 480, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            One email a month. Real frameworks. No fluff. Unsubscribe in one click.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              track('newsletter_subscribed', { source: 'blog_index' });
            }}
            style={{ display: 'flex', gap: 8, maxWidth: 420, margin: '0 auto', flexWrap: 'wrap', justifyContent: 'center' }}
          >
            <input
              type="email"
              required
              placeholder="you@company.com"
              aria-label="Email for newsletter"
              style={{
                flex: '1 1 220px',
                minWidth: 0,
                height: 44,
                padding: '0 14px',
                fontSize: 14,
                background: 'var(--surface-page)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                outline: 'none',
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
              }}
            />
            <button
              type="submit"
              style={{
                height: 44, minHeight: 'auto', minWidth: 'auto',
                padding: '0 18px',
                background: 'var(--brand-gradient)',
                color: '#fff',
                fontSize: 14, fontWeight: 600,
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              Subscribe
            </button>
          </form>
        </div>
      </section>
    </MarketingLayout>
  );
}

function PostCard({ post }) {
  return (
    <Link
      to={`/blog/${post.slug}`}
      style={{
        display: 'flex', flexDirection: 'column',
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-xs)',
        overflow: 'hidden',
        textDecoration: 'none',
        transition: 'var(--transition-fast)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.borderColor = 'var(--border-default)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-xs)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
    >
      <div
        aria-hidden
        style={{
          aspectRatio: '16 / 9',
          background: `linear-gradient(135deg, ${post.accent}33, transparent 80%), var(--surface-sunken)`,
          borderBottom: '1px solid var(--border-subtle)',
        }}
      />
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <Badge variant="default" size="sm">{post.category}</Badge>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-primary)', lineHeight: 1.3 }}>
          {post.title}
        </h3>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: 'var(--text-secondary)', flex: 1 }}>
          {post.excerpt}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <Avatar name={post.author.name} size="xs" />
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            {post.author.name} · {new Date(post.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · {post.readTime}
          </span>
        </div>
      </div>
    </Link>
  );
}
