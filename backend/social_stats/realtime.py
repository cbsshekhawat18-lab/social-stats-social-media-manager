# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Server-side helpers for pushing live events to connected WebSocket clients.

Public:
    push_event(event_type: str, client_id: int, data: dict | None = None) -> bool

Sync-callable from anywhere — Celery tasks, view handlers, signals. Wraps
`channel_layer.group_send` with `async_to_sync` so no caller needs to know
about asyncio. Always non-raising — a missing channel layer just logs and
no-ops.

Suggested event types (consumer + frontend dispatch off the `type` field):
    inbox.new_message
    inbox.new_review
    composer.post_published
    composer.post_failed
    composer.post_partial
    automation.fired
    credential.token_expired
    alert.viral_post
"""
from __future__ import annotations

import logging
from typing import Optional

from asgiref.sync import async_to_sync

from .consumers import group_name

logger = logging.getLogger(__name__)


def push_event(event_type: str, client_id: int, data: Optional[dict] = None) -> bool:
    """
    Broadcast an event to every WS client subscribed to this client's group.
    Returns True on success, False on failure (never raises).
    """
    try:
        from channels.layers import get_channel_layer
        layer = get_channel_layer()
        if layer is None:
            logger.debug('No channel layer configured — skipping push_event %s', event_type)
            return False
        payload = {
            'type':       event_type,
            'client_id':  int(client_id),
            'data':       data or {},
        }
        async_to_sync(layer.group_send)(
            group_name(client_id),
            {'type': 'broadcast.event', 'payload': payload},
        )
        return True
    except Exception:
        logger.exception('push_event failed type=%s client_id=%s', event_type, client_id)
        return False
