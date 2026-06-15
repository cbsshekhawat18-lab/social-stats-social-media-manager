# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Multi-Factor Authentication (TOTP + backup codes).

Storage
-------
* ``UserMFA.totp_secret`` is encrypted at rest via the Stage-1 EncryptedTextField
  (so a leaked DB doesn't hand attackers everyone's TOTP seeds).
* ``UserMFA.backup_codes`` stores the SHA-256 hash of each one-time backup code.
  We never store the plaintext; codes are returned to the user exactly once on
  setup / regeneration.

Login flow (orchestrated in views.LoginView)
--------------------------------------------
  1. POST /api/auth/login/ with {username, password}
  2. If user has MFA enabled → respond 401 with ``{"mfa_required": true,
     "mfa_token": "<short-lived signed token>"}`` instead of issuing JWTs.
  3. Frontend prompts for OTP, then POSTs /api/auth/mfa/login/ with the
     ``mfa_token`` + the 6-digit code (or backup code).
  4. On success, the regular {access, refresh} pair is issued.

The mfa_token is a Django ``signing`` payload with a 5-min TTL — it carries
just the user_id and is bound to the IP that requested it (defence against
the case where step-1 happens on the attacker's machine and step-2 on the
victim's).
"""
from __future__ import annotations

import base64
import hashlib
import io
import logging
import secrets
from typing import Optional

from django.conf import settings
from django.core import signing
from django.db import models
from django.utils import timezone

from ..fields import EncryptedTextField


logger = logging.getLogger(__name__)


MFA_ISSUER = 'Social Stats'
BACKUP_CODE_COUNT = 10
MFA_TOKEN_SALT = 'socialstats-mfa-handshake'
MFA_TOKEN_TTL  = 300  # seconds


# ─────────────────────────────────────────────────────────────────────────────
# Model
# ─────────────────────────────────────────────────────────────────────────────
class UserMFA(models.Model):
    """One row per user. Created lazily on first /mfa/setup/ call."""
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='mfa',
    )
    is_enabled  = models.BooleanField(default=False)
    totp_secret = EncryptedTextField(blank=True)   # base32, encrypted at rest
    # backup_codes = list of {hash, used: bool, used_at: iso8601}
    backup_codes = models.JSONField(default=list, blank=True)

    enabled_at   = models.DateTimeField(null=True, blank=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    last_used_method = models.CharField(max_length=20, blank=True)
    # 'totp' / 'backup_code'

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'social_stats'

    def __str__(self):
        state = 'enabled' if self.is_enabled else 'pending'
        return f'UserMFA<user={self.user_id} {state}>'

    # ── Helpers ───────────────────────────────────────────────────────────
    def remaining_backup_codes(self) -> int:
        return sum(1 for c in (self.backup_codes or []) if not c.get('used'))


# ─────────────────────────────────────────────────────────────────────────────
# TOTP helpers
# ─────────────────────────────────────────────────────────────────────────────
def provision_secret(user) -> tuple[UserMFA, str, str]:
    """Create-or-replace an MFA row in PENDING state. Returns
    (mfa_row, base32_secret, otpauth_url). The frontend renders either the
    secret (for manual entry) or the otpauth URL (for QR code).

    Idempotent: re-calling before verification rotates the secret. After
    verification, this call is rejected — use disable() then setup again.
    """
    import pyotp
    mfa, _ = UserMFA.objects.get_or_create(user=user)
    if mfa.is_enabled:
        raise ValueError('MFA already enabled. Disable it first to re-provision.')

    secret = pyotp.random_base32()
    mfa.totp_secret = secret
    mfa.is_enabled = False
    mfa.backup_codes = []  # clear any stale ones
    mfa.save(update_fields=['totp_secret', 'is_enabled', 'backup_codes', 'updated_at'])

    label = user.email or user.username or f'user-{user.id}'
    url = pyotp.totp.TOTP(secret).provisioning_uri(name=label, issuer_name=MFA_ISSUER)
    return mfa, secret, url


def qr_data_uri(otpauth_url: str) -> str:
    """Render the otpauth URL as a base64 PNG data URI for inline <img>."""
    import qrcode
    img = qrcode.make(otpauth_url)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    b64 = base64.b64encode(buf.getvalue()).decode('ascii')
    return f'data:image/png;base64,{b64}'


def verify_totp(mfa: UserMFA, code: str) -> bool:
    """Verify a 6-digit TOTP. ±1 step (30s) tolerance for clock drift."""
    import pyotp
    if not mfa.totp_secret or not code:
        return False
    cleaned = ''.join(c for c in code if c.isdigit())
    if len(cleaned) != 6:
        return False
    try:
        return pyotp.TOTP(mfa.totp_secret).verify(cleaned, valid_window=1)
    except Exception:
        return False


# ─────────────────────────────────────────────────────────────────────────────
# Backup codes
# ─────────────────────────────────────────────────────────────────────────────
def _hash_backup_code(code: str) -> str:
    return hashlib.sha256(code.encode('utf-8')).hexdigest()


def generate_backup_codes(mfa: UserMFA, *, count: int = BACKUP_CODE_COUNT) -> list[str]:
    """Generate ``count`` fresh backup codes. Stores only their hashes.
    Returns the plaintext codes — the caller is responsible for showing them
    exactly ONCE to the user."""
    plaintext = [secrets.token_hex(5).upper() for _ in range(count)]  # 10 hex chars
    mfa.backup_codes = [
        {'hash': _hash_backup_code(p), 'used': False} for p in plaintext
    ]
    mfa.save(update_fields=['backup_codes', 'updated_at'])
    return plaintext


def consume_backup_code(mfa: UserMFA, code: str) -> bool:
    """Return True iff ``code`` matches an unused backup code; mark it used."""
    if not code:
        return False
    cleaned = code.strip().upper().replace(' ', '').replace('-', '')
    target = _hash_backup_code(cleaned)
    rows = list(mfa.backup_codes or [])
    for row in rows:
        if row.get('used'):
            continue
        if secrets_equal(row.get('hash', ''), target):
            row['used'] = True
            row['used_at'] = timezone.now().isoformat()
            mfa.backup_codes = rows
            mfa.save(update_fields=['backup_codes', 'updated_at'])
            return True
    return False


def secrets_equal(a: str, b: str) -> bool:
    """Constant-time hex string comparison."""
    import hmac
    return hmac.compare_digest(a.encode(), b.encode())


# ─────────────────────────────────────────────────────────────────────────────
# MFA handshake token — used between password-step and OTP-step of login
# ─────────────────────────────────────────────────────────────────────────────
def issue_mfa_token(*, user_id: int, ip: Optional[str]) -> str:
    """Sign a short-lived blob carrying user_id + IP binding."""
    return signing.dumps({'uid': user_id, 'ip': ip or ''}, salt=MFA_TOKEN_SALT)


def parse_mfa_token(token: str, *, expected_ip: Optional[str]) -> Optional[int]:
    """Return user_id if the token is valid, fresh, AND the IP matches.
    Returns None on any failure (no info disclosure)."""
    try:
        payload = signing.loads(token, salt=MFA_TOKEN_SALT, max_age=MFA_TOKEN_TTL)
    except signing.BadSignature:
        return None
    if not isinstance(payload, dict):
        return None
    bound_ip = (payload.get('ip') or '')
    if expected_ip and bound_ip and bound_ip != expected_ip:
        return None
    uid = payload.get('uid')
    return int(uid) if uid else None
