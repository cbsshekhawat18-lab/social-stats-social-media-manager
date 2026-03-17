import uuid
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta

PLATFORM_CHOICES = [
    ('facebook',          'Facebook'),
    ('instagram',         'Instagram'),
    ('youtube',           'YouTube'),
    ('linkedin',          'LinkedIn'),
    ('google_my_business','Google My Business'),
]

ROLE_CHOICES = [
    ('superadmin', 'Super Admin'),
    ('staff',      'Staff'),
    ('client',     'Client'),
]

SYNC_STATUS = [
    ('pending', 'Pending'),
    ('running', 'Running'),
    ('success', 'Success'),
    ('failed',  'Failed'),
]


# ── Client (Company) ──────────────────────────────────────────────────────────
class Client(models.Model):
    name       = models.CharField(max_length=200)
    company    = models.CharField(max_length=200)
    email      = models.EmailField(unique=True)
    phone      = models.CharField(max_length=30, blank=True)
    logo       = models.ImageField(upload_to='logos/', blank=True, null=True)
    website    = models.URLField(blank=True)
    is_active  = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.company} ({self.name})"

    class Meta:
        ordering = ['company']


# ── User Profile (roles) ──────────────────────────────────────────────────────
class UserProfile(models.Model):
    user              = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role              = models.CharField(max_length=20, choices=ROLE_CHOICES, default='client')
    client            = models.ForeignKey(Client, null=True, blank=True, on_delete=models.SET_NULL)
    assigned_clients  = models.ManyToManyField(Client, blank=True, related_name='staff_assigned')
    avatar            = models.ImageField(upload_to='avatars/', blank=True, null=True)
    created_at        = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.email} ({self.role})"

    def can_access_client(self, client_id):
        if self.role == 'superadmin':
            return True
        if self.role == 'client':
            return self.client_id == int(client_id)
        if self.role == 'staff':
            return self.assigned_clients.filter(id=client_id).exists()
        return False


# ── OAuth Credentials per client per platform ─────────────────────────────────
class PlatformCredential(models.Model):
    client        = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='credentials')
    platform      = models.CharField(max_length=30, choices=PLATFORM_CHOICES)

    # OAuth tokens
    access_token  = models.TextField(blank=True)
    refresh_token = models.TextField(blank=True)
    token_type    = models.CharField(max_length=50, blank=True, default='Bearer')
    expires_at    = models.DateTimeField(null=True, blank=True)
    scope         = models.TextField(blank=True)

    # Platform-specific IDs (auto-fetched after OAuth)
    page_id              = models.CharField(max_length=200, blank=True)   # Facebook Page ID
    page_name            = models.CharField(max_length=200, blank=True)   # Facebook Page Name
    instagram_account_id = models.CharField(max_length=200, blank=True)   # IG Business Account ID
    channel_id           = models.CharField(max_length=200, blank=True)   # YouTube Channel ID
    channel_name         = models.CharField(max_length=200, blank=True)   # YouTube Channel Name
    organization_id      = models.CharField(max_length=200, blank=True)   # LinkedIn Org ID
    organization_name    = models.CharField(max_length=200, blank=True)   # LinkedIn Org Name
    gmb_account_id       = models.CharField(max_length=200, blank=True)   # GMB Account
    gmb_location_id      = models.CharField(max_length=200, blank=True)   # GMB Location

    is_active    = models.BooleanField(default=True)
    connected_at = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('client', 'platform')
        ordering = ['platform']

    def __str__(self):
        return f"{self.client.company} — {self.get_platform_display()}"

    @property
    def is_expired(self):
        if not self.expires_at:
            return False
        return timezone.now() >= self.expires_at - timedelta(minutes=10)

    @property
    def status(self):
        if not self.access_token:
            return 'not_connected'
        if self.is_expired:
            return 'expired'
        return 'active'


