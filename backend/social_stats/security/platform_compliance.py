# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Meta + Google compliance endpoints.

Meta App Review requires that we expose:
  • A "Data Deletion Request" callback URL that Meta calls when a user
    chooses to delete their data via Facebook's account settings.
  • A "Deauthorize" callback URL that Meta calls when a user removes our
    app from their Facebook connections.

Google has a similar requirement for their App Verification process.

Both providers expect:
  1. A confirmation code we mint immediately (string, ≤256 chars)
  2. A public status URL where the user can check progress
  3. The actual deletion processed within a reasonable window (Meta says
     "without undue delay"; we aim for <24h via Celery)

Storage
-------
``PlatformDataDeletionRequest`` is the system of record. Each row is keyed
by ``(provider, external_user_id, confirmation_code)`` so we can correlate
the platform's user-id with our internal Client/User context AND surface a
status URL the user can hit.

The signed_request format is Meta-specific (HMAC-SHA256 over base64url-encoded
JSON). We verify against ``META_APP_SECRET`` before trusting the payload —
otherwise an attacker could trigger arbitrary deletions by POSTing to our
public callback URL.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import secrets
import uuid
from typing import Optional

from django.conf import settings
from django.db import models


logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Model
# ─────────────────────────────────────────────────────────────────────────────
class PlatformDataDeletionRequest(models.Model):
    PROVIDER_CHOICES = [
        ('meta',   'Meta (Facebook / Instagram)'),
        ('google', 'Google'),
    ]
    KIND_CHOICES = [
        ('data_deletion', 'Data deletion request'),
        ('deauthorize',   'Deauthorization (app removed)'),
    ]
    STATUS_CHOICES = [
        ('queued',     'Queued'),
        ('processing', 'Processing'),
        ('completed',  'Completed'),
        ('failed',     'Failed'),
    ]

    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES, db_index=True)
    kind     = models.CharField(max_length=20, choices=KIND_CHOICES, default='data_deletion')

    external_user_id = models.CharField(max_length=80, db_index=True)
    confirmation_code = models.CharField(max_length=64, unique=True, db_index=True)

    # Optional cross-link to internal records — populated by the processor task
    # when it can match the external_user_id back to one of our PlatformCredentials.
    matched_credential = models.ForeignKey(
        'social_stats.PlatformCredential', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='deletion_requests',
    )

    raw_payload = models.JSONField(default=dict, blank=True)
    status      = models.CharField(max_length=20, choices=STATUS_CHOICES, default='queued')

    received_at  = models.DateTimeField(auto_now_add=True, db_index=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)

    class Meta:
        app_label = 'social_stats'
        ordering = ['-received_at']
        indexes = [
            models.Index(fields=['provider', 'status']),
            models.Index(fields=['provider', 'external_user_id']),
        ]

    def __str__(self):
        return (f'PlatformDataDeletionRequest<{self.provider} {self.kind} '
                f'ext={self.external_user_id} {self.status}>')


# ─────────────────────────────────────────────────────────────────────────────
# signed_request parser (Meta)
# ─────────────────────────────────────────────────────────────────────────────
class SignedRequestError(ValueError):
    """Raised when a Meta signed_request fails verification or parsing."""


def _b64url_decode(s: str) -> bytes:
    """Meta uses URL-safe base64 without padding."""
    s = s.replace('-', '+').replace('_', '/')
    s += '=' * (-len(s) % 4)
    return base64.b64decode(s)


