# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
server-side Cloudflare Turnstile verifier.

Turnstile is Cloudflare's CAPTCHA replacement (free, privacy-friendly).
The frontend renders the widget with a public site key and POSTs the
resulting token to our endpoints. We verify the token against Cloudflare's
``siteverify`` API before accepting the submission.

Settings:
    TURNSTILE_SECRET_KEY  — server-side secret (NEVER ship to frontend)
    TURNSTILE_SITE_KEY    — public site key (frontend uses this; we expose
                            it via /api/public/site-config/ in a later stage)

Behaviour:
    • If TURNSTILE_SECRET_KEY is unset, ``verify_turnstile_token`` returns True
      (dev / staging skip). Production deploys MUST set the secret.
    • Network failures hard-fail (return False) — we'd rather reject signups
      during a Cloudflare outage than let a bot through.
"""
from __future__ import annotations

import logging
from typing import Optional

import requests
from django.conf import settings


logger = logging.getLogger(__name__)


VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'


def is_enabled() -> bool:
    return bool(getattr(settings, 'TURNSTILE_SECRET_KEY', '') or '')


def verify_turnstile_token(token: str, *, remote_ip: Optional[str] = None,
                            timeout: float = 4.0) -> bool:
    """Verify a Turnstile token against Cloudflare. Returns True on success.

    Returns True (skip) when no secret key is configured — useful for local
    dev. Production must set TURNSTILE_SECRET_KEY.
    """
    secret = (getattr(settings, 'TURNSTILE_SECRET_KEY', '') or '').strip()
    if not secret:
        logger.debug('TURNSTILE_SECRET_KEY not set — skipping verification')
        return True

    if not token:
        return False

    payload = {'secret': secret, 'response': token}
    if remote_ip:
        payload['remoteip'] = remote_ip

    try:
        r = requests.post(VERIFY_URL, data=payload, timeout=timeout)
    except requests.RequestException as e:
        logger.warning('Turnstile verify network error: %s — denying', e)
        return False

    if r.status_code >= 400:
        logger.warning('Turnstile verify http %s — denying', r.status_code)
        return False

    try:
        body = r.json()
    except ValueError:
        return False

    success = bool(body.get('success'))
    if not success:
        logger.info('Turnstile verify rejected: codes=%s', body.get('error-codes'))
    return success
