# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
webhook replay protection.

Pinbot, Meta, and Google all retry webhooks on transient failures.
Without idempotency, a retry can double-credit a sync or double-send a
notification.

We dedupe by ``(provider, event_id)``. The provider's docs tell us where to
read the event_id from each provider's payload; this module just owns
storage + a tiny helper.

Storage TTL: 30 days. Retried events older than that are treated as fresh
(unlikely in practice — providers give up after a few retries).
"""
from __future__ import annotations

import hashlib
import logging
from datetime import timedelta

from django.db import models
from django.utils import timezone


logger = logging.getLogger(__name__)


class WebhookEvent(models.Model):
    """One row per inbound webhook we've already processed.

    Indexed on (provider, event_id) so the dedup lookup is a single index hit.
    The `payload_hash` is stored alongside as a sanity check — if we see the
    same event_id with a different payload, that's a likely security incident
    (replay with mutation) and we log a warning.
    """
    provider     = models.CharField(max_length=30, db_index=True)
    # 'meta' / 'pinbot' / 'google' / 'youtube' / etc.
    event_id     = models.CharField(max_length=200, db_index=True)
    payload_hash = models.CharField(max_length=64)  # sha256 hex
    received_at  = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        app_label = 'social_stats'
        constraints = [
            models.UniqueConstraint(
                fields=['provider', 'event_id'],
                name='webhook_event_unique_per_provider',
            ),
        ]
        indexes = [
            models.Index(fields=['provider', 'event_id']),
            models.Index(fields=['received_at']),
        ]

    def __str__(self):
        return f'WebhookEvent<{self.provider}/{self.event_id} @ {self.received_at:%Y-%m-%d}>'


def _hash_payload(payload_bytes: bytes | str) -> str:
    if isinstance(payload_bytes, str):
        payload_bytes = payload_bytes.encode('utf-8')
    return hashlib.sha256(payload_bytes or b'').hexdigest()


def is_duplicate(provider: str, event_id: str, payload_bytes: bytes | str = b'') -> bool:
    """Atomically claim ``(provider, event_id)``. Returns True if this exact
    event was already received — caller should respond 200 with no side effects.

    The unique constraint makes this race-safe: two concurrent webhook
    deliveries both trying to insert lose to ON CONFLICT — the loser sees
    True (duplicate), the winner gets True for their first call only.
    """
    if not provider or not event_id:
        # No event ID — can't dedupe. Caller should fall through.
        return False
    payload_hash = _hash_payload(payload_bytes)
    obj, created = WebhookEvent.objects.get_or_create(
        provider=provider, event_id=str(event_id)[:200],
        defaults={'payload_hash': payload_hash},
    )
    if created:
        return False
    # Already seen. If the payload differs from the original, that's
    # suspicious — log it. We still return True (drop the duplicate) so
    # we don't fail open under attack.
    if obj.payload_hash and payload_hash and obj.payload_hash != payload_hash:
        logger.warning(
            'webhook replay with mutated payload: provider=%s event_id=%s '
            'original_hash=%s new_hash=%s',
            provider, event_id, obj.payload_hash[:8], payload_hash[:8],
        )
    return True


def cleanup_old_events(*, days: int = 30) -> int:
    """Delete webhook records older than ``days``. Wire to a Celery beat job."""
    cutoff = timezone.now() - timedelta(days=days)
    n, _ = WebhookEvent.objects.filter(received_at__lt=cutoff).delete()
    return n