def parse_meta_signed_request(signed_request: str, *, app_secret: Optional[str] = None) -> dict:
    """Verify HMAC + decode payload. Returns the JSON dict on success.

    Format: ``<signature_b64url>.<payload_b64url>`` where signature is
    HMAC-SHA256(payload_b64url, app_secret).

    Raises SignedRequestError on any failure — caller should return 400.
    """
    if not signed_request or '.' not in signed_request:
        raise SignedRequestError('malformed signed_request')

    secret = (app_secret or getattr(settings, 'META_APP_SECRET', '') or '').encode()
    if not secret:
        raise SignedRequestError('META_APP_SECRET not configured')

    sig_b64, payload_b64 = signed_request.split('.', 1)
    try:
        sig = _b64url_decode(sig_b64)
    except Exception as e:
        raise SignedRequestError(f'bad signature encoding: {e}') from e

    expected = hmac.new(secret, payload_b64.encode(), hashlib.sha256).digest()
    if not hmac.compare_digest(sig, expected):
        raise SignedRequestError('signature mismatch')

    try:
        payload = json.loads(_b64url_decode(payload_b64).decode('utf-8'))
    except (ValueError, UnicodeDecodeError) as e:
        raise SignedRequestError(f'bad payload: {e}') from e

    if not isinstance(payload, dict):
        raise SignedRequestError('payload not a JSON object')
    if payload.get('algorithm') and payload['algorithm'].upper() != 'HMAC-SHA256':
        raise SignedRequestError(f'unsupported algorithm {payload.get("algorithm")}')

    return payload


# ─────────────────────────────────────────────────────────────────────────────
# Confirmation code generator
# ─────────────────────────────────────────────────────────────────────────────
def mint_confirmation_code() -> str:
    """Random 32-char hex; unique-constrained at the DB level."""
    return secrets.token_hex(16)


# ─────────────────────────────────────────────────────────────────────────────
# Processor — invoked async from the Celery task
# ─────────────────────────────────────────────────────────────────────────────
def process_platform_deletion(request_id: int) -> str:
    """Carry out the actual deletion for a queued request.

    For ``meta`` deauth/deletion: revoke matching PlatformCredential rows
    (so we stop calling Graph for that user) and audit.

    For ``google``: same pattern, scoped to the google credential.
    """
    from ..models import PlatformCredential
    from django.utils import timezone

    req = PlatformDataDeletionRequest.objects.filter(pk=request_id).first()
    if not req:
        return 'not_found'
    if req.status != 'queued':
        return f'noop:{req.status}'

    req.status = 'processing'
    req.save(update_fields=['status'])

    try:
        # Match credentials by the platform user-id stored on the credential.
        # We persist the FB/Google user-id at OAuth-callback time on
        # PlatformCredential.platform_user_id (existing field).
        platform_filter = (
            ['facebook', 'instagram'] if req.provider == 'meta' else
            ['google_my_business', 'youtube'] if req.provider == 'google' else
            []
        )
        matches = PlatformCredential.objects.filter(
            platform__in=platform_filter, platform_user_id=req.external_user_id,
        )

        if matches.exists():
            req.matched_credential = matches.first()

        # Revoke each credential — flips is_active=False so refresh / sync skip it.
        # We do NOT delete the row outright — it's referenced from logs.
        n_revoked = matches.update(
            is_active=False,
            access_token='',         # wipe the token
            refresh_token='',
            expires_at=timezone.now(),
        )

        # Audit row
        try:
            from . import audit
            audit.record(
                event_type='token_revoked',
                target_object_type='PlatformDataDeletionRequest',
                target_object_id=req.id,
                description=f'{req.provider} {req.kind} for ext_user={req.external_user_id}',
                metadata={
                    'provider': req.provider,
                    'kind':     req.kind,
                    'credentials_revoked': n_revoked,
                },
                severity='warning' if n_revoked else 'info',
            )
        except Exception:
            pass

        req.status       = 'completed'
        req.completed_at = timezone.now()
        req.save(update_fields=['status', 'completed_at', 'matched_credential'])
        return 'completed'

    except Exception as e:  # noqa: BLE001
        logger.exception('process_platform_deletion failed: req=%s', req.id)
        req.status        = 'failed'
        req.error_message = str(e)[:500]
        req.save(update_fields=['status', 'error_message'])
        return 'failed'
