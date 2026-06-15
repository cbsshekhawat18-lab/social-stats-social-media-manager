/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Linkedin, Facebook, Link as LinkIcon, Quote } from 'lucide-react';

import MarketingLayout from '../components/marketing/MarketingLayout';
import Button from '../components/ui/Button';
import Avatar from '../components/ui/Avatar';
import Badge from '../components/ui/Badge';
import Meta from '../components/Meta';
import JsonLd, { buildArticle, buildBreadcrumbs, SITE_URL } from '../components/JsonLd';
import toast from '../components/ui/toast';

import POSTS, { getPost, getRelated } from './marketing/blogPosts';

/**
 * BlogPostPage — /blog/:slug
 *
 * Looks up the post in blogPosts.js and renders the body. Layout:
 *   - 720px article column with sticky TOC on desktop (built from h2 nodes)
 *   - Hero accent + author block
 *   - Body rendered from typed nodes (lead/p/h2/h3/ul/ol/quote/callout)
 *   - Share row (LinkedIn / Facebook / copy link)
 *   - Related posts (same category > same tag > recent)
 *   - Bottom CTA
 *
 * Unknown slugs render a friendly 404-ish state with a back-to-blog CTA.
 */
export default function BlogPostPage() {
  const { slug } = useParams();
  const post = getPost(slug);

  // Slugify h2s for TOC anchors.
  const sections = useMemo(
    () => (post?.body || [])
      .filter((n) => n.type === 'h2')
      .map((n) => ({ id: slugify(n.text), title: n.text })),
    [post]
  );

  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    if (sections.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); });
      },
      { rootMargin: '-30% 0px -55% 0px', threshold: 0 }
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [sections]);

  if (!post) return <NotFoundState slug={slug} />;

  const related = getRelated(slug, 3);

  function copyLink() {
    try {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard');
    } catch {
      toast.error('Could not copy link');
    }
  }

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <MarketingLayout>
      <Meta
        title={post.title}
        description={post.excerpt}
        type="article"
      />
      <JsonLd
        id="article"
        data={buildArticle({
          title: post.title,
          description: post.excerpt,
          slug: post.slug,
          datePublished: post.date,
          authorName: post.author.name,
        })}
      />
      <JsonLd
        id="breadcrumbs"
        data={buildBreadcrumbs([
          { name: 'Home',  url: `${SITE_URL}/` },
          { name: 'Blog',  url: `${SITE_URL}/blog` },
          { name: post.title, url: `${SITE_URL}/blog/${post.slug}` },
        ])}
      />

      <article style={{ padding: '128px 32px 72px' }}>
        <div
          style={{
            maxWidth: 1080, margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 220px',
            gap: 56,
            alignItems: 'flex-start',
          }}
          className="blog-grid"
        >
          {/* Article column */}
          <div style={{ minWidth: 0, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
            <Link
              to="/blog"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 13, fontWeight: 500,
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                marginBottom: 24,
              }}
            >
              <ArrowLeft size={13} /> Back to blog
            </Link>

            <Badge variant="brand" size="sm">{post.category}</Badge>
            <h1 style={{
              margin: '14px 0 12px',
              fontSize: 'clamp(32px, 4vw, 44px)',
              fontWeight: 600,
              letterSpacing: '-0.025em',
              lineHeight: 1.15,
              color: 'var(--text-primary)',
            }}>
              {post.title}
            </h1>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <Avatar name={post.author.name} size="md" />
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {post.author.name} · {post.author.role}
                </div>
                <div style={{ color: 'var(--text-tertiary)' }}>
                  {new Date(post.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                  {' · '}{post.readTime}
                </div>
              </div>
            </div>

            {/* Hero image placeholder, accent-tinted */}
            <div
              aria-hidden
              style={{
                aspectRatio: '16 / 9',
                borderRadius: 'var(--radius-xl)',
                background: `linear-gradient(135deg, ${post.accent}33, transparent 60%), var(--surface-sunken)`,
                border: '1px solid var(--border-subtle)',
                marginBottom: 32,
              }}
            />

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 28 }}>
                {post.tags.map((t) => (
                  <span key={t} style={{
                    padding: '3px 10px',
                    fontSize: 11, fontWeight: 600,
                    color: 'var(--text-secondary)',
                    background: 'var(--surface-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-pill)',
                  }}>
                    #{t}
                  </span>
                ))}
              </div>
            )}

            {/* Body */}
            <div className="blog-body" style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--text-secondary)' }}>
              {post.body.map((node, i) => <BodyNode key={i} node={node} accent={post.accent} />)}
            </div>

            {/* Share row */}
            <div
              style={{
                marginTop: 40,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                background: 'var(--surface-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Share this post</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <ShareBtn icon={Linkedin} href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`} label="Share on LinkedIn" />
                <ShareBtn icon={Facebook} href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`} label="Share on Facebook" />
                <ShareBtn icon={LinkIcon} onClick={copyLink} label="Copy link" />
              </div>
            </div>

            {/* Author bio */}
            <div style={{
              marginTop: 32,
              padding: 20,
              display: 'flex', gap: 16, alignItems: 'flex-start',
              background: 'var(--surface-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
            }}>
              <Avatar name={post.author.name} size="lg" />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {post.author.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                  {post.author.role}
                </div>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                  Writes about {post.tags?.slice(0, 2).join(' and ').toLowerCase() || post.category.toLowerCase()} on the SocialStats journal.
                </p>
              </div>
            </div>
          </div>

          {/* Sticky TOC (desktop) */}
          {sections.length > 0 && (
            <aside
              className="blog-toc"
              style={{
                position: 'sticky', top: 96,
                padding: 14,
                background: 'var(--surface-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              <div style={{
                fontSize: 11, fontWeight: 600,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                color: 'var(--text-tertiary)',
                padding: '4px 8px 10px',
              }}>
                On this page
              </div>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {sections.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    style={{
                      padding: '6px 10px',
                      fontSize: 12,
                      fontWeight: active === s.id ? 600 : 500,
                      color: active === s.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                      background: active === s.id ? 'var(--brand-primary-soft)' : 'transparent',
                      boxShadow: active === s.id ? 'inset 2px 0 0 var(--brand-primary)' : 'none',
                      borderRadius: 'var(--radius-sm)',
                      textDecoration: 'none',
                      lineHeight: 1.4,
                      transition: 'var(--transition-fast)',
                    }}
                  >
                    {s.title}
                  </a>
                ))}
              </nav>
            </aside>
          )}
        </div>
      </article>

      {/* Related posts */}
      {related.length > 0 && (
        <section style={{ padding: '0 32px 96px' }}>
          <div style={{ maxWidth: 'var(--container-xl)', margin: '0 auto' }}>
            <h2 style={{
              margin: '0 0 20px',
              fontSize: 14, fontWeight: 600,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
            }}>
              Keep reading
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 20,
              }}
              className="related-grid"
            >
              {related.map((p) => <RelatedCard key={p.slug} post={p} />)}
            </div>
            <style>{`
              @media (max-width: 980px) { .related-grid { grid-template-columns: 1fr 1fr !important; } }
              @media (max-width: 640px) { .related-grid { grid-template-columns: 1fr !important; } }
            `}</style>
          </div>
        </section>
      )}

      {/* Bottom CTA */}
      <section style={{ padding: '0 32px 96px' }}>
        <div style={{
          maxWidth: 720, margin: '0 auto',
          padding: 32,
          background: 'var(--surface-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-2xl)',
          textAlign: 'center',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <h3 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em', color: 'var(--text-primary)' }}>
            Build your unified marketing OS today.
          </h3>
          <p style={{ margin: '8px auto 18px', maxWidth: 480, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Free plan, no card. Most teams connect 4–6 platforms before they finish their morning coffee.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Button as={Link} to="/signup" size="md" iconRight={ArrowRight}>Try Social Stats free</Button>
            <Button as={Link} to="/blog" variant="ghost" size="md" icon={ArrowLeft}>All posts</Button>
          </div>
        </div>
      </section>

      <style>{`
        .blog-body h2 { font-size: 22px; font-weight: 600; letter-spacing: -0.015em; color: var(--text-primary); margin: 32px 0 12px; scroll-margin-top: 96px; }
        .blog-body h3 { font-size: 17px; font-weight: 600; color: var(--text-primary); margin: 24px 0 8px; scroll-margin-top: 96px; }
        .blog-body p  { margin: 0 0 18px; }
        .blog-body ul, .blog-body ol { margin: 0 0 18px; padding-left: 22px; }
        .blog-body li { margin-bottom: 8px; }
        .blog-body strong { color: var(--text-primary); font-weight: 600; }
        .blog-body em { font-style: italic; color: var(--text-primary); }
        .blog-body a  { color: var(--text-link); text-decoration: none; font-weight: 500; }
        .blog-body a:hover { text-decoration: underline; }

        @media (max-width: 980px) {
          .blog-grid { grid-template-columns: 1fr !important; }
          .blog-toc  { display: none !important; }
        }
      `}</style>
    </MarketingLayout>
  );
}

// ── nodes ─────────────────────────────────────────────────────────────
function BodyNode({ node, accent }) {
  switch (node.type) {
    case 'lead':
      return (
        <p style={{
          fontSize: 18, lineHeight: 1.65,
          color: 'var(--text-primary)',
          margin: '0 0 24px',
          fontWeight: 500,
        }}>
          {node.text || node.children}
        </p>
      );
    case 'p':
      return <p>{node.children || node.text}</p>;
    case 'h2': {
      const id = slugify(node.text);
      return <h2 id={id}>{node.text}</h2>;
    }
    case 'h3':
      return <h3>{node.text}</h3>;
    case 'ul':
      return <ul>{node.items.map((c, i) => <li key={i}>{c}</li>)}</ul>;
    case 'ol':
      return <ol>{node.items.map((c, i) => <li key={i}>{c}</li>)}</ol>;
    case 'quote':
      return (
        <blockquote style={{
          margin: '24px 0',
          padding: '16px 20px',
          borderLeft: `3px solid ${accent}`,
          background: 'var(--surface-card)',
          borderRadius: 'var(--radius-md)',
          fontSize: 17, fontStyle: 'italic',
          color: 'var(--text-primary)',
        }}>
          <Quote size={18} style={{ opacity: 0.4, marginBottom: 6 }} />
          <div>{node.children || node.text}</div>
          {node.cite && (
            <footer style={{
              marginTop: 8, fontSize: 13, fontStyle: 'normal',
              color: 'var(--text-tertiary)',
            }}>
              — {node.cite}
            </footer>
          )}
        </blockquote>
      );
    case 'callout':
      return (
        <aside style={{
          margin: '24px 0',
          padding: '16px 20px',
          background: `linear-gradient(135deg, ${accent}14, transparent)`,
          border: `1px solid ${accent}40`,
          borderRadius: 'var(--radius-md)',
          fontSize: 15,
          color: 'var(--text-primary)',
          lineHeight: 1.6,
        }}>
          {node.children || node.text}
        </aside>
      );
    default:
      return null;
  }
}

// ── helpers ───────────────────────────────────────────────────────────
function slugify(s = '') {
  return s.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function ShareBtn({ icon: Icon, href, onClick, label }) {
  const Wrap = href ? 'a' : 'button';
  return (
    <Wrap
      href={href}
      target={href ? '_blank' : undefined}
      rel={href ? 'noopener noreferrer' : undefined}
      onClick={onClick}
      aria-label={label}
      type={href ? undefined : 'button'}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 32, height: 32, minHeight: 'auto', minWidth: 'auto',
        background: 'var(--surface-page)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        textDecoration: 'none',
        transition: 'var(--transition-fast)',
        padding: 0,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--brand-primary-hover)'; e.currentTarget.style.borderColor = 'var(--brand-primary-glow)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
    >
      <Icon size={14} strokeWidth={2} />
    </Wrap>
  );
}

function RelatedCard({ post }) {
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
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-xs)'; }}
    >
      <div
        aria-hidden
        style={{
          aspectRatio: '16 / 9',
          background: `linear-gradient(135deg, ${post.accent}33, transparent 80%), var(--surface-sunken)`,
          borderBottom: '1px solid var(--border-subtle)',
        }}
      />
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <Badge variant="default" size="sm">{post.category}</Badge>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
          {post.title}
        </h3>
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: 'var(--text-secondary)', flex: 1 }}>
          {post.excerpt}
        </p>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
          {post.readTime}
        </span>
      </div>
    </Link>
  );
}

function NotFoundState({ slug }) {
  return (
    <MarketingLayout>
      <Meta title="Post not found" />
      <section style={{
        padding: '160px 32px 96px',
        textAlign: 'center',
        minHeight: '60vh',
      }}>
        <div style={{ maxWidth: 540, margin: '0 auto' }}>
          <Badge variant="default" size="sm">404</Badge>
          <h1 style={{
            margin: '20px 0 12px',
            fontSize: 'clamp(28px, 4vw, 36px)',
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
          }}>
            We couldn't find that post.
          </h1>
          <p style={{ margin: '0 0 24px', fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            The slug <code style={{
              padding: '2px 8px', background: 'var(--surface-card)',
              border: '1px solid var(--border-subtle)', borderRadius: 4,
              fontSize: 13,
            }}>{slug}</code> doesn't match any post in our journal.
          </p>
          <Button as={Link} to="/blog" size="md" icon={ArrowLeft}>Back to all posts</Button>
        </div>
      </section>
    </MarketingLayout>
  );
}

// Avoid the unused-import lint warning for POSTS — re-export shape
// helpers consumed elsewhere may use it directly.
export { POSTS };
