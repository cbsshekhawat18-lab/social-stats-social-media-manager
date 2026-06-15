/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * solutionPages — content for the 7 /solutions/* pages.
 *
 * Each entry maps to a slug. The `SolutionPage` template renders these.
 *
 * Schema:
 *   eyebrow, heroTitle, heroSubtitle, heroDemo
 *   heroPriceLine     small line under hero subtitle (e.g. "Starts at ₹999/mo")
 *   ctaPrimary        button label override
 *   painPoints        { title, subtitle, items: [{title, description}] }
 *   stripes[]         { eyebrow, title, description, bullets, demo }
 *   templates         { title, subtitle, items: [{title, description, icon, gradient}] }
 *   quote             { quote, author, role, gradient }
 *   ctaTitle, ctaSubtitle
 */
import {
  Building2, Stethoscope, UtensilsCrossed, Palette, ShoppingBag,
  Briefcase, Users, Target,
  Calendar, MessageCircle, Bot, FileText,
  Heart, Star, ChefHat, ClipboardList, Megaphone,
  TrendingUp, ShoppingCart, Package,
} from 'lucide-react';

import {
  ComposerPreview, InboxPreview, BotBuilderPreview, AIInsightPreview,
  AutomationsPreview, AnalyticsPreview, ReportsPreview,
} from '../../components/marketing/BentoPreviews';


