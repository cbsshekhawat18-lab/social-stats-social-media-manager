# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
security headers + request-ID tracing middleware.

`SecurityHeadersMiddleware` adds the OWASP-baseline response headers that
Django doesn't ship by default and a configurable Content-Security-Policy.
The CSP `connect-src` is built from settings so each deploy points at its
real frontend / API / third-party endpoints.

`RequestIDMiddleware` mints a UUID per request (or honours an upstream-set
``X-Request-Id``) and writes it back as ``X-Request-ID`` on the response.
The id is stashed on ``request.id`` so downstream views and log handlers
can include it.

Add both to MIDDLEWARE before ``CsrfViewMiddleware`` so headers cover error
pages too.
"""
from __future__ import annotations

import logging
import uuid

from django.conf import settings


logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Defaults — overridable via Django settings
# ─────────────────────────────────────────────────────────────────────────────
_DEFAULT_PERMISSIONS_POLICY = (
    'geolocation=(), microphone=(), camera=(), '
    'payment=(), usb=(), bluetooth=()'
)

_DEFAULT_REFERRER_POLICY = 'strict-origin-when-cross-origin'

_DEFAULT_CSP_DIRECTIVES = {
    'default-src': ["'self'"],
    # 'unsafe-inline' on style-src is unfortunately required by Create-React-App
    # builds + many third-party widgets. We trade it for the tighter script-src
    # which is the higher-value attack surface.
    'script-src':  ["'self'"],
    'style-src':   ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'img-src':     ["'self'", 'data:', 'https:', 'blob:'],
    'font-src':    ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://rsms.me'],
    'connect-src': [
        "'self'",
        'https://api.anthropic.com',
        'https://partnersv1.pinbot.ai',
        'https://graph.facebook.com',
        'https://www.googleapis.com',
    ],
    'frame-ancestors': ["'none'"],   # complements X-Frame-Options
    'base-uri':        ["'self'"],
    'form-action':     ["'self'"],
    'object-src':      ["'none'"],
    'worker-src':      ["'self'", 'blob:'],
}


def _build_csp() -> str:
    """Compose the CSP header from `settings.CONTENT_SECURITY_POLICY` (a dict
    overriding `_DEFAULT_CSP_DIRECTIVES`) plus optional bonuses."""
    overrides = getattr(settings, 'CONTENT_SECURITY_POLICY', None) or {}
    merged: dict = {}
    for k, v in _DEFAULT_CSP_DIRECTIVES.items():
        merged[k] = list(v)
    for k, v in overrides.items():
        merged[k] = list(v) if isinstance(v, (list, tuple)) else [str(v)]

    parts: list[str] = []
    for directive, sources in merged.items():
        parts.append(f'{directive} {" ".join(sources)}')

    # `upgrade-insecure-requests` is a flag, not a source list
    if getattr(settings, 'CSP_UPGRADE_INSECURE_REQUESTS', not settings.DEBUG):
        parts.append('upgrade-insecure-requests')

    return '; '.join(parts)


# ─────────────────────────────────────────────────────────────────────────────
# Middlewares
# ─────────────────────────────────────────────────────────────────────────────
class SecurityHeadersMiddleware:
    """Adds OWASP-baseline headers + CSP to every response.

    Django's ``SecurityMiddleware`` already covers HSTS / X-Content-Type-Options
    / Referrer-Policy when their settings are present. This middleware adds
    what Django doesn't:
      • Permissions-Policy
      • Cross-Origin-Opener-Policy (COOP)
      • X-Permitted-Cross-Domain-Policies
      • Content-Security-Policy
      • A safe default Referrer-Policy when SECURE_REFERRER_POLICY is unset
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self._csp = _build_csp()

    def __call__(self, request):
        response = self.get_response(request)
        # Belt-and-braces (Django's middleware sets some of these too)
        response.setdefault('X-Content-Type-Options', 'nosniff')
        response.setdefault('Referrer-Policy', getattr(
            settings, 'SECURE_REFERRER_POLICY', _DEFAULT_REFERRER_POLICY,
        ))
        response.setdefault('Permissions-Policy', getattr(
            settings, 'PERMISSIONS_POLICY', _DEFAULT_PERMISSIONS_POLICY,
        ))
        response.setdefault('Cross-Origin-Opener-Policy', getattr(
            settings, 'SECURE_CROSS_ORIGIN_OPENER_POLICY', 'same-origin',
        ))
        response.setdefault('X-Permitted-Cross-Domain-Policies', 'none')
        # CSP — set unconditionally so dev mismatches surface early
        if 'Content-Security-Policy' not in response:
            response['Content-Security-Policy'] = self._csp
        return response


class RequestIDMiddleware:
    """Per-request UUID for tracing.

    Honours an upstream ``X-Request-Id`` header when present (e.g. when a load
    balancer / Cloudflare set one) so logs can be joined across hops. Truncates
    to 64 chars to defend against header-bomb DoS.
    """

    HEADER_IN  = 'HTTP_X_REQUEST_ID'
    HEADER_OUT = 'X-Request-ID'

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        incoming = (request.META.get(self.HEADER_IN) or '').strip()[:64]
        request_id = incoming if _looks_safe(incoming) else uuid.uuid4().hex
        request.id = request_id
        response = self.get_response(request)
        response[self.HEADER_OUT] = request_id
        return response


def _looks_safe(s: str) -> bool:
    """Allow alphanumerics + dashes + underscores only. Anything else, mint
    fresh — protects log-injection via crafted headers."""
    if not s:
        return False
    return all(c.isalnum() or c in '-_' for c in s)
