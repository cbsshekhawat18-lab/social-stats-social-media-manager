# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Centralized encryption API.

The functional `social_stats.crypto` module is the source of truth — all
encryption goes through MultiFernet there. This class is a typed wrapper
that mirrors the API the security spec calls for, so callers who prefer
the OO style can use it without duplicating cipher logic.

Usage:
    from social_stats.security import TokenEncryption

    blob = TokenEncryption.encrypt('refresh-token-xyz')   # → "enc::..."
    plain = TokenEncryption.decrypt(blob)                 # → "refresh-token-xyz"
    rotated = TokenEncryption.rotate(blob)                # → "enc::..." (primary key)
"""
from __future__ import annotations

from .. import crypto


class TokenEncryption:
    """envelope encryption with key rotation.

    Keys are read from settings.FIELD_ENCRYPTION_KEYS (comma-separated,
    primary first). All keys decrypt; only the first encrypts new writes.

    See `social_stats.crypto._key_list` for full resolution order +
    backwards-compat fallback to FIELD_ENCRYPTION_KEY / SECRET_KEY.
    """

    @staticmethod
    def encrypt(plaintext: str) -> str:
        """Encrypt a string with the current primary key. Empty / None
        returned unchanged so callers don't have to null-check.
        Output format: ``enc::<urlsafe-b64-fernet>``."""
        return crypto.encrypt_value(plaintext)

    @staticmethod
    def decrypt(ciphertext: str) -> str:
        """Decrypt; tries every configured key in order. Legacy plaintext
        (no ``enc::`` prefix) returned unchanged for graceful migration."""
        return crypto.decrypt_value(ciphertext)

    @staticmethod
    def rotate(ciphertext: str) -> str:
        """Re-encrypt with the current primary key. Idempotent.

        Used by the rotation Celery task to migrate ciphertexts off a
        retired key after it's been added at position [0] in
        FIELD_ENCRYPTION_KEYS. Legacy plaintext is also "rotated" by
        being encrypted for the first time."""
        return crypto.re_encrypt_value(ciphertext)