# ── Daily Aggregated Metrics ───────────────────────────────────────────────────
class DailyMetric(models.Model):
    client    = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='metrics')
    platform  = models.CharField(max_length=30, choices=PLATFORM_CHOICES)
    date      = models.DateField()

    # Universal metrics
    impressions  = models.BigIntegerField(default=0)
    reach        = models.BigIntegerField(default=0)
    clicks       = models.BigIntegerField(default=0)
    likes        = models.BigIntegerField(default=0)
    comments     = models.BigIntegerField(default=0)
    shares       = models.BigIntegerField(default=0)
    saves        = models.BigIntegerField(default=0)
    video_views  = models.BigIntegerField(default=0)
    followers    = models.BigIntegerField(default=0)
    profile_views= models.BigIntegerField(default=0)

    # Google / Ads specific
    sessions             = models.BigIntegerField(default=0)
    users                = models.BigIntegerField(default=0)
    page_views           = models.BigIntegerField(default=0)
    website_clicks       = models.BigIntegerField(default=0)
    direction_requests   = models.BigIntegerField(default=0)
    phone_calls          = models.BigIntegerField(default=0)

    # Calculated
    engagement_rate = models.FloatField(default=0)
    ctr             = models.FloatField(default=0)

    synced_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('client', 'platform', 'date')
        ordering = ['-date']
        indexes = [
            models.Index(fields=['client', 'platform', 'date']),
        ]

    def __str__(self):
        return f"{self.client.company} | {self.platform} | {self.date}"


# ── Per-Post Metrics (Instagram / Facebook) ───────────────────────────────────
class PostMetric(models.Model):
    client        = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='post_metrics')
    platform      = models.CharField(max_length=30, choices=PLATFORM_CHOICES)
    post_id       = models.CharField(max_length=300)
    post_url      = models.URLField(blank=True)
    post_type     = models.CharField(max_length=50, blank=True)
    caption       = models.TextField(blank=True)
    thumbnail_url = models.URLField(blank=True)
    published_at  = models.DateTimeField(null=True, blank=True)

    impressions  = models.BigIntegerField(default=0)
    reach        = models.BigIntegerField(default=0)
    clicks       = models.BigIntegerField(default=0)
    likes        = models.BigIntegerField(default=0)
    comments     = models.BigIntegerField(default=0)
    shares       = models.BigIntegerField(default=0)
    saves        = models.BigIntegerField(default=0)
    video_views  = models.BigIntegerField(default=0)

    synced_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('client', 'platform', 'post_id')
        ordering = ['-published_at']


GOAL_METRIC_CHOICES = [
    ('impressions',    'Impressions'),
    ('reach',          'Reach'),
    ('clicks',         'Clicks'),
    ('likes',          'Likes'),
    ('followers',      'Followers'),
    ('video_views',    'Video Views'),
    ('website_clicks', 'Website Clicks'),
    ('phone_calls',    'Phone Calls'),
]

GOAL_PLATFORM_CHOICES = PLATFORM_CHOICES + [('all', 'All Platforms')]


# ── Monthly Goals ─────────────────────────────────────────────────────────────
class ClientGoal(models.Model):
    client       = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='goals')
    platform     = models.CharField(max_length=30, choices=GOAL_PLATFORM_CHOICES)
    metric       = models.CharField(max_length=30, choices=GOAL_METRIC_CHOICES)
    target_value = models.BigIntegerField()
    month        = models.PositiveSmallIntegerField()   # 1–12
    year         = models.PositiveSmallIntegerField()
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('client', 'platform', 'metric', 'month', 'year')
        ordering = ['-year', '-month', 'platform', 'metric']

    def __str__(self):
        return f"{self.client.company} | {self.platform} | {self.metric} | {self.month}/{self.year}"


ALERT_TYPE_CHOICES = [
    ('token_expired',      'Token Expired'),
    ('sync_failed',        'Sync Failed'),
    ('reach_drop',         'Reach Drop'),
    ('viral_post',         'Viral Post'),
    ('goal_at_risk',       'Goal At Risk'),
    ('follower_milestone', 'Follower Milestone'),
]


# ── Smart Alerts ──────────────────────────────────────────────────────────────
class Alert(models.Model):
    client     = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='alerts')
    platform   = models.CharField(max_length=30, blank=True)
    alert_type = models.CharField(max_length=30, choices=ALERT_TYPE_CHOICES)
    message    = models.TextField()
    is_read    = models.BooleanField(default=False)
    dedup_key  = models.CharField(max_length=200, blank=True)  # prevents duplicate alerts per day
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.client.company} | {self.alert_type} | {self.created_at:%Y-%m-%d}"


# ── AI Insights ───────────────────────────────────────────────────────────────
class AIInsight(models.Model):
    client       = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='ai_insights')
    month        = models.PositiveSmallIntegerField()
    year         = models.PositiveSmallIntegerField()
    content      = models.TextField()
    generated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('client', 'month', 'year')
        ordering = ['-year', '-month']

    def __str__(self):
        return f"{self.client.company} | {self.month}/{self.year}"


