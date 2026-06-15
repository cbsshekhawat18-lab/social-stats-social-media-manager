# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
HTTP-level rate limits for sensitive auth endpoints.

This sits ALONGSIDE django-axes . axes locks accounts after N
failed-password attempts from the same (username, ip) tuple over a long
window (1 hour). DRF throttles cap burst rate over a much shorter window
(per-second / per-minute), so a single botnet IP can't fire 1000 requests
in 10 seconds and probe before axes catches up.

The throttles are keyed off:
    • client IP (X-Forwarded-For aware)  → AnonAuthThrottle
    • email/username (case-insensitive) → AuthByUsernameThrottle
    • email + IP combo                   → PasswordResetThrottle
"""
from __future__ import annotations

from rest_framework.throttling import SimpleRateThrottle


def _client_ip(request) -> str | None:
    if not request:
        return None
    xff = request.META.get('HTTP_X_FORWARDED_FOR') or ''
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


# ─────────────────────────────────────────────────────────────────────────────
# Login burst — 10/min per IP
# ─────────────────────────────────────────────────────────────────────────────
class LoginIPThrottle(SimpleRateThrottle):
    """Cap login attempts at 10/min per source IP. Belt to axes' lockout."""
    scope = 'login_ip'
    rate  = '10/min'

    def get_cache_key(self, request, view):
        ip = _client_ip(request)
        if not ip:
            return None
        return self.cache_format % {'scope': self.scope, 'ident': ip}


# ─────────────────────────────────────────────────────────────────────────────
# Signup — 3/min per IP, 20/day per IP
# ─────────────────────────────────────────────────────────────────────────────
class SignupBurstThrottle(SimpleRateThrottle):
    scope = 'signup_burst'
    rate  = '3/min'

    def get_cache_key(self, request, view):
        ip = _client_ip(request)
        return self.cache_format % {'scope': self.scope, 'ident': ip} if ip else None


class SignupDailyThrottle(SimpleRateThrottle):
    scope = 'signup_daily'
    rate  = '20/day'

    def get_cache_key(self, request, view):
        ip = _client_ip(request)
        return self.cache_format % {'scope': self.scope, 'ident': ip} if ip else None


# ─────────────────────────────────────────────────────────────────────────────
# Password reset — 3/hour per (email, ip)
# ─────────────────────────────────────────────────────────────────────────────
class PasswordResetThrottle(SimpleRateThrottle):
    """Caps reset requests at 3/hour per (lowercased-email, ip) combo so an
    attacker can't flood a victim's inbox or burn through reset tokens."""
    scope = 'password_reset'
    rate  = '3/hour'

    def get_cache_key(self, request, view):
        data = getattr(request, 'data', None) or getattr(request, 'POST', None) or {}
        email = (data.get('email') or '').strip().lower()
        ip    = _client_ip(request) or ''
        if not email and not ip:
            return None
        ident = f'{email}|{ip}'
        return self.cache_format % {'scope': self.scope, 'ident': ident}


# ─────────────────────────────────────────────────────────────────────────────
# MFA verify — 5/min per user (mfa_token introspection)
# ─────────────────────────────────────────────────────────────────────────────
class MFAVerifyThrottle(SimpleRateThrottle):
    """5 OTP attempts per minute per mfa_token — protects against brute-force
    of the 6-digit TOTP code during the 5-min handshake window."""
    scope = 'mfa_verify'
    rate  = '5/min'

    def get_cache_key(self, request, view):
        data = getattr(request, 'data', None) or getattr(request, 'POST', None) or {}
        token = (data.get('mfa_token') or '').strip()
        ip    = _client_ip(request) or ''
        if token:
            return self.cache_format % {'scope': self.scope, 'ident': token[:64]}
        if ip:
            return self.cache_format % {'scope': self.scope, 'ident': ip}
        return None
