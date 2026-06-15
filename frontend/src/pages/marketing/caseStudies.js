/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * caseStudies.js — content for /customers/:slug pages.
 *
 * Each entry powers CaseStudyPage.jsx. Pattern:
 *   slug    — URL slug
 *   company — display name
 *   tagline — one line summary under headline
 *   industry, accent — color + chip
 *   hero.metric — the headline number
 *   profile — { logoText, sector, size, founded, location, website }
 *   challenge / solution / results — narrative blocks
 *   pulls — pull-quote list
 *   stats — animated MetricCounter rows under "Results"
 *   features — used products
 *   cta — final CTA + back link
 */

const STUDIES = {
  // ── 1. Acme Realty ────────────────────────────────────────────────
  'acme-realty': {
    slug: 'acme-realty',
    company: 'Acme Realty',
    industry: 'Real Estate',
    accent: '#00CCF5',
    tagline: 'How Acme 4.2x-ed leads with WhatsApp + a unified inbox.',
    hero: {
      metric: { value: 4.2, suffix: 'x', label: 'lead volume in 9 months' },
      portrait: {
        name: 'Priya Sharma',
        role: 'Marketing Head, Acme Realty',
        initial: 'PS',
      },
      logoText: 'A',
    },

    profile: {
      sector: 'Real Estate',
      size: '120 agents · 6 cities',
      founded: '2014',
      location: 'Mumbai · Pune · Bengaluru',
      website: 'acmerealty.example',
      uses: ['WhatsApp Business', 'Unified Inbox', 'Composer', 'Reports'],
    },

    challenge: {
      title: 'The "where do I respond first?" problem',
      body: [
        'Acme Realty was running on three platforms — Instagram DMs, Facebook Messenger, and WhatsApp — with one shared Google Sheet to track leads. By 2024, they were getting over 12,000 enquiries a month. Agents would miss DMs for 6+ hours, leads would go cold, and the spreadsheet became a graveyard of duplicates.',
        '"We had two full-time interns whose only job was to manually copy WhatsApp numbers into HubSpot," says Priya Sharma, their marketing head. "Every Monday morning, the team would spend half a day reconciling lists."',
      ],
    },

    solution: {
      title: 'One inbox. Two-way WhatsApp. Auto-routing.',
      body: [
        'Acme migrated all three channels into the Social Stats unified inbox. Incoming messages now route automatically to the right city agent based on the property mentioned. WhatsApp campaigns went out via the Composer, with brand-trained voice tuned to "warm, fast, and professional."',
        'The Reports module gives Priya a single view of "leads by source, by city, by agent" — refreshed live, white-labelled, sent to her CEO every Monday at 9am sharp.',
      ],
      bullets: [
        'Instagram, Facebook, WhatsApp — one unified inbox, one queue.',
        'Auto-routing rules by city, property type, and budget mentioned.',
        'WhatsApp broadcast campaigns segmented by lead score.',
        'Shared note threads so any agent can pick up any lead.',
      ],
    },

    results: {
      title: '4.2x leads. 60-second response time.',
      body: 'In nine months on Social Stats, Acme grew enquiries from ~12,000/month to over 50,000 — without adding a single new lead-handling role. Response time is now sub-60 seconds across all channels.',
      stats: [
        { value: 4.2,    suffix: 'x',  label: 'lead volume',          decimals: 1 },
        { value: 50000,  suffix: '+',  label: 'monthly enquiries' },
        { value: 60,     suffix: 's',  label: 'avg. response time' },
        { value: 92,     suffix: '%',  label: 'lead-to-tour conv.' },
      ],
    },

    pulls: [
      {
        quote: 'Social Stats is the only thing that scaled with us. We grew 4x and our team got smaller, not larger.',
        person: 'Priya Sharma · Marketing Head',
      },
      {
        quote: 'The auto-routing is the single best thing. Every message goes to the right person on the first try.',
        person: 'Vikas Rao · Pune City Manager',
      },
    ],
  },

  // ── 2. Sunrise Clinics ────────────────────────────────────────────
  'sunrise-clinics': {
    slug: 'sunrise-clinics',
    company: 'Sunrise Clinics',
    industry: 'Healthcare',
    accent: '#8b5cf6',
    tagline: '12 clinics. One inbox. 32% fewer no-shows.',
    hero: {
      metric: { value: 32, suffix: '%', label: 'drop in patient no-shows' },
      portrait: {
        name: 'Dr. Anjali Verma',
        role: 'Founder, Sunrise Clinics',
        initial: 'AV',
      },
      logoText: 'S',
    },

    profile: {
      sector: 'Healthcare · Multi-location',
      size: '12 clinics · 80 staff',
      founded: '2018',
      location: 'Bengaluru · Mysore · Hubli',
      website: 'sunriseclinics.example',
      uses: ['WhatsApp Business', 'Automations', 'Unified Inbox', 'Analytics'],
    },

    challenge: {
      title: 'No-shows were eating 28% of revenue',
      body: [
        'Sunrise Clinics had a quiet but expensive problem: 28% of patients booked appointments and didn\'t show up. SMS reminders were ignored — read rates were below 20%. The receptionist at each clinic was making manual reminder calls, but with 200+ daily appointments per location, half went unconfirmed.',
        '"We were losing about ₹14 lakh a month to no-shows," says Dr. Anjali Verma. "And our front-desk staff was spending 3 hours a day on the phone instead of looking after patients."',
      ],
    },

    solution: {
      title: 'WhatsApp reminders, smart automations, one master inbox',
      body: [
        'Sunrise wired their appointment system into Social Stats with two automations: a 24-hour WhatsApp reminder, and a 2-hour confirm/reschedule prompt. Patients can confirm with a single tap or reschedule via a smart flow — without picking up the phone.',
        'All 12 clinics now share a unified inbox. The central operations team can see every conversation, every clinic, in real time. Analytics tracks no-show rate by clinic, by doctor, by day-of-week.',
      ],
      bullets: [
        '24-hour and 2-hour WhatsApp reminders with one-tap confirm.',
        'Reschedule flow — patients pick a new slot in chat.',
        'Cross-clinic master inbox for the central ops team.',
        'No-show analytics by clinic, doctor, time-of-day.',
      ],
    },

    results: {
      title: 'No-shows down 32%. Bookings up 2x.',
      body: 'After three months, no-show rates dropped from 28% to 19% — a 32% relative improvement. With reminder workload off the front desk, Sunrise re-deployed staff to outbound bookings and grew total appointments 2x.',
      stats: [
        { value: 32,    suffix: '%',  label: 'fewer no-shows' },
        { value: 2,     suffix: 'x',  label: 'total bookings' },
        { value: 3,     suffix: 'h',  label: 'staff time saved daily' },
        { value: 87,    suffix: '%',  label: 'WhatsApp read rate' },
      ],
    },

    pulls: [
      {
        quote: 'We doubled bookings without hiring anyone. The math is unreal.',
        person: 'Dr. Anjali Verma · Founder',
      },
      {
        quote: 'Patients actually reply on WhatsApp. They never replied to SMS.',
        person: 'Anita Kumar · Operations Manager',
      },
    ],
  },

  // ── 3. BlueWave Agency ────────────────────────────────────────────
  'bluewave-agency': {
    slug: 'bluewave-agency',
    company: 'BlueWave Agency',
    industry: 'Agencies',
    accent: '#f472b6',
    tagline: 'Six humans. 120 clients. One Social Stats tenant.',
    hero: {
      metric: { value: 120, suffix: '+', label: 'clients managed concurrently' },
      portrait: {
        name: 'Rohit Mehta',
        role: 'Founder & CEO, BlueWave',
        initial: 'RM',
      },
      logoText: 'B',
    },

    profile: {
      sector: 'Marketing Agency',
      size: '6 staff · 120+ clients',
      founded: '2021',
      location: 'Gurgaon, India',
      website: 'bluewave.example',
      uses: ['Multi-tenant', 'White-label portals', 'Composer', 'AI Assistant', 'Reports'],
    },

    challenge: {
      title: 'Tools that broke at 30 clients',
      body: [
        'BlueWave grew from 12 to 80 clients in 18 months. Their tool stack — Hootsuite for scheduling, Notion for approvals, Google Sheets for reporting, Slack for client comms — all started cracking. Approvals were slipping through the gaps. White-label reporting required manual screenshots into PowerPoint every Friday.',
        '"By client 30, we were paying ₹2.8 lakh a month across four tools," says Rohit Mehta. "And we still had three full-time people whose job was just stitching them together."',
      ],
    },

    solution: {
      title: 'One tenant per client. Brand assets baked in.',
      body: [
        'Social Stats\'s multi-tenant architecture meant every BlueWave client got their own isolated workspace under the BlueWave parent account. White-label portals carry the client\'s logo and the agency\'s branding. The AI Assistant trained on each client\'s past content writes new posts in their exact voice.',
        'Reports are generated and delivered automatically every Monday. The Composer plans a month ahead. Approvals happen in-product — no PowerPoint exports, no chasing emails.',
      ],
      bullets: [
        'Multi-tenant isolation — every client in their own workspace.',
        'White-label portals with per-client branding.',
        'AI Assistant trained per-client for brand-voice consistency.',
        'Auto-generated white-label reports every Monday.',
      ],
    },

    results: {
      title: '120+ clients. ₹2.8L/mo saved. Zero added headcount.',
      body: 'BlueWave 8x-ed their client roster — from 12 to 120+ — without adding new operational staff. They retired three legacy tools, saving ₹2.8L/month, and turned that into margin.',
      stats: [
        { value: 120,   suffix: '+',  label: 'clients managed' },
        { value: 2.8,   suffix: 'L',  label: '₹/month saved on tools', decimals: 1 },
        { value: 7,     suffix: 'x',  label: 'production throughput' },
        { value: 4,     suffix: '',   label: 'tools replaced' },
      ],
    },

    pulls: [
      {
        quote: 'We replaced four tools with Social Stats. Four. The savings funded the agency for a year.',
        person: 'Rohit Mehta · Founder & CEO',
      },
      {
        quote: 'Clients ask which agency dashboard we built. It\'s just Social Stats in our colors.',
        person: 'Karan Bhatia · Operations',
      },
    ],
  },
};

export default STUDIES;
