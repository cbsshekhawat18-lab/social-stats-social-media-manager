/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * Mirror of backend `NODE_TYPES` (social_stats/bot_models.py) — kept in sync
 * by hand. The catalog drives the left palette, the right inspector form
 * dispatch, and the canvas renderer's icon/color/shape per type.
 *
 * Each entry:
 *   key       — node.type (must match backend handler key)
 *   label     — short name shown in palette + inspector header
 *   icon      — Lucide icon component
 *   category  — palette section grouping
 *   color     — accent color (CSS variable name, with fallback)
 *   waits     — true if the engine halts on this node (ask_*, message_buttons, message_list, ai_chat, wait_delay)
 *   terminal  — true if the node ends the flow (end_conversation, human_handoff, jump_to_flow)
 *   defaultData — initial payload when dropped onto the canvas
 */
import {
  PlayCircle, MessageSquare, Image as ImageIcon, Video, FileText, Send,
  ListChecks, ExternalLink, Sparkles,
  HelpCircle, Mail, Phone, Hash, MapPin, Paperclip,
  GitBranch, Shuffle, Variable, ArrowRightCircle, Clock,
  Tag, UserCheck, Globe, AtSign, Database,
  Bot, UserPlus, FlagTriangleRight, ListPlus, Share2, ScanText, Split,
} from 'lucide-react';

export const NODE_CATALOG = {
  // ── Flow control ──────────────────────────────────────
  start: {
    label: 'Start', icon: PlayCircle, category: 'Flow', color: 'var(--success)',
    defaultData: {},
    waits: false, terminal: false,
  },
  end_conversation: {
    label: 'End', icon: FlagTriangleRight, category: 'Flow', color: 'var(--text-tertiary)',
    defaultData: { text: '' },
    waits: false, terminal: true,
  },

  // ── Send ──────────────────────────────────────────────
  message_text: {
    label: 'Send Text', icon: MessageSquare, category: 'Send', color: '#3b82f6',
    defaultData: { text: 'Hello {{contact.name|default:"there"}}!' },
    waits: false, terminal: false,
  },
  message_image: {
    label: 'Send Image', icon: ImageIcon, category: 'Send', color: '#3b82f6',
    defaultData: { url: '', caption: '' },
    waits: false, terminal: false,
  },
  message_video: {
    label: 'Send Video', icon: Video, category: 'Send', color: '#3b82f6',
    defaultData: { url: '', caption: '' },
    waits: false, terminal: false,
  },
  message_document: {
    label: 'Send Document', icon: FileText, category: 'Send', color: '#3b82f6',
    defaultData: { url: '', caption: '', filename: '' },
    waits: false, terminal: false,
  },
  message_template: {
    label: 'Send Template', icon: Send, category: 'Send', color: '#3b82f6',
    defaultData: { template_name: '', language: 'en_US', components: [] },
    waits: false, terminal: false,
  },
  message_buttons: {
    label: 'Buttons', icon: ListChecks, category: 'Send', color: '#3b82f6',
    defaultData: {
      body: 'Pick an option',
      buttons: [{ id: 'OPT_A', title: 'Option A' }, { id: 'OPT_B', title: 'Option B' }],
      store_var: 'choice',
    },
    waits: true, terminal: false,
  },
  message_list: {
    label: 'List Picker', icon: ListChecks, category: 'Send', color: '#3b82f6',
    defaultData: {
      body: 'Pick from the list',
      button_label: 'Choose',
      sections: [{ title: 'Options', rows: [{ id: 'r1', title: 'Row 1' }] }],
      store_var: 'choice',
    },
    waits: true, terminal: false,
  },
  message_cta: {
    label: 'CTA URL', icon: ExternalLink, category: 'Send', color: '#3b82f6',
    defaultData: { body: 'Visit our site', url: 'https://', button_text: 'Open' },
    waits: false, terminal: false,
  },

  // ── Ask ──────────────────────────────────────────────
  ask_question: {
    label: 'Ask Question', icon: HelpCircle, category: 'Ask', color: '#8b5cf6',
    defaultData: { question: 'What is your name?', store_var: 'name' },
    waits: true, terminal: false,
  },
  ask_email: {
    label: 'Ask Email', icon: Mail, category: 'Ask', color: '#8b5cf6',
    defaultData: { question: 'Please share your email', store_var: 'email' },
    waits: true, terminal: false,
  },
  ask_phone: {
    label: 'Ask Phone', icon: Phone, category: 'Ask', color: '#8b5cf6',
    defaultData: { question: 'Please share your phone', store_var: 'phone' },
    waits: true, terminal: false,
  },
  ask_number: {
    label: 'Ask Number', icon: Hash, category: 'Ask', color: '#8b5cf6',
    defaultData: { question: 'Enter an amount', store_var: 'amount' },
    waits: true, terminal: false,
  },
  ask_location: {
    label: 'Ask Location', icon: MapPin, category: 'Ask', color: '#8b5cf6',
    defaultData: { question: 'Please share your location', store_var: 'location' },
    waits: true, terminal: false,
  },
  ask_attachment: {
    label: 'Ask Attachment', icon: Paperclip, category: 'Ask', color: '#8b5cf6',
    defaultData: { question: 'Please upload', store_var: 'attachment' },
    waits: true, terminal: false,
  },

  // ── Logic ─────────────────────────────────────────────
  condition: {
    label: 'If / Else', icon: GitBranch, category: 'Logic', color: '#f59e0b',
    defaultData: { condition: { left: 'budget', op: '>=', right: 5000000 } },
    waits: false, terminal: false,
  },
  random_split: {
    label: 'Random Split', icon: Shuffle, category: 'Logic', color: '#f59e0b',
    defaultData: {},
    waits: false, terminal: false,
  },
  set_variable: {
    label: 'Set Variable', icon: Variable, category: 'Logic', color: '#f59e0b',
    defaultData: { name: '', value: '' },
    waits: false, terminal: false,
  },
  jump_to_flow: {
    label: 'Jump to Flow', icon: ArrowRightCircle, category: 'Logic', color: '#f59e0b',
    defaultData: { target_flow_id: null, carry_variables: true },
    waits: false, terminal: true,
  },
  wait_delay: {
    label: 'Wait', icon: Clock, category: 'Logic', color: '#f59e0b',
    defaultData: { seconds: 0, minutes: 1, hours: 0 },
    waits: true, terminal: false,
  },

  // ── Actions ───────────────────────────────────────────
  tag_contact: {
    label: 'Tag Contact', icon: Tag, category: 'Action', color: '#10b981',
    defaultData: { tags: [], remove: false },
    waits: false, terminal: false,
  },
  capture_lead: {
    label: 'Capture Lead', icon: UserCheck, category: 'Action', color: '#10b981',
    defaultData: { tags: [] },
    waits: false, terminal: false,
  },
  webhook: {
    label: 'Webhook', icon: Globe, category: 'Action', color: '#10b981',
    defaultData: { url: 'https://', method: 'POST', include_variables: true },
    waits: false, terminal: false,
  },
  send_email: {
    label: 'Send Email', icon: AtSign, category: 'Action', color: '#10b981',
    defaultData: { to: '', subject: 'New lead', body: '' },
    waits: false, terminal: false,
  },
  assign_segment: {
    label: 'Add to List', icon: ListPlus, category: 'Action', color: '#10b981',
    defaultData: { list_name: '', create_if_missing: true, remove: false },
    waits: false, terminal: false,
  },
  crm_push: {
    label: 'Push to CRM', icon: Share2, category: 'Action', color: '#10b981',
    defaultData: {
      url: 'https://', method: 'POST', headers: {},
      field_map: { name: '{{name}}', phone: '{{phone}}', email: '{{email}}' },
      include_source: true,
    },
    waits: false, terminal: false,
  },

  // ── Smart ─────────────────────────────────────────────
  ai_chat: {
    label: 'AI Chat', icon: Bot, category: 'Smart', color: '#ec4899',
    defaultData: {
      persona: 'You are a friendly assistant for our business.',
      opening_message: 'Sure — how can I help?',
      max_turns: 12,
    },
    waits: true, terminal: false,
  },
  ai_extract: {
    label: 'AI Extract', icon: ScanText, category: 'Smart', color: '#ec4899',
    defaultData: {
      fields: [
        { name: 'name', description: "The customer's name", type: 'string', required: true },
        { name: 'budget', description: 'Budget in rupees', type: 'number', required: false },
      ],
    },
    waits: false, terminal: false, namedOutputsOnly: true,
  },
  ai_intent: {
    label: 'AI Intent', icon: Split, category: 'Smart', color: '#ec4899',
    defaultData: {
      intents: [
        { key: 'pricing', description: 'Asks about price, cost or offers' },
        { key: 'support', description: 'Has a problem or complaint' },
      ],
      store_var: 'intent',
    },
    waits: false, terminal: false, namedOutputsOnly: true,
  },
  human_handoff: {
    label: 'Human Handoff', icon: UserPlus, category: 'Smart', color: '#ec4899',
    defaultData: { message: 'Connecting you to a teammate…' },
    waits: false, terminal: true,
  },
};

