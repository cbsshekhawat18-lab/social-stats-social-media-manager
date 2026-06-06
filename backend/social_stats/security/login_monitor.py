"""
suspicious-login detection.

On every successful login we compare the new request's IP / user-agent
fingerprint against the user's recent UserSession history. If we see a
NEW context, we email the user a "new login detected" notification so a
compromised credential surfaces fast.

Heuristics — kept deliberately simple:
    • New IP address  AND
    • New (browser+os) combo
    → notify

Either alone is too noisy (mobile carriers rotate IPs constantly; users
update browsers regularly).
"""
from __future__ import annotations

import logging
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from .sessions import UserSession, _client_ip, _parse_user_agent


logger = logging.getLogger(__name__)


def is_suspicious(*, user, request) -> tuple[bool, dict]:
    """Return (suspicious_bool, context_dict). Context is logged + emailed."""
    ip = _client_ip(request)
    ua = request.META.get('HTTP_USER_AGENT', '') if request else ''
    browser, os_, device = _parse_user_agent(ua)

    # Look at the last 90 days of sessions
    since = timezone.now() - timedelta(days=90)
    recent = UserSession.objects.filter(
        user=user, created_at__gte=since,
    ).values_list('ip_address', 'ua_browser', 'ua_os')
    seen_ips = {r[0] for r in recent if r[0]}
    seen_combos = {(r[1], r[2]) for r in recent if r[1] or r[2]}

    if not seen_ips and not seen_combos:
        # First login ever — not "suspicious"; don't spam
        return (False, {})

    new_ip = bool(ip and ip not in seen_ips)
    new_combo = bool((browser or os_) and (browser, os_) not in seen_combos)
    suspicious = new_ip and new_combo

    return suspicious, {
        'ip': ip, 'browser': browser, 'os': os_, 'device': device,
        'new_ip': new_ip, 'new_combo': new_combo,
    }


def notify_new_login(*, user, context: dict) -> None:
    """Send a 'new login detected' email. Best-effort — never raises."""
    if not user.email:
        return
    try:
        from django.core.mail import send_mail
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@statox.ai')
        frontend = getattr(settings, 'FRONTEND_URL', 'https://app.statox.ai')

        when = timezone.now().strftime('%Y-%m-%d %H:%M UTC')
        subject = '[Statox] New login to your account'
        body = (
            f'Hi {user.first_name or user.username},\n\n'
            f'We detected a new sign-in to your Statox account at {when}.\n\n'
            f'  IP address : {context.get("ip") or "unknown"}\n'
            f'  Browser    : {context.get("browser") or "unknown"} on {context.get("os") or "unknown"}\n'
            f'  Device     : {context.get("device") or "unknown"}\n\n'
            f'If this was you, no action needed.\n\n'
            f'If you don\'t recognise this sign-in:\n'
            f'  1. Change your password immediately: {frontend}/u/settings/security\n'
            f'  2. Review and revoke active sessions on the same page\n'
            f'  3. Contact support@statox.ai\n\n'
            f'— Statox Security'
        )
        send_mail(subject, body, from_email, [user.email], fail_silently=True)
    except Exception:
        logger.warning('notify_new_login: failed for user=%s', user.id, exc_info=True)
