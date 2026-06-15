# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
security audit log.

A dedicated, append-only log for security-sensitive events. Lives alongside
(NOT replacing) the existing user-facing ``ActivityLog`` and the older
``ActionLog`` — those serve product-level activity feeds; this one serves
security audits, compliance reviews (DPDP / GDPR / SOC 2), and incident
response.

Retention: 7 years (regulatory baseline). Cleanup task in tasks.py.

Use:
    from social_stats.security import audit
    audit.record(
        event_type='login_success',
        actor_user=user,
        request=request,
        target_object_type='User', target_object_id=user.id,
        metadata={'method': 'password'},
    )

The helper handles sanitization (no tokens/passwords in metadata), severity
defaulting, IP extraction, and request-id correlation.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from django.conf import settings
from django.db import models
from django.utils import timezone


logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Event registry — every value here is a known security event. Calls with
# unknown event_types are accepted (we'd rather over-log than under-log) but
# logged at WARNING so registry drift surfaces.
# ─────────────────────────────────────────────────────────────────────────────
SECURITY_EVENTS: set[str] = {
    # Auth
    'login_success', 'login_failed', 'logout',
    'password_changed', 'password_reset_requested', 'password_reset_completed',
    'mfa_setup_started', 'mfa_enabled', 'mfa_disabled',
    'mfa_used', 'backup_code_used', 'mfa_login_failed',
    'session_revoked', 'sign_out_everywhere',
    'suspicious_login',
    # Authorization
    'permission_granted', 'permission_denied', 'permission_changed',
    'role_changed', 'admin_action',
    # Data access
    'sensitive_data_accessed', 'data_exported', 'data_deleted', 'bulk_operation',
    # Token / credential
    'token_added', 'token_rotated', 'token_revoked', 'token_expired',
    'api_key_created', 'api_key_revoked', 'api_key_used',
    # Marketplace
    'relation_created', 'relation_terminated',
    'approval_granted', 'approval_rejected',
    # Compliance
    'data_export_requested', 'data_deletion_requested',
    'consent_given', 'consent_withdrawn',
    'privacy_settings_changed',
}


# Keys whose values must NEVER appear in the audit log. Match is
# case-insensitive on the key. Substring matches catch e.g. 'access_token',
# 'refresh_token', 'aws_secret_access_key'.
_LOG_REDACT_PATTERNS = (
    'password', 'token', 'secret', 'authorization', 'api_key',
    'access_token', 'refresh_token', 'totp', 'backup_code', 'cookie',
    'private_key', 'aadhaar', 'ssn', 'pan',
)
_REDACTED = '[REDACTED]'


def sanitize_log(value: Any) -> Any:
    """Recursively redact sensitive keys in a dict/list. Strings + numbers
    pass through; only dict KEYS are checked.

    Idempotent: re-running on already-redacted data is a no-op.
    """
    if isinstance(value, dict):
        out = {}
        for k, v in value.items():
            kl = str(k).lower()
            if any(pat in kl for pat in _LOG_REDACT_PATTERNS):
                out[k] = _REDACTED
            else:
                out[k] = sanitize_log(v)
        return out
    if isinstance(value, (list, tuple)):
        return [sanitize_log(v) for v in value]
    return value


# ─────────────────────────────────────────────────────────────────────────────
# Model
# ─────────────────────────────────────────────────────────────────────────────
SEVERITY_CHOICES = [
    ('info',     'Info'),
    ('warning',  'Warning'),
    ('critical', 'Critical'),
]