# ── Weekly Top Posts ──────────────────────────────────────────────────────────
class WeeklyTopPost(models.Model):
    client      = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='weekly_top_posts')
    platform    = models.CharField(max_length=30, choices=PLATFORM_CHOICES)
    post_metric = models.ForeignKey('PostMetric', on_delete=models.CASCADE, null=True, blank=True)
    week_start  = models.DateField()   # Monday of the scored week
    score       = models.FloatField(default=0)
    rank        = models.PositiveSmallIntegerField(default=1)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('client', 'platform', 'week_start', 'rank')
        ordering = ['-week_start', 'platform', 'rank']

    def __str__(self):
        return f"{self.client.company} | {self.platform} | {self.week_start} | #{self.rank}"


# ── Shareable Public Reports ──────────────────────────────────────────────────
class SharedReport(models.Model):
    client      = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='shared_reports')
    token       = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    created_by  = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    date_from   = models.DateField()
    date_until  = models.DateField()
    platforms   = models.JSONField(default=list)        # e.g. ['facebook', 'instagram']
    is_password_protected = models.BooleanField(default=False)
    password_hash         = models.CharField(max_length=128, blank=True)
    expires_at    = models.DateTimeField(null=True, blank=True)
    view_count    = models.PositiveIntegerField(default=0)
    last_viewed_at= models.DateTimeField(null=True, blank=True)
    is_active     = models.BooleanField(default=True)
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.client.company} | {self.token}"

    @property
    def is_expired(self):
        if not self.expires_at:
            return False
        return timezone.now() > self.expires_at

    def set_password(self, raw_password):
        from django.contrib.auth.hashers import make_password
        self.password_hash = make_password(raw_password)

    def verify_password(self, raw_password):
        from django.contrib.auth.hashers import check_password
        return check_password(raw_password, self.password_hash)


# ── Client Onboarding Checklist ───────────────────────────────────────────────
ONBOARDING_STEP_CHOICES = [
    ('connect_platform',  'Connect a Platform'),
    ('first_sync',        'Run First Sync'),
    ('set_goals',         'Set Monthly Goals'),
    ('add_credentials',   'Add API Credentials'),
    ('invite_team',       'Invite Team Members'),
    ('configure_alerts',  'Configure Alerts'),
]

ONBOARDING_STEP_DESCRIPTIONS = {
    'connect_platform': 'Connect at least one social media platform via OAuth.',
    'first_sync':       'Run a successful data sync to pull in your first metrics.',
    'set_goals':        'Create at least one monthly performance goal.',
    'add_credentials':  'Add API credentials for manual platform access.',
    'invite_team':      'Invite a team member or verify your account is set up.',
    'configure_alerts': 'Review and configure your smart alert preferences.',
}


class OnboardingStep(models.Model):
    client       = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='onboarding_steps')
    step_key     = models.CharField(max_length=40, choices=ONBOARDING_STEP_CHOICES)
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    completed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        unique_together = ('client', 'step_key')
        ordering = ['id']

    def __str__(self):
        status = '✓' if self.is_completed else '○'
        return f"{self.client.company} | {status} {self.step_key}"

    def mark_complete(self, user=None):
        if not self.is_completed:
            self.is_completed = True
            self.completed_at = timezone.now()
            self.completed_by = user
            self.save(update_fields=['is_completed', 'completed_at', 'completed_by'])


# ── Signals: auto-create onboarding steps + auto-mark complete ────────────────
from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender=Client)
def create_onboarding_steps(sender, instance, created, **kwargs):
    if created:
        for step_key, _ in ONBOARDING_STEP_CHOICES:
            OnboardingStep.objects.get_or_create(client=instance, step_key=step_key)


@receiver(post_save, sender='social_stats.PlatformCredential')
def mark_connect_platform(sender, instance, created, **kwargs):
    if created:
        OnboardingStep.objects.filter(
            client=instance.client, step_key='connect_platform', is_completed=False
        ).update(is_completed=True, completed_at=timezone.now())
        OnboardingStep.objects.filter(
            client=instance.client, step_key='add_credentials', is_completed=False
        ).update(is_completed=True, completed_at=timezone.now())


@receiver(post_save, sender='social_stats.SyncLog')
def mark_first_sync(sender, instance, **kwargs):
    if instance.status == 'success' and instance.client_id:
        OnboardingStep.objects.filter(
            client=instance.client, step_key='first_sync', is_completed=False
        ).update(is_completed=True, completed_at=timezone.now())


@receiver(post_save, sender='social_stats.ClientGoal')
def mark_set_goals(sender, instance, created, **kwargs):
    if created:
        OnboardingStep.objects.filter(
            client=instance.client, step_key='set_goals', is_completed=False
        ).update(is_completed=True, completed_at=timezone.now())