export const solutionPages = {

  // ── 1. AGENCIES ──────────────────────────────────────────────────────────
  'agencies': {
    title: 'For agencies',
    description: 'Manage 100+ clients without hiring. Multi-client workspaces, team roles, white-label reports, AI per client, marketplace exposure.',
    eyebrow: 'For agencies',
    heroTitle: 'Manage 100+ clients from one place',
    heroSubtitle: 'Multi-client workspaces, role-based teams, white-label reports, AI tuned per client, and a marketplace that brings new clients to you.',
    heroDemo: AnalyticsPreview,
    ctaPrimary: 'Try free for 14 days',
    painPoints: {
      title: 'You\'re tired of …',
      items: [
        { title: 'Client switching chaos',  description: 'Five logins, five dashboards, five places to lose context.' },
        { title: 'Reporting nightmares',     description: 'Sundays spent assembling PDFs your clients don\'t even read.' },
        { title: 'Team coordination',        description: 'Two people replied to the same DM. Awkward.' },
        { title: 'Scaling without hiring',   description: 'Every new client = another 10 hours/week. The math breaks.' },
      ],
    },
    stripes: [
      { eyebrow: 'Multi-client workspace',
        title: 'One login, every client',
        description: 'Switch between client workspaces with a single click. Your team\'s context is automatic.',
        bullets: [
          'Up to 100 client workspaces per agency',
          'Per-client connections, content, inbox, leads',
          'One-click client switcher',
          'Per-workspace branding for client portals',
        ],
        demo: AnalyticsPreview },
      { eyebrow: 'Team + permissions',
        title: 'Roles your way',
        description: 'Senior strategists, junior content writers, freelance designers — give each the access they need, nothing more.',
        bullets: [
          'Role-based permissions (12 categories)',
          'Per-client team assignment',
          'Approval workflows for sensitive actions',
          'Activity audit trail (every action logged + reversible)',
        ],
        demo: AutomationsPreview },
      { eyebrow: 'White-label + marketplace',
        title: 'Look bigger than you are',
        description: 'White-label client portals + branded reports. Plus a public marketplace profile that ranks in Google.',
        bullets: [
          'Custom logo + colors per client portal',
          'Branded PDF reports your clients screenshot',
          'Public profile page on /agencies/your-slug',
          'Inbound leads through the marketplace',
        ],
        demo: ReportsPreview },
    ],
    quote: {
      quote: 'We onboarded 23 new clients in 3 months without hiring. Most came via the marketplace.',
      author: 'Rohit Mehta', role: 'CEO, BlueWave Agency',
      gradient: 'linear-gradient(135deg, #00CCF5, #34d399)',
    },
    ctaTitle: 'Triple your client roster.',
    ctaSubtitle: 'Without tripling your headcount.',
  },


  // ── 2. BUSINESSES ────────────────────────────────────────────────────────
  'businesses': {
    title: 'For businesses',
    description: 'Take control of your social media. Free forever for end users — invite an agency to help anytime.',
    eyebrow: 'For businesses',
    heroTitle: 'Take control of your social media',
    heroSubtitle: 'You don\'t need a 10-person agency to run great social. You need ONE tool that does the work — and an agency option for when you want help.',
    heroDemo: ComposerPreview,
    ctaPrimary: 'Sign up free',
    heroPriceLine: 'Free forever — no credit card required.',
    painPoints: {
      title: 'You\'re tired of …',
      items: [
        { title: 'Five different SaaS subscriptions',  description: 'Each ₹2K/mo. None of them talk to each other.' },
        { title: 'No time to post consistently',         description: 'You meant to post Monday. It\'s Friday.' },
        { title: 'Can\'t prove ROI',                    description: 'Your gut says it\'s working. The numbers stay in 5 different tools.' },
        { title: 'Agency quotes that scare you',        description: '₹40K/mo for "social media management" without specifics.' },
      ],
    },
    stripes: [
      { eyebrow: 'Free forever',
        title: 'Everything you need on day one',
        description: 'One workspace, three platforms, 30 posts a month, basic AI. Free. Not a 14-day trial — actually free forever.',
        bullets: [
          '1 connected workspace',
          'Up to 3 platforms (FB / IG / GMB)',
          '30 AI generations per month',
          'Cross-platform analytics + inbox',
        ],
        demo: ComposerPreview },
      { eyebrow: 'Bring your agency',
        title: 'Already work with an agency? They join free',
        description: 'Your agency creates their own login, you grant them granular permissions, you keep ownership of every account. They charge YOU; we charge THEM.',
        bullets: [
          'Invite your agency in 2 minutes',
          '12 permission categories — agency only sees what you grant',
          'Approval workflow for sensitive actions',
          'Pause / resume / terminate the relationship anytime',
        ],
        demo: AutomationsPreview },
      { eyebrow: 'AI does the heavy lifting',
        title: 'Quality posts in 5 minutes a day',
        description: 'Cmd+K writes the draft, you tweak it, schedule it, done. AI replies to every comment with a tone-matched suggestion.',
        bullets: [
          'AI draft + 3 caption variants per post',
          'Best-time-to-post predictions per platform',
          'Inbox replies in 3-click suggestions',
          'AI weekly insights summary on Mondays',
        ],
        demo: AIInsightPreview },
    ],
    quote: {
      quote: 'I run my whole café\'s social in 30 minutes a week. Best ₹0 I\'ve ever spent.',
      author: 'Priya Menon', role: 'Owner, The Garden Café',
      gradient: 'linear-gradient(135deg, #00CCF5, #f472b6)',
    },
    ctaTitle: 'Own your social.',
    ctaSubtitle: 'Free forever for one workspace. Add an agency only when you want one.',
  },


  // ── 3. REAL ESTATE ───────────────────────────────────────────────────────
  'real-estate': {
    title: 'For real estate',
    description: 'Sell more properties on social. Listing carousels, site-visit reminders, CTWA lead capture, AI property descriptions, open-house automation.',
    eyebrow: 'Real estate',
    heroTitle: 'Sell more properties on social media',
    heroSubtitle: 'Built for the way Indian real estate actually moves — Click-to-WhatsApp ads → instant lead capture → site-visit reminders → closed deals.',
    heroDemo: BotBuilderPreview,
    heroPriceLine: 'Starts at ₹999/mo. Industry templates included.',
    painPoints: {
      title: 'You\'re tired of …',
      items: [
        { title: 'Leaky lead capture',     description: 'CTWA ad runs. People click. WhatsApp explodes. Half don\'t get a reply.' },
        { title: 'Manual site-visit reminders', description: 'Saturday booked at 3pm. You forget Friday. They no-show.' },
        { title: 'Generic property captions', description: '"Beautiful 3BHK". Every listing. No brand voice.' },
      ],
    },
    stripes: [
      { eyebrow: 'CTWA → CRM',
        title: 'Capture every lead, automatically',
        description: 'CTWA ad clicks land in a Social Stats bot flow. The bot qualifies (budget, area, when), captures contact, pushes to your CRM with full attribution.',
        bullets: [
          'Pre-built lead-capture flow (clone in 2 clicks)',
          'AI takeover for off-script questions',
          'Lead → CRM with source ad + campaign attribution',
          'Conversions API push so Meta optimises on real conversions',
        ],
        demo: BotBuilderPreview },
      { eyebrow: 'Site-visit ops',
        title: 'Site-visit reminders + post-visit follow-ups',
        description: 'Confirm bookings via WhatsApp. Auto-remind 24h + 1h before. Auto-follow-up the morning after.',
        bullets: [
          '24h + 1h reminder templates pre-built',
          'No-show detection + nudge flow',
          'Post-visit "what did you think?" template',
          'Hot/warm/cold tagging based on responses',
        ],
        demo: AutomationsPreview },
      { eyebrow: 'Listing posts',
        title: 'AI-written property descriptions',
        description: 'Paste the listing. Social Stats writes the post in your brand voice — for IG carousel, FB, LinkedIn — auto-formatted per platform.',
        bullets: [
          'Property listing carousels (10 slides ready)',
          'AI property descriptions (highlights + amenities)',
          'IG-specific hashtag research',
          'Schedule the same post to all 5 platforms',
        ],
        demo: ComposerPreview },
    ],
    templates: {
      title: 'Real-estate templates ready to clone',
      items: [
        { title: 'Lead capture (rent)',   description: 'Budget + area + move-in date qualifier.', icon: Building2,
          gradient: 'linear-gradient(135deg, #00CCF5, #8b5cf6)' },
        { title: 'Lead capture (buy)',    description: '3BHK / 4BHK + budget tier + financing.',   icon: Building2,
          gradient: 'linear-gradient(135deg, #34d399, #00CCF5)' },
        { title: 'Site-visit confirm',    description: 'Date + time + Google Maps + reminder set.', icon: Calendar,
          gradient: 'linear-gradient(135deg, #f472b6, #a78bfa)' },
      ],
    },
    quote: {
      quote: 'Built our first lead-capture flow in 12 minutes. Captured 47 qualified leads the same week.',
      author: 'Priya Sharma', role: 'Marketing Director, Acme Realty',
      gradient: 'linear-gradient(135deg, #f472b6, #a78bfa)',
    },
    ctaTitle: 'Stop losing leads to slow replies.',
  },


  // ── 4. CLINICS / HEALTHCARE ──────────────────────────────────────────────
  'clinics': {
    title: 'For clinics + hospitals',
    description: 'Engage patients across every platform. Appointment reminders, lab-report delivery, awareness campaigns, HIPAA-aligned content checker.',
    eyebrow: 'Healthcare',
    heroTitle: 'Engage patients across every platform',
    heroSubtitle: 'Run patient communication, content, and reviews from one place. Privacy-respectful. WhatsApp Business for the clinical-grade reminder flows.',
    heroDemo: InboxPreview,
    heroPriceLine: 'Starts at ₹2,499/mo. Healthcare DPA available.',
    painPoints: {
      title: 'You\'re tired of …',
      items: [
        { title: 'Phone tag for appointments', description: 'Reception calls 30 patients a day to confirm. Half are voicemail.' },
        { title: 'Lab report dispatch',          description: 'PDFs emailed individually. No audit trail. Compliance nightmare.' },
        { title: 'Negative review panic',        description: 'One bad review on Google. Three days of meetings.' },
        { title: 'Empty content calendar',       description: 'Doctor wants to post awareness content. Nobody knows what to write.' },
      ],
    },
    stripes: [
      { eyebrow: 'Patient ops',
        title: 'Appointment reminders + lab reports',
        description: 'WhatsApp Business templates for confirms, reminders, lab-report delivery — with audit trail your compliance team will love.',
        bullets: [
          'Appointment-confirm + 24h-reminder templates',
          'Lab-report delivery with read-receipt + audit log',
          'Auto-reschedule when patient replies "RESCHEDULE"',
          'No-show detection + recovery nudge',
        ],
        demo: InboxPreview },
      { eyebrow: 'Awareness content',
        title: 'Pre-built health calendars',
        description: 'World Heart Day, Diabetes Awareness, mental health weeks — pre-built calendars per specialty. Doctor reviews + publishes.',
        bullets: [
          'Specialty-specific calendars (cardiology, peds, dermatology, …)',
          'Doctor-introduction post templates',
          'AI-written awareness posts (medically reviewed templates)',
          'HIPAA-aligned content checker (flags risky claims)',
        ],
        demo: ComposerPreview },
      { eyebrow: 'Reviews + reputation',
        title: 'Google + Practo + Justdial in one inbox',
        description: 'Every review across every platform. AI-suggested replies tuned to clinical tone. Negative reviews auto-escalated.',
        bullets: [
          'Unified review inbox (GMB + Practo + Justdial)',
          'AI-suggested replies (clinical tone)',
          'Negative-review auto-escalation to admin',
          'Reply-rate + avg-rating dashboard',
        ],
        demo: AIInsightPreview },
    ],
    templates: {
      title: 'Healthcare templates ready to clone',
      items: [
        { title: 'Appointment reminder', description: 'Confirm 24h before + 1h before with map link.', icon: Calendar,
          gradient: 'linear-gradient(135deg, #34d399, #00CCF5)' },
        { title: 'Lab report ready',     description: 'Notify with secure download link + read-receipt.', icon: ClipboardList,
          gradient: 'linear-gradient(135deg, #00CCF5, #8b5cf6)' },
        { title: 'Health awareness',     description: '12-month calendar by specialty.', icon: Heart,
          gradient: 'linear-gradient(135deg, #f472b6, #a78bfa)' },
      ],
    },
    quote: {
      quote: 'Patient response time dropped from 4 hours to 4 minutes. Game changer.',
      author: 'Dr. Anjali Verma', role: 'Founder, Sunrise Clinics',
      gradient: 'linear-gradient(135deg, #34d399, #00CCF5)',
    },
    ctaTitle: 'Patient experience starts before they walk in.',
  },


  // ── 5. RESTAURANTS ───────────────────────────────────────────────────────
  'restaurants': {
    title: 'For restaurants',
    description: 'Fill more tables. Reservation bots, daily specials posts, review management for Zomato + Google, festival campaigns.',
    eyebrow: 'F&B',
    heroTitle: 'Fill more tables with social',
    heroSubtitle: 'Reservations via WhatsApp. Daily specials posted automatically. Reviews answered instantly. Festival campaigns ready for Diwali, Eid, Christmas.',
    heroDemo: BotBuilderPreview,
    heroPriceLine: 'Starts at ₹1,499/mo. Festival packs included.',
    painPoints: {
      title: 'You\'re tired of …',
      items: [
        { title: 'Phone-only reservations',  description: 'Patrons WhatsApp; phone goes to voicemail.' },
        { title: 'Inconsistent posting',     description: 'Manager forgets to post the day\'s special.' },
        { title: 'One-star Zomato reviews',  description: 'Saw it Tuesday. Ate the loss Wednesday.' },
      ],
    },
    stripes: [
      { eyebrow: 'Reservations',
        title: 'WhatsApp reservation bot',
        description: 'Customer asks "table for 4 tonight?" — bot checks availability against your seating chart, confirms, sends a calendar invite.',
        bullets: [
          'Conversational reservation flow',
          'Availability check (config or POS-integrated)',
          'Auto-reminder 1h before arrival',
          'No-show tracking + deposit policy support',
        ],
        demo: BotBuilderPreview },
      { eyebrow: 'Content',
        title: 'Daily specials on auto-pilot',
        description: 'Photo of today\'s dish + 1-line description. AI writes IG + FB captions. Posts at lunch + dinner-window time.',
        bullets: [
          'Daily-specials template (snap + 1 line + post)',
          'Festival campaigns (Diwali, Eid, Christmas, regional)',
          'Influencer outreach + tracking',
          'Auto-tag the dish photographer + chef',
        ],
        demo: ComposerPreview },
      { eyebrow: 'Reviews',
        title: 'Zomato + Google + Justdial in one place',
        description: 'Every review in one feed. AI replies tuned to F&B tone. Negative reviews auto-escalated to the manager.',
        bullets: [
          'Unified review inbox (GMB + Zomato + Justdial + Swiggy)',
          'AI-suggested replies (F&B tone — warm, accountable)',
          'Negative-review escalation Slack',
          'Per-outlet review aggregator (multi-location chains)',
        ],
        demo: AIInsightPreview },
    ],
    templates: {
      title: 'F&B templates ready to clone',
      items: [
        { title: 'Reservation bot',  description: 'Date + time + party size + dietary needs.', icon: ChefHat,
          gradient: 'linear-gradient(135deg, #fbbf24, #f472b6)' },
        { title: 'Daily specials post', description: 'Snap + 1-line + auto IG + FB captions.', icon: Megaphone,
          gradient: 'linear-gradient(135deg, #34d399, #fbbf24)' },
        { title: 'Festival campaigns', description: 'Diwali, Eid, Christmas, regional ready packs.', icon: Star,
          gradient: 'linear-gradient(135deg, #f472b6, #00CCF5)' },
      ],
    },
    quote: {
      quote: 'Reservations from WhatsApp are 35% of our weekly cover. Social Stats runs the bot end-to-end.',
      author: 'Aisha Khan', role: 'Marketing Manager, Lumen',
      gradient: 'linear-gradient(135deg, #fbbf24, #f472b6)',
    },
    ctaTitle: 'Every empty table costs money.',
  },


  // ── 6. CREATORS ──────────────────────────────────────────────────────────
  'creators': {
    title: 'For creators',
    description: 'Track your creator economy. YouTube + Instagram + LinkedIn analytics, brand-deal tracking, audience insights, posting optimization.',
    eyebrow: 'Creators',
    heroTitle: 'Track your creator economy',
    heroSubtitle: 'YouTube, Instagram, LinkedIn — analytics that show what your audience actually wants. Brand-deal tracking + invoicing. Posting optimisation with AI.',
    heroDemo: AnalyticsPreview,
    painPoints: {
      title: 'You\'re tired of …',
      items: [
        { title: 'Three studio dashboards',         description: 'YT Studio + IG Insights + LI Analytics. Three tabs. Three definitions of "engagement".' },
        { title: 'Brand-deal chaos',                description: 'Three brands. Two payments missed. One Excel sheet.' },
        { title: 'Inconsistent posting',            description: 'You meant to post Tuesday. It\'s Friday. Algorithm hates you.' },
      ],
    },
    stripes: [
      { eyebrow: 'Cross-platform',
        title: 'YouTube + IG + LinkedIn in one view',
        description: 'See what\'s working across all your platforms in one dashboard. Compare reach, engagement, follower growth, watch-time.',
        bullets: [
          'Unified subscriber + follower count',
          'Per-platform watch-time / saves / shares',
          'Top-content patterns surfaced by AI',
          'Audience demographics across platforms',
        ],
        demo: AnalyticsPreview },
      { eyebrow: 'Brand deals',
        title: 'Brand-deal tracking + invoicing',
        description: 'Log every deal (brand, deliverables, payment). Social Stats tracks payment status, generates GST-compliant invoices, nudges late payers.',
        bullets: [
          'Brand-deal CRM (status, payment, deliverables)',
          'GST-compliant invoice generation',
          'Auto-payment reminders to late-paying brands',
          'Year-end TDS summary for IT filing',
        ],
        demo: ReportsPreview },
      { eyebrow: 'Posting + AI',
        title: 'Post when your audience is online',
        description: 'AI predicts when YOUR audience is most active per platform. Posting optimisation per content type (Reel vs static vs Story).',
        bullets: [
          'Per-platform optimal-time predictions',
          'Per-content-type predictions (Reel/Story/static)',
          'Content calendar with recurring rules',
          'Hashtag research baked into composer',
        ],
        demo: ComposerPreview },
    ],
    quote: {
      quote: 'I post the same thing 3x and Social Stats formats it perfectly for each platform. Saves me 5 hours a week.',
      author: 'Vikram Joshi', role: 'Creator (385K subs)',
      gradient: 'linear-gradient(135deg, #f472b6, #fbbf24)',
    },
    ctaTitle: 'Your creator stack, simplified.',
  },


  // ── 7. E-COMMERCE ────────────────────────────────────────────────────────
  'ecommerce': {
    title: 'For e-commerce',
    description: 'Drive sales from social. Product catalog integration, Shop tab insights, WhatsApp commerce, cart abandonment campaigns.',
    eyebrow: 'E-commerce',
    heroTitle: 'Drive sales from social',
    heroSubtitle: 'Product catalogs that sync. Shop-tab insights. WhatsApp commerce flows. Cart-abandonment campaigns. Customer support automation.',
    heroDemo: BotBuilderPreview,
    heroPriceLine: 'Shopify + WooCommerce integrations included.',
    painPoints: {
      title: 'You\'re tired of …',
      items: [
        { title: 'Catalog updates everywhere',     description: 'New SKU. Update Shopify. Update IG Shop. Update FB Catalog. Update WhatsApp catalog.' },
        { title: 'Cart abandonment leaks',          description: '60% of carts abandoned. No follow-up.' },
        { title: 'CS questions in 5 places',        description: '"What size is this?" via DM, comment, WhatsApp, email.' },
        { title: 'Festival campaigns scrambled',    description: 'Diwali sale planning starts October 5. Goes live October 10. Half the channels miss.' },
      ],
    },
    stripes: [
      { eyebrow: 'Catalog sync',
        title: 'Product catalog, sync once',
        description: 'Connect Shopify or WooCommerce. Social Stats syncs to IG Shop + FB Catalog + WhatsApp catalog automatically.',
        bullets: [
          'Shopify + WooCommerce integration',
          'Auto-sync to IG Shop + FB Catalog + WA catalog',
          'Inventory updates flow to all channels',
          'Pricing changes propagate in 5 minutes',
        ],
        demo: ComposerPreview },
      { eyebrow: 'WhatsApp commerce',
        title: 'Sell on WhatsApp',
        description: 'Customer browses your WhatsApp catalog → adds items → bot collects address → routes to your fulfillment.',
        bullets: [
          'WhatsApp catalog auto-populated',
          'Cart-builder bot flow',
          'Cash-on-delivery + UPI checkout',
          'Order-status updates via template',
        ],
        demo: BotBuilderPreview },
      { eyebrow: 'Recovery + support',
        title: 'Cart abandonment + support, automated',
        description: 'Cart left? WhatsApp reminder in 30 min. Question on a product? AI answers from your FAQ + catalog data.',
        bullets: [
          'Cart-abandonment WhatsApp campaign',
          'AI customer support (FAQ + catalog-aware)',
          'Order-status proactive updates',
          'Festival-campaign packs (Diwali, Republic Day)',
        ],
        demo: AutomationsPreview },
    ],
    templates: {
      title: 'E-commerce templates ready to clone',
      items: [
        { title: 'Cart abandonment',     description: '30-min + 24h + 72h escalating reminders.', icon: ShoppingCart,
          gradient: 'linear-gradient(135deg, #f472b6, #fbbf24)' },
        { title: 'Order status',          description: 'Confirmed → packed → shipped → delivered.', icon: Package,
          gradient: 'linear-gradient(135deg, #00CCF5, #34d399)' },
        { title: 'Product inquiry bot',   description: 'Catalog-aware Q&A with handoff to human.', icon: Bot,
          gradient: 'linear-gradient(135deg, #8b5cf6, #f472b6)' },
      ],
    },
    quote: {
      quote: 'Cart-abandonment recovery via WhatsApp made up 18% of our Diwali revenue last year.',
      author: 'Karan Bhatia', role: 'COO, BlueWave',
      gradient: 'linear-gradient(135deg, #f472b6, #00CCF5)',
    },
    ctaTitle: 'Stop letting carts go cold.',
  },

};


export function getSolutionPage(slug) {
  return solutionPages[slug] || null;
}