class SecurityAuditLog(models.Model):
    """One row per security-relevant event. Append-only — no admin edits."""

    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    event_type = models.CharField(max_length=60, db_index=True)
    severity   = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='info')

    actor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='security_audit_actor',
    )
    actor_ip         = models.GenericIPAddressField(null=True, blank=True)
    actor_user_agent = models.TextField(blank=True)
    actor_country    = models.CharField(max_length=2, blank=True)

    target_object_type = models.CharField(max_length=60, blank=True)
    target_object_id   = models.CharField(max_length=64, blank=True)
    target_client = models.ForeignKey(
        'social_stats.Client', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='security_audit_targeted',
    )

    description = models.TextField(blank=True)
    metadata    = models.JSONField(default=dict, blank=True)

    request_id  = models.CharField(max_length=64, blank=True, db_index=True)
    success     = models.BooleanField(default=True)

    class Meta:
        app_label = 'social_stats'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['-timestamp']),
            models.Index(fields=['actor_user', '-timestamp']),
            models.Index(fields=['target_client', '-timestamp']),
            models.Index(fields=['event_type', '-timestamp']),
            models.Index(fields=['severity', '-timestamp']),
        ]

    def __str__(self):
        return f'SecurityAuditLog<{self.event_type} actor={self.actor_user_id} @ {self.timestamp:%Y-%m-%d %H:%M}>'


# ─────────────────────────────────────────────────────────────────────────────
# record() — the call site for every event
# ─────────────────────────────────────────────────────────────────────────────
DEFAULT_SEVERITIES = {
    'login_failed':           'warning',
    'mfa_login_failed':       'warning',
    'suspicious_login':       'warning',
    'password_reset_requested': 'info',
    'permission_denied':      'warning',
    'admin_action':           'warning',
    'token_revoked':          'warning',
    'api_key_revoked':        'warning',
    'data_deletion_requested': 'critical',
    'data_exported':          'critical',
}


def _client_ip_from_request(request) -> Optional[str]:
    if not request:
        return None
    xff = request.META.get('HTTP_X_FORWARDED_FOR') or ''
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def record(
    *,
    event_type: str,
    actor_user=None,
    request=None,
    target_object_type: str = '',
    target_object_id: Any = '',
    target_client=None,
    description: str = '',
    metadata: Optional[dict] = None,
    severity: Optional[str] = None,
    success: bool = True,
) -> Optional[SecurityAuditLog]:
    """Persist a security event. Returns the row, or None on failure (we
    NEVER let an audit-write failure break the calling flow).

    `metadata` is sanitized: any key matching `_LOG_REDACT_PATTERNS` is
    replaced with '[REDACTED]' before storage.
    """
    if event_type not in SECURITY_EVENTS:
        logger.warning('audit.record: unknown event_type %s — recording anyway', event_type)

    sev = (severity or DEFAULT_SEVERITIES.get(event_type)
           or ('warning' if not success else 'info'))

    ua = ''
    request_id = ''
    if request is not None:
        ua = (request.META.get('HTTP_USER_AGENT') or '')[:1000]
        request_id = getattr(request, 'id', '') or ''

    safe_meta = sanitize_log(metadata or {})

    try:
        return SecurityAuditLog.objects.create(
            event_type=event_type,
            severity=sev,
            actor_user=actor_user if (actor_user and getattr(actor_user, 'pk', None)) else None,
            actor_ip=_client_ip_from_request(request),
            actor_user_agent=ua,
            target_object_type=str(target_object_type)[:60],
            target_object_id=str(target_object_id)[:64] if target_object_id else '',
            target_client=target_client,
            description=str(description)[:2000],
            metadata=safe_meta,
            request_id=str(request_id)[:64],
            success=bool(success),
        )
    except Exception:
        logger.exception('audit.record failed for event=%s', event_type)
        return None


def cleanup_old_logs(*, days: int = 2555) -> int:
    """Delete logs older than ``days`` (default 7 years). Wire to a Celery
    beat job — DPDP/GDPR don't FORCE us to delete, but storing forever is
    a separate retention liability."""
    from datetime import timedelta
    cutoff = timezone.now() - timedelta(days=days)
    n, _ = SecurityAuditLog.objects.filter(timestamp__lt=cutoff).delete()
    return n
