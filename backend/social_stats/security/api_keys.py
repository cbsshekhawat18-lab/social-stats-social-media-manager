# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
API Key authentication for programmatic access.

Storage model
-------------
* On create we generate ``sk_live_<32 random chars>`` (or ``sk_test_`` for
  test mode) and return it ONCE. The DB stores SHA-256(key) only.
* `key_prefix` (first 12 chars: ``sk_live_xxxx``) is displayed in lists so
  users can identify which key is which without holding the secret.

Auth flow
---------
``Authorization: Bearer sk_live_xxx`` → APIKeyAuthentication looks up the
hash, validates scope/expiry/IP, returns ``(client.owner_user, api_key)``
so DRF's ``request.user`` is a real user (the key's creator) and
``request.auth`` is the APIKey row (for scope checks).
"""
from __future__ import annotations

import hashlib
import hmac
import ipaddress
import logging
import secrets
from datetime import timedelta
from typing import Optional

from django.conf import settings
from django.db import models
from django.utils import timezone
from rest_framework import authentication, exceptions


logger = logging.getLogger(__name__)


KEY_PREFIX_LIVE = 'sk_live_'
KEY_PREFIX_TEST = 'sk_test_'
KEY_BODY_LEN = 32  # urlsafe-base64 chars after the prefix
DISPLAY_PREFIX_LEN = len(KEY_PREFIX_LIVE) + 4   # e.g. "sk_live_aBc1"


# ─────────────────────────────────────────────────────────────────────────────
# Model
# ─────────────────────────────────────────────────────────────────────────────
class APIKey(models.Model):
    """A scoped API key for programmatic access, owned by a Client.

    Created by a User (``created_by``) but authenticates AS that user — i.e.
    the key inherits the user's row-level permissions plus the additional
    scope filter declared at creation.
    """
    client     = models.ForeignKey(
        'social_stats.Client', on_delete=models.CASCADE, related_name='api_keys',
    )
    name       = models.CharField(max_length=200)
    key_prefix = models.CharField(max_length=20, db_index=True)   # "sk_live_aBc1"
    key_hash   = models.CharField(max_length=128, db_index=True)  # SHA-256 hex
    scopes     = models.JSONField(default=list, blank=True)
    # Examples: ['read:posts', 'write:posts', 'read:leads']
    ip_allowlist = models.JSONField(default=list, blank=True)
    # Optional list of CIDRs ['1.2.3.0/24', '5.6.7.8/32']

    last_used_at = models.DateTimeField(null=True, blank=True)
    last_used_ip = models.GenericIPAddressField(null=True, blank=True)
    use_count    = models.IntegerField(default=0)

    expires_at  = models.DateTimeField(null=True, blank=True)
    is_active   = models.BooleanField(default=True)
    created_by  = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_api_keys',
    )
    created_at  = models.DateTimeField(auto_now_add=True)
    revoked_at  = models.DateTimeField(null=True, blank=True)
    revoke_reason = models.CharField(max_length=80, blank=True)

    class Meta:
        app_label = 'social_stats'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['client', 'is_active']),
            models.Index(fields=['key_hash']),
        ]

    def __str__(self):
        return f'APIKey<{self.key_prefix}… client={self.client_id} {"active" if self.is_active else "revoked"}>'

    @property
    def is_expired(self) -> bool:
        return bool(self.expires_at and timezone.now() >= self.expires_at)

    @property
    def is_usable(self) -> bool:
        return bool(self.is_active and self.revoked_at is None and not self.is_expired)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
def _hash_key(key: str) -> str:
    return hashlib.sha256(key.encode('utf-8')).hexdigest()


def generate_key(*, test_mode: bool = False) -> tuple[str, str, str]:
    """Generate a fresh API key. Returns ``(plaintext, prefix, hash)``.

    plaintext is shown to the caller exactly ONCE. Only ``prefix`` and ``hash``
    are persisted.
    """
    body = secrets.token_urlsafe(KEY_BODY_LEN)[:KEY_BODY_LEN]
    prefix = KEY_PREFIX_TEST if test_mode else KEY_PREFIX_LIVE
    plaintext = f'{prefix}{body}'
    return plaintext, plaintext[:DISPLAY_PREFIX_LEN], _hash_key(plaintext)


def lookup_key(plaintext: str) -> Optional[APIKey]:
    """Resolve a plaintext key to its row. Returns None if not found, expired,
    or revoked. Constant-time equality is unnecessary because the hash IS the
    DB key — the lookup itself doesn't leak anything."""
    if not plaintext or not plaintext.startswith((KEY_PREFIX_LIVE, KEY_PREFIX_TEST)):
        return None
    target_hash = _hash_key(plaintext)
    return APIKey.objects.select_related('client', 'created_by').filter(
        key_hash=target_hash, is_active=True, revoked_at__isnull=True,
    ).first()