# ── ROI Settings ──────────────────────────────────────────────────────────────
class ROISettings(models.Model):
    client              = models.OneToOneField(Client, on_delete=models.CASCADE, related_name='roi_settings')
    facebook_budget     = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    instagram_budget    = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    youtube_budget      = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    linkedin_budget     = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    gmb_budget          = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    agency_fee          = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    avg_sale_value      = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    conversion_rate     = models.DecimalField(max_digits=5, decimal_places=2, default=2.5)
    lead_to_sale_rate   = models.DecimalField(max_digits=5, decimal_places=2, default=20.0)
    currency            = models.CharField(max_length=10, default='USD')
    currency_symbol     = models.CharField(max_length=5, default='$')
    monthly_revenue_goal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    monthly_leads_goal  = models.IntegerField(default=0)
    updated_at          = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"ROI Settings — {self.client.company}"

    @property
    def total_budget(self):
        return (self.facebook_budget + self.instagram_budget + self.youtube_budget +
                self.linkedin_budget + self.gmb_budget + self.agency_fee)


# ── ROI Report ────────────────────────────────────────────────────────────────
class ROIReport(models.Model):
    client            = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='roi_reports')
    month             = models.IntegerField()
    year              = models.IntegerField()
    total_investment  = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    agency_fee        = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_clicks      = models.BigIntegerField(default=0)
    total_impressions = models.BigIntegerField(default=0)
    total_reach       = models.BigIntegerField(default=0)
    website_clicks    = models.BigIntegerField(default=0)
    estimated_leads   = models.IntegerField(default=0)
    estimated_sales   = models.IntegerField(default=0)
    estimated_revenue = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    roi_percentage    = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    cost_per_click    = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    cost_per_lead     = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    cost_per_sale     = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    platform_breakdown = models.JSONField(default=dict)
    generated_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('client', 'month', 'year')
        ordering = ['-year', '-month']

    def __str__(self):
        return f"ROI Report — {self.client.company} {self.month}/{self.year}"


# ── Sync Log ──────────────────────────────────────────────────────────────────
class SyncLog(models.Model):
    client         = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='sync_logs', null=True)
    platform       = models.CharField(max_length=30, choices=PLATFORM_CHOICES)
    status         = models.CharField(max_length=20, choices=SYNC_STATUS, default='pending')
    records_synced = models.IntegerField(default=0)
    error_message  = models.TextField(blank=True)
    started_at     = models.DateTimeField(auto_now_add=True)
    finished_at    = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-started_at']

    def __str__(self):
        return f"{self.platform} | {self.status} | {self.started_at:%Y-%m-%d %H:%M}"


# ── Content Calendar ───────────────────────────────────────────────────────────

POST_TYPE_CHOICES = [
    ('image',    'Image'),
    ('video',    'Video'),
    ('reel',     'Reel'),
    ('story',    'Story'),
    ('carousel', 'Carousel'),
    ('text',     'Text'),
    ('article',  'Article'),
    ('short',    'Short'),
]

CALENDAR_STATUS_CHOICES = [
    ('published', 'Published'),
    ('scheduled', 'Scheduled'),
    ('draft',     'Draft'),
    ('failed',    'Failed'),
]


class CalendarPost(models.Model):
    client      = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='calendar_posts')
    platform    = models.CharField(max_length=30, choices=PLATFORM_CHOICES)
    post_type   = models.CharField(max_length=20, choices=POST_TYPE_CHOICES, default='image')
    status      = models.CharField(max_length=20, choices=CALENDAR_STATUS_CHOICES, default='draft')
    title       = models.CharField(max_length=200, blank=True)
    caption     = models.TextField(blank=True)
    hashtags    = models.TextField(blank=True)
    media_url   = models.URLField(blank=True)
    post_url    = models.URLField(blank=True)
    scheduled_at  = models.DateTimeField(null=True, blank=True)
    published_at  = models.DateTimeField(null=True, blank=True)
    post_metric   = models.OneToOneField(
        'PostMetric', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='calendar_post'
    )

    # Performance snapshot
    impressions     = models.BigIntegerField(default=0)
    reach           = models.BigIntegerField(default=0)
    likes           = models.BigIntegerField(default=0)
    comments        = models.BigIntegerField(default=0)
    shares          = models.BigIntegerField(default=0)
    saves           = models.BigIntegerField(default=0)
    video_views     = models.BigIntegerField(default=0)
    engagement_rate = models.DecimalField(max_digits=8, decimal_places=4, default=0)

    # Meta
    created_by  = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_calendar_posts')
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)
    external_id = models.CharField(max_length=300, blank=True)
    notes       = models.TextField(blank=True)

    class Meta:
        ordering = ['-scheduled_at', '-published_at']

    def __str__(self):
        return f"{self.client.company} | {self.platform} | {self.status} | {self.title or self.caption[:40]}"

    @property
    def best_time(self):
        return self.scheduled_at or self.published_at


