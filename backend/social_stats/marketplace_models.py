# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Social Stats marketplace data models — of the two-sided marketplace build.

These live in their own module for readability but belong to the social_stats
app (every model declares app_label='social_stats' explicitly). They are
imported into models.py so Django's autodiscovery picks them up.

Concepts:
    Agency               — agency org with members and a marketplace profile
    AgencyMembership     — which user works at which agency, with role
    AgencyClientRelation — the authorization link: "this agency manages this
                           client workspace, with these granular permissions
                           and these approval-required actions"
    ApprovalRequest      — agency action waiting on end-user sign-off
    ActivityLog          — user-facing audit trail; richer than ActionLog
                           (severity, reversibility, flagging)
    AgencyReview         — marketplace review of an agency by a client
    ManageRequest        — agency invites end-user to be managed
    AgencyInviteFromUser — reverse direction: end-user invites an agency

The granular permission keys agencies can be granted live in
AGENCY_CLIENT_PERMISSIONS (re-exported from this module).
"""
import uuid
from datetime import timedelta

from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone


# ─────────────────────────────────────────────────────────────────────────────
# Granular permissions an agency can be granted on a managed client
# ─────────────────────────────────────────────────────────────────────────────
# Risk levels: low (read), medium (visible-to-audience side effects),
# high (irreversible side effects), critical (money / platform connection).
# Permissions with default=False must be explicitly granted by the user.
AGENCY_CLIENT_PERMISSIONS = {
    # Read
    'view_analytics':      {'label': 'View Analytics',          'category': 'read',       'default': True,  'risk': 'low'},
    'view_posts':          {'label': 'View Posts',              'category': 'read',       'default': True,  'risk': 'low'},
    'view_inbox':          {'label': 'View Inbox',              'category': 'read',       'default': True,  'risk': 'medium'},
    'view_audience':       {'label': 'View Audience Data',      'category': 'read',       'default': True,  'risk': 'low'},
    'export_data':         {'label': 'Export Data',             'category': 'read',       'default': True,  'risk': 'low'},
    'generate_reports':    {'label': 'Generate Reports',        'category': 'read',       'default': True,  'risk': 'low'},
    # Content
    'draft_posts':         {'label': 'Create Draft Posts',      'category': 'content',    'default': True,  'risk': 'low'},
    'publish_posts':       {'label': 'Publish Posts',           'category': 'content',    'default': False, 'risk': 'high'},
    'schedule_posts':      {'label': 'Schedule Posts',          'category': 'content',    'default': True,  'risk': 'medium'},
    'delete_posts':        {'label': 'Delete Posts',            'category': 'content',    'default': False, 'risk': 'high'},
    'edit_published':      {'label': 'Edit Published Posts',    'category': 'content',    'default': False, 'risk': 'medium'},
    # Engagement
    'reply_comments':      {'label': 'Reply to Comments',       'category': 'engagement', 'default': False, 'risk': 'medium'},
    'reply_messages':      {'label': 'Reply to DMs',            'category': 'engagement', 'default': False, 'risk': 'high'},
    'reply_reviews':       {'label': 'Reply to Reviews',        'category': 'engagement', 'default': True,  'risk': 'medium'},
    'delete_comments':     {'label': 'Delete Comments',         'category': 'engagement', 'default': False, 'risk': 'high'},
    'block_users':         {'label': 'Block / Hide Users',      'category': 'engagement', 'default': False, 'risk': 'high'},
    # Campaigns
    'create_campaigns':    {'label': 'Create WhatsApp Campaigns','category': 'campaigns',  'default': False, 'risk': 'medium'},
    'send_campaigns':      {'label': 'Send WhatsApp Campaigns', 'category': 'campaigns',  'default': False, 'risk': 'high'},
    'manage_contacts':     {'label': 'Manage Contacts',         'category': 'campaigns',  'default': False, 'risk': 'medium'},
    # Ads
    'view_ads':            {'label': 'View Ad Performance',     'category': 'ads',        'default': False, 'risk': 'low'},
    'create_ads':          {'label': 'Create Ads',              'category': 'ads',        'default': False, 'risk': 'high'},
    'spend_on_ads':        {'label': 'Spend Ad Budget',         'category': 'ads',        'default': False, 'risk': 'critical'},
    # Bots — (audit decision #7: separate from publish_posts)
    'manage_bots':         {'label': 'Build & Publish Bot Flows','category': 'campaigns',  'default': False, 'risk': 'high'},
    # Settings / AI
    'manage_team':         {'label': 'Manage Team Members',     'category': 'settings',   'default': False, 'risk': 'high'},
    'manage_automation':   {'label': 'Set Up Automations',      'category': 'settings',   'default': False, 'risk': 'medium'},
    'manage_brand_voice':  {'label': 'Train AI Brand Voice',    'category': 'settings',   'default': True,  'risk': 'low'},
    # Critical (cannot be silently granted; UI must call them out separately)
    'disconnect_platforms':{'label': 'Disconnect Platforms',    'category': 'critical',   'default': False, 'risk': 'critical'},
    'change_billing':      {'label': 'Change Billing',          'category': 'critical',   'default': False, 'risk': 'critical'},
}


def default_relation_permissions():
    """JSONField default: {key: bool} from AGENCY_CLIENT_PERMISSIONS defaults."""
    return {k: meta['default'] for k, meta in AGENCY_CLIENT_PERMISSIONS.items()}


def default_invite_expiry():
    return timezone.now() + timedelta(days=7)


def default_approval_expiry():
    return timezone.now() + timedelta(hours=48)


# ─────────────────────────────────────────────────────────────────────────────
# Agency
# ─────────────────────────────────────────────────────────────────────────────
class Agency(models.Model):
    """An agency organization. Owns members and manages clients via relations."""
    PLAN_CHOICES = [
        ('starter',    'Starter'),
        ('growth',     'Growth'),
        ('scale',      'Scale'),
        ('enterprise', 'Enterprise'),
    ]

    name        = models.CharField(max_length=200)
    slug        = models.SlugField(unique=True)
    owner_user  = models.ForeignKey(User, on_delete=models.PROTECT, related_name='owned_agency')
    members     = models.ManyToManyField(
        User,
        through='AgencyMembership',
        through_fields=('agency', 'user'),
        related_name='agencies',
    )

    # Profile
    logo_url           = models.URLField(blank=True)
    description        = models.TextField(blank=True)
    website            = models.URLField(blank=True)
    location_city      = models.CharField(max_length=100, blank=True)
    location_country   = models.CharField(max_length=2,   blank=True)
    industries_served  = models.JSONField(default=list,   blank=True)
    services_offered   = models.JSONField(default=list,   blank=True)
    pricing_starting_at = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    pricing_currency   = models.CharField(max_length=3, default='INR')

    # Verification
    is_verified            = models.BooleanField(default=False)
    verification_documents = models.JSONField(default=dict, blank=True)
    verified_at            = models.DateTimeField(null=True, blank=True)

    # Marketplace
    is_listed_in_marketplace  = models.BooleanField(default=False)
    marketplace_profile_views = models.IntegerField(default=0)
    avg_rating                = models.FloatField(default=0.0)
    review_count              = models.IntegerField(default=0)

    # Stats (denormalized; refreshed by Celery beat)
    active_clients_count   = models.IntegerField(default=0)
    total_clients_managed  = models.IntegerField(default=0)

    # Plan
    plan              = models.CharField(max_length=20, choices=PLAN_CHOICES, default='starter')
    plan_client_limit = models.IntegerField(default=5)

    # Status
    is_active    = models.BooleanField(default=True)
    suspended_at = models.DateTimeField(null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'social_stats'
        verbose_name_plural = 'Agencies'
        indexes = [
            models.Index(fields=['is_listed_in_marketplace', '-avg_rating']),
            models.Index(fields=['is_verified']),
        ]

    def __str__(self):
        return f"Agency<{self.slug}>"


class AgencyMembership(models.Model):
    """User ↔ Agency join with role inside the agency."""
    ROLE_CHOICES = [
        ('owner',   'Owner'),
        ('admin',   'Admin'),
        ('manager', 'Manager'),
        ('member',  'Member'),
    ]

    agency      = models.ForeignKey(Agency, on_delete=models.CASCADE)
    user        = models.ForeignKey(User,   on_delete=models.CASCADE)
    role        = models.CharField(max_length=20, choices=ROLE_CHOICES, default='member')
    invited_by  = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    joined_at   = models.DateTimeField(auto_now_add=True)
    is_active   = models.BooleanField(default=True)

    class Meta:
        app_label = 'social_stats'
        unique_together = ('agency', 'user')
        indexes = [models.Index(fields=['user', 'is_active'])]


# ─────────────────────────────────────────────────────────────────────────────
# AgencyClientRelation — the central authorization link
# ─────────────────────────────────────────────────────────────────────────────
class AgencyClientRelation(models.Model):
    """An agency's authorization to manage a client workspace.

    `permissions` is a flat {key: bool} map keyed by AGENCY_CLIENT_PERMISSIONS
    keys. `requires_approval_for` is a list of those same keys that, when the
    agency tries to perform the action, must first generate an ApprovalRequest
    for the end-user to sign off on.
    """
    STATUS_CHOICES = [
        ('pending',    'Pending User Approval'),
        ('active',     'Active'),
        ('paused',     'Paused by User'),
        ('terminated', 'Terminated'),
        ('flagged',    'Flagged for Review'),
    ]
    INITIATED_BY_CHOICES = [
        ('agency',      'Agency Invited'),
        ('end_user',    'User Invited Agency'),
        ('marketplace', 'Via Marketplace'),
    ]
    TERMINATED_BY_CHOICES = [
        ('agency',         'Agency'),
        ('end_user',       'End User'),
        ('platform_admin', 'Platform Admin'),
    ]
    TRUST_LEVELS = [
        ('low',    'Low'),
        ('medium', 'Medium'),
        ('high',   'High'),
    ]

    agency = models.ForeignKey(Agency,                   on_delete=models.CASCADE, related_name='managed_clients')
    client = models.ForeignKey('social_stats.Client',    on_delete=models.CASCADE, related_name='managing_agencies')

    status              = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    initiated_by        = models.CharField(max_length=20, choices=INITIATED_BY_CHOICES)
    initiated_by_user   = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')

    # Permission matrix: see AGENCY_CLIENT_PERMISSIONS for keys
    permissions             = models.JSONField(default=default_relation_permissions, blank=True)
    requires_approval_for   = models.JSONField(default=list, blank=True)

    # Lifecycle
    proposed_at         = models.DateTimeField(auto_now_add=True)
    approved_at         = models.DateTimeField(null=True, blank=True)
    paused_at           = models.DateTimeField(null=True, blank=True)
    terminated_at       = models.DateTimeField(null=True, blank=True)
    terminated_by       = models.CharField(max_length=20, blank=True, choices=TERMINATED_BY_CHOICES)
    termination_reason  = models.TextField(blank=True)

    # Pricing (only used if billing is mediated by Social Stats; otherwise null)
    monthly_fee  = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    fee_currency = models.CharField(max_length=3, default='INR')

    # Trust
    user_trust_level = models.CharField(max_length=20, choices=TRUST_LEVELS, default='medium')

    # Communication
    notes_from_user   = models.TextField(blank=True)
    notes_from_agency = models.TextField(blank=True)

    class Meta:
        app_label = 'social_stats'
        unique_together = ('agency', 'client')
        indexes = [
            models.Index(fields=['agency', 'status']),
            models.Index(fields=['client', 'status']),
        ]

    def __str__(self):
        return f"Relation<{self.agency.slug} ↔ client#{self.client_id} {self.status}>"

    def can(self, permission_key):
        """Lightweight check used by views/permissions: agency-side allowed?"""
        if self.status != 'active':
            return False
        return bool(self.permissions.get(permission_key, False))

    def needs_approval(self, permission_key):
        return permission_key in (self.requires_approval_for or [])


# ─────────────────────────────────────────────────────────────────────────────
# ApprovalRequest — agency action waiting on end-user
# ─────────────────────────────────────────────────────────────────────────────
class ApprovalRequest(models.Model):
    STATUS_CHOICES = [
        ('pending',       'Pending'),
        ('approved',      'Approved'),
        ('rejected',      'Rejected'),
        ('expired',       'Expired'),
        ('auto_approved', 'Auto-Approved'),
        ('cancelled',     'Cancelled'),
    ]

    relation     = models.ForeignKey(AgencyClientRelation, on_delete=models.CASCADE)
    client       = models.ForeignKey('social_stats.Client', on_delete=models.CASCADE, related_name='pending_approvals')
    requested_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='requested_approvals')

    action_type        = models.CharField(max_length=50)
    target_object_type = models.CharField(max_length=50, blank=True)
    target_object_id   = models.IntegerField(null=True, blank=True)

    # Snapshot of what is being approved (e.g., post body + platforms)
    payload   = models.JSONField(default=dict, blank=True)
    preview   = models.TextField(blank=True)

    status         = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    user_response  = models.TextField(blank=True)
    edited_payload = models.JSONField(default=dict, blank=True)
    decided_at     = models.DateTimeField(null=True, blank=True)
    decided_by     = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')

    expires_at               = models.DateTimeField(default=default_approval_expiry)
    auto_approve_after_hours = models.IntegerField(null=True, blank=True)

    executed_at      = models.DateTimeField(null=True, blank=True)
    execution_result = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'social_stats'
        indexes = [
            models.Index(fields=['client',   'status']),
            models.Index(fields=['relation', 'status']),
            models.Index(fields=['expires_at']),
        ]

    def __str__(self):
        return f"Approval<{self.action_type} {self.status}>"


# ─────────────────────────────────────────────────────────────────────────────
# ActivityLog — user-facing audit trail
# ─────────────────────────────────────────────────────────────────────────────
class ActivityLog(models.Model):
    """Every meaningful action visible to the end-user.

    This is intentionally distinct from the existing ActionLog (which is a
    technical/operational log keyed off `action='composer.publish'` strings).
    ActivityLog is the user-readable audit feed shown in the trust UI:
    severity, reversibility, flagging, and a human description.
    """
    ACTOR_TYPES = [
        ('end_user', 'End User'),
        ('agency',   'Agency'),
        ('system',   'System'),
        ('ai',       'AI Assistant'),
    ]
    SEVERITY_CHOICES = [
        ('info',     'Info'),
        ('notice',   'Notice'),
        ('warning',  'Warning'),
        ('critical', 'Critical'),
    ]

    client       = models.ForeignKey('social_stats.Client', on_delete=models.CASCADE, related_name='activity_logs')
    actor_user   = models.ForeignKey(User,   on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    actor_agency = models.ForeignKey(Agency, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    actor_type   = models.CharField(max_length=20, choices=ACTOR_TYPES)

    action_type        = models.CharField(max_length=50)
    severity           = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='info')
    target_object_type = models.CharField(max_length=50, blank=True)
    target_object_id   = models.IntegerField(null=True, blank=True)

    description = models.TextField()
    metadata    = models.JSONField(default=dict, blank=True)

    is_reversible    = models.BooleanField(default=False)
    reverted_at      = models.DateTimeField(null=True, blank=True)
    reverted_by      = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')

    flagged_by_user  = models.BooleanField(default=False)
    flagged_at       = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'social_stats'
        indexes = [
            models.Index(fields=['client',       '-created_at']),
            models.Index(fields=['actor_agency', '-created_at']),
            models.Index(fields=['action_type']),
        ]

    def __str__(self):
        return f"Activity<{self.action_type} by {self.actor_type}>"


# ─────────────────────────────────────────────────────────────────────────────
# AgencyReview — marketplace trust signal
# ─────────────────────────────────────────────────────────────────────────────
class AgencyReview(models.Model):
    agency         = models.ForeignKey(Agency, on_delete=models.CASCADE, related_name='reviews')
    reviewer_user  = models.ForeignKey(User, on_delete=models.CASCADE)
    relation       = models.ForeignKey(AgencyClientRelation, on_delete=models.SET_NULL, null=True, blank=True)

    rating         = models.IntegerField()  # 1-5; validation in serializer
    title          = models.CharField(max_length=200)
    body           = models.TextField()
    pros           = models.JSONField(default=list, blank=True)
    cons           = models.JSONField(default=list, blank=True)
    services_used  = models.JSONField(default=list, blank=True)
    duration_months = models.IntegerField(null=True, blank=True)

    is_verified      = models.BooleanField(default=False)  # auto-set if relation exists
    is_approved      = models.BooleanField(default=True)   # admin moderation
    agency_response  = models.TextField(blank=True)
    helpful_count    = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'social_stats'
        unique_together = ('agency', 'reviewer_user')
        indexes = [models.Index(fields=['agency', '-created_at'])]

    def __str__(self):
        return f"Review<{self.agency.slug} ★{self.rating}>"


# ─────────────────────────────────────────────────────────────────────────────
# ManageRequest — agency invites end-user to be managed
# ─────────────────────────────────────────────────────────────────────────────
class ManageRequest(models.Model):
    STATUS_CHOICES = [
        ('sent',      'Sent'),
        ('viewed',    'Viewed by User'),
        ('accepted',  'Accepted'),
        ('declined',  'Declined'),
        ('expired',   'Expired'),
        ('cancelled', 'Cancelled by Agency'),
    ]

    agency        = models.ForeignKey(Agency, on_delete=models.CASCADE, related_name='sent_manage_requests')
    target_email  = models.EmailField()
    target_phone  = models.CharField(max_length=20, blank=True)
    target_user   = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='received_manage_requests',
    )
    target_client = models.ForeignKey(
        'social_stats.Client', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='+',
    )

    proposed_permissions = models.JSONField(default=default_relation_permissions, blank=True)
    proposed_message     = models.TextField(blank=True)
    proposed_pricing     = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    proposed_services    = models.JSONField(default=list, blank=True)

    status      = models.CharField(max_length=20, choices=STATUS_CHOICES, default='sent')
    token       = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)

    sent_at     = models.DateTimeField(auto_now_add=True)
    viewed_at   = models.DateTimeField(null=True, blank=True)
    decided_at  = models.DateTimeField(null=True, blank=True)
    expires_at  = models.DateTimeField(default=default_invite_expiry)

    resulting_relation = models.ForeignKey(
        AgencyClientRelation, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='+',
    )
    decline_reason = models.TextField(blank=True)

    class Meta:
        app_label = 'social_stats'
        indexes = [
            models.Index(fields=['agency',  'status']),
            models.Index(fields=['target_user', 'status']),
            models.Index(fields=['expires_at']),
        ]

    def __str__(self):
        return f"ManageRequest<{self.agency.slug} → {self.target_email} {self.status}>"


# ─────────────────────────────────────────────────────────────────────────────
# AgencyInviteFromUser — end-user invites a specific agency
# ─────────────────────────────────────────────────────────────────────────────
class AgencyInviteFromUser(models.Model):
    STATUS_CHOICES = [
        ('sent',     'Sent'),
        ('viewed',   'Viewed'),
        ('accepted', 'Accepted'),
        ('declined', 'Declined'),
        ('expired',  'Expired'),
    ]

    inviter_user        = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_agency_invites')
    client              = models.ForeignKey('social_stats.Client', on_delete=models.CASCADE, related_name='+')
    target_agency       = models.ForeignKey(
        Agency, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='received_user_invites',
    )
    target_agency_email = models.EmailField(blank=True)  # if agency not on Social Stats yet

    proposed_permissions = models.JSONField(default=default_relation_permissions, blank=True)
    message              = models.TextField(blank=True)
    desired_services     = models.JSONField(default=list, blank=True)
    budget_range         = models.CharField(max_length=50, blank=True)

    status   = models.CharField(max_length=20, choices=STATUS_CHOICES, default='sent')
    token    = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)

    sent_at    = models.DateTimeField(auto_now_add=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(default=default_invite_expiry)

    resulting_relation = models.ForeignKey(
        AgencyClientRelation, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='+',
    )

    class Meta:
        app_label = 'social_stats'
        indexes = [
            models.Index(fields=['target_agency', 'status']),
            models.Index(fields=['inviter_user',  'status']),
            models.Index(fields=['expires_at']),
        ]

    def __str__(self):
        return f"AgencyInvite<user#{self.inviter_user_id} → agency#{self.target_agency_id} {self.status}>"


# ─────────────────────────────────────────────────────────────────────────────
# Subscription — (end-user billing)
# ─────────────────────────────────────────────────────────────────────────────
class Subscription(models.Model):
    """One subscription per *subject* (an end-user workspace OR an agency).
    Exactly one of `client` / `agency` is set; the rest of the row tracks
    plan + Razorpay state regardless of side.
    """
    PLAN_CHOICES = [
        ('eu-free',         'End-user · Free'),
        ('eu-pro',          'End-user · Pro'),
        ('eu-premium',      'End-user · Premium'),
        ('agency-starter',  'Agency · Starter'),
        ('agency-growth',   'Agency · Growth'),
        ('agency-scale',    'Agency · Scale'),
        ('agency-enterprise', 'Agency · Enterprise'),
    ]
    STATUS_CHOICES = [
        ('active',     'Active'),
        ('trialing',   'Trialing'),
        ('past_due',   'Past Due'),
        ('cancelled',  'Cancelled'),
        ('paused',     'Paused'),
        ('halted',     'Halted'),
    ]

    client = models.OneToOneField(
        'social_stats.Client', on_delete=models.CASCADE,
        related_name='subscription', null=True, blank=True,
    )
    agency = models.OneToOneField(
        Agency, on_delete=models.CASCADE,
        related_name='subscription', null=True, blank=True,
    )

    plan       = models.CharField(max_length=30, choices=PLAN_CHOICES, default='eu-free')
    status     = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')

    # Razorpay state (stubbed in dev — real values flow in via webhooks)
    razorpay_customer_id     = models.CharField(max_length=64, blank=True)
    razorpay_subscription_id = models.CharField(max_length=64, blank=True)
    razorpay_plan_id         = models.CharField(max_length=64, blank=True)

    # Billing period (server-of-record; webhooks push updates)
    current_period_start = models.DateTimeField(null=True, blank=True)
    current_period_end   = models.DateTimeField(null=True, blank=True)
    cancel_at_period_end = models.BooleanField(default=False)

    started_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    # Free-form per-cycle counters; reset by a Celery task at period boundaries
    usage_counters = models.JSONField(default=dict, blank=True)

    class Meta:
        app_label = 'social_stats'
        constraints = [
            # Exactly one subject — XOR enforced at the DB layer.
            models.CheckConstraint(
                check=(
                    (models.Q(client__isnull=False) & models.Q(agency__isnull=True))
                    | (models.Q(client__isnull=True) & models.Q(agency__isnull=False))
                ),
                name='subscription_exactly_one_subject',
            ),
        ]

    @property
    def subject(self):
        return self.client or self.agency

    @property
    def subject_kind(self) -> str:
        return 'client' if self.client_id else 'agency'

    def __str__(self):
        sub = f'client#{self.client_id}' if self.client_id else f'agency#{self.agency_id}'
        return f"Subscription<{sub} {self.plan} {self.status}>"


class Invoice(models.Model):
    """Lightweight invoice mirror. Real PDF invoices come from Razorpay; we
    keep a row per webhook so the user can browse history without re-fetching."""
    STATUS_CHOICES = [
        ('paid',    'Paid'),
        ('failed',  'Failed'),
        ('pending', 'Pending'),
        ('refunded', 'Refunded'),
    ]

    subscription = models.ForeignKey(Subscription, on_delete=models.CASCADE, related_name='invoices')
    razorpay_invoice_id = models.CharField(max_length=64, blank=True)
    razorpay_payment_id = models.CharField(max_length=64, blank=True)
    amount       = models.DecimalField(max_digits=10, decimal_places=2)
    currency     = models.CharField(max_length=3, default='INR')
    status       = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    period_start = models.DateTimeField(null=True, blank=True)
    period_end   = models.DateTimeField(null=True, blank=True)
    pdf_url      = models.URLField(blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'social_stats'
        ordering = ['-created_at']
        indexes = [models.Index(fields=['subscription', '-created_at'])]

    def __str__(self):
        return f"Invoice<sub#{self.subscription_id} {self.status} {self.amount} {self.currency}>"


# ─────────────────────────────────────────────────────────────────────────────
# Dispute — (filed by an end-user against an agency)
# ─────────────────────────────────────────────────────────────────────────────
class Dispute(models.Model):
    STATUS_CHOICES = [
        ('open',         'Open'),
        ('under_review', 'Under review'),
        ('resolved',     'Resolved'),
        ('rejected',     'Rejected'),
        ('escalated',    'Escalated'),
    ]
    SEVERITY_CHOICES = [
        ('low',      'Low'),
        ('medium',   'Medium'),
        ('high',     'High'),
        ('critical', 'Critical'),
    ]

    relation       = models.ForeignKey(AgencyClientRelation, on_delete=models.CASCADE, related_name='disputes')
    filer          = models.ForeignKey('auth.User', on_delete=models.CASCADE, related_name='filed_disputes')
    reason         = models.TextField()
    severity       = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='medium')
    evidence_urls  = models.JSONField(default=list, blank=True)
    status         = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')

    # Admin resolution
    decided_by     = models.ForeignKey(
        'auth.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='resolved_disputes',
    )
    decided_at     = models.DateTimeField(null=True, blank=True)
    resolution     = models.TextField(blank=True)
    action_taken   = models.CharField(
        max_length=30, blank=True,
        choices=[
            ('paused',     'Paused relation'),
            ('terminated', 'Terminated relation'),
            ('warned',     'Warned agency'),
            ('dismissed',  'Dismissed'),
            ('escalated',  'Escalated to legal'),
        ],
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'social_stats'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['relation']),
            models.Index(fields=['filer']),
        ]

    def __str__(self):
        return f"Dispute<#{self.id} relation#{self.relation_id} {self.status}>"
