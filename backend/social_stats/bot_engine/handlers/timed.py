# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
wait_delay — pauses the flow for N seconds via Celery countdown.

The handler:
    1. Records the step.
    2. Schedules `resume_bot_conversation.apply_async(eta=now+delay)`.
    3. Halts execution by NOT calling advance_to_next; the conversation stays
       in 'active' status with `_waiting_for_resume=True` so resume_bot_conversation
       can pick it up.

The resume task is a thin wrapper that re-instantiates a BotExecutor and calls
advance_to_next from the wait node. It guards against (a) the conversation
being terminated in the meantime and (b) the user replying first.
"""
from __future__ import annotations

import logging
from datetime import timedelta

from celery import shared_task

from ..templates import render


logger = logging.getLogger(__name__)


def handle_wait_delay(executor, node):
    """data: { seconds | minutes | hours }"""
    data = node.get('data') or {}
    seconds = 0
    if 'seconds' in data:
        seconds = int(data.get('seconds') or 0)
    if 'minutes' in data:
        seconds += int(data.get('minutes') or 0) * 60
    if 'hours' in data:
        seconds += int(data.get('hours') or 0) * 3600
    seconds = max(1, min(seconds or 1, 7 * 24 * 3600))  # clamp to 1s..7d

    # Mark the conversation as waiting so a concurrent inbound reply doesn't
    # double-fire (the runner reads this flag).
    executor.set_variable('_waiting_for_resume', True)
    executor.set_variable('_resume_node_id', node['id'])
    executor.conversation.current_node_id = node['id']
    executor.conversation.save()

    executor.log_step(node, direction='system', payload={'wait_seconds': seconds})

    # Schedule resume
    resume_bot_conversation.apply_async(
        args=[executor.conversation.id],
        countdown=seconds,
    )
    return executor.conversation


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def resume_bot_conversation(self, conversation_id: int):
    """Celery task — fired after a wait_delay countdown. Re-instantiates the
    executor and advances from the wait node.

    Safe-guards:
      - If the conversation is no longer 'active' OR the user already advanced
        past the wait node, this is a no-op.
      - If the wait was a long delay (>24h), the next message must use a
        template — flows of that depth should have been authored with a
        message_template node directly after the wait.
    """
    from ...models import BotConversation
    from ..executor import BotExecutor

    conv = (
        BotConversation.objects
        .select_related('flow', 'client', 'contact')
        .filter(pk=conversation_id, status='active')
        .first()
    )
    if not conv:
        return
    variables = conv.variables or {}
    if not variables.get('_waiting_for_resume'):
        # User replied or another worker already advanced past the wait
        return
    wait_node_id = variables.get('_resume_node_id') or conv.current_node_id

    # Pop the resume markers
    cleaned = dict(variables)
    cleaned.pop('_waiting_for_resume', None)
    cleaned.pop('_resume_node_id', None)
    conv.variables = cleaned
    conv.save(update_fields=['variables'])

    BotExecutor(conv).advance_to_next(wait_node_id)
