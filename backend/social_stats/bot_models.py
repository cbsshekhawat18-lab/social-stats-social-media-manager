# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
CTWA Bot Builder — of the bot/lead funnel build.

These models live in their own module for readability and are imported into
models.py so Django auto-discovers them under the social_stats app label.

Concepts:
    BotFlow              — a complete chatbot conversation flow with nodes/edges
    BotConversation      — a contact's session through a flow
    BotConversationStep  — audit trail of each step in a conversation
    Lead                 — captured lead (denormalised + custom_fields)
    LeadActivity         — note/call/status-change timeline against a lead
    BotFlowTemplate      — pre-built industry flows (cloned into BotFlow)
    CTWACampaign         — links a BotFlow to specific Meta CTWA ads + tracks ROI

The flow's nodes/edges live in JSONField (no separate Node/Edge tables) so
the visual editor can save the graph atomically and the engine can read it
without joins. NODE_TYPES below is the canonical catalog; new types are
added by registering a handler under bot_engine/handlers/.
"""
from __future__ import annotations

from django.contrib.auth.models import User
from django.db import models


# ─────────────────────────────────────────────────────────────────────────────
# Node-type catalog
# ─────────────────────────────────────────────────────────────────────────────
# Used by:
#   - editor (left palette + inspector form selection)
#   - engine (handler dispatch via NODE_HANDLERS table in bot_engine/handlers)
#   - flow validator (pre-publish check + content moderation pass)
NODE_TYPES = {
    # Send
    'message_text':     'Send Text Message',
    'message_image':    'Send Image',
    'message_video':    'Send Video',
    'message_document': 'Send Document',
    'message_template': 'Send Approved Template',
    'message_buttons':  'Send Buttons (Quick Reply)',
    'message_list':     'Send List Picker',
    'message_cta':      'Send CTA URL Button',
    # Ask
    'ask_question':   'Ask Question + Wait for Reply',
    'ask_email':      'Ask for Email (validated)',
    'ask_phone':      'Ask for Phone (validated)',
    'ask_number':     'Ask for Number',
    'ask_location':   'Ask for Location Share',
    'ask_attachment': 'Ask for Image/Document Upload',
    # Logic
    'condition':     'If/Else Branch',
    'random_split':  'Random Split (A/B test)',
    'jump_to_flow':  'Jump to Another Flow',
    'wait_delay':    'Wait Delay (e.g., 2 minutes)',
    'set_variable':  'Set Variable',
    # Actions
    'tag_contact':    'Add Tag to Contact',
    'assign_segment': 'Add to List',
    'capture_lead':   'Save Lead to Database',
    'webhook':        'Call External Webhook',
    'send_email':     'Send Email Notification (to agency)',
    'crm_push':       'Push Lead to CRM',
    'rate_limit':     'Rate Limit (anti-spam)',
    # Smart
    'ai_chat':        'AI Conversation (Claude)',
    'human_handoff':  'Hand Off to Human Agent',
    # Flow control
    'start':            'Start (entry point, only one per flow)',
    'end_conversation': 'End Conversation',
}


# ─────────────────────────────────────────────────────────────────────────────
# BotFlow — a complete bot conversation flow
# ─────────────────────────────────────────────────────────────────────────────
class BotFlow(models.Model):
    TRIGGER_CHOICES = [
        ('ctwa_ad',        'Click-to-WhatsApp Ad'),
        ('keyword',        'Keyword in Message'),
        ('first_message',  'First Message Ever'),
        ('button_reply',   'Button/List Reply'),
        ('referral_link',  'WhatsApp Link Referral'),
        ('manual',         'Manually Triggered'),
    ]

    client      = models.ForeignKey('social_stats.Client', on_delete=models.CASCADE, related_name='bot_flows')
    name        = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    # Trigger
    trigger_type   = models.CharField(max_length=30, choices=TRIGGER_CHOICES, default='ctwa_ad')
    trigger_config = models.JSONField(default=dict, blank=True)
    # Per trigger type:
    #   ctwa_ad:       {ad_account_id, campaign_ids: [], adset_ids: [], ad_ids: []}
    #   keyword:       {keywords: [...], match_type: 'exact|contains|regex', case_sensitive: false}
    #   referral_link: {referral_codes: ['LP_REAL_ESTATE_2024']}
    #   button_reply:  {button_payloads: [...]}

    # Visual flow definition — single source of truth for the editor + engine
    nodes = models.JSONField(default=list, blank=True)
    # [{id, type, position: {x, y}, data: {...}}, ...]
    edges = models.JSONField(default=list, blank=True)
    # [{id, source: nodeId, target: nodeId, sourceHandle?, targetHandle?, label?, condition?}, ...]
    starting_node_id = models.CharField(max_length=50, blank=True)

    # Settings
    is_active   = models.BooleanField(default=False)
    is_template = models.BooleanField(default=False)

    # Lifecycle / versioning
    version            = models.IntegerField(default=1)
    published_version  = models.IntegerField(null=True, blank=True)
    last_published_at  = models.DateTimeField(null=True, blank=True)

    # Stats (denormalized; updated by engine + analytics jobs)
    total_triggered      = models.IntegerField(default=0)
    total_completed      = models.IntegerField(default=0)
    total_leads_captured = models.IntegerField(default=0)

    # Behavior
    business_hours_only  = models.BooleanField(default=False)
    business_hours       = models.JSONField(default=dict, blank=True)
    # {"monday": {"start": "09:00", "end": "18:00"}, ..., "timezone": "Asia/Kolkata"}
    out_of_hours_message = models.TextField(blank=True)

    # AI fallback — when user input doesn't match any branch, AI takes over
    ai_fallback_enabled = models.BooleanField(default=False)
    ai_fallback_persona = models.TextField(blank=True)

    # Audit
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'social_stats'
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['client', 'is_active']),
            models.Index(fields=['client', 'trigger_type', 'is_active']),
            models.Index(fields=['is_template']),
        ]

    def __str__(self):
        return f'BotFlow<{self.name} client#{self.client_id} v{self.version}{" active" if self.is_active else ""}>'


# ─────────────────────────────────────────────────────────────────────────────
# BotConversation — a contact's session through a flow
# ─────────────────────────────────────────────────────────────────────────────
class BotConversation(models.Model):
    STATUS_CHOICES = [
        ('active',     'Active'),
        ('completed',  'Completed Successfully'),
        ('abandoned',  'User Stopped Replying'),
        ('handed_off', 'Handed Off to Human'),
        ('failed',     'Bot Errored'),
        ('exited',     'User Exited Flow'),
    ]

    client  = models.ForeignKey('social_stats.Client', on_delete=models.CASCADE, related_name='bot_conversations')
    flow    = models.ForeignKey(BotFlow, on_delete=models.SET_NULL, null=True, blank=True, related_name='conversations')
    contact = models.ForeignKey('social_stats.WhatsAppContact', on_delete=models.CASCADE, related_name='bot_conversations')

    # Tracking
    triggered_via    = models.CharField(max_length=50)
    trigger_metadata = models.JSONField(default=dict, blank=True)
    # CTWA: {ad_id, ad_name, campaign_id, campaign_name, adset_id, adset_name, ctwa_clid}

    current_node_id = models.CharField(max_length=50, blank=True)
    variables       = models.JSONField(default=dict, blank=True)
    path_history    = models.JSONField(default=list, blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')

    started_at        = models.DateTimeField(auto_now_add=True)
    last_activity_at  = models.DateTimeField(auto_now=True)
    ended_at          = models.DateTimeField(null=True, blank=True)

    # Lead outcome
    lead_captured = models.BooleanField(default=False)
    lead = models.ForeignKey('social_stats.Lead', on_delete=models.SET_NULL, null=True, blank=True, related_name='+')

    # AI / handoff
    handed_off_to_user  = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    handed_off_at       = models.DateTimeField(null=True, blank=True)
    ai_takeover_active  = models.BooleanField(default=False)

    user_messages_count = models.IntegerField(default=0)        # incremented per inbound user msg
    spam_score          = models.IntegerField(default=0)        # bumped by safety heuristics
    flagged_as_spam     = models.BooleanField(default=False)

    class Meta:
        app_label = 'social_stats'
        indexes = [
            models.Index(fields=['client', '-started_at']),
            models.Index(fields=['flow', 'status']),
            models.Index(fields=['contact', '-last_activity_at']),
            models.Index(fields=['client', 'contact', 'status']),
        ]

    def __str__(self):
        return f'BotConversation<#{self.id} flow={self.flow_id} contact={self.contact_id} {self.status}>'


# ─────────────────────────────────────────────────────────────────────────────
# BotConversationStep — audit trail of each step
# ─────────────────────────────────────────────────────────────────────────────
class BotConversationStep(models.Model):
    DIRECTION_CHOICES = [
        ('bot_to_user', 'Bot → User'),
        ('user_to_bot', 'User → Bot'),
        ('system',      'System'),  # set_variable / tag_contact / etc.
    ]

    conversation = models.ForeignKey(BotConversation, on_delete=models.CASCADE, related_name='steps')
    client       = models.ForeignKey(
        'social_stats.Client',
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='bot_conversation_steps',
    )
    node_id      = models.CharField(max_length=50)
    node_type    = models.CharField(max_length=30)
    direction    = models.CharField(max_length=12, choices=DIRECTION_CHOICES)
    payload      = models.JSONField(default=dict, blank=True)
    duration_ms  = models.IntegerField(null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'social_stats'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['conversation', 'created_at']),
            models.Index(fields=['node_type']),
            models.Index(fields=['client', '-created_at']),
        ]

    def __str__(self):
        return f'BotStep<conv={self.conversation_id} node={self.node_id} {self.direction}>'


# ─────────────────────────────────────────────────────────────────────────────
# Lead — captured lead from a flow
# ─────────────────────────────────────────────────────────────────────────────
class Lead(models.Model):
    STATUS_CHOICES = [
        ('new',       'New'),
        ('contacted', 'Contacted'),
        ('qualified', 'Qualified'),
        ('converted', 'Converted'),
        ('lost',      'Lost'),
        ('spam',      'Spam'),
    ]

    client  = models.ForeignKey('social_stats.Client', on_delete=models.CASCADE, related_name='leads')
    contact = models.ForeignKey('social_stats.WhatsAppContact', on_delete=models.CASCADE, related_name='leads')

    source_flow         = models.ForeignKey(BotFlow, on_delete=models.SET_NULL, null=True, blank=True, related_name='leads')
    source_conversation = models.ForeignKey(BotConversation, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')

    source_post = models.ForeignKey(
        'social_stats.UnifiedPost',
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name='leads',
        help_text='Set when a Lead originated from a reply/comment on an organic post.',
    )
    source_whatsapp_campaign = models.ForeignKey(
        'social_stats.WhatsAppCampaign',
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name='leads',
        help_text='Set when a Lead came in through a WhatsApp broadcast campaign.',
    )

    # Captured fields (denormalised for fast filter/sort; full payload in custom_fields)
    name     = models.CharField(max_length=200, blank=True)
    phone    = models.CharField(max_length=30)
    email    = models.EmailField(blank=True)
    interest = models.CharField(max_length=200, blank=True)
    budget   = models.CharField(max_length=100, blank=True)
    location = models.CharField(max_length=200, blank=True)
    custom_fields = models.JSONField(default=dict, blank=True)

    # Source tracking (CTWA UTMs)
    source_channel       = models.CharField(max_length=50, default='whatsapp')
    source_ad_id         = models.CharField(max_length=100, blank=True)
    source_ad_name       = models.CharField(max_length=200, blank=True)
    source_campaign_id   = models.CharField(max_length=100, blank=True)
    source_campaign_name = models.CharField(max_length=200, blank=True)
    source_adset_id      = models.CharField(max_length=100, blank=True)

    # Pipeline
    status         = models.CharField(max_length=20, choices=STATUS_CHOICES, default='new')
    quality_score  = models.IntegerField(default=50)        # AI-scored 0-100
    quality_reason = models.TextField(blank=True)
    assigned_to    = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_leads')
    tags           = models.JSONField(default=list, blank=True)
    notes          = models.TextField(blank=True)

    # Conversion
    converted_at     = models.DateTimeField(null=True, blank=True)
    conversion_value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    capi_pushed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'social_stats'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['client', '-created_at']),
            models.Index(fields=['client', 'status']),
            models.Index(fields=['source_campaign_id']),
            models.Index(fields=['assigned_to', 'status']),
        ]

    def __str__(self):
        return f'Lead<{self.name or self.phone} client#{self.client_id} {self.status}>'


# ─────────────────────────────────────────────────────────────────────────────
# LeadActivity — note / call / status-change timeline
# ─────────────────────────────────────────────────────────────────────────────
class LeadActivity(models.Model):
    ACTIVITY_CHOICES = [
        ('note',          'Note'),
        ('call',          'Call Logged'),
        ('email',         'Email Sent'),
        ('whatsapp',      'WhatsApp Message'),
        ('status_change', 'Status Change'),
        ('assignment',    'Assignment'),
        ('tag',           'Tag Added'),
    ]

    lead          = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='activities')
    actor         = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    activity_type = models.CharField(max_length=30, choices=ACTIVITY_CHOICES)
    content       = models.TextField(blank=True)
    metadata      = models.JSONField(default=dict, blank=True)
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'social_stats'
        ordering = ['-created_at']
        indexes = [models.Index(fields=['lead', '-created_at'])]

    def __str__(self):
        return f'LeadActivity<lead#{self.lead_id} {self.activity_type}>'


# ─────────────────────────────────────────────────────────────────────────────
# BotFlowTemplate — pre-built industry flows
# ─────────────────────────────────────────────────────────────────────────────
class BotFlowTemplate(models.Model):
    INDUSTRY_CHOICES = [
        ('real_estate', 'Real Estate'),
        ('healthcare',  'Healthcare'),
        ('restaurant',  'Restaurant'),
        ('fitness',     'Fitness / Gym'),
        ('education',   'Education'),
        ('ecommerce',   'E-commerce'),
        ('professional','Professional Services'),
        ('general',     'General'),
    ]
    USE_CASE_CHOICES = [
        ('lead_capture',         'Lead Capture'),
        ('appointment_booking',  'Appointment Booking'),
        ('product_inquiry',      'Product Inquiry'),
        ('feedback_collection',  'Feedback Collection'),
        ('support',              'Customer Support Triage'),
        ('lead_magnet',          'Lead Magnet Delivery'),
    ]

    name        = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    industry    = models.CharField(max_length=50, choices=INDUSTRY_CHOICES, default='general')
    use_case    = models.CharField(max_length=50, choices=USE_CASE_CHOICES, default='lead_capture')
    cover_image = models.URLField(blank=True)

    nodes            = models.JSONField(default=list, blank=True)
    edges            = models.JSONField(default=list, blank=True)
    starting_node_id = models.CharField(max_length=50, blank=True)

    is_featured = models.BooleanField(default=False)
    use_count   = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'social_stats'
        ordering = ['-is_featured', '-use_count', '-created_at']
        indexes = [
            models.Index(fields=['industry', 'use_case']),
            models.Index(fields=['is_featured', '-use_count']),
        ]

    def __str__(self):
        return f'BotFlowTemplate<{self.name} {self.industry}/{self.use_case}>'


# ─────────────────────────────────────────────────────────────────────────────
# CTWACampaign — links a BotFlow to specific Meta CTWA ads
# ─────────────────────────────────────────────────────────────────────────────
class CTWACampaign(models.Model):
    client = models.ForeignKey('social_stats.Client', on_delete=models.CASCADE, related_name='ctwa_campaigns')
    flow   = models.ForeignKey(BotFlow, on_delete=models.CASCADE, related_name='ctwa_campaigns')
    name   = models.CharField(max_length=200)

    # Meta ad info
    ad_account_id     = models.CharField(max_length=100)
    campaign_id       = models.CharField(max_length=100)
    campaign_name     = models.CharField(max_length=200, blank=True)
    adset_ids         = models.JSONField(default=list, blank=True)
    ad_ids            = models.JSONField(default=list, blank=True)
    pre_filled_message = models.CharField(max_length=200, default='Hello')

    # Tracking
    is_active            = models.BooleanField(default=True)
    total_clicks         = models.IntegerField(default=0)
    total_conversations  = models.IntegerField(default=0)
    total_leads          = models.IntegerField(default=0)
    total_spent          = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    last_synced_at = models.DateTimeField(null=True, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'social_stats'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['client', 'is_active']),
            models.Index(fields=['campaign_id']),
        ]

    def __str__(self):
        return f'CTWACampaign<{self.name} client#{self.client_id} flow#{self.flow_id}>'