class CalendarNote(models.Model):
    client            = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='calendar_notes')
    date              = models.DateField()
    title             = models.CharField(max_length=200)
    note              = models.TextField(blank=True)
    color             = models.CharField(max_length=7, default='#2563EB')
    is_client_visible = models.BooleanField(default=False)
    created_by        = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_calendar_notes')
    created_at        = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['date', 'id']

    def __str__(self):
        return f"{self.client.company} | {self.date} | {self.title}"


class PostingSchedule(models.Model):
    client      = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='posting_schedules')
    platform    = models.CharField(max_length=30, choices=PLATFORM_CHOICES)
    day_of_week = models.IntegerField()   # 0=Monday … 6=Sunday
    hour        = models.IntegerField()
    minute      = models.IntegerField(default=0)
    is_active   = models.BooleanField(default=True)
    note        = models.CharField(max_length=100, blank=True)

    class Meta:
        unique_together = ('client', 'platform', 'day_of_week', 'hour', 'minute')
        ordering = ['platform', 'day_of_week', 'hour']

    def __str__(self):
        days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        return f"{self.client.company} | {self.platform} | {days[self.day_of_week]} {self.hour:02d}:{self.minute:02d}"


# ── Access Management ─────────────────────────────────────────────────────────

PERMISSION_CATEGORY_CHOICES = [
    ('pages',    'Pages'),
    ('sections', 'Sections'),
    ('actions',  'Actions'),
    ('data',     'Data'),
]