def verify_ip(api_key: APIKey, ip: Optional[str]) -> bool:
    """If the key has an ip_allowlist, ``ip`` must match one of its CIDRs.
    Empty allowlist = allow any."""
    cidrs = list(api_key.ip_allowlist or [])
    if not cidrs:
        return True
    if not ip:
        return False
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    for c in cidrs:
        try:
            if addr in ipaddress.ip_network(c, strict=False):
                return True
        except ValueError:
            continue
    return False


def has_scope(api_key: APIKey, required_scope: str) -> bool:
    """Return True if the key declares ``required_scope``. Wildcard ``*`` or
    matching prefix (e.g. ``read:*``) honoured."""
    if not required_scope:
        return True
    scopes = api_key.scopes or []
    if '*' in scopes or required_scope in scopes:
        return True
    bucket = required_scope.split(':', 1)[0] + ':*'
    return bucket in scopes


# ─────────────────────────────────────────────────────────────────────────────
# DRF authentication backend
# ─────────────────────────────────────────────────────────────────────────────
class APIKeyAuthentication(authentication.BaseAuthentication):
    """Recognises ``Authorization: Bearer sk_live_xxx`` / ``sk_test_xxx``.

    On success returns ``(user, api_key)`` where:
        user     = api_key.created_by  (so existing tenant-filter logic works)
        request.auth = APIKey row      (for scope-aware permission classes)

    On failure returns None (lets JWT auth take over). On *malformed* key
    raises AuthenticationFailed so the client gets a 401 instead of silent
    fallthrough.
    """
    keyword_lc = 'bearer'

    def authenticate(self, request):
        auth_header = (request.META.get('HTTP_AUTHORIZATION') or '').strip()
        if not auth_header:
            return None
        parts = auth_header.split(None, 1)
        if len(parts) != 2 or parts[0].lower() != self.keyword_lc:
            return None
        token = parts[1].strip()
        if not token.startswith((KEY_PREFIX_LIVE, KEY_PREFIX_TEST)):
            return None  # JWT — let JWTAuthentication handle it

        api_key = lookup_key(token)
        if not api_key or not api_key.is_usable:
            raise exceptions.AuthenticationFailed('invalid or revoked API key')

        ip = _client_ip(request)
        if not verify_ip(api_key, ip):
            raise exceptions.AuthenticationFailed('IP not in API-key allowlist')

        if not api_key.created_by_id:
            raise exceptions.AuthenticationFailed('API key has no associated user')

        user = api_key.created_by
        if not user.is_active:
            raise exceptions.AuthenticationFailed('API key owner deactivated')

        # Stamp last-used (cheap; bump count)
        try:
            APIKey.objects.filter(pk=api_key.pk).update(
                last_used_at=timezone.now(),
                last_used_ip=ip or None,
                use_count=models.F('use_count') + 1,
            )
        except Exception:
            pass

        return (user, api_key)

    def authenticate_header(self, request):
        return 'Bearer'


def _client_ip(request) -> Optional[str]:
    if not request:
        return None
    xff = request.META.get('HTTP_X_FORWARDED_FOR') or ''
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')
