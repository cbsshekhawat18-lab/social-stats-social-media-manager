# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
active-session tracking.

Every login creates a `UserSession` row keyed by the refresh-token JTI.
Logout / "sign out everywhere" / suspicious-activity workflows can revoke
specific sessions (or all of them) by deleting the row + blacklisting the
matching refresh token via simplejwt's `OutstandingToken`/`BlacklistedToken`
tables.

The model lives in social_stats so its migrations stay co-located with
everything else, but logic lives in this `security` package.
"""
from __future__ import annotations

import logging

from django.conf import settings
from django.db import models
from django.utils import timezone


logger = logging.getLogger(__name__)


class UserSession(models.Model):
    """One row per refresh token ever issued. Survives token rotation by
    chaining on `parent_jti` (the previous JTI in the rotation chain).
    """
    user        = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                    related_name='security_sessions')

    # JTI of the refresh token currently associated with this session.
    # Updated on rotation; the previous JTI is preserved on `parent_jti`.
    refresh_jti = models.CharField(max_length=64, unique=True, db_index=True)
    parent_jti  = models.CharField(max_length=64, blank=True, db_index=True)

    user_agent  = models.TextField(blank=True)
    ua_browser  = models.CharField(max_length=60, blank=True)  # parsed for display
    ua_os       = models.CharField(max_length=60, blank=True)
    ua_device   = models.CharField(max_length=60, blank=True)

    ip_address       = models.GenericIPAddressField(null=True, blank=True)
    location_country = models.CharField(max_length=2,  blank=True)
    location_city    = models.CharField(max_length=100, blank=True)

    created_at  = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(auto_now=True)
    expires_at  = models.DateTimeField()

    revoked_at  = models.DateTimeField(null=True, blank=True)
    revoke_reason = models.CharField(max_length=40, blank=True)
    # 'user_logout' / 'user_revoked' / 'admin_revoked' / 'suspicious' / 'rotated'

    class Meta:
        app_label = 'social_stats'
        ordering = ['-last_used_at']
        indexes = [
            models.Index(fields=['user', '-last_used_at']),
            models.Index(fields=['user', 'revoked_at']),
        ]

    def __str__(self):
        return f'UserSession<user={self.user_id} jti={self.refresh_jti[:8]} {"revoked" if self.revoked_at else "active"}>'

    @property
    def is_active(self) -> bool:
        return self.revoked_at is None and timezone.now() < self.expires_at


# ─────────────────────────────────────────────────────────────────────────────
# Helpers — called from auth signals and the sessions API
# ─────────────────────────────────────────────────────────────────────────────
def _parse_user_agent(ua_string: str) -> tuple[str, str, str]:
    """Return (browser, os, device) for display. Best-effort; returns empty
    strings on parse failure."""
    if not ua_string:
        return ('', '', '')
    try:
        from user_agents import parse
        ua = parse(ua_string)
        browser = (ua.browser.family or '')[:60]
        os_     = (ua.os.family or '')[:60]
        device  = ('Mobile' if ua.is_mobile else 'Tablet' if ua.is_tablet else 'Desktop')
        return (browser, os_, device)
    except Exception:
        return ('', '', '')


def _client_ip(request) -> str | None:
    if not request:
        return None
    xff = request.META.get('HTTP_X_FORWARDED_FOR') or ''
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def record_session(*, user, refresh_jti: str, expires_at, request=None,
                   parent_jti: str = '') -> UserSession:
    """Create or update a UserSession row from an authenticated request.

    Idempotent on `refresh_jti`: re-running on the same JTI updates `last_used_at`
    and any newly-known fields (e.g. user-agent on first authenticated call).
    """
    ua_string = request.META.get('HTTP_USER_AGENT', '')[:1000] if request else ''
    browser, os_, device = _parse_user_agent(ua_string)
    ip = _client_ip(request)

    sess, _ = UserSession.objects.update_or_create(
        refresh_jti=refresh_jti,
        defaults={
            'user':       user,
            'parent_jti': parent_jti or '',
            'user_agent': ua_string,
            'ua_browser': browser,
            'ua_os':      os_,
            'ua_device':  device,
            'ip_address': ip,
            'expires_at': expires_at,
        },
    )
    return sess


def revoke_session(session: UserSession, *, reason: str = 'user_revoked') -> None:
    """Mark the session revoked and blacklist its refresh token via simplejwt.

    The blacklist call is best-effort — if the token_blacklist app isn't
    installed yet (early in the rollout), we still flip our own flag.
    """
    if session.revoked_at:
        return
    session.revoked_at    = timezone.now()
    session.revoke_reason = reason
    session.save(update_fields=['revoked_at', 'revoke_reason'])

    try:
        from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
        ot = OutstandingToken.objects.filter(jti=session.refresh_jti).first()
        if ot and not BlacklistedToken.objects.filter(token=ot).exists():
            BlacklistedToken.objects.create(token=ot)
    except Exception:
        logger.warning('revoke_session: simplejwt blacklist unavailable for jti=%s',
                       session.refresh_jti[:8])


def revoke_all_for_user(user, *, except_jti: str = '', reason: str = 'sign_out_everywhere') -> int:
    """Revoke every active session for a user. Returns the count revoked."""
    qs = UserSession.objects.filter(user=user, revoked_at__isnull=True)
    if except_jti:
        qs = qs.exclude(refresh_jti=except_jti)
    n = 0
    for s in qs:
        revoke_session(s, reason=reason)
        n += 1
    return n