ALL_PERMISSIONS = [
    # Dashboard
    ('dashboard.view',               'View Dashboard',                'See the main dashboard page',                          'pages',    True,  True,  10),
    ('dashboard.kpi_cards',          'See KPI Cards',                 'View stat cards at top of dashboard',                  'sections', True,  True,  11),
    ('dashboard.charts',             'See Charts',                    'View charts and graphs',                               'sections', True,  True,  12),
    ('dashboard.platform_tabs',      'Platform Tabs',                 'Switch between platforms',                             'sections', True,  True,  13),
    ('dashboard.date_range',         'Change Date Range',             'Modify date range filter',                             'actions',  True,  True,  14),
    ('dashboard.posts_table',        'Recent Posts Table',            'See recent posts section',                             'sections', True,  True,  15),
    ('dashboard.platform_breakdown', 'Platform Breakdown',            'See platform breakdown table',                         'sections', True,  True,  16),
    ('dashboard.sync_now',           'Sync Now Button',               'Trigger manual sync',                                  'actions',  True,  False, 17),
    ('dashboard.export_pdf',         'Export PDF',                    'Export dashboard as PDF report',                       'actions',  True,  True,  18),
    # Analytics
    ('analytics.view',               'View Analytics',                'Access analytics page',                                'pages',    True,  True,  20),
    ('analytics.impressions',        'Impressions Data',              'See impressions metrics',                              'data',     True,  True,  21),
    ('analytics.reach',              'Reach Data',                    'See reach metrics',                                    'data',     True,  True,  22),
    ('analytics.engagement',         'Engagement Data',               'See engagement metrics',                               'data',     True,  True,  23),
    ('analytics.video_views',        'Video Views Data',              'See video view counts',                                'data',     True,  True,  24),
    ('analytics.followers',          'Followers Data',                'See follower counts',                                  'data',     True,  True,  25),
    ('analytics.website_clicks',     'Website Clicks',                'See website click data',                               'data',     True,  True,  26),
    ('analytics.phone_calls',        'Phone Calls',                   'See phone call data (GMB)',                            'data',     True,  False, 27),
    ('analytics.direction_requests', 'Direction Requests',            'See direction requests (GMB)',                         'data',     True,  False, 28),
    # Calendar
    ('calendar.view',                'View Calendar',                 'Access content calendar page',                         'pages',    True,  True,  30),
    ('calendar.month_view',          'Month View',                    'See monthly calendar grid',                            'sections', True,  True,  31),
    ('calendar.list_view',           'List View',                     'See list view of posts',                               'sections', True,  True,  32),
    ('calendar.stats_view',          'Stats View',                    'See posting stats',                                    'sections', True,  False, 33),
    ('calendar.create_post',         'Create Posts',                  'Schedule new posts',                                   'actions',  True,  False, 34),
    ('calendar.edit_post',           'Edit Posts',                    'Edit existing calendar posts',                         'actions',  True,  False, 35),
    ('calendar.delete_post',         'Delete Posts',                  'Delete calendar posts',                                'actions',  True,  False, 36),
    ('calendar.add_notes',           'Add Notes',                     'Add calendar notes',                                   'actions',  True,  False, 37),
    ('calendar.view_notes',          'View Notes',                    'See calendar notes',                                   'sections', True,  True,  38),
    ('calendar.best_times',          'Best Posting Times',            'See recommended posting times',                        'sections', True,  False, 39),
    # ROI
    ('roi.view',                     'View ROI Calculator',           'Access ROI calculator page',                           'pages',    True,  True,  40),
    ('roi.view_results',             'See ROI Results',               'View calculated ROI results',                          'sections', True,  True,  41),
    ('roi.edit_settings',            'Edit ROI Settings',             'Modify budgets and conversion rates',                  'actions',  True,  False, 42),
    ('roi.view_history',             'ROI History',                   'View past ROI reports',                                'sections', True,  True,  43),
    ('roi.export',                   'Export ROI Report',             'Download ROI as PDF',                                  'actions',  True,  False, 44),
    # Reports
    ('reports.view',                 'View Reports',                  'Access reports page',                                  'pages',    True,  True,  50),
    ('reports.download_pdf',         'Download PDF',                  'Download report PDFs',                                 'actions',  True,  True,  51),
    ('reports.view_history',         'Report History',                'See past generated reports',                           'sections', True,  True,  52),
    ('reports.schedule',             'Schedule Reports',              'Configure automated report delivery',                  'actions',  True,  False, 53),
    # Alerts
    ('alerts.view',                  'View Alerts',                   'Access alerts page',                                   'pages',    True,  False, 60),
    ('alerts.mark_read',             'Mark Alerts Read',              'Dismiss and mark alerts as read',                      'actions',  True,  False, 61),
    ('alerts.configure',             'Configure Alerts',              'Set up alert rules and thresholds',                    'actions',  True,  False, 62),
    # Reviews
    ('reviews.view',                 'View Reviews',                  'Access reviews page',                                  'pages',    True,  False, 70),
    ('reviews.reply',                'Reply to Reviews',              'Post replies to Google reviews',                       'actions',  True,  False, 71),
    ('reviews.view_stats',           'Review Statistics',             'See review rating analytics',                          'sections', True,  False, 72),
    # Settings
    ('settings.view',                'View Settings',                 'Access settings page',                                 'pages',    True,  True,  80),
    ('settings.connect_accounts',    'Connect Accounts',              'Link social media accounts via OAuth',                 'actions',  True,  True,  81),
    ('settings.disconnect_accounts', 'Disconnect Accounts',           'Unlink connected accounts',                            'actions',  True,  False, 82),
    ('settings.view_credentials',    'View Connected Status',         'See which platforms are connected',                    'sections', True,  True,  83),
    # Billing
    ('billing.view',                 'View Billing',                  'Access billing page',                                  'pages',    True,  False, 90),
    ('billing.view_invoices',        'View Invoices',                 'See invoice history',                                  'sections', True,  False, 91),
    ('billing.download_invoices',    'Download Invoices',             'Download invoice PDFs',                                'actions',  True,  False, 92),
    # Data
    ('data.view_all_clients',        'View All Clients',              'Access data for all clients',                          'data',     True,  False, 100),
    ('data.view_assigned_clients',   'View Assigned Clients',         'Access data only for assigned clients',                'data',     True,  False, 101),
    ('data.view_own_client',         'View Own Client Data',          'Access own client data only',                          'data',     False, True,  102),
    ('data.impressions',             'Impressions Numbers',           'See impressions figures',                              'data',     True,  True,  103),
    ('data.revenue_data',            'Revenue / ROI Numbers',         'See financial and ROI data',                           'data',     True,  False, 104),
    ('data.competitor_data',         'Competitor Data',               'Access competitor benchmarks',                         'data',     True,  False, 105),
]