export const CATEGORIES = ['Flow', 'Send', 'Ask', 'Logic', 'Action', 'Smart'];

// Node types that halt and take the user's next message as their answer.
export const ANSWER_TYPES = [
  'ask_question', 'ask_email', 'ask_phone', 'ask_number', 'ask_location', 'ask_attachment',
  'message_buttons', 'message_list',
];

// Node types that send a free-form WhatsApp message, which Meta only delivers
// within 24 hours of the contact's last message. They accept a fallback template.
export const FREEFORM_TYPES = [
  'message_text', 'message_image', 'message_video', 'message_document',
  'message_buttons', 'message_list', 'message_cta',
  'ask_question', 'ask_email', 'ask_phone', 'ask_number', 'ask_location', 'ask_attachment',
  'ai_chat',
];

// Extra named outputs per node type (besides per-button / per-row handles and
// the plain output). Mirrors the engine's sourceHandle names.
export function extraOutputs(type, data = {}) {
  if (type === 'ai_extract') {
    return [{ id: 'missing', label: 'missing' }, { id: 'complete', label: 'complete' }];
  }
  if (type === 'ai_intent') {
    const keys = (data.intents || []).map((i) => (i.key || '').trim()).filter((k) => k && k !== 'other');
    return [{ id: 'other', label: 'other' }, ...keys.reverse().map((k) => ({ id: k, label: k }))];
  }
  const timeout = Number(data.timeout_minutes) > 0 ? [{ id: 'timeout', label: 'timeout' }] : [];
  if (type === 'message_buttons' || type === 'message_list') {
    return [...timeout, { id: 'no_match', label: 'no match' }, { id: 'invalid', label: 'gave up' }];
  }
  if (type === 'condition') return [{ id: 'no_match', label: 'no match' }];
  if (type.startsWith('ask_')) return [...timeout, { id: 'invalid', label: 'invalid' }];
  if (type === 'webhook' || type === 'crm_push') return [{ id: 'failure', label: 'failure' }];
  return [];
}

export function getNodeMeta(type) {
  return NODE_CATALOG[type] || { label: type, icon: Sparkles, category: 'Flow', color: 'var(--text-tertiary)', defaultData: {} };
}
