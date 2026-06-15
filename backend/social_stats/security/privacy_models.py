# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
privacy / data-subject-rights models.

Three rows track the lifecycle of every request:

  • ``DataExportRequest``     — GDPR Art.15 / DPDP §11 (right to access)
  • ``AccountDeletionRequest`` — GDPR Art.17 / DPDP §12 (right to erasure)
                                 with 30-day grace period for accidental clicks
  • ``UserConsent``            — GDPR Art.7 / DPDP §6 (granular consent log)

All three append, never edit. The Celery tasks in `privacy_tasks.py` move
them through their states: queued → in_progress → completed / failed.
"""
from __future__ import annotations

from django.conf import settings
from django.db import models


# ─────────────────────────────────────────────────────────────────────────────
# Data export (right to access / portability)
# ─────────────────────────────────────────────────────────────────────────────
class DataExportRequest(models.Model):
    STATUS_CHOICES = [
        ('queued',     'Queued'),
        ('processing', 'Processing'),
        ('completed',  'Completed'),
        ('failed',     'Failed'),
        ('expired',    'Download Expired'),
    ]

    user        = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                    related_name='data_export_requests')
    status      = models.CharField(max_length=20, choices=STATUS_CHOICES, default='queued')
    requested_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Where the assembled ZIP lives. Could be S3 key in prod, local path in dev.
    archive_path = models.CharField(max_length=500, blank=True)
    archive_size_bytes = models.BigIntegerField(default=0)
    download_token     = models.UUIDField(null=True, blank=True, db_index=True)
    download_expires_at = models.DateTimeField(null=True, blank=True)

    error_message = models.TextField(blank=True)

    class Meta:
        app_label = 'social_stats'
        ordering = ['-requested_at']
        indexes = [
            models.Index(fields=['user', '-requested_at']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f'DataExportRequest<#{self.id} user={self.user_id} {self.status}>'


# ─────────────────────────────────────────────────────────────────────────────
# Account deletion (right to erasure)
# ─────────────────────────────────────────────────────────────────────────────
class AccountDeletionRequest(models.Model):
    STATUS_CHOICES = [
        ('queued',    'Queued (in grace period)'),
        ('cancelled', 'Cancelled by user'),
        ('processing', 'Processing'),
        ('completed', 'Completed (anonymised)'),
        ('failed',    'Failed'),
    ]

    user           = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                       null=True, blank=True, related_name='deletion_requests')
    user_email_at_request = models.EmailField()  # preserved post-anonymisation
    status         = models.CharField(max_length=20, choices=STATUS_CHOICES, default='queued')
    reason         = models.TextField(blank=True)

    requested_at   = models.DateTimeField(auto_now_add=True)
    grace_until    = models.DateTimeField(db_index=True)  # set to requested_at + 30d
    cancelled_at   = models.DateTimeField(null=True, blank=True)
    processed_at   = models.DateTimeField(null=True, blank=True)

    # Audit fingerprint of the user record AFTER anonymisation, so we can
    # confirm "this request was honoured" without keeping the email.
    anonymised_user_id_hash = models.CharField(max_length=64, blank=True)

    error_message = models.TextField(blank=True)

    class Meta:
        app_label = 'social_stats'
        ordering = ['-requested_at']
        indexes = [
            models.Index(fields=['status', 'grace_until']),
        ]

    def __str__(self):
        return f'AccountDeletionRequest<#{self.id} {self.status} grace_until={self.grace_until:%Y-%m-%d}>'


# ─────────────────────────────────────────────────────────────────────────────
# Granular consent (GDPR Art.7 / DPDP §6)
# ─────────────────────────────────────────────────────────────────────────────
CONSENT_TYPES = [
    ('marketing_emails',    'Marketing emails'),
    ('product_emails',      'Product update emails'),
    ('cookies_analytics',   'Analytics cookies'),
    ('cookies_marketing',   'Marketing cookies'),
    ('ai_processing_optout', 'AI processing — opt out'),
    ('whatsapp_marketing',  'WhatsApp marketing messages'),
    ('data_processing',     'Core service data processing'),
]


class UserConsent(models.Model):
    """One row per consent change. Append-only — withdrawing consent inserts
    a NEW row with given=False, so the audit trail of decisions is intact."""
    user         = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                     related_name='consent_records')
    consent_type = models.CharField(max_length=40, choices=CONSENT_TYPES, db_index=True)
    given        = models.BooleanField()
    given_at     = models.DateTimeField(auto_now_add=True)
    given_via    = models.CharField(max_length=40, blank=True)
    # 'signup_form' | 'cookie_banner' | 'settings_page' | 'email_link' | etc.
    ip_address   = models.GenericIPAddressField(null=True, blank=True)
    user_agent   = models.TextField(blank=True)
    text_version = models.CharField(max_length=20, blank=True)  # privacy-policy version

    class Meta:
        app_label = 'social_stats'
        ordering = ['-given_at']
        indexes = [
            models.Index(fields=['user', 'consent_type', '-given_at']),
        ]

    def __str__(self):
        return f'UserConsent<{self.consent_type}={self.given} user={self.user_id}>'
