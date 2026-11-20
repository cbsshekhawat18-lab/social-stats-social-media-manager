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

One inbound message is processed inside a single transaction that holds row
locks on the contact and on its active conversation, so two webhook
deliveries (or a webhook and a wait_delay timer) can't walk the same
conversation at once.
"""
from __future__ import annotations

import logging
from datetime import timedelta

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from ..models import BotConversation, BotFlow, BotFlowVersion, Client, WhatsAppContact
from .business_hours import flow_is_open
from .executor import BotExecutor
from .language import detect_language, is_confident
from .safety import is_bot_enabled, is_rate_limited, spam_signal
from .triggers import match_entry_trigger, match_trigger


logger = logging.getLogger(__name__)

DEFAULT_ABANDON_AFTER_MINUTES = 1440
# Don't repeat the out-of-hours notice to the same contact more often than this.
OUT_OF_HOURS_NOTICE_EVERY = timedelta(hours=1)


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


def abandon_after_minutes(client) -> int:
    try:
        return max(1, int(getattr(client, 'bot_abandon_after_minutes', None) or DEFAULT_ABANDON_AFTER_MINUTES))
    except (TypeError, ValueError):
        return DEFAULT_ABANDON_AFTER_MINUTES


def published_version_of(flow: BotFlow) -> BotFlowVersion | None:
    """The snapshot new conversations of `flow` run on (None → live flow,
    for flows published before versioning existed)."""
    if not flow.published_version:
        return None
    return BotFlowVersion.objects.filter(flow_id=flow.pk, version=flow.published_version).first()


def process_incoming_message(client_id: int, contact_id: int, payload: dict, *, pinbot=None) -> bool:
    """Engine entry point. Returns True iff the message was handled by a bot."""
    if not payload:
        return False

    # ── safety preflight ────────────────────────────────────────────
    # Cheap checks first — kill switch, then rate limit. If either trips, we
    # return True so the message is consumed (the inbox shouldn't get a copy
    # of a spam burst), but we never hit the engine, AI, or PinBot.
    client = Client.objects.filter(pk=client_id).only(
        'id', 'bot_enabled', 'bot_max_msgs_per_minute', 'bot_abandon_after_minutes',
    ).first()
    if not client:
        return False
    if not is_bot_enabled(client):
        logger.info('bot disabled for client=%s — skipping', client_id)
        return False  # let the inbox handle it
    if is_rate_limited(client_id, contact_id, max_per_minute=client.bot_max_msgs_per_minute):
        logger.warning('rate-limited contact=%s on client=%s — dropping', contact_id, client_id)
        return True  # silently drop — don't fall through to inbox spam

    with transaction.atomic():
        # Serialise everything for this contact (also covers two "first"
        # messages racing to start a conversation).
        if WhatsAppContact.objects.select_for_update().filter(
            pk=contact_id, client_id=client_id,
        ).only('id').first() is None:
            return False

        # 1. Resume an active conversation if one exists for this contact.
        active = (
            BotConversation.objects.select_for_update()
            .filter(client_id=client_id, contact_id=contact_id, status='active')
            .order_by('-started_at')
            .first()
        )
        if active:
            reason = _retire_reason(active, client, payload)
            if reason is None:
                if active.ai_takeover_active:
                    return _continue_ai(active, payload, pinbot=pinbot)
                return _continue(active, payload, pinbot=pinbot)
            _retire(active, reason, pinbot=pinbot)

        # 2. No (usable) active conversation — try to trigger a new one.
        flow, triggered_via, trigger_meta = match_trigger(client_id, contact_id, payload)
        if not flow:
            return False

        return _start(flow, contact_id, payload, triggered_via=triggered_via,
                      trigger_meta=trigger_meta, pinbot=pinbot)


# ─────────────────────────────────────────────────────────────────────────────
# Retiring a conversation that should no longer receive this message
# ─────────────────────────────────────────────────────────────────────────────
def _retire_reason(conv: BotConversation, client, payload: dict) -> tuple[str, str] | None:
    """(status, note) when `conv` must be ended instead of resumed, else None."""
    if not conv.flow_id or not conv.flow.is_active:
        return ('exited', 'flow_unpublished')
    idle_limit = timedelta(minutes=abandon_after_minutes(client))
    if conv.last_activity_at and timezone.now() - conv.last_activity_at > idle_limit:
        return ('abandoned', 'idle_timeout')
    entry_flow, _via, _meta = match_entry_trigger(conv.client_id, payload)
    if entry_flow and entry_flow.pk != conv.flow_id:
        return ('abandoned', f'replaced_by_flow_{entry_flow.pk}')
    return None


def _retire(conv: BotConversation, reason: tuple[str, str], *, pinbot=None) -> None:
    status, note = reason
    executor = BotExecutor(conv, pinbot=pinbot)
    executor.log_step({'id': conv.current_node_id, 'type': '_system'}, direction='system',
                      payload={'note': note})
    executor.end_conversation(status)


# ─────────────────────────────────────────────────────────────────────────────
# Start a fresh conversation
# ─────────────────────────────────────────────────────────────────────────────
def _start(flow: BotFlow, contact_id: int, payload: dict, *, triggered_via: str,
           trigger_meta: dict, pinbot=None) -> bool:
    if not flow_is_open(flow):
        return _out_of_hours(flow, contact_id, triggered_via=triggered_via,
                             trigger_meta=trigger_meta, pinbot=pinbot)

    version = published_version_of(flow)
    graph = version or flow
    starting = graph.starting_node_id or _find_start_node(graph)
    if not starting:
        logger.warning('Flow %s has no start node', flow.id)
        return False

    conv = BotConversation.objects.create(
        client_id=flow.client_id,
        flow=flow,
        flow_version=version,
        contact_id=contact_id,
        triggered_via=triggered_via,
        trigger_metadata=trigger_meta,
        current_node_id=starting,
        path_history=[starting],
    )

    # Bump triggered counter atomically
    BotFlow.objects.filter(pk=flow.pk).update(total_triggered=F('total_triggered') + 1)
    if (trigger_meta or {}).get('ctwa_campaign_id'):
        from ..models import CTWACampaign
        CTWACampaign.objects.filter(
            pk=trigger_meta['ctwa_campaign_id'], client_id=flow.client_id,
        ).update(total_conversations=F('total_conversations') + 1)

    executor = BotExecutor(conv, pinbot=pinbot)

    # Surface any inbound text as `_first_message` for handlers that want it
    text, kind = _extract_user_text(payload)
    if text:
        executor.set_variable('_first_message', text)
        executor.set_variable('_first_message_kind', kind)
        executor.set_variable('_last_user_text', text)
        _note_language(executor, text, kind)
    if (payload.get('referral') or {}):
        executor.set_variable('_referral', payload['referral'])

    executor.execute_node(starting)
    return True


def _out_of_hours(flow: BotFlow, contact_id: int, *, triggered_via: str,
                  trigger_meta: dict, pinbot=None) -> bool:
    """The flow only runs in business hours and it is closed now: send the
    out-of-hours message (at most once an hour per contact), record why, and
    do not run the flow."""
    recent = BotConversation.objects.filter(
        client_id=flow.client_id, contact_id=contact_id, flow=flow,
        trigger_metadata__has_key='out_of_hours',
        started_at__gte=timezone.now() - OUT_OF_HOURS_NOTICE_EVERY,
    ).exists()
    if recent:
        return True

    conv = BotConversation.objects.create(
        client_id=flow.client_id, flow=flow, contact_id=contact_id,
        triggered_via=triggered_via,
        trigger_metadata={**(trigger_meta or {}), 'out_of_hours': True},
        status='exited', ended_at=timezone.now(),
    )
    executor = BotExecutor(conv, pinbot=pinbot)
    node = {'id': '', 'type': '_business_hours'}
    executor.log_step(node, direction='system', payload={'note': 'outside_business_hours'})
    message = (flow.out_of_hours_message or '').strip()
    if message:
        try:
            # The contact has just written to us, so the 24h window is open.
            executor.pinbot.send_text(executor.contact.phone, message)
            executor.log_step(node, direction='bot_to_user', payload={'text': message})
        except Exception:  # noqa: BLE001
            logger.exception('out-of-hours message failed for flow=%s', flow.id)
    return True


def _note_language(executor: BotExecutor, text: str, kind: str) -> None:
    """Detect Hindi / Hinglish / English from the customer's first typed
    message and keep it in `_lang` for AI nodes. Button and list taps carry
    the flow's own wording, so they don't count. A short English-looking
    opener ("Hi") stays provisional until a longer message confirms it."""
    if kind != 'text' or executor.variables.get('_lang_final'):
        return
    lang = detect_language(text)
    if not lang:
        return
    executor.set_variable('_lang', lang)
    if is_confident(text, lang):
        executor.set_variable('_lang_final', True)


def _find_start_node(graph) -> str | None:
    for n in (graph.nodes or []):
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


def _save_counters(conv: BotConversation, *extra: str) -> None:
    """Persist what the runner itself changed. Handlers save the conversation
    state they change (wait_for_user / end_conversation / …); a full save here
    could overwrite that with a stale copy — e.g. when Celery runs eagerly and
    a wait_delay timer has already advanced the row."""
    conv.save(update_fields=['last_activity_at', 'user_messages_count', 'spam_score', *extra])


def _end_for_safety(conv: BotConversation, executor: BotExecutor, *, mode: str = '') -> bool:
    conv.flagged_as_spam = True
    executor.log_step(
        {'id': conv.current_node_id, 'type': '_safety'},
        direction='system',
        payload={'note': 'auto_ended_by_safety', 'spam_score': conv.spam_score,
                 'msg_count': conv.user_messages_count, **({'mode': mode} if mode else {})},
    )
    executor.end_conversation('failed')
    return True


# ─────────────────────────────────────────────────────────────────────────────
# Resume an in-flight conversation
# ─────────────────────────────────────────────────────────────────────────────
def _continue(conv: BotConversation, payload: dict, *, pinbot=None) -> bool:
    text, kind = _extract_user_text(payload)
    executor = BotExecutor(conv, pinbot=pinbot)
    variables = conv.variables or {}
    waiting_node_id = variables.get('_waiting_for_node') or conv.current_node_id
    waiting_var     = variables.get('_waiting_for')

    # ── per-conversation safety caps ────────────────────────────────
    # 1) Hard message cap — kicks in if the bot has somehow looped or the
    # user keeps poking long after the flow's intended end.
    # 2) Spam heuristic — bumps a score; auto-end at the configured threshold.
    if _safety_should_end(conv, text):
        return _end_for_safety(conv, executor)

    # Log inbound user message to the audit trail
    node = executor.get_node(waiting_node_id) if waiting_node_id else None
    if waiting_node_id:
        executor.log_step(node or {'id': waiting_node_id, 'type': '_unknown'},
                          direction='user_to_bot',
                          payload={'text': text, 'kind': kind, 'raw': payload})
    if text:
        executor.set_variable('_last_user_text', text)
        _note_language(executor, text, kind)

    # A wait_delay timer owns this conversation: record the message, but let
    # the timer advance the flow (otherwise the node after the wait runs twice).
    if variables.get('_waiting_for_resume'):
        _save_counters(conv, 'variables')
        return True

    # The node's prompt could not be sent earlier (24h window closed, a
    # template went out instead). The user has now replied, so send the real
    # prompt and wait for the answer to *that*.
    if node and variables.get('_resend_on_reply') == node.get('id'):
        executor.pop_variable('_resend_on_reply')
        executor.execute_node(node['id'])
        _save_counters(conv)
        return True

    # Hand off to the node's reply handler if it has one (ask_*, buttons,
    # list); otherwise treat the user message as "any input" and advance.
    from .handlers import REPLY_HANDLERS
    reply_handler = REPLY_HANDLERS.get(node.get('type')) if node else None
    if reply_handler:
        executor.run_reply_handler(reply_handler, node, text, kind, payload)
        _save_counters(conv)
        return True

    # Default: treat reply as "advance from current node" (e.g., user replies
    # while the bot was just chatty).
    if waiting_var:
        executor.set_variable(waiting_var, text)
    executor.consume_waiting()
    if waiting_node_id:
        executor.advance_to_next(waiting_node_id, branch=kind if kind != 'text' else None)
    _save_counters(conv)
    return True


def _continue_ai(conv: BotConversation, payload: dict, *, pinbot=None) -> bool:
    """ai_takeover_active=True path — Claude handles the turn."""
    text, kind = _extract_user_text(payload)
    executor = BotExecutor(conv, pinbot=pinbot)

    if _safety_should_end(conv, text):
        return _end_for_safety(conv, executor, mode='ai_chat')

    # Audit the inbound regardless
    executor.log_step(
        {'id': conv.current_node_id, 'type': 'ai_chat'},
        direction='user_to_bot',
        payload={'text': text, 'kind': kind, 'mode': 'ai_chat'},
    )
    if text:
        executor.set_variable('_last_user_text', text)
        _note_language(executor, text, kind)
    from .handlers.smart import respond_with_ai
    from .executor import BotExecutorError
    try:
        respond_with_ai(executor, text, payload)
    except BotExecutorError as e:
        executor._fail(str(e))
    _save_counters(conv)
    return True