# Page groupings for the UI
PERMISSION_PAGE_GROUPS = {
    'dashboard': {'label': 'Dashboard',         'icon': '📊', 'prefix': 'dashboard.'},
    'analytics': {'label': 'Analytics',         'icon': '📈', 'prefix': 'analytics.'},
    'calendar':  {'label': 'Content Calendar',  'icon': '📅', 'prefix': 'calendar.'},
    'roi':       {'label': 'ROI Calculator',    'icon': '💰', 'prefix': 'roi.'},
    'reports':   {'label': 'Reports',           'icon': '📄', 'prefix': 'reports.'},
    'alerts':    {'label': 'Alerts',            'icon': '🔔', 'prefix': 'alerts.'},
    'reviews':   {'label': 'Reviews',           'icon': '⭐', 'prefix': 'reviews.'},
    'settings':  {'label': 'Settings',          'icon': '⚙️', 'prefix': 'settings.'},
    'billing':   {'label': 'Billing',           'icon': '💳', 'prefix': 'billing.'},
    'data':      {'label': 'Data Access',       'icon': '🗄️', 'prefix': 'data.'},
}


class Permission(models.Model):
    code             = models.CharField(max_length=100, unique=True)
    label            = models.CharField(max_length=200)
    description      = models.CharField(max_length=300, blank=True)
    category         = models.CharField(max_length=20, choices=PERMISSION_CATEGORY_CHOICES, default='pages')
    page             = models.CharField(max_length=50, blank=True)
    is_default_staff  = models.BooleanField(default=False)
    is_default_client = models.BooleanField(default=False)
    sort_order        = models.IntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'code']

    def __str__(self):
        return f"{self.code} — {self.label}"


class RolePermission(models.Model):
    role       = models.CharField(max_length=20, choices=[('staff','Staff'),('client','Client')])
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name='role_permissions')
    is_granted = models.BooleanField(default=True)

    class Meta:
        unique_together = ('role', 'permission')

    def __str__(self):
        return f"{self.role} | {self.permission.code} | {'✓' if self.is_granted else '✗'}"


class UserPermission(models.Model):
    user_profile = models.ForeignKey('UserProfile', on_delete=models.CASCADE, related_name='permission_overrides')
    permission   = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name='user_overrides')
    is_granted   = models.BooleanField()
    granted_by   = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='granted_permissions')
    granted_at   = models.DateTimeField(auto_now_add=True)
    note         = models.CharField(max_length=300, blank=True)

    class Meta:
        unique_together = ('user_profile', 'permission')

    def __str__(self):
        return f"{self.user_profile.user.email} | {self.permission.code} | {'✓' if self.is_granted else '✗'}"


class StaffClientAssignment(models.Model):
    staff_profile = models.ForeignKey('UserProfile', on_delete=models.CASCADE, related_name='client_assignments')
    client        = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='staff_assignments')
    assigned_by   = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='made_assignments')
    assigned_at   = models.DateTimeField(auto_now_add=True)
    can_edit      = models.BooleanField(default=False)
    can_sync      = models.BooleanField(default=True)
    can_export    = models.BooleanField(default=True)
    note          = models.CharField(max_length=300, blank=True)

    class Meta:
        unique_together = ('staff_profile', 'client')

    def __str__(self):
        return f"{self.staff_profile.user.email} → {self.client.company}"


class ClientPageConfig(models.Model):
    client               = models.OneToOneField(Client, on_delete=models.CASCADE, related_name='page_config')
    portal_title         = models.CharField(max_length=200, default='My Dashboard')
    show_platform_tabs   = models.BooleanField(default=True)
    show_date_picker     = models.BooleanField(default=True)
    show_export_button   = models.BooleanField(default=True)
    show_sync_button     = models.BooleanField(default=False)
    show_posts_section   = models.BooleanField(default=True)
    show_reviews_section = models.BooleanField(default=False)
    show_roi_section     = models.BooleanField(default=False)
    show_calendar        = models.BooleanField(default=False)
    default_platform     = models.CharField(max_length=30, default='all')
    default_date_range   = models.IntegerField(default=30)
    custom_logo_url      = models.URLField(blank=True)
    custom_accent_color  = models.CharField(max_length=7, default='#2563EB')
    welcome_message      = models.TextField(blank=True)
    updated_at           = models.DateTimeField(auto_now=True)
    updated_by           = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_portal_configs')

    def __str__(self):
        return f"Portal config — {self.client.company}"


