# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Top-level orchestrator: webhook → engine.

`process_incoming_message(client_id, contact_id, payload, *, pinbot=None)`
returns True when the engine handled the message, False when no flow was
applicable so the caller can fall through to the inbox.
"""
from __future__ import annotations

import logging

from django.db.models import F
from django.utils import timezone

from ..models import BotConversation, BotFlow, Client
from .executor import BotExecutor
from .safety import is_bot_enabled, is_rate_limited, spam_signal
from .triggers import match_trigger


logger = logging.getLogger(__name__)


def _extract_user_text(payload: dict) -> tuple[str, str]:
    """Return (text, kind) where kind ∈ {'text', 'button', 'list', 'other'}."""
    if not payload:
        return ('', 'other')
    if payload.get('type') == 'interactive' or payload.get('interactive'):
        interactive = payload.get('interactive') or {}
        br = interactive.get('button_reply') or {}
        lr = interactive.get('list_reply') or {}
        if br:
            return (br.get('title', '') or br.get('id', ''), 'button')
        if lr:
            return (lr.get('title', '') or lr.get('id', ''), 'list')
    text = ((payload.get('text') or {}).get('body') or '').strip()
    if text:
        return (text, 'text')
    return ('', 'other')


def process_incoming_message(client_id: int, contact_id: int, payload: dict, *, pinbot=None) -> bool:
    """Engine entry point. Returns True iff the message was handled by a bot."""
    if not payload:
        return False

    # ── safety preflight ────────────────────────────────────────────
    # Cheap checks first — kill switch, then rate limit. If either trips, we
    # return True so the message is consumed (the inbox shouldn't get a copy
    # of a spam burst), but we never hit the engine, AI, or PinBot.
    client = Client.objects.filter(pk=client_id).only(
        'id', 'bot_enabled', 'bot_max_msgs_per_minute',
    ).first()
    if not client:
        return False
    if not is_bot_enabled(client):
        logger.info('bot disabled for client=%s — skipping', client_id)
        return False  # let the inbox handle it
    if is_rate_limited(client_id, contact_id, max_per_minute=client.bot_max_msgs_per_minute):
        logger.warning('rate-limited contact=%s on client=%s — dropping', contact_id, client_id)
        return True  # silently drop — don't fall through to inbox spam

    # 1. Resume an active conversation if one exists for this contact.
    active = (
        BotConversation.objects
        .select_related('flow', 'client', 'contact')
        .filter(client_id=client_id, contact_id=contact_id, status='active')
        .first()
    )
    if active and active.flow_id and active.flow.is_active:
        if active.ai_takeover_active:
            return _continue_ai(active, payload, pinbot=pinbot)
        return _continue(active, payload, pinbot=pinbot)

    # 2. No active conversation — try to trigger a new one.
    flow, triggered_via, trigger_meta = match_trigger(client_id, contact_id, payload)
    if not flow:
        return False

    return _start(flow, contact_id, payload, triggered_via=triggered_via, trigger_meta=trigger_meta, pinbot=pinbot)


# ─────────────────────────────────────────────────────────────────────────────
# Start a fresh conversation
# ─────────────────────────────────────────────────────────────────────────────
def _start(flow: BotFlow, contact_id: int, payload: dict, *, triggered_via: str,
           trigger_meta: dict, pinbot=None) -> bool:
    starting = flow.starting_node_id or _find_start_node(flow)
    if not starting:
        logger.warning('Flow %s has no start node', flow.id)
        return False

    conv = BotConversation.objects.create(
        client_id=flow.client_id,
        flow=flow,
        contact_id=contact_id,
        triggered_via=triggered_via,
        trigger_metadata=trigger_meta,
        current_node_id=starting,
        path_history=[starting],
    )

    # Bump triggered counter atomically
    BotFlow.objects.filter(pk=flow.pk).update(total_triggered=F('total_triggered') + 1)

    executor = BotExecutor(conv, pinbot=pinbot)

    # Surface any inbound text as `_first_message` for handlers that want it
    text, kind = _extract_user_text(payload)
    if text:
        executor.set_variable('_first_message', text)
        executor.set_variable('_first_message_kind', kind)
    if (payload.get('referral') or {}):
        executor.set_variable('_referral', payload['referral'])

    executor.execute_node(starting)
    return True


def _find_start_node(flow: BotFlow) -> str | None:
    for n in (flow.nodes or []):
        if n.get('type') == 'start':
            return n.get('id')
    return None


def _safety_should_end(conv: BotConversation, text: str) -> bool:
    """bump the per-conversation counters and decide whether the
    runner should auto-end this conversation. Returns True iff a hard limit
    was hit. Mutates `conv` in-memory; the caller persists.
    """
    client = conv.client
    cap_msgs = getattr(client, 'bot_max_msgs_per_conv', 200)
    spam_cap = getattr(client, 'bot_spam_threshold', 5)

    conv.user_messages_count = (conv.user_messages_count or 0) + 1
    if cap_msgs and conv.user_messages_count > cap_msgs:
        return True

    conv.spam_score = (conv.spam_score or 0) + spam_signal(text or '')
    if spam_cap and conv.spam_score >= spam_cap:
        return True
    return False


# ─────────────────────────────────────────────────────────────────────────────
# Resume an in-flight conversation
# ─────────────────────────────────────────────────────────────────────────────
def _continue(conv: BotConversation, payload: dict, *, pinbot=None) -> bool:
    text, kind = _extract_user_text(payload)
    executor = BotExecutor(conv, pinbot=pinbot)
    waiting_node_id = (conv.variables or {}).get('_waiting_for_node') or conv.current_node_id
    waiting_var     = (conv.variables or {}).get('_waiting_for')

    # ── : per-conversation safety caps ──────────────────────────────
    # 1) Hard message cap — kicks in if the bot has somehow looped or the
    # user keeps poking long after the flow's intended end.
    # 2) Spam heuristic — bumps a score; auto-end at the configured threshold.
    if _safety_should_end(conv, text):
        conv.status = 'failed'
        conv.flagged_as_spam = True
        conv.ended_at = timezone.now()
        conv.save(update_fields=['status', 'flagged_as_spam', 'ended_at', 'spam_score'])
        executor.log_step(
            {'id': conv.current_node_id, 'type': '_safety'},
            direction='system',
            payload={'note': 'auto_ended_by_safety', 'spam_score': conv.spam_score,
                     'msg_count': conv.user_messages_count},
        )
        return True

    # Log inbound user message to the audit trail
    if waiting_node_id:
        node = executor.get_node(waiting_node_id) or {'id': waiting_node_id, 'type': '_unknown'}
        executor.log_step(node, direction='user_to_bot', payload={
            'text': text, 'kind': kind, 'raw': payload,
        })

    # Hand off to the node's reply handler if it has one (ask_*); otherwise
    # treat the user message as "any input" and advance.
    from .handlers import REPLY_HANDLERS
    node = executor.get_node(waiting_node_id) if waiting_node_id else None
    if node:
        reply_handler = REPLY_HANDLERS.get(node.get('type'))
        if reply_handler:
            reply_handler(executor, node, text, kind, payload)
            conv.last_activity_at = timezone.now()
            conv.save(update_fields=['last_activity_at'])
            return True

    # Default: treat reply as "advance from current node" (e.g., user replies
    # while the bot was just chatty).
    if waiting_var:
        executor.set_variable(waiting_var, text)
    executor.consume_waiting()
    if waiting_node_id:
        executor.advance_to_next(waiting_node_id, branch=kind if kind != 'text' else None)
    conv.last_activity_at = timezone.now()
    conv.save(update_fields=['last_activity_at', 'user_messages_count', 'spam_score'])
    return True


def _continue_ai(conv: BotConversation, payload: dict, *, pinbot=None) -> bool:
    """ai_takeover_active=True path — Claude handles the turn."""
    text, kind = _extract_user_text(payload)
    executor = BotExecutor(conv, pinbot=pinbot)

    if _safety_should_end(conv, text):
        conv.status = 'failed'
        conv.flagged_as_spam = True
        conv.ai_takeover_active = False
        conv.ended_at = timezone.now()
        conv.save(update_fields=[
            'status', 'flagged_as_spam', 'ai_takeover_active',
            'ended_at', 'spam_score', 'user_messages_count',
        ])
        executor.log_step(
            {'id': conv.current_node_id, 'type': '_safety'},
            direction='system',
            payload={'note': 'auto_ended_by_safety', 'mode': 'ai_chat',
                     'spam_score': conv.spam_score,
                     'msg_count': conv.user_messages_count},
        )
        return True

    # Audit the inbound regardless
    executor.log_step(
        {'id': conv.current_node_id, 'type': 'ai_chat'},
        direction='user_to_bot',
        payload={'text': text, 'kind': kind, 'mode': 'ai_chat'},
    )
    from .handlers.smart import respond_with_ai
    respond_with_ai(executor, text, payload)
    conv.last_activity_at = timezone.now()
    conv.save(update_fields=['last_activity_at', 'user_messages_count', 'spam_score'])
    return True
