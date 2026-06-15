# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Notification dispatch — multi-channel sender that respects per-user preferences.

Public:
    dispatch_notification(*, recipients, event_type, title, body, client=None,
                          data=None, channels=None) -> dict

Channels:
  in_app   → Notification row (always-on default)
  email    → SMTP (uses Django EMAIL_HOST_*)
  whatsapp → Pinbot (only if WhatsAppAccount + opted-in contact phone exist)
  browser  → recorded as in_app for now; web-push integration is future work

Each (user, event_type, channel) is consulted via NotificationPreference.
Default policy when no row exists:
  - in_app   = True
  - email    = False
  - whatsapp = False
  - browser  = False

Always non-raising — channel failures are logged + recorded in the result.
"""
from __future__ import annotations

import logging
from typing import Iterable, Optional

from django.conf import settings
from django.core.mail import send_mail

from .models import (
    Notification, NotificationPreference, Client,
    NOTIFICATION_CHANNEL_CHOICES,
)
from .realtime import push_event

logger = logging.getLogger(__name__)

DEFAULT_CHANNEL_POLICY = {
    'in_app':   True,
    'email':    False,
    'whatsapp': False,
    'browser':  False,
}

ALL_CHANNELS = [c[0] for c in NOTIFICATION_CHANNEL_CHOICES]


def dispatch_notification(*, recipients: Iterable, event_type: str,
                           title: str, body: str = '',
                           client: Optional[Client] = None,
                           data: Optional[dict] = None,
                           channels: Optional[list[str]] = None) -> dict:
    """
    Send `event_type` notification to each user in `recipients` over the
    enabled channels. Returns a per-user, per-channel result map.
    """
    targets = [u for u in (recipients or []) if u and getattr(u, 'is_active', True)]
    requested = channels or ALL_CHANNELS
    summary = {'sent': [], 'skipped': [], 'errors': []}

    for user in targets:
        prefs_map = _user_channel_prefs(user, event_type)
        for ch in requested:
            enabled = prefs_map.get(ch, DEFAULT_CHANNEL_POLICY.get(ch, False))
            if not enabled:
                summary['skipped'].append({'user': user.id, 'channel': ch, 'reason': 'opt_out'})
                continue

            try:
                if ch == 'in_app':
                    Notification.objects.create(
                        user=user, notif_type='system',
                        title=title, body=body,
                        data={'event_type': event_type, **(data or {})},
                    )
                elif ch == 'email':
                    _send_email(user, title, body)
                elif ch == 'whatsapp':
                    _send_whatsapp(client, user, title, body)
                elif ch == 'browser':
                    # Mirror to in_app until web-push integration ships
                    Notification.objects.create(
                        user=user, notif_type='system',
                        title=title, body=body,
                        data={'event_type': event_type, 'channel': 'browser', **(data or {})},
                    )
                summary['sent'].append({'user': user.id, 'channel': ch})
            except Exception as e:
                logger.exception('dispatch_notification: %s/%s failed', user.id, ch)
                summary['errors'].append({'user': user.id, 'channel': ch, 'error': str(e)[:200]})

    # Live push to any open WS sessions for this tenant — independent of channels.
    if client:
        push_event(f'notification.{event_type}', client.id, {
            'title': title, 'body': body,
            'recipients': [u.id for u in targets],
            **(data or {}),
        })

    return summary


# ── Helpers ──────────────────────────────────────────────────────────────────
def _user_channel_prefs(user, event_type: str) -> dict[str, bool]:
    rows = NotificationPreference.objects.filter(user=user, event_type=event_type)
    out = dict(DEFAULT_CHANNEL_POLICY)
    for r in rows:
        out[r.channel] = r.enabled
    return out


def _send_email(user, title: str, body: str):
    if not getattr(settings, 'EMAIL_HOST', '') or not user.email:
        raise RuntimeError('Email not configured or user has no email')
    send_mail(
        subject=title,
        message=body or title,
        from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', None),
        recipient_list=[user.email],
        fail_silently=False,
    )


def _send_whatsapp(client: Optional[Client], user, title: str, body: str):
    """
    Best-effort WhatsApp delivery via the Pinbot integration. Requires:
      - the user's profile to have a phone number
      - the client to have an active WhatsAppAccount
      - a contact row for the phone (so opt-in status can be respected)
    Falls back silently when any precondition is missing.
    """
    if not client:
        raise RuntimeError('WhatsApp delivery requires a client context')

    phone = ''
    try:
        phone = (user.profile.user.email or '').strip()  # placeholder — real impl reads phone field
    except Exception:
        phone = ''
    if not phone:
        raise RuntimeError('No phone number on user profile')

    from .models import WhatsAppAccount, WhatsAppContact
    if not hasattr(client, 'whatsapp_account'):
        raise RuntimeError('No WhatsApp account configured for this client')
    contact = WhatsAppContact.objects.filter(client=client, phone=phone).first()
    if not contact or contact.opt_in_status != 'opted_in':
        raise RuntimeError('Recipient is not opted in for WhatsApp')

    from .whatsapp_service import get_pinbot_for_client
    svc = get_pinbot_for_client(client.id)
    text = f'{title}\n\n{body}' if body else title
    svc.send_text(phone, text[:1500])
