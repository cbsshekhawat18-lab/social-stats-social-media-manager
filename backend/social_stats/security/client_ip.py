# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
The one place that decides a request's client IP.

Used by throttles, session records, MFA-token IP binding, API-key IP
allow-lists, audit logs and django-axes (via ``AXES_CLIENT_IP_CALLABLE``).

``X-Forwarded-For`` is client-controlled: anyone can send
``X-Forwarded-For: 1.2.3.4``. Each reverse proxy *appends* the address it
received the connection from, so only the right-most entries — the ones our
own proxies wrote — can be trusted.

  • ``settings.TRUSTED_PROXY_COUNT == 0`` (default): ignore the header and use
    ``REMOTE_ADDR``. Correct when Django is reached directly.
  • ``TRUSTED_PROXY_COUNT == N``: take the N-th entry from the right. With one
    nginx in front (docker-compose) that is the address nginx saw.

Only set N when Django is reachable *exclusively* through those N proxies;
otherwise a direct caller could still forge the header.
"""
from __future__ import annotations

import ipaddress
from typing import Optional

from django.conf import settings


def _trusted_proxy_count() -> int:
    try:
        return max(0, int(getattr(settings, 'TRUSTED_PROXY_COUNT', 0) or 0))
    except (TypeError, ValueError):
        return 0


def _valid_ip(value: str) -> Optional[str]:
    value = (value or '').strip()
    if not value:
        return None
    try:
        return str(ipaddress.ip_address(value))
    except ValueError:
        return None


def get_client_ip(request) -> Optional[str]:
    """Best-known client IP for ``request`` (Django or DRF request), or None."""
    if request is None:
        return None
    meta = getattr(request, 'META', None) or {}
    remote = _valid_ip(meta.get('REMOTE_ADDR', ''))

    count = _trusted_proxy_count()
    if count == 0:
        return remote

    hops = [h.strip() for h in (meta.get('HTTP_X_FORWARDED_FOR') or '').split(',') if h.strip()]
    if len(hops) < count:
        # The request didn't pass through every trusted proxy (e.g. a direct
        # hit on the app port) — the header can't be trusted at all.
        return remote
    return _valid_ip(hops[-count]) or remote
