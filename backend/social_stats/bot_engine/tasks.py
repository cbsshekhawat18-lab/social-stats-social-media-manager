# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Celery tasks owned by the bot engine.

Listed in settings.CELERY_IMPORTS so workers register them at start-up (they
don't live in a `tasks.py` at the app root, which is all autodiscovery finds).
"""
from __future__ import annotations

import logging
from datetime import timedelta

from celery import shared_task
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task
def mark_abandoned_bot_conversations(batch_size: int = 500) -> int:
    """Close active conversations whose contact stopped replying.

    A conversation is abandoned when its last activity is older than the
    workspace's `Client.bot_abandon_after_minutes` (default 1440 = 24 h).
    Runs every 15 minutes from Celery beat. Returns how many were closed.
    """
    from ..models import BotConversation, BotConversationStep, Client

    now = timezone.now()
    closed = 0
    thresholds = (
        Client.objects.filter(bot_conversations__status='active')
        .values_list('id', 'bot_abandon_after_minutes').distinct()
    )
    for client_id, minutes in thresholds:
        cutoff = now - timedelta(minutes=max(1, int(minutes or 1440)))
        stale_ids = list(
            BotConversation.objects
            .filter(client_id=client_id, status='active', last_activity_at__lt=cutoff)
            .values_list('id', flat=True)[:batch_size]
        )
        for conv_id in stale_ids:
            with transaction.atomic():
                conv = (BotConversation.objects.select_for_update()
                        .filter(pk=conv_id, client_id=client_id, status='active',
                                last_activity_at__lt=cutoff).first())
                if not conv:
                    continue   # the contact replied in the meantime
                variables = dict(conv.variables or {})
                for key in ('_waiting_for', '_waiting_for_node', '_resend_on_reply',
                            '_waiting_for_resume', '_resume_node_id', '_timeout'):
                    variables.pop(key, None)
                # .update() so `last_activity_at` (auto_now) keeps the time the
                # contact was last heard from.
                BotConversation.objects.filter(pk=conv.pk).update(
                    status='abandoned', ended_at=now, ai_takeover_active=False,
                    variables=variables,
                )
                BotConversationStep.objects.create(
                    conversation=conv, client_id=client_id,
                    node_id=conv.current_node_id or '', node_type='_system',
                    direction='system', payload={'note': 'idle_timeout'},
                )
                closed += 1
    if closed:
        logger.info('marked %s bot conversation(s) abandoned', closed)
    return closed
