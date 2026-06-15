/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * productPages — content for the 10 /product/* pages.
 *
 * Each entry maps to a slug (the URL segment after /product/). The
 * `ProductPage` template renders these entries.
 *
 * Schema:
 *   eyebrow         pill text shown above hero H1 (uppercase, 3-5 words)
 *   heroTitle       hero H1
 *   heroSubtitle    one-paragraph hook
 *   heroDemo        component to render in the hero panel
 *   stripes[]       alternating image/text rows (max 3-4 to keep page tight)
 *     eyebrow, title, description, bullets, demo
 *   capabilities    grid of small tiles
 *     title, subtitle, columns, items[{title, description, icon}]
 *   quote           customer quote
 *     quote, author, role, gradient
 *   ctaTitle        bottom CTA copy override
 */
import {
  BarChart3, PenSquare, Inbox, MessageCircle, Bot, Sparkles,
  FileText, Zap, Star, Calendar, Layers,
  Users, Shield, Palette, TrendingUp,
  Workflow, GitBranch, Bell, Tag, Send,
  Check, MessageSquare, Repeat, ChevronRight,
} from 'lucide-react';

import {
  AIAssistantPreview, ComposerPreview, InboxPreview, BotBuilderPreview,
  AIInsightPreview, AutomationsPreview, AnalyticsPreview, ReportsPreview,
} from '../../components/marketing/BentoPreviews';
import AnimatedChat from '../../components/marketing/AnimatedChat';


// Reusable inline chat demo for the AI pages
function AIChatDemo() {
  return (
    <AnimatedChat
      userMessage="Why did engagement drop on Tuesday?"
      assistantReply="Tuesday's post was a static image at 11am — your audience is most active 6-8pm and prefers Reels (3.2× normal saves). I'd suggest moving Tue posts to 7pm and switching to video. Want me to draft 3 Reels?"
      speedMs={14}
    />
  );
}


