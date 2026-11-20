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


@shared_task
def ask_node_timeout(conversation_id: int, node_id: str, token: str, pinbot=None) -> str:
    """Fires `timeout_minutes` after an answer node (ask_*, buttons, list)
    started waiting. Returns what it did, for logs and tests.

    Still waiting on that node, with the same timer token?
      • first time, and the node has `reminder_text` → send the reminder once
        and re-arm the timer;
      • otherwise → follow the node's `timeout` output (if it is connected).
    Anything else — the customer answered, the conversation ended, the node
    was re-asked — and this timer is stale: nothing happens.

    The reminder and whatever follows `timeout` are sent through
    executor.send_freeform, so the 24-hour rule applies: past the window the
    node's `fallback_template` is used for the reminder, or it is skipped.
    """
    from ..models import BotConversation
    from .executor import BotExecutor, BotExecutorError
    from .templates import render

    with transaction.atomic():
        conv = (BotConversation.objects.select_for_update()
                .filter(pk=conversation_id, status='active').first())
        if not conv:
            return 'stale'
        variables = conv.variables or {}
        timer = variables.get('_timeout') or {}
        if (timer.get('token') != token or timer.get('node') != node_id
                or variables.get('_waiting_for_node') != node_id):
            return 'stale'

        executor = BotExecutor(conv, pinbot=pinbot)
        node = executor.get_node(node_id)
        if not node:
            return 'stale'
        data = node.get('data') or {}
        reminder = render(str(data.get('reminder_text') or ''), executor.variables).strip()

        if reminder and not timer.get('reminded'):
            sent = False
            try:
                sent = executor.send_freeform(node, 'send_text', executor.contact.phone, reminder)
            except BotExecutorError:
                # Outside the 24-hour window with no fallback template: skip
                # the reminder rather than fail a conversation that may resume.
                executor.log_step(node, direction='system',
                                  payload={'note': 'reminder_skipped', 'reason': 'outside_24h_window'})
            if sent:
                executor.log_step(node, direction='bot_to_user', payload={'text': reminder, 'reminder': True})
            executor.pop_variable('_resend_on_reply')     # the question itself was already asked
            executor.schedule_timeout(node, reminded=True)
            executor.save()
            return 'reminded' if sent else 'reminder_skipped'

        executor.log_step(node, direction='system', payload={'note': 'answer_timeout'})
        if not executor.has_branch(node_id, 'timeout'):
            # Nothing wired: keep waiting; the abandonment sweep closes it later.
            executor.pop_variable('_timeout')
            executor.save()
            return 'timed_out_no_edge'
        executor.consume_waiting()
        executor.pop_variable('_waiting_for_node')
        executor.advance_to_next(node_id, branch='timeout')
        return 'timed_out'
