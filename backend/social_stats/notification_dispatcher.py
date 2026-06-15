# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Unified notification dispatch.

`dispatch(user, event_type, title, body, data, ...)` writes the in-app row,
then fans out to email / WhatsApp / browser-push respecting per-user
preferences. Channels not yet implemented (whatsapp, browser-push) log a
TODO so observability can pick it up.

Default policy when no NotificationPreference row exists for `(user, event)`:
    in_app   : on
    email    : on for "high-impact" events (DEFAULTS_EMAIL set), off otherwise
    whatsapp : off
    browser  : off

The preference UI (the frontend) writes rows via the bulk PUT endpoint;
absence of a row means "use default", so we never have to seed.
"""
from __future__ import annotations

import logging
from typing import Iterable

from django.conf import settings
from django.contrib.auth.models import User
from django.core.mail import send_mail

from .auth_views import _email_html
from .models import (
    NOTIFICATION_CHANNEL_CHOICES,
    SMART_NOTIFICATION_EVENT_CHOICES,
    Notification,
    NotificationPreference,
)


logger = logging.getLogger(__name__)

CHANNELS = [c[0] for c in NOTIFICATION_CHANNEL_CHOICES]
EVENT_TYPES = [e[0] for e in SMART_NOTIFICATION_EVENT_CHOICES]

# High-impact marketplace events get email by default; everything else is
# in-app-only until the user opts into more channels.
DEFAULTS_EMAIL: set[str] = {
    'manage_request_received',
    'agency_invite_received',
    'approval_requested',
    'new_review_received',
    'relation_terminated',
    'token_expiring',
    'publish_failed',
    # CTWA bot builder —: handoff/lead are high-impact ("a human is
    # waiting" / "a real lead arrived"), so they email by default.
    'bot_handoff',
    'bot_lead_captured',
    'invitation_received',
    'invitation_accepted',
    'invitation_rejected',
    'agency_invite_accepted',
    'agency_invite_declined',
    'manage_request_accepted',
    'manage_request_declined',
    # invitation_cancelled is intentionally NOT in DEFAULTS_EMAIL — it's
    # informational (the agency withdrew); in-app is enough.

    'permission_changed',
    'relation_paused',
    # relation_resumed intentionally NOT in DEFAULTS_EMAIL.

    'agency_disconnected',
    'client_account_deleted',
    'client_joined',
}


def is_channel_enabled(user: User, event_type: str, channel: str) -> bool:
    """Read user pref; fall back to DEFAULTS_EMAIL for email, on for in_app, off
    for the rest."""
    if channel not in CHANNELS:
        return False
    pref = NotificationPreference.objects.filter(
        user=user, event_type=event_type, channel=channel,
    ).first()
    if pref is not None:
        return pref.enabled

    # No row yet — apply policy
    if channel == 'in_app':
        return True
    if channel == 'email':
        return event_type in DEFAULTS_EMAIL
    return False


def _send_email(user: User, subject: str, title: str, body: str, cta_url: str = '', cta_label: str = ''):
    if not user.email:
        return
    frontend = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
    body_html = (
        f'<p style="margin:0 0 12px;font-size:15px;color:#1e293b;line-height:1.7;">{body}</p>'
        if body else ''
    )
    html = _email_html(
        title=title,
        greeting=title,
        body_html=body_html,
        cta_url=cta_url or frontend,
        cta_label=cta_label or 'Open SocialStats',
        expiry_note='',
        frontend_url=frontend,
    )
    plain = f'{title}\n\n{body}\n\n{cta_url or frontend}\n'
    try:
        send_mail(
            subject, plain,
            getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@socialstats.app'),
            [user.email],
            html_message=html, fail_silently=True,
        )
    except Exception:
        logger.exception('notification_dispatcher: email send failed for user=%s event=%s',
                         user.id, subject)


def dispatch(
    user: User,
    *,
    event_type: str,
    title: str,
    body: str = '',
    data: dict | None = None,
    cta_url: str = '',
    cta_label: str = '',
    email_subject: str | None = None,
    notif_type: str | None = None,
    channels: Iterable[str] | None = None,
) -> Notification:
    """Write in-app row + fan out to enabled channels. Returns the in-app row.

    `channels` (optional) restricts the fanout to a specific list — useful
    when a call site has its own rich email path and only wants the in-app
    row written here, e.g. `channels=['in_app']`.
    """
    if not user or not user.pk:
        return None  # type: ignore[return-value]

    note = Notification.objects.create(
        user=user,
        notif_type=notif_type or 'system',
        title=title,
        body=body,
        data={**(data or {}), 'event_type': event_type},
    )

    allow = set(channels) if channels is not None else None

    def _allowed(ch):
        return (allow is None or ch in allow)

    if _allowed('email') and event_type in EVENT_TYPES and is_channel_enabled(user, event_type, 'email'):
        _send_email(user, email_subject or title, title, body, cta_url, cta_label)
    # WhatsApp + browser push are deferred —+ owns the actual delivery.
    if _allowed('whatsapp') and event_type in EVENT_TYPES and is_channel_enabled(user, event_type, 'whatsapp'):
        logger.info('TODO whatsapp send: user=%s event=%s title=%s', user.id, event_type, title)
    if _allowed('browser') and event_type in EVENT_TYPES and is_channel_enabled(user, event_type, 'browser'):
        logger.info('TODO browser push: user=%s event=%s title=%s', user.id, event_type, title)

    return note


# ─────────────────────────────────────────────────────────────────────────────
# Preferences API helpers
# ─────────────────────────────────────────────────────────────────────────────
def get_preferences_matrix(user: User) -> list[dict]:
    """Return a fully-populated matrix [{event_type, label, channels: {...}}]
    using row + default fallback."""
    rows = list(NotificationPreference.objects.filter(user=user))
    by_key = {(r.event_type, r.channel): r.enabled for r in rows}
    out = []
    for ev, label in SMART_NOTIFICATION_EVENT_CHOICES:
        channel_state = {}
        for ch in CHANNELS:
            if (ev, ch) in by_key:
                channel_state[ch] = by_key[(ev, ch)]
            else:
                channel_state[ch] = is_channel_enabled(user, ev, ch)
        out.append({'event_type': ev, 'label': label, 'channels': channel_state})
    return out


def update_preferences(user: User, payload: Iterable[dict]) -> int:
    """Bulk update — accepts a list of `{event_type, channel, enabled}` rows.
    Returns the number of rows touched."""
    touched = 0
    for row in payload or []:
        ev = row.get('event_type'); ch = row.get('channel')
        if ev not in EVENT_TYPES or ch not in CHANNELS:
            continue
        NotificationPreference.objects.update_or_create(
            user=user, event_type=ev, channel=ch,
            defaults={'enabled': bool(row.get('enabled'))},
        )
        touched += 1
    return touched
