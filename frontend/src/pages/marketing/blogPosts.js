/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import React from 'react';

/**
 * blogPosts.js — content for /blog and /blog/:slug.
 *
 * Each entry is a JS object (not MDX/Markdown) so we don't pull in a parser
 * for six articles. Bodies are JSX fragments — section objects are turned
 * into headed sections + paragraphs by BlogPostPage. Each post has:
 *
 *   slug, title, excerpt, category, tags, author{name, role, initial},
 *   date, readTime, accent, body[]  — ordered list of nodes:
 *     { type: 'lead' | 'p' | 'h2' | 'h3' | 'ul' | 'ol' | 'quote' | 'callout',
 *       text|items|children }
 *
 * BlogIndexPage uses everything but `body`. BlogPostPage renders `body`
 * sequentially and builds a TOC from `h2` nodes.
 */

const POSTS = [
  // ──────────────────────────────────────────────────────────────────────
  {
    slug: 'unified-marketing-os-is-here',
    title: 'The unified marketing OS is here.',
    excerpt: 'Why we rebuilt Social Stats into a single platform — and what it means for your agency workflow.',
    category: 'Product',
    tags: ['Product', 'Strategy', 'Roadmap'],
    author: { name: 'Aarav Mehta', role: 'CEO, Social Stats', initial: 'AM' },
    date: '2026-04-30',
    readTime: '6 min read',
    accent: 'var(--brand-primary)',
    body: [
      { type: 'lead', text: 'We set out to consolidate three years of patchwork tools into one unified platform. Here\'s what we built, what we cut, and what we learned along the way.' },
      { type: 'p', children: <>When we started Social Stats in early 2024, the modern marketing agency stack looked something like this: one tool for analytics, another for scheduling, a third for messaging, a Google Sheet for reporting, a Slack channel for approvals, and a calendar app to glue it all together.</> },
      { type: 'p', children: <>By the end of 2025 we were running 11 tools internally — for our own marketing. The irony was not lost on us. Every Monday someone would forget to copy-paste a number from one dashboard to another, and a metric would silently drift for two weeks before a senior would catch it.</> },
      { type: 'h2', text: 'What changed in this release' },
      { type: 'p', children: <>We rebuilt the visual system from the ground up. New design tokens. First-class dark mode. A 25-component library. New auth pages. New marketing site. New shell. And every existing page restyled to match.</> },
      { type: 'p', children: <>More importantly, we rebuilt the <strong>information architecture</strong>. Every workflow an agency runs every day now lives in a single surface — Composer, Inbox, Analytics, Reports, AI Assistant. Cmd+J pulls up the AI from anywhere. The mental tax of platform-switching is gone.</> },
      { type: 'h2', text: 'What we cut' },
      { type: 'ul', items: [
        <>Three legacy "module" sidebars that felt like product silos.</>,
        <>The "approvals queue" page — folded into Inbox where it belongs.</>,
        <>Six different report builders. Now: one Reports surface, ten templates.</>,
        <>The "settings settings" page. Yes, that was real.</>,
      ] },
      { type: 'callout', children: <><strong>Principle:</strong> if a page only existed because we hadn't decided where its functionality belonged, we deleted the page and decided.</> },
      { type: 'h2', text: 'What\'s next' },
      { type: 'p', children: <>The next thing on the roadmap is the new Composer experience: a single-pane editor that adapts to every platform without losing platform-native nuance. Sneak peek coming next month.</> },
      { type: 'p', children: <>As always, we'd love to hear what you think — reply to this email, or hit our <a href="/contact">contact page</a>. Thanks for building with us.</> },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────
  {
    slug: 'how-we-train-brand-voice',
    title: 'How we train brand voice without leaking your data.',
    excerpt: 'A peek under the hood at our zero-retention AI pipeline and the engineering behind brand-voice profiles.',
    category: 'AI',
    tags: ['AI', 'Engineering', 'Privacy'],
    author: { name: 'Saanvi Rao', role: 'Staff Engineer, AI', initial: 'SR' },
    date: '2026-04-12',
    readTime: '8 min read',
    accent: '#8b5cf6',
    body: [
      { type: 'lead', text: 'Brand-voice training has a privacy problem nobody likes to talk about: the better the training, the more of your private content the model sees. Here\'s how we cut that knot.' },
      { type: 'p', children: <>When customers asked us for "AI that writes like our brand," we had two options. Option A: send all their past content to a generic LLM as in-context examples on every request. Option B: fine-tune a per-customer model.</> },
      { type: 'p', children: <>Both have problems. Option A bloats every request with copies of private content. Option B requires a training pipeline, opens questions about model retention, and gets expensive fast.</> },
      { type: 'h2', text: 'Our approach: distilled style profiles' },
      { type: 'p', children: <>We compute a <strong>brand-voice profile</strong> from your last ~50 best-performing posts. It's a structured object — vocabulary preferences, sentence shape distributions, taboo phrases, positivity calibration, formatting rules — that we store in your tenant.</> },
      { type: 'p', children: <>At inference time we send Social Stats the profile, plus the prompt, plus a tiny set of 3 anchor examples chosen for similarity to the prompt. Total context: under 3 KB. The model writes in your voice without ever seeing your full archive.</> },
      { type: 'h2', text: 'Why this approach works' },
      { type: 'ul', items: [
        <>Our underlying AI provider's Enterprise terms guarantee no model training on your prompts (vendor disclosure in the <a href="/privacy">Privacy Policy</a>).</>,
        <>Modern frontier models are uncannily good at style replication from a few anchor examples.</>,
        <>The 200K token context window is plenty — we never come close to using it.</>,
      ] },
      { type: 'h2', text: 'Profiles never blend' },
      { type: 'p', children: <>This is the part that took the most engineering. Each tenant's profile is keyed by tenant ID. The inference path validates that the profile, prompt context, and target user all share that tenant ID before any request leaves our network. Two failures up the chain — and your content stays in your workspace, full stop.</> },
      { type: 'callout', children: <>If you want to read the actual code that enforces this, ping us — we're happy to walk through it on a security review call.</> },
      { type: 'h2', text: 'Result' },
      { type: 'p', children: <>Customers now get Composer drafts that read like they wrote them, with no part of their content training anyone else's model. The pipeline costs us about 1/40th of fine-tuning per request and is one infrastructure tier simpler.</> },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────
  {
    slug: 'whatsapp-engagement-2026',
    title: 'The 2026 WhatsApp engagement playbook for agencies.',
    excerpt: 'Templates, opt-in flows, and the automation patterns we see top-performing agencies using.',
    category: 'Playbook',
    tags: ['WhatsApp', 'Agencies', 'Playbook'],
    author: { name: 'Rahul Mehta', role: 'Head of Customer Success', initial: 'RM' },
    date: '2026-03-22',
    readTime: '12 min read',
    accent: '#22c55e',
    body: [
      { type: 'lead', text: 'WhatsApp is no longer optional in India. Here\'s the playbook your agency clients should be running in 2026 — drawn from the top decile of accounts on Social Stats.' },
      { type: 'h2', text: '1. Stop using WhatsApp like SMS' },
      { type: 'p', children: <>The biggest pattern we see: brands send a single "broadcast" template to a list of 10K numbers and call it a campaign. Open rates: 80%+. Click rates: under 2%. Why? Because the message has nowhere to go.</> },
      { type: 'p', children: <>WhatsApp's superpower is <strong>two-way conversation</strong>. Every campaign should end in a question with a quick-reply button. Every reply should route to a human agent within 60 seconds, even if it's an out-of-hours acknowledgment.</> },
      { type: 'h2', text: '2. The opt-in flow that actually converts' },
      { type: 'ol', items: [
        <>Place a CTA on your website: "Get our weekly drop on WhatsApp."</>,
        <>Use a click-to-WhatsApp link with a pre-filled "I want in" message.</>,
        <>The first reply is a <strong>welcome flow</strong> with a quick-reply: "What are you most interested in? [Properties / Investment tips / News]".</>,
        <>That answer routes the person into a tagged segment.</>,
        <>Send your weekly drop only to that segment.</>,
      ] },
      { type: 'p', children: <>Agencies running this flow on Social Stats see 30%+ click rates on weekly drops. The ones still doing list-broadcasts see 2%.</> },
      { type: 'h2', text: '3. The four templates worth approving' },
      { type: 'ul', items: [
        <><strong>Welcome</strong> — sent on opt-in, with quick replies.</>,
        <><strong>Reminder</strong> — for appointments, events, deadlines.</>,
        <><strong>Update</strong> — order status, delivery, tracking.</>,
        <><strong>Promo</strong> — segmented offers (only to people who opted in for offers).</>,
      ] },
      { type: 'callout', children: <>Skip "thank you for your purchase," "have a nice day," and other ceremonial templates. They cost money per message and don't move metrics.</> },
      { type: 'h2', text: '4. Automate the boring stuff' },
      { type: 'p', children: <>Inside Social Stats, set up automations for: out-of-hours acknowledgements, FAQ deflection (50% of inbound DMs are "what are your prices?" — answer with a smart flow), and second-touch follow-ups for unresponded leads after 24 hours.</> },
      { type: 'p', children: <>The agencies in our top decile route 60% of inbound traffic through automation, and 40% to a human. The bottom decile routes 100% to a human, and humans burn out at scale.</> },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────
  {
    slug: 'designing-a-design-system',
    title: 'Designing a design system in public.',
    excerpt: 'Notes on the visual refresh — tokens, dark mode, and the components we kept rebuilding until they felt right.',
    category: 'Design',
    tags: ['Design', 'Engineering'],
    author: { name: 'Tara Iyer', role: 'Design Lead', initial: 'TI' },
    date: '2026-03-04',
    readTime: '5 min read',
    accent: '#ec4899',
    body: [
      { type: 'lead', text: 'We rebuilt the Social Stats design system in three months — in public, with customers using it the whole time. Here\'s what worked and what almost killed us.' },
      { type: 'h2', text: 'Tokens first, components second' },
      { type: 'p', children: <>The first thing we did was rip out hex codes from every component file and route them through CSS variables. Boring, slow, mechanical. Worth it: dark mode took two weeks instead of two months.</> },
      { type: 'h2', text: 'The button we rebuilt seven times' },
      { type: 'p', children: <>The Button component went through seven iterations. Variants, sizes, icon-only, link-as-button, loading state, disabled state. Each iteration added something we needed in production. By v7 we had a single component that replaced 14 distinct &quot;button&quot; styles across the app.</> },
      { type: 'callout', children: <>If a primitive feels finished after one iteration, it probably isn't doing enough work yet.</> },
      { type: 'h2', text: 'What we learned' },
      { type: 'ul', items: [
        <>Build dark mode and light mode <em>simultaneously</em>, not sequentially.</>,
        <>Tokens beat utility classes when you have a small team — fewer choices.</>,
        <>Document with screenshots, not prose. Designers and engineers both skim.</>,
      ] },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────
  {
    slug: 'agency-roi-blueprint',
    title: 'The agency ROI blueprint: showing your value in 5 charts.',
    excerpt: 'A repeatable reporting structure that turns one-off campaigns into multi-year retainers.',
    category: 'Playbook',
    tags: ['Agencies', 'Reporting', 'Strategy'],
    author: { name: 'Priya Nair', role: 'Customer Strategy', initial: 'PN' },
    date: '2026-02-18',
    readTime: '10 min read',
    accent: '#f59e0b',
    body: [
      { type: 'lead', text: 'Agencies that retain clients for 3+ years all do one thing the others don\'t: they make the value of their work undeniable. Here\'s the 5-chart structure we see in the best monthly client reports.' },
      { type: 'h2', text: 'Chart 1: The "what changed" line chart' },
      { type: 'p', children: <>Top-line follower or impression chart, but with a vertical line at the date you started working with the client. Visual proof that the up-and-to-the-right began with you.</> },
      { type: 'h2', text: 'Chart 2: Money in vs. money out' },
      { type: 'p', children: <>Revenue attributable to social vs. agency fee. Even rough attribution beats none. If revenue grew 3x, your fee should look small in comparison.</> },
      { type: 'h2', text: 'Chart 3: The audience composition shift' },
      { type: 'p', children: <>"Three months ago, your audience was 70% existing customers. Today, 55% — meaning you're adding net new reach, not just preaching to the choir."</> },
      { type: 'h2', text: 'Chart 4: Top 5 wins' },
      { type: 'p', children: <>Specific posts/campaigns/conversations with screenshots, links, and the metric that made them notable. This is what the client forwards to their CEO.</> },
      { type: 'h2', text: 'Chart 5: What\'s next' },
      { type: 'p', children: <>One slide. Three bets for next month. This is the slide that justifies your retainer renewal.</> },
      { type: 'callout', children: <>The Reports module on Social Stats templates these five charts out of the box. Customise once, schedule monthly, white-label, done.</> },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────
  {
    slug: 'composer-design-decisions',
    title: 'Why our Composer is a single-pane editor (not tabs).',
    excerpt: 'How we landed on a unified compose flow that maps to every platform without losing platform-native nuance.',
    category: 'Engineering',
    tags: ['Engineering', 'Design', 'Product'],
    author: { name: 'Ishaan Verma', role: 'Engineering Lead, Composer', initial: 'IV' },
    date: '2026-01-29',
    readTime: '7 min read',
    accent: '#10b981',
    body: [
      { type: 'lead', text: 'Every social media tool eventually faces the same fork: tabbed compose (one tab per platform) or unified compose (one input, smart adaptation). We picked unified. Here\'s why.' },
      { type: 'h2', text: 'The case for tabs' },
      { type: 'p', children: <>Tabs are honest. Each platform has its own character limit, its own tone, its own hashtag conventions. Tabs let users tune each variant independently.</> },
      { type: 'p', children: <>The problem: tabs encourage <strong>copy-paste-and-tweak</strong> behaviour. Users write the LinkedIn version, copy it to the Facebook tab, tighten it, copy it to Instagram, add hashtags. Twenty seconds per platform. The platforms drift over time.</> },
      { type: 'h2', text: 'The unified bet' },
      { type: 'p', children: <>One editor. Type your idea. The Composer auto-renders previews for each enabled platform — Facebook trimmed to a hook + paragraph, LinkedIn formatted with line breaks, Instagram with hashtags pulled from your library. You can override any preview, but you don't have to.</> },
      { type: 'p', children: <>The trade-off: the AI that does the per-platform rendering has to be good. We spent four months on it.</> },
      { type: 'h2', text: 'What worked' },
      { type: 'ul', items: [
        <>Per-platform render rules expressed as JSON (length, hashtag count, link handling).</>,
        <>A small Social Stats call per platform that adapts the prose without changing voice.</>,
        <>"Smart resize" for media — pre-cropped variants for square, portrait, landscape.</>,
      ] },
      { type: 'callout', children: <>Result: time-to-publish dropped 3.5x in our internal A/B. Composer became our most-used surface.</> },
    ],
  },
];

export default POSTS;

export function getPost(slug) {
  return POSTS.find((p) => p.slug === slug) || null;
}

export function getRelated(slug, n = 3) {
  const post = getPost(slug);
  if (!post) return POSTS.slice(0, n);
  // Prefer same-category, then same-tag, then most recent.
  const sameCat = POSTS.filter((p) => p.slug !== slug && p.category === post.category);
  const tags = new Set(post.tags || []);
  const sameTag = POSTS.filter((p) =>
    p.slug !== slug && p.category !== post.category && (p.tags || []).some((t) => tags.has(t))
  );
  const others = POSTS.filter((p) =>
    p.slug !== slug && !sameCat.includes(p) && !sameTag.includes(p)
  );
  return [...sameCat, ...sameTag, ...others].slice(0, n);
}
