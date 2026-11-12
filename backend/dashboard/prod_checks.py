# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Startup guard for production-like configuration (DEBUG=False).

``settings.py`` calls ``production_config_errors`` once at import time and
raises ``ImproperlyConfigured`` if anything comes back, so a misconfigured
web server, Celery worker or management command fails at boot instead of
running with a guessable SECRET_KEY, unencrypted-at-rest fallbacks or open
webhooks. Kept free of Django imports so it is trivially unit-testable.
"""
from __future__ import annotations

MIN_SECRET_KEY_LENGTH = 50
PLACEHOLDER_MARKERS = ('insecure', 'change-me')


def production_config_errors(
    *,
    secret_key: str,
    field_encryption_keys: str,
    allowed_hosts: list[str],
    meta_webhook_secret: str,
    whatsapp_webhook_secret: str,
    allow_unsigned_webhooks: bool,
    legacy_field_encryption_key: str = '',
) -> list[str]:
    """Return a list of human-readable problems; empty means OK."""
    errors: list[str] = []

    if not secret_key:
        errors.append('SECRET_KEY is not set.')
    else:
        if len(secret_key) < MIN_SECRET_KEY_LENGTH:
            errors.append(
                f'SECRET_KEY must be at least {MIN_SECRET_KEY_LENGTH} characters '
                f'(it is {len(secret_key)}).'
            )
        lowered = secret_key.lower()
        for marker in PLACEHOLDER_MARKERS:
            if marker in lowered:
                errors.append(f"SECRET_KEY still contains the placeholder text '{marker}'.")

    if not [k for k in (field_encryption_keys or '').split(',') if k.strip()]:
        hint = (
            ' You have the legacy FIELD_ENCRYPTION_KEY set — move its value into '
            'FIELD_ENCRYPTION_KEYS.'
            if legacy_field_encryption_key else
            ' If tokens were stored without one, they are encrypted with a key '
            'derived from SECRET_KEY: set FIELD_ENCRYPTION_KEYS=<new key>,<old SECRET_KEY> '
            'and run the rotate_encryption_keys task.'
        )
        errors.append('FIELD_ENCRYPTION_KEYS is empty.' + hint)

    if any(h.strip() == '*' for h in allowed_hosts):
        errors.append("ALLOWED_HOSTS contains '*'; list your real hostnames.")

    if not allow_unsigned_webhooks:
        if not meta_webhook_secret:
            errors.append(
                'META_WEBHOOK_SECRET is empty (set it, or ALLOW_UNSIGNED_WEBHOOKS=True '
                'if you do not use Meta webhooks).'
            )
        if not whatsapp_webhook_secret:
            errors.append(
                'WHATSAPP_WEBHOOK_SECRET is empty (set it, or ALLOW_UNSIGNED_WEBHOOKS=True '
                'if you do not use WhatsApp webhooks).'
            )

    return errors


def format_errors(errors: list[str]) -> str:
    return (
        'Refusing to start with DEBUG=False — production configuration is unsafe:\n'
        + '\n'.join(f'  - {e}' for e in errors)
        + '\nSee docs/GOING_LIVE.md. (Local development: set DEBUG=True.)'
    )