// ─────────────────────────────────────────────────────────────────────────────
export const productPages = {

  // ── 1. Analytics ──────────────────────────────────────────────────────────
  'analytics': {
    title: 'Cross-platform analytics',
    description: 'Track Facebook, Instagram, YouTube, LinkedIn, and Google Business Profile in one unified dashboard. AI insights surface what to do next.',
    eyebrow: 'Analytics',
    heroTitle: 'See everything across 5 platforms',
    heroSubtitle: 'Reach, engagement, follower growth, and revenue — across Facebook, Instagram, YouTube, LinkedIn, and Google Business Profile, in one dashboard.',
    heroDemo: AnalyticsPreview,
    stripes: [
      {
        eyebrow: 'Built for comparison',
        title: 'Compare platforms side-by-side',
        description: 'Stop opening 5 tabs. See which platform is pulling its weight, and which needs more attention.',
        bullets: [
          'Unified reach + engagement + follower growth',
          'Per-platform breakdowns when you need to drill in',
          'Custom date ranges, week-over-week, year-over-year',
          'CSV + PDF export for stakeholders',
        ],
        demo: AnalyticsPreview,
      },
      {
        eyebrow: 'AI insights',
        title: 'Why your numbers moved',
        description: 'AI watches your metrics so you don\'t have to. When something changes, you find out within hours, not weeks.',
        bullets: [
          'Engagement-drop alerts with hypotheses',
          'Best-time-to-post recommendations',
          'Top-performing content pattern detection',
          'Anomaly detection on every metric',
        ],
        demo: AIInsightPreview,
      },
    ],
    capabilities: {
      title: 'Connect everything in 5 minutes',
      subtitle: 'OAuth or paste-token modes for every supported platform.',
      columns: 4,
      items: [
        { icon: BarChart3, title: 'Real-time metrics',  description: 'Auto-refresh every 5 minutes.' },
        { icon: Users,     title: 'Audience insights',  description: 'Demographics, active hours, content preferences.' },
        { icon: TrendingUp,title: 'Content performance',description: 'Top posts by reach, engagement, conversions.' },
        { icon: Layers,    title: 'Competitor benchmarks', description: 'Public profile snapshots + AI commentary.' },
      ],
    },
    quote: {
      quote: 'I used to spend Sunday evenings exporting CSVs from 5 platforms. Now I just open Social Stats.',
      author: 'Aditya Rao', role: 'Founder, Halcyon',
      gradient: 'linear-gradient(135deg, #00CCF5, #8b5cf6)',
    },
    ctaTitle: 'Stop juggling tabs.',
    ctaSubtitle: 'Connect your accounts in 5 minutes — see everything in one place.',
  },


  // ── 2. Composer ──────────────────────────────────────────────────────────
  'composer': {
    title: 'Multi-platform composer',
    description: 'Write one post. Social Stats auto-formats for Facebook, Instagram, LinkedIn, YouTube. Schedule, queue, or recur.',
    eyebrow: 'Composer',
    heroTitle: 'Write once, publish 5x',
    heroSubtitle: 'One editor for every platform. Auto-resize images, platform-aware character counts, AI-generated alt text. Schedule once, publish everywhere.',
    heroDemo: ComposerPreview,
    stripes: [
      {
        eyebrow: 'Smart formatting',
        title: 'Each platform, formatted right',
        description: 'Social Stats knows IG hates long links, Facebook rewards a strong hook, LinkedIn wants paragraphs. We format your draft per-platform automatically.',
        bullets: [
          'Per-platform character + media-spec preview',
          'Auto-cropping for IG square, Story, Reel, FB landscape',
          'Hashtag research baked in',
          'Link previews validated before publish',
        ],
        demo: ComposerPreview,
      },
      {
        eyebrow: 'Scheduling',
        title: 'Calendar, queue, and recurring',
        description: 'Drag-and-drop calendar for the visual planner; queues for evergreen content; recurring posts for daily fixtures.',
        bullets: [
          'Drag-and-drop content calendar',
          'Queue your evergreen library',
          'Recurring rules ("every Tuesday 9am")',
          'Optimal-time AI ("post 7pm — 2.4× engagement")',
        ],
        demo: AnalyticsPreview,
      },
      {
        eyebrow: 'AI write',
        title: 'AI drafts, you polish',
        description: 'Stuck staring at a blank draft? Hit Cmd+K. Social Stats writes the first version tuned to your brand voice in 3 seconds.',
        bullets: [
          'Generate 3 variants per draft',
          'Tuned to your brand voice (configurable)',
          'Translate posts to 30+ languages',
          'Rewrite for tone (friendly / formal / urgent)',
        ],
        demo: AIChatDemo,
      },
    ],
    capabilities: {
      title: 'Everything in the composer',
      columns: 4,
      items: [
        { icon: PenSquare, title: 'Rich-text editor',   description: 'Bold, links, mentions, emojis.' },
        { icon: Calendar,  title: 'Visual calendar',    description: 'Drag posts to reschedule.' },
        { icon: Repeat,    title: 'Queues + recurring', description: 'Set it and forget it.' },
        { icon: Shield,    title: 'Approval workflow',  description: 'Sign-off before publish.' },
      ],
    },
    quote: {
      quote: 'Drafting once and publishing to 5 platforms used to take an hour. Now it takes 4 minutes.',
      author: 'Meera Iyer', role: 'Head of Marketing, Verve',
      gradient: 'linear-gradient(135deg, #a78bfa, #f472b6)',
    },
    ctaTitle: 'Stop copy-pasting between platforms.',
  },


  // ── 3. Inbox ─────────────────────────────────────────────────────────────
  'inbox': {
    title: 'Unified inbox',
    description: 'DMs, comments, mentions, and reviews from Facebook, Instagram, WhatsApp, YouTube, and Google Business Profile — all in one inbox.',
    eyebrow: 'Inbox',
    heroTitle: 'All conversations, one inbox',
    heroSubtitle: 'Every DM, every comment, every review — sorted, AI-prioritised, replyable. Stop missing customers because you forgot to check Instagram.',
    heroDemo: InboxPreview,
    stripes: [
      {
        eyebrow: 'Triage built in',
        title: 'AI sorts before you arrive',
        description: 'Sentiment analysis, urgency scoring, intent classification — your inbox is sorted by what actually needs you.',
        bullets: [
          'Sentiment color-coding (positive / neutral / negative)',
          'Urgency scoring (complaints float to the top)',
          'Auto-grouping by topic',
          'Spam + bot filter (no manual moderation)',
        ],
        demo: InboxPreview,
      },
      {
        eyebrow: 'AI replies',
        title: '3 reply suggestions, one click',
        description: 'Social Stats drafts three options tuned to your brand voice. Pick one, edit if needed, send. Done in 5 seconds.',
        bullets: [
          'Drafts in your brand voice',
          'Detects question type (price / availability / complaint)',
          'Multilingual: replies in the customer\'s language',
          '24-hour window awareness for WhatsApp',
        ],
        demo: AIChatDemo,
      },
      {
        eyebrow: 'Team handoff',
        title: 'Assign + tag + escalate',
        description: 'Multi-agent inbox with assignment, internal notes, and one-click escalation to a manager.',
        bullets: [
          'Assign to teammate, see live presence',
          'Internal notes (visible to team only)',
          'Escalation rules (negative sentiment → manager)',
          'Audit trail of who replied what, when',
        ],
        demo: AutomationsPreview,
      },
    ],
    capabilities: {
      title: 'Inbox capabilities',
      columns: 4,
      items: [
        { icon: MessageCircle, title: 'WhatsApp',         description: 'Two-way + 24h window awareness.' },
        { icon: Bell,          title: 'IG / FB DMs',      description: 'Comments + mentions + DMs unified.' },
        { icon: Star,          title: 'GMB reviews',      description: 'AI-suggested replies in 5 sec.' },
        { icon: MessageSquare, title: 'YouTube comments', description: 'Reply, hide, pin from one place.' },
      ],
    },
    quote: {
      quote: 'Patient response time dropped from 4 hours to 4 minutes. Game changer.',
      author: 'Dr. Anjali Verma', role: 'Founder, Sunrise Clinics',
      gradient: 'linear-gradient(135deg, #34d399, #00CCF5)',
    },
  },


  // ── 4. WhatsApp ──────────────────────────────────────────────────────────
  'whatsapp': {
    title: 'WhatsApp Business at agency scale',
    description: 'Templates, broadcast campaigns, two-way chat, opt-in compliance — everything you need to run WhatsApp Business across 100+ clients via Pinbot.',
    eyebrow: 'WhatsApp',
    heroTitle: 'WhatsApp Business at agency scale',
    heroSubtitle: 'Run broadcasts, manage templates, handle two-way chat — across every client in your agency. Compliance built in.',
    heroDemo: InboxPreview,
    stripes: [
      {
        eyebrow: 'Templates',
        title: 'Submit, track, and reuse',
        description: 'Submit templates to Meta from Social Stats. Track approval status. Build campaigns the moment your template is approved.',
        bullets: [
          'In-app template editor with live preview',
          'Submit + track approval status from Meta',
          'Variables ({{name}}) with default values',
          'Auto-categorisation: marketing / utility / authentication',
        ],
        demo: ComposerPreview,
      },
      {
        eyebrow: 'Campaigns',
        title: 'Broadcast to thousands, sanely',
        description: 'Pick a template, target a segment, schedule the send. Social Stats respects Meta tier limits + WhatsApp quality rating automatically.',
        bullets: [
          'Segment by tags + custom fields',
          'Schedule with Meta tier-aware throttling',
          'Per-message status (sent / delivered / read / replied)',
          'Auto-pause if quality rating drops',
        ],
        demo: AutomationsPreview,
      },
      {
        eyebrow: 'Compliance',
        title: 'Opt-in proof, opt-out detection',
        description: 'Every contact has an opt-in evidence record. Auto-detect "STOP" / "बंद" / "停止" — and 26 other multilingual opt-out keywords.',
        bullets: [
          'Opt-in source + IP + policy version stored',
          'Multilingual opt-out detection (19 languages)',
          'Auto-confirmation reply on opt-out',
          'Marketing-only-to-opted-in enforcement',
        ],
        demo: BotBuilderPreview,
      },
    ],
    capabilities: {
      title: 'Why Pinbot vs direct Meta?',
      subtitle: 'Pinbot is our BSP partner — they own the technical relationship with Meta so you don\'t have to.',
      columns: 3,
      items: [
        { icon: Check, title: 'Faster onboarding', description: 'No Meta App Review for messaging — go live in days.' },
        { icon: Shield, title: 'India-aligned',     description: 'Pinbot is RBI-aware + GST invoiced.' },
        { icon: TrendingUp, title: 'Better tier upgrades', description: 'Pinbot handles tier-bump requests with Meta.' },
      ],
    },
    quote: {
      quote: 'WhatsApp is now our highest-converting channel. The compliance work alone would\'ve taken us 3 months in-house.',
      author: 'Karan Bhatia', role: 'COO, BlueWave',
      gradient: 'linear-gradient(135deg, #25D366, #00CCF5)',
    },
  },


  // ── 5. Bot Builder ───────────────────────────────────────────────────────
  'bot-builder': {
    title: 'CTWA Bot Builder',
    description: 'Visual drag-drop flow editor for click-to-WhatsApp ad funnels. Capture, qualify, and convert leads 24/7.',
    eyebrow: 'Bot Builder',
    heroTitle: 'Build conversational ad funnels in minutes',
    heroSubtitle: 'A drag-drop visual editor for the WhatsApp flows that follow your CTWA ads. 30+ node types, AI takeover, lead-to-CRM in one shot.',
    heroDemo: BotBuilderPreview,
    stripes: [
      {
        eyebrow: 'Visual editor',
        title: 'Drag-and-drop, no code',
        description: 'Compose a flow on a canvas. Connect nodes. Hit publish. The bot is live on every CTWA ad linked to it.',
        bullets: [
          '30+ node types (ask, capture, condition, AI chat, jump-to-flow…)',
          'Drag to connect; right-click to insert',
          'Live test mode — chat with your own bot before publishing',
          'Undo/redo + auto-save every 5 seconds',
        ],
        demo: BotBuilderPreview,
      },
      {
        eyebrow: 'Lead capture',
        title: 'CRM integration in one step',
        description: 'When the flow captures contact details, they land in your Lead pipeline with full attribution.',
        bullets: [
          'Lead row with source ad + campaign + ctwa_clid',
          'Custom fields → free-form data per business',
          'AI quality score (0-100) + auto-tagging',
          'Conversions API push back to Meta for ad optimisation',
        ],
        demo: AutomationsPreview,
      },
      {
        eyebrow: 'Templates gallery',
        title: 'Start from a battle-tested template',
        description: 'Eight industry templates ready to clone — real estate lead capture, healthcare appointment booking, restaurant reservation, and more.',
        bullets: [
          'Real Estate lead-capture flow',
          'Healthcare appointment-booking flow',
          'Restaurant reservation flow',
          'E-commerce product-inquiry flow',
        ],
        demo: BotBuilderPreview,
      },
    ],
    capabilities: {
      title: 'Bot Builder capabilities',
      columns: 4,
      items: [
        { icon: Workflow,  title: 'Visual canvas',     description: 'Drag-drop with auto-layout.' },
        { icon: Bot,       title: 'AI chat node',      description: 'Hand the conversation to Social Stats.' },
        { icon: GitBranch, title: 'Conditional branches', description: 'IF/ELSE on any variable.' },
        { icon: Sparkles,  title: 'Generate with AI',  description: 'Describe a flow, get a draft.' },
      ],
    },
    quote: {
      quote: 'Built our first lead-capture flow in 12 minutes. Captured 47 qualified leads the same week.',
      author: 'Priya Sharma', role: 'Marketing Director, Acme Realty',
      gradient: 'linear-gradient(135deg, #f472b6, #a78bfa)',
    },
  },


  // ── 6. AI Studio ─────────────────────────────────────────────────────────
  'ai': {
    title: 'Social Stats Studio',
    description: 'AI-powered content generation, brand voice, replies, insights, forecasting — across every Social Stats module.',
    eyebrow: 'AI Studio',
    heroTitle: 'AI features powered by Social Stats',
    heroSubtitle: 'Social Stats isn\'t an "AI feature". It\'s an AI-native product. Social Stats shows up wherever you\'re stuck — composer, inbox, reports, bot builder, analytics.',
    heroDemo: AIChatDemo,
    stripes: [
      {
        eyebrow: 'Brand voice',
        title: 'Tuned to YOUR business',
        description: 'Train a brand voice once with 5 sample posts. Social Stats uses it for every AI generation thereafter.',
        bullets: [
          'Train with 5-10 sample posts (3 minutes)',
          'Per-client brand voice (agencies)',
          'Voice + tone + emoji-usage + length preferences',
          'Override per-feature when needed',
        ],
        demo: AIChatDemo,
      },
      {
        eyebrow: 'Generations',
        title: 'Posts, replies, reports — written for you',
        description: 'AI write everywhere: composer captions, inbox replies, monthly reports, bot personas.',
        bullets: [
          'Compose: 3 caption variants per draft',
          'Inbox: 3 reply suggestions per message',
          'Reports: AI-narrated PDF summary',
          'Bot Builder: persona-builder wizard',
        ],
        demo: ComposerPreview,
      },
      {
        eyebrow: 'Insights + forecasting',
        title: 'Predictions you can act on',
        description: 'Social Stats watches your metrics + content and surfaces what\'s working, what\'s slipping, and what to do next.',
        bullets: [
          'Engagement-drop alerts with hypotheses',
          'Forecast next-30-day reach',
          'Optimal-time predictions per platform',
          'PR-crisis early-warning (sentiment trends)',
        ],
        demo: AIInsightPreview,
      },
    ],
    capabilities: {
      title: 'Cost-transparent. Privacy-respectful.',
      subtitle: 'Per-call cost shown in usage dashboard. We do not train on your prompts or content.',
      columns: 3,
      items: [
        { icon: Shield,    title: 'No training on your data',  description: 'Confirmed by our underlying AI provider\'s API terms — see our Privacy Policy for vendor disclosure.' },
        { icon: TrendingUp,title: 'Per-feature cost tracking', description: 'See spend per AI feature, per client.' },
        { icon: Sparkles,  title: 'Daily $ budget caps',       description: 'Set a cap per plan; nothing surprises you.' },
      ],
    },
    quote: {
      quote: 'The AI assistant feels like having an extra teammate who never sleeps.',
      author: 'Aditya Rao', role: 'Founder, Halcyon',
      gradient: 'linear-gradient(135deg, #00CCF5, #8b5cf6)',
    },
  },


  // ── 7. AI Assistant ──────────────────────────────────────────────────────
  'ai-assistant': {
    title: 'Social Stats Assistant',
    description: 'Press Cmd+J anywhere. Talk to your marketing data. Social Stats with tool use — creates posts, schedules, generates reports.',
    eyebrow: 'AI Assistant',
    heroTitle: 'Talk to your marketing data',
    heroSubtitle: 'Press Cmd+J anywhere in Social Stats. Ask questions, request actions, get reports. Social Stats has tool use — it actually clicks the buttons for you.',
    heroDemo: AIChatDemo,
    stripes: [
      {
        eyebrow: 'Tool use',
        title: 'Social Stats with hands',
        description: 'Social Stats doesn\'t just answer — it does. "Schedule 3 Diwali posts for Acme Realty" → it drafts the posts, schedules them, and shows you the calendar.',
        bullets: [
          'Compose + schedule posts',
          'Run analytics queries on your behalf',
          'Generate + email PDF reports',
          'Triage inbox + draft replies in your queue',
        ],
        demo: AIChatDemo,
      },
      {
        eyebrow: 'Cmd+J anywhere',
        title: 'One shortcut, every screen',
        description: 'On the dashboard, in the composer, inside a bot flow — Cmd+J brings Social Stats with the right context.',
        bullets: [
          'Knows what page you\'re on',
          'Knows which client you\'re viewing',
          'Knows which workspace you\'re in',
          'Conversation history per workspace',
        ],
        demo: AIAssistantPreview,
      },
    ],
    capabilities: {
      title: 'Safe by design',
      subtitle: 'Tenant-scoped. Audit-logged. No training on your data.',
      columns: 3,
      items: [
        { icon: Shield, title: 'Tenant scope',  description: 'Social Stats only sees the workspace you\'re in.' },
        { icon: Zap,    title: 'Confirms before action', description: 'Destructive actions need your OK.' },
        { icon: Check,  title: 'Audit log',    description: 'Every tool call recorded for compliance.' },
      ],
    },
    quote: {
      quote: 'I asked it to "tell me which posts I should boost this week" and it ran the analysis, picked the top 3, and queued the boosts.',
      author: 'Vikram Joshi', role: 'Founder, Ember',
      gradient: 'linear-gradient(135deg, #8b5cf6, #00CCF5)',
    },
  },


  // ── 8. Reports ───────────────────────────────────────────────────────────
  'reports': {
    title: 'Reports that write themselves',
    description: 'Auto-generated PDF reports with AI narration, scheduled delivery, white-label branding for agencies.',
    eyebrow: 'Reports',
    heroTitle: 'Reports that write themselves',
    heroSubtitle: 'Schedule a monthly report once. Social Stats pulls the data, AI writes the narrative, white-labels the PDF, and emails your client. You read the PDF on Sunday morning.',
    heroDemo: ReportsPreview,
    stripes: [
      {
        eyebrow: 'AI-narrated',
        title: 'Numbers + the story behind them',
        description: 'Stop sending clients raw screenshots. Social Stats writes the narrative — what worked, why, and what to do next month.',
        bullets: [
          'AI summary section per platform',
          'Top-post + best-time-to-post highlights',
          'Audience-growth + sentiment trend analysis',
          'Comparison to last period + YoY',
        ],
        demo: ReportsPreview,
      },
      {
        eyebrow: 'White-label',
        title: 'Looks like your agency built it',
        description: 'Upload your agency logo + colors once. Every report ships with your brand front and center.',
        bullets: [
          'Logo + accent color per client',
          'Custom cover page',
          'Per-section visibility toggles',
          'Direct PDF download or shareable URL',
        ],
        demo: ReportsPreview,
      },
      {
        eyebrow: 'Scheduling',
        title: 'Set it once, ship monthly',
        description: 'Configure recipients, frequency, and start date. Done. Social Stats emails the report on the 1st of every month.',
        bullets: [
          'Weekly, monthly, quarterly, or custom',
          'Multiple recipients per report',
          'Slack channel delivery (alongside email)',
          'Watermark + read-tracking on shared URLs',
        ],
        demo: AutomationsPreview,
      },
    ],
    capabilities: {
      title: 'What\'s in every report',
      columns: 4,
      items: [
        { icon: TrendingUp, title: 'Reach + engagement', description: 'Cross-platform totals + per-platform breakdown.' },
        { icon: Star,       title: 'Top posts',          description: 'Top 5 by reach, by engagement, by conversions.' },
        { icon: Users,      title: 'Audience growth',    description: 'Followers gained / lost across the period.' },
        { icon: BarChart3,  title: 'AI commentary',      description: 'What worked, why, what to do next.' },
      ],
    },
    quote: {
      quote: 'Reports that used to take a junior 4 hours now write themselves.',
      author: 'Ravi Krishnan', role: 'Director, Apex Agency',
      gradient: 'linear-gradient(135deg, #a78bfa, #f472b6)',
    },
  },


  // ── 9. Automations ───────────────────────────────────────────────────────
  'automations': {
    title: 'Automation engine',
    description: 'IF this happens, do that. Triggers from keywords, sentiment, intent, mentions, milestones. Actions: notify, reply, assign, tag, webhook.',
    eyebrow: 'Automations',
    heroTitle: 'If this happens, do that',
    heroSubtitle: 'Build IF-THEN rules without code. Triggers fire on real events: a 5-star review, a negative comment, a campaign milestone. Actions: notify, reply, assign, tag, webhook.',
    heroDemo: AutomationsPreview,
    stripes: [
      {
        eyebrow: 'Triggers',
        title: 'Watch for what matters',
        description: 'Trigger on inbox events, analytics thresholds, calendar milestones, AI-detected sentiment, or any custom webhook.',
        bullets: [
          'Inbox: keyword / sentiment / intent / volume',
          'Analytics: engagement-drop / reach-spike / follower-milestone',
          'Schedule: time / day-of-week / date',
          'Custom: any external webhook fires the rule',
        ],
        demo: AutomationsPreview,
      },
      {
        eyebrow: 'Actions',
        title: 'Do the right thing automatically',
        description: '12+ action types — Slack notifications, auto-replies, lead-creation, assignment, tagging, escalation, even outbound webhooks.',
        bullets: [
          'Slack / email / WhatsApp notifications',
          'Auto-reply with brand-voice template',
          'Assign to teammate + set priority',
          'Tag contact + create lead in CRM',
        ],
        demo: AutomationsPreview,
      },
      {
        eyebrow: 'Real examples',
        title: 'Common rules our customers use',
        description: 'No need to start from scratch — pick from the gallery and customise.',
        bullets: [
          '5-star review → auto-thank in 2 minutes',
          'Negative comment → escalate to manager Slack',
          'Mentions us with "broken" → ticket in Linear',
          'CTWA lead → push to Salesforce + assign rep',
        ],
        demo: BotBuilderPreview,
      },
    ],
    capabilities: {
      title: 'AI-powered triggers',
      subtitle: 'Beyond keyword matching — AI classifies intent, sentiment, urgency.',
      columns: 3,
      items: [
        { icon: Bot,  title: 'Sentiment detection', description: 'Negative comments fire the urgent-escalation rule.' },
        { icon: Tag,  title: 'Intent classification', description: 'Routes price questions vs complaints differently.' },
        { icon: Bell, title: 'Anomaly detection',     description: 'Auto-fires when something looks off.' },
      ],
    },
    quote: {
      quote: 'Every 5-star review now gets a thank-you reply within 2 minutes. Customers love it.',
      author: 'Aisha Khan', role: 'Marketing Manager, Lumen',
      gradient: 'linear-gradient(135deg, #fbbf24, #00CCF5)',
    },
  },


  // ── 10. Marketplace ──────────────────────────────────────────────────────
  'marketplace-product': {
    title: 'Two-sided marketplace',
    description: 'Built-in agency-client marketplace. End users find vetted agencies; agencies get discovered. Granular permissions + approvals.',
    eyebrow: 'Marketplace',
    heroTitle: 'Two-sided marketplace built in',
    heroSubtitle: 'End users browse + invite agencies. Agencies get a public profile + inbound leads. Granular permissions + approvals + activity transparency built in.',
    heroDemo: AIInsightPreview,
    stripes: [
      {
        eyebrow: 'For end users',
        title: 'Find an agency that fits',
        description: 'Browse 200+ verified agencies, filtered by industry, budget, language. Compare profiles. Invite the right one.',
        bullets: [
          'Industry + budget + city filters',
          'Verified agencies (GST + work history)',
          'Reviews + ratings from real clients',
          'One-click invite — agency joins in minutes',
        ],
        demo: AIInsightPreview,
      },
      {
        eyebrow: 'For agencies',
        title: 'Get found by the right clients',
        description: 'Build a public profile that ranks in Google. Showcase case studies, services, pricing. Get inbound leads.',
        bullets: [
          'SEO-optimised public profile (/agencies/your-slug)',
          'Case-study showcase',
          'Service tags + starting prices',
          'Lead inquiries route to your inbox',
        ],
        demo: ReportsPreview,
      },
      {
        eyebrow: 'Granular permissions',
        title: 'You stay in control',
        description: 'Per-action permissions: agency can post but not delete; can reply but not change passwords; can see analytics but not billing.',
        bullets: [
          '12 permission categories',
          'Approval-required option for sensitive actions',
          'Pause / resume / terminate the relationship anytime',
          'Full activity audit trail (every action logged)',
        ],
        demo: AutomationsPreview,
      },
    ],
    capabilities: {
      title: 'Two sides, one marketplace',
      columns: 3,
      items: [
        { icon: Users,    title: 'Verified agencies',  description: 'GST-verified, work-sample-reviewed.' },
        { icon: Star,     title: 'Reviews + ratings',  description: 'Honest reviews from real clients.' },
        { icon: Shield,   title: 'Permission matrix',  description: '12 categories of granular access.' },
      ],
    },
    quote: {
      quote: 'We onboarded 23 new clients in 3 months without hiring. Most came via the marketplace.',
      author: 'Rohit Mehta', role: 'CEO, BlueWave Agency',
      gradient: 'linear-gradient(135deg, #00CCF5, #34d399)',
    },
  },

};


// Lookup helper used by ProductPage.jsx
export function getProductPage(slug) {
  return productPages[slug] || null;
}
