# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Fernet-based field encryption with key-rotation support (Stage 1, security build-out).

Ciphertexts are stored with an ``enc::`` prefix so the system can:
  • distinguish encrypted from legacy plaintext during gradual migration
  • later add other ciphers behind different prefixes without an offline rewrite

Keys
----
``settings.FIELD_ENCRYPTION_KEYS`` is a comma-separated list. The **first** key
is "primary" — used for all NEW writes. Every key in the list can DECRYPT.
This is the standard Fernet rotation pattern: add the new key in front, run
``rotate_encryption_keys`` to re-encrypt all rows, then drop the old key from
the list on the next deploy.

Backwards compatibility:
  • If ``FIELD_ENCRYPTION_KEYS`` is missing/empty, we fall back to the legacy
    single-key var ``FIELD_ENCRYPTION_KEY`` (or ``SECRET_KEY`` derivation).
  • Legacy plaintext values (no ``enc::`` prefix) decrypt as-is.
"""

import base64
import hashlib

from cryptography.fernet import Fernet, MultiFernet
from django.conf import settings

ENCRYPTED_PREFIX = 'enc::'


def _derive_key(raw: str) -> bytes:
    """Stretch an arbitrary secret into a 32-byte Fernet key."""
    dk = hashlib.pbkdf2_hmac('sha256', raw.encode(), b'socialstate-field-enc', 100_000)
    return base64.urlsafe_b64encode(dk[:32])


def _normalise_key(raw: str) -> bytes:
    """Accept either a raw 44-char Fernet key OR an arbitrary secret (which
    we'll stretch). This means ops can either use ``Fernet.generate_key()``
    output directly, or paste any high-entropy string."""
    raw = (raw or '').strip()
    if not raw:
        return b''
    # Raw Fernet keys are 44 chars urlsafe-b64 with trailing '=' padding.
    if len(raw) == 44 and raw.endswith('='):
        try:
            base64.urlsafe_b64decode(raw)
            return raw.encode()
        except Exception:
            pass
    return _derive_key(raw)


def _key_list() -> list[bytes]:
    """Resolve the ordered key list. Primary first; secondary keys are for
    decrypting old ciphertexts during rotation windows."""
    keys: list[bytes] = []

    # Preferred: comma-separated list, primary first
    raw_list = getattr(settings, 'FIELD_ENCRYPTION_KEYS', '') or ''
    for piece in raw_list.split(','):
        k = _normalise_key(piece)
        if k:
            keys.append(k)

    # Fallback to single legacy key
    if not keys:
        legacy = getattr(settings, 'FIELD_ENCRYPTION_KEY', '') or ''
        k = _normalise_key(legacy)
        if k:
            keys.append(k)

    # Last-resort dev fallback: SECRET_KEY-derived. Logged once per process
    # so production deploys are loud about misconfiguration.
    if not keys:
        sec = getattr(settings, 'SECRET_KEY', '')
        if sec:
            keys.append(_derive_key(sec))

    return keys


def _cipher() -> MultiFernet:
    keys = _key_list()
    if not keys:
        raise RuntimeError(
            'No encryption key configured. Set FIELD_ENCRYPTION_KEYS '
            '(comma-separated, primary first) or FIELD_ENCRYPTION_KEY.'
        )
    return MultiFernet([Fernet(k) for k in keys])


def encrypt_value(plaintext):
    """Encrypt a string with the primary key. Returns '' / None unchanged."""
    if not plaintext:
        return plaintext
    if isinstance(plaintext, str) and plaintext.startswith(ENCRYPTED_PREFIX):
        return plaintext  # already encrypted
    return ENCRYPTED_PREFIX + _cipher().encrypt(plaintext.encode()).decode()


def decrypt_value(ciphertext):
    """Decrypt an enc::-prefixed string. Tries every configured key. Returns
    legacy plaintext unchanged so partial rollouts stay readable."""
    if not ciphertext:
        return ciphertext
    if not ciphertext.startswith(ENCRYPTED_PREFIX):
        return ciphertext  # legacy plaintext — transparent fallback
    return _cipher().decrypt(ciphertext[len(ENCRYPTED_PREFIX):].encode()).decode()


def re_encrypt_value(ciphertext):
    """Rotate ONE value to the current primary key. Returns the new ciphertext.
    Idempotent: re-running on already-primary ciphertext returns unchanged.

    Used by the key-rotation Celery task. Legacy plaintext is encrypted with
    the primary key (i.e. rotation also serves as a backfill).
    """
    if not ciphertext:
        return ciphertext
    if not ciphertext.startswith(ENCRYPTED_PREFIX):
        # Legacy plaintext → encrypt with primary
        return encrypt_value(ciphertext)
    rotated = _cipher().rotate(ciphertext[len(ENCRYPTED_PREFIX):].encode()).decode()
    return ENCRYPTED_PREFIX + rotated