class CaptionRequest(models.Model):
    TONE_CHOICES = [
        ('professional', 'Professional'),
        ('casual', 'Casual'),
        ('funny', 'Funny'),
        ('inspirational', 'Inspirational'),
        ('urgent', 'Urgent'),
        ('friendly', 'Friendly'),
    ]
    POST_TYPE_CHOICES = [
        ('promotion', 'Promotion'),
        ('announcement', 'Announcement'),
        ('educational', 'Educational'),
        ('behind_scenes', 'Behind the Scenes'),
        ('product', 'Product Showcase'),
        ('event', 'Event'),
        ('tip', 'Tip & Advice'),
    ]

    client             = models.ForeignKey('Client', on_delete=models.CASCADE, related_name='caption_requests')
    topic              = models.TextField()
    tone               = models.CharField(max_length=20, choices=TONE_CHOICES, default='professional')
    post_type          = models.CharField(max_length=20, choices=POST_TYPE_CHOICES, default='promotion')
    platforms          = models.JSONField(default=list)
    keywords           = models.TextField(blank=True, default='')
    call_to_action     = models.CharField(max_length=200, blank=True, default='')
    generated_captions = models.JSONField(default=dict)
    created_at         = models.DateTimeField(auto_now_add=True)
    created_by         = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.client.company} – {self.topic[:50]}"


# ── AI Post Ideas Generator ────────────────────────────────────────────────────

BUSINESS_TYPE_CHOICES = [
    ('restaurant',   'Restaurant'),
    ('retail',       'Retail'),
    ('healthcare',   'Healthcare'),
    ('fitness',      'Fitness'),
    ('real_estate',  'Real Estate'),
    ('education',    'Education'),
    ('tech',         'Tech'),
    ('beauty',       'Beauty'),
    ('legal',        'Legal'),
    ('finance',      'Finance'),
    ('other',        'Other'),
]


class PostIdeaSet(models.Model):
    client          = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='post_idea_sets')
    month           = models.IntegerField()
    year            = models.IntegerField()
    business_type   = models.CharField(max_length=50, choices=BUSINESS_TYPE_CHOICES)
    location        = models.CharField(max_length=200, blank=True)
    upcoming_events = models.TextField(blank=True)
    target_audience = models.CharField(max_length=300, blank=True)
    platforms       = models.JSONField(default=list)
    ideas           = models.JSONField(default=dict)   # raw AI response
    posts_per_week  = models.IntegerField(default=5)
    generated_at    = models.DateTimeField(auto_now_add=True)
    generated_by    = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='generated_idea_sets')

    class Meta:
        ordering = ['-generated_at']

    def __str__(self):
        import calendar
        month_name = calendar.month_name[self.month]
        return f"{self.client.company} | {month_name} {self.year}"


class PostIdea(models.Model):
    idea_set             = models.ForeignKey(PostIdeaSet, on_delete=models.CASCADE, related_name='post_ideas')
    week_number          = models.IntegerField()
    day_of_week          = models.CharField(max_length=20)
    platform             = models.CharField(max_length=30)
    post_type            = models.CharField(max_length=30)
    topic                = models.CharField(max_length=500)
    caption_hint         = models.TextField()
    hashtag_hints        = models.JSONField(default=list)
    best_time            = models.CharField(max_length=50, blank=True)
    notes                = models.TextField(blank=True)
    is_approved          = models.BooleanField(default=False)
    is_added_to_calendar = models.BooleanField(default=False)
    converted_post       = models.ForeignKey(
        'CalendarPost', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='post_idea_source'
    )

    class Meta:
        ordering = ['week_number', 'id']

    def __str__(self):
        return f"{self.idea_set.client.company} | W{self.week_number} | {self.day_of_week} | {self.topic[:50]}"


# ── AI Hashtag Research Tool ───────────────────────────────────────────────────

class HashtagSet(models.Model):
    PLATFORM_CHOICES = [
        ('instagram', 'Instagram'),
        ('facebook',  'Facebook'),
        ('linkedin',  'LinkedIn'),
        ('youtube',   'YouTube'),
        ('tiktok',    'TikTok'),
    ]

    client      = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='hashtag_sets')
    niche       = models.CharField(max_length=200)
    location    = models.CharField(max_length=200, blank=True)
    platform    = models.CharField(max_length=30, choices=PLATFORM_CHOICES)
    hashtags    = models.JSONField(default=dict)   # full AI response
    saved_sets  = models.JSONField(default=list)   # [{name, tags, platform, created_at}]
    generated_at = models.DateTimeField(auto_now_add=True)
    generated_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='generated_hashtag_sets'
    )

    class Meta:
        ordering = ['-generated_at']

    def __str__(self):
        return f"{self.client.company} | {self.niche} | {self.platform}"
