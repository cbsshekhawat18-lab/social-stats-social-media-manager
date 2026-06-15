/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * agencyProfiles.js — content for /agencies (showcase) and /agencies/:slug.
 *
 * 6 hand-crafted partner-agency profiles. Static data — no backend
 * dependency. Reuses the BlueWave / Halcyon / Verve / Lumen / Ember / Apex
 * characters that already appear across the marketing site so storytelling
 * stays consistent.
 *
 * Each entry:
 *   slug, name, tagline, headline metric, accent, location, founded, size,
 *   industries[], services[], languages[], badges[], rating { score, count },
 *   pricing { from, model }, hero.logo, hero.cover (gradient stops),
 *   about (long form), services_detail[], stats[], portfolio[],
 *   reviews[], contact { website, email, phone }
 */

const AGENCIES = {
  // ──────────────────────────────────────────────────────────────────────
  'bluewave-agency': {
    slug: 'bluewave-agency',
    name: 'BlueWave Agency',
    tagline: 'Six humans. 120+ clients. Multi-tenant marketing at scale.',
    accent: '#00CCF5',
    location: 'Gurgaon, India',
    founded: 2021,
    size: '6 staff',
    industries: ['SaaS', 'D2C', 'Fintech'],
    services: ['Social media', 'WhatsApp campaigns', 'Reporting', 'Strategy'],
    languages: ['English', 'Hindi'],
    badges: ['Verified', 'Top 1%', 'Social Stats Native'],
    rating: { score: 4.9, count: 86 },
    pricing: { from: '₹40K/mo', model: 'Retainer' },
    hero: {
      logoText: 'B',
      cover: ['#00CCF5', '#0066FF'],
    },
    about: [
      'BlueWave is a 6-person agency based in Gurgaon that runs marketing for over 120 clients — primarily SaaS, D2C and fintech. Founded in 2021 by Rohit Mehta after a decade at larger agencies, BlueWave was built on a single idea: small teams, when properly tooled, can outperform 50-person shops.',
      'BlueWave is a Social Stats Native partner — every client lives in their own multi-tenant workspace, every report is white-labelled, and every scheduled post is reviewed in-product. No PowerPoint exports. No spreadsheets to reconcile.',
    ],
    metric: { value: '120+', label: 'clients managed' },
    stats: [
      { value: '120+',  label: 'concurrent clients' },
      { value: '4',     label: 'tools replaced'    },
      { value: '7x',    label: 'production speed'  },
      { value: '4.9',   label: 'avg. client rating'},
    ],
    services_detail: [
      { title: 'Social media management', body: 'Daily posting across Instagram, Facebook, LinkedIn, X. Brand-voice trained Composer drafts. Approval flows in-product.' },
      { title: 'WhatsApp campaigns',      body: 'Opt-in flows, broadcast segmentation, two-way agent routing. Compliant with WhatsApp Business policy.' },
      { title: 'White-label reporting',    body: 'Auto-generated monthly reports delivered every Monday. Carries your brand, not BlueWave\'s.' },
      { title: 'Brand strategy',           body: 'Quarterly brand-voice audits. Content pillars. Audience composition deep-dives.' },
    ],
    portfolio: [
      { brand: 'Halcyon SaaS',     metric: '4.2x leads',   note: 'CTWA bot funnel'        },
      { brand: 'Verve D2C',        metric: '+₹38L/mo',     note: 'WhatsApp catalogue'     },
      { brand: 'Lumen Fintech',    metric: '6.4x ROAS',    note: 'Composer + Meta ads'    },
      { brand: 'Ember Restaurants',metric: '+450 covers/wk',note:'Local Instagram strategy'},
    ],
    reviews: [
      { name: 'Aditya Rao',  role: 'Growth, Halcyon',          rating: 5, body: 'BlueWave delivered the CTWA bot in two weeks. Paid for itself in the first month.' },
      { name: 'Meera Iyer',  role: 'Content Lead, Verve',      rating: 5, body: 'Their composer drafts feel like our team wrote them. Brand-voice training is uncanny.' },
      { name: 'Aisha Khan',  role: 'Brand Director, Lumen',    rating: 5, body: 'Replaced four agencies with BlueWave. Saved ~40% and got better numbers.' },
    ],
    contact: { website: 'bluewave.example', email: 'hi@bluewave.example', phone: '+91 90000 00001' },
  },

  // ──────────────────────────────────────────────────────────────────────
  'halcyon': {
    slug: 'halcyon',
    name: 'Halcyon',
    tagline: 'AI-first social. Performance creative for fast-growing brands.',
    accent: '#8b5cf6',
    location: 'Bengaluru, India',
    founded: 2020,
    size: '14 staff',
    industries: ['E-commerce', 'D2C', 'Beauty'],
    services: ['Performance creative', 'Meta ads', 'AI Composer', 'Analytics'],
    languages: ['English', 'Kannada', 'Hindi'],
    badges: ['Verified', 'Social Stats Native'],
    rating: { score: 4.8, count: 142 },
    pricing: { from: '₹85K/mo', model: 'Retainer + perf bonus' },
    hero: { logoText: 'H', cover: ['#8b5cf6', '#6d28d9'] },
    about: [
      'Halcyon is a 14-person Bengaluru agency that specialises in performance creative — the high-volume, AI-assisted ad iteration that modern D2C brands rely on. Founded in 2020 by Aditya Rao, Halcyon ships ~600 creative variants per month per client.',
      'They were one of the first agencies to onboard onto the Social Stats Studio. Today the entire creative pipeline — brief → draft → approval → publish → measure → iterate — runs in Social Stats.',
    ],
    metric: { value: '7x', label: 'creative throughput' },
    stats: [
      { value: '600+', label: 'creatives/mo per client' },
      { value: '7x',   label: 'iteration speed'         },
      { value: '4.8',  label: 'avg. ROAS'              },
      { value: '92',   label: 'NPS score'              },
    ],
    services_detail: [
      { title: 'Performance creative', body: 'Brief → 50 ad variants in 48 hours. AI-assisted, brand-voice consistent.' },
      { title: 'Meta ads management',  body: 'Campaign ops + creative testing. Daily budget + bid optimisation.' },
      { title: 'AI Composer',          body: 'Brand-voice trained on your archive. Drafts that read like you.' },
      { title: 'Analytics + reporting',body: 'Spend, ROAS, creative scoring. Weekly reviews.' },
    ],
    portfolio: [
      { brand: 'Aurora Skincare', metric: '8.1% CTR',       note: 'D2C beauty creative'   },
      { brand: 'Fern Studio',     metric: '6.4x ROAS',      note: 'Catalogue ads'         },
      { brand: 'Mango Cafe',      metric: '+320% impressions',note:'Local awareness'      },
      { brand: 'Saffron',         metric: '+5K WhatsApp opt-ins',note:'CTWA performance'  },
    ],
    reviews: [
      { name: 'Priya Menon',  role: 'CMO, Aurora',  rating: 5, body: 'Halcyon\'s creative iteration speed is unmatched. We\'ve never had this many tested ads in market.' },
      { name: 'Karan Bhatia', role: 'Founder, Fern',rating: 5, body: 'Switched from a 30-person agency. Halcyon is half the cost and twice the output.' },
      { name: 'Vikram Joshi', role: 'Director, Ember', rating: 4, body: 'Excellent creative; reporting could be faster on weekends, but everything else is great.' },
    ],
    contact: { website: 'halcyon.example', email: 'partners@halcyon.example', phone: '+91 90000 00002' },
  },

  // ──────────────────────────────────────────────────────────────────────
  'verve': {
    slug: 'verve',
    name: 'Verve',
    tagline: 'Brand voice that converts. Content for premium D2C.',
    accent: '#f472b6',
    location: 'Mumbai, India',
    founded: 2019,
    size: '22 staff',
    industries: ['Premium D2C', 'Beauty', 'Lifestyle'],
    services: ['Content strategy', 'Brand voice', 'Influencer mgmt'],
    languages: ['English', 'Hindi', 'Marathi'],
    badges: ['Verified', 'Top 5%'],
    rating: { score: 4.7, count: 198 },
    pricing: { from: '₹120K/mo', model: 'Retainer' },
    hero: { logoText: 'V', cover: ['#f472b6', '#db2777'] },
    about: [
      'Verve is a Mumbai-based content agency for premium D2C brands. Founded in 2019, they have a deep specialisation in brand-voice work — taking a brand from "competent posts" to "instantly recognisable from a single line of copy."',
      'Verve trains its writers on a proprietary methodology and uses Social Stats\'s brand-voice profiles to ensure consistency at scale.',
    ],
    metric: { value: '24h', label: 'creative turnaround' },
    stats: [
      { value: '24h', label: 'avg. turnaround'    },
      { value: '50+', label: 'D2C clients served' },
      { value: '4.7', label: 'avg. rating'        },
      { value: '7yr', label: 'avg. retention'     },
    ],
    services_detail: [
      { title: 'Brand voice systems', body: 'Multi-month brand-voice audits, vocabulary lists, do/don\'t guides.' },
      { title: 'Content production',  body: '20-40 posts/mo per client. Photography + copy + scheduling.' },
      { title: 'Influencer mgmt',     body: 'Tier-1 to micro influencers. Negotiation, briefing, measurement.' },
      { title: 'Approval workflows',  body: 'Multi-stakeholder approvals via Social Stats. Average 24-hour turnaround.' },
    ],
    portfolio: [
      { brand: 'Aurora Skincare', metric: '+450% reach',     note: 'Influencer + organic' },
      { brand: 'Bloom Florist',   metric: '+22K followers/mo',note:'Lifestyle content'    },
      { brand: 'Glide Hotels',    metric: '+38% direct bookings',note:'Brand + perf hybrid'},
    ],
    reviews: [
      { name: 'Priya Menon', role: 'CMO, Aurora',     rating: 5, body: 'Verve made our brand sound like Verve. Game changer.' },
      { name: 'Ravi K.',     role: 'GM, Glide Hotels',rating: 5, body: 'They turned a tired hotel brand into something we\'re proud of.' },
      { name: 'Nisha Rao',   role: 'Founder, Bloom',  rating: 4, body: 'High quality, premium pricing, you get what you pay for.' },
    ],
    contact: { website: 'verve.example', email: 'hello@verve.example', phone: '+91 90000 00003' },
  },

  // ──────────────────────────────────────────────────────────────────────
  'lumen': {
    slug: 'lumen',
    name: 'Lumen',
    tagline: 'White-label social for finance, insurance, and professional services.',
    accent: '#10b981',
    location: 'Pune, India',
    founded: 2018,
    size: '18 staff',
    industries: ['Finance', 'Insurance', 'B2B services'],
    services: ['White-label social', 'LinkedIn-first', 'Compliance review'],
    languages: ['English', 'Hindi'],
    badges: ['Verified', 'Compliance specialist'],
    rating: { score: 4.9, count: 64 },
    pricing: { from: '₹60K/mo', model: 'Retainer' },
    hero: { logoText: 'L', cover: ['#10b981', '#059669'] },
    about: [
      'Lumen specialises in regulated industries — finance, insurance, and professional services where every post needs compliance review. They\'ve built an internal review queue inside Social Stats that lawyers, compliance officers, and the marketing team share.',
      'If you need to ship a LinkedIn post in a regulated category and not get a fine for it, Lumen is the agency.',
    ],
    metric: { value: '3x', label: 'client retention' },
    stats: [
      { value: '0',    label: 'compliance violations' },
      { value: '3x',   label: 'client retention'      },
      { value: '180d', label: 'avg. lead time SLA'    },
      { value: '4.9',  label: 'avg. rating'           },
    ],
    services_detail: [
      { title: 'White-label management', body: 'Your colors, your branding. Lumen invisible to the end client.' },
      { title: 'Compliance-first content', body: 'Every post reviewed by registered compliance officers.' },
      { title: 'LinkedIn-first',          body: 'Specialists in B2B LinkedIn organic + paid. Founder-brand work.' },
      { title: 'Audit-ready reporting',   body: 'Reports designed to satisfy regulators, not just CEOs.' },
    ],
    portfolio: [
      { brand: 'Quartz Legal',  metric: '+41% engagement', note: 'Founder thought-leadership' },
      { brand: 'Vault Finance', metric: '+2.4K leads',     note: 'Compliant lead-gen'         },
      { brand: 'Apex Foods',    metric: '+22% AOV',        note: 'B2B procurement'           },
    ],
    reviews: [
      { name: 'Anjali V.',    role: 'GC, Quartz Legal', rating: 5, body: 'Lumen makes compliance feel painless. Eight quarters in, zero violations.' },
      { name: 'Rakesh T.',    role: 'CMO, Vault',       rating: 5, body: 'They speak finance. Half the briefing time, twice the output quality.' },
      { name: 'Manish Patel', role: 'COO, Apex Foods',  rating: 5, body: 'Outstanding for B2B procurement comms. Knows the audience.' },
    ],
    contact: { website: 'lumen.example', email: 'partners@lumen.example', phone: '+91 90000 00004' },
  },

  // ──────────────────────────────────────────────────────────────────────
  'ember': {
    slug: 'ember',
    name: 'Ember',
    tagline: 'Hyper-local social for restaurants, clinics, and retail chains.',
    accent: '#f59e0b',
    location: 'Hyderabad, India',
    founded: 2022,
    size: '8 staff',
    industries: ['Restaurants', 'Clinics', 'Retail'],
    services: ['Hyper-local social', 'WhatsApp campaigns', 'GMB optimisation'],
    languages: ['English', 'Telugu', 'Hindi', 'Tamil'],
    badges: ['Verified', 'Multi-location'],
    rating: { score: 4.6, count: 91 },
    pricing: { from: '₹25K/mo', model: 'Per-location pricing' },
    hero: { logoText: 'E', cover: ['#f59e0b', '#d97706'] },
    about: [
      'Ember runs the social presence for restaurant chains, multi-clinic networks, and retail brands that need consistent presence across many physical locations. They use Social Stats\'s multi-tenant architecture to manage 100+ Google Business profiles + 100+ Instagram accounts from one workspace.',
      'If you have more than 5 physical locations, Ember is built for you.',
    ],
    metric: { value: '+₹38L', label: 'monthly revenue lift' },
    stats: [
      { value: '100+', label: 'locations managed/client' },
      { value: '+₹38L',label: 'avg. monthly revenue lift'},
      { value: '4.6',  label: 'avg. rating'              },
      { value: '14d',  label: 'avg. onboarding time'     },
    ],
    services_detail: [
      { title: 'Multi-location social',  body: 'One workspace, 100+ Instagram accounts. Per-location overrides.' },
      { title: 'GMB optimisation',       body: 'Reviews, posts, Q&A management at scale.' },
      { title: 'WhatsApp campaigns',     body: 'Per-store WhatsApp numbers. Campaigns segmented by neighbourhood.' },
      { title: 'Operations dashboards',  body: 'Per-location metrics for franchise owners.' },
    ],
    portfolio: [
      { brand: 'Apex Foods',       metric: '+22% AOV',        note: 'Catalogue + checkout'  },
      { brand: 'Sunrise Clinics',  metric: '32% fewer no-shows',note:'WhatsApp reminders'   },
      { brand: 'Pulse Fitness',    metric: '+450 members',    note: 'Hyper-local CTWA'      },
    ],
    reviews: [
      { name: 'Vikram J.',       role: 'Director, Ember chain',     rating: 5, body: 'Ember runs all 14 of our locations. Saved 3 ops people.' },
      { name: 'Dr. Anjali V.',   role: 'Founder, Sunrise Clinics',  rating: 4, body: 'Solid for multi-location healthcare. Some lag during festival surge.' },
      { name: 'Sneha P.',        role: 'GM, Pulse Fitness',         rating: 5, body: 'They get hyper-local. Other agencies don\'t.' },
    ],
    contact: { website: 'ember.example', email: 'hi@ember.example', phone: '+91 90000 00005' },
  },

  // ──────────────────────────────────────────────────────────────────────
  'apex-marketing': {
    slug: 'apex-marketing',
    name: 'Apex Marketing',
    tagline: 'Enterprise-grade. SOC 2, SLAs, white-label.',
    accent: '#ef4444',
    location: 'Delhi, India',
    founded: 2015,
    size: '48 staff',
    industries: ['Enterprise', 'Healthcare', 'B2B'],
    services: ['Enterprise social', 'Crisis comms', 'Multi-region'],
    languages: ['English', 'Hindi', 'Bengali', 'Tamil'],
    badges: ['Verified', 'Top 1%', 'SOC 2'],
    rating: { score: 4.7, count: 312 },
    pricing: { from: '₹250K/mo', model: 'MSA + retainer' },
    hero: { logoText: 'A', cover: ['#ef4444', '#dc2626'] },
    about: [
      'Apex is the agency you call when stakes are high. Founded in 2015, they run enterprise social for Fortune 500 India entries — full MSAs, SLAs, security reviews, the works. They\'re SOC 2 audited and one of three Social Stats partners cleared for Tier-1 enterprise customers.',
      'If you need an agency your General Counsel will sign off on, Apex is the answer.',
    ],
    metric: { value: '99.9%', label: 'SLA uptime' },
    stats: [
      { value: '99.9%', label: 'SLA uptime'         },
      { value: '15min',label: 'crisis SLA'          },
      { value: '4.7',  label: 'avg. rating'         },
      { value: '8yr',  label: 'avg. enterprise tenure'},
    ],
    services_detail: [
      { title: 'Enterprise social',   body: 'Multi-stakeholder approval flows. Compliance-first. Audit logs.' },
      { title: 'Crisis communications', body: '15-minute SLA. 24/7 monitoring. Regional language coverage.' },
      { title: 'Multi-region campaigns', body: '5 regional language teams. Cultural review built into the workflow.' },
      { title: 'Executive ghost-writing', body: 'C-suite LinkedIn presences. Confidential, white-glove.' },
    ],
    portfolio: [
      { brand: 'Northstar Pharma', metric: '0 incidents',   note: 'Compliance-grade rollout' },
      { brand: 'Indus Realty',     metric: 'IPO comms',     note: 'Multi-region campaign'  },
      { brand: 'Cobalt Energy',    metric: '+18% sentiment',note: 'Brand reputation work'   },
    ],
    reviews: [
      { name: 'Senior Director',  role: 'F500 Healthcare',  rating: 5, body: 'White-glove from kickoff to delivery. The only agency we trust for our IPO comms.' },
      { name: 'CMO',              role: 'Indus Realty',     rating: 5, body: 'Mature, processes well-defined, communications crisp.' },
      { name: 'Head of PR',       role: 'Cobalt Energy',    rating: 4, body: 'Premium pricing but you get what you pay for.' },
    ],
    contact: { website: 'apex.example', email: 'enterprise@apex.example', phone: '+91 90000 00006' },
  },
};

export default AGENCIES;

export function getAgency(slug) {
  return AGENCIES[slug] || null;
}

export const AGENCY_LIST = Object.values(AGENCIES);

export function listIndustries() {
  return Array.from(new Set(AGENCY_LIST.flatMap((a) => a.industries))).sort();
}
export function listServices() {
  return Array.from(new Set(AGENCY_LIST.flatMap((a) => a.services))).sort();
}
