# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
human_handoff — escalate to a human agent.
ai_chat       — Claude takes over (free-form turn-by-turn).

ai_chat enters AI takeover mode: the engine sets `ai_takeover_active=True`
on the conversation. Subsequent inbound messages are routed (by runner.py)
to `respond_with_ai`, which generates a Claude reply, sends it via Pinbot,
and appends to the conversation history. The user can exit AI mode by
sending an `_AI_EXIT` keyword (default: "stop", "agent", "human").
"""
from __future__ import annotations

import logging
from typing import List

from django.utils import timezone

from ..templates import render


logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# human_handoff
# ─────────────────────────────────────────────────────────────────────────────
def handle_human_handoff(executor, node):
    """Mark the conversation as handed-off, optionally send a final message,
    and notify the assigned/round-robin agent.

    data: { message, assignee_user_id, group_tag }
    """
    data = node.get('data') or {}
    msg = render(data.get('message', ''), executor.variables)
    if msg:
        try:
            executor.pinbot.send_text(executor.contact.phone, msg)
        except Exception:  # noqa: BLE001
            pass
        executor.log_step(node, direction='bot_to_user', payload={'text': msg})

    assignee_id = data.get('assignee_user_id')
    assignee = _resolve_assignee(executor, assignee_id, group_tag=data.get('group_tag'))

    conv = executor.conversation
    conv.status = 'handed_off'
    conv.handed_off_at = timezone.now()
    conv.handed_off_to_user = assignee
    conv.ended_at = timezone.now()
    conv.save(update_fields=['status', 'handed_off_at', 'handed_off_to_user', 'ended_at'])

    # Notify the assigned agent (— dedicated bot_handoff event)
    if assignee:
        try:
            from ...notification_dispatcher import dispatch as dispatch_notification
            from django.conf import settings
            frontend = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
            contact_label = executor.contact.name or executor.contact.phone
            dispatch_notification(
                assignee,
                event_type='bot_handoff',
                title=f'Handoff from {contact_label}',
                body=(f'Bot flow "{executor.flow.name}" handed conversation #{conv.id} to you. '
                      f'{len(executor.variables)} variable(s) collected.'),
                data={
                    'kind': 'bot_handoff',
                    'conversation_id': conv.id,
                    'contact_id': executor.contact.id,
                    'flow_id': executor.flow.id if executor.flow else None,
                },
                cta_url=f'{frontend}/admin/conversations/{conv.id}',
                cta_label='Open conversation',
                email_subject=f'[Social Stats] Handoff from {contact_label}',
            )
        except Exception:
            logger.exception('handoff notification failed')

    executor.log_step(node, direction='system', payload={
        'assignee_user_id': assignee.id if assignee else None,
    })
    # Don't advance — handoff terminates the bot's run.
    return conv


def _resolve_assignee(executor, explicit_user_id, *, group_tag=None):
    """Pick an agent. Priority: explicit_user_id → round-robin among agency
    members → None (the inbox triages it).

    For this task we keep this minimal — the inbox triage UI in a later stage
    will own true round-robin / availability state.
    """
    from django.contrib.auth.models import User
    if explicit_user_id:
        return User.objects.filter(pk=explicit_user_id).first()
    # Round-robin among the workspace's staff. Cheap version: random pick.
    staff = list(User.objects.filter(profile__assigned_clients=executor.client).distinct()[:20])
    if staff:
        import random
        return random.choice(staff)
    return None


# ─────────────────────────────────────────────────────────────────────────────
# ai_chat — handed off to Claude
# ─────────────────────────────────────────────────────────────────────────────
_DEFAULT_PERSONA = (
    'You are a helpful customer-service assistant. '
    'Keep replies under 80 words. Be friendly, factual, and never make up information. '
    'If the user asks for medical, legal, or financial advice — politely defer and suggest a human consultant.'
)
_DEFAULT_EXIT_KEYWORDS = ('stop', 'agent', 'human', 'staff', 'representative')


def handle_ai_chat(executor, node):
    """Send the opening turn (if configured), enable AI takeover, halt.

    data: { persona, opening_message, exit_keywords, max_turns, max_tokens }
    """
    data = node.get('data') or {}
    opening = render(data.get('opening_message', ''), executor.variables)
    if opening:
        executor.pinbot.send_text(executor.contact.phone, opening)
        executor.log_step(node, direction='bot_to_user', payload={'text': opening, 'mode': 'ai_chat_opening'})

    # Persist AI config on the conversation so reply handler can read it
    executor.set_variable('_ai_node_id', node['id'])
    executor.set_variable('_ai_turn_count', 0)
    executor.conversation.ai_takeover_active = True
    executor.conversation.current_node_id = node['id']
    executor.conversation.save()

    # Don't advance — wait for the user's next message; runner routes to respond_with_ai
    return executor.conversation


def respond_with_ai(executor, user_message: str, raw_payload: dict):
    """Called by runner.py when ai_takeover_active=True and an inbound arrives."""
    conv = executor.conversation
    variables = conv.variables or {}
    node = executor.get_node(variables.get('_ai_node_id') or conv.current_node_id) or {}
    data = node.get('data') or {}

    exit_keywords = [w.strip().lower() for w in (data.get('exit_keywords') or _DEFAULT_EXIT_KEYWORDS) if w]
    max_turns = int(data.get('max_turns') or 12)
    max_tokens = int(data.get('max_tokens') or 256)

    # Exit conditions
    if (user_message or '').strip().lower() in exit_keywords:
        return _exit_ai(executor, node, reason='user_exit_keyword')

    turn_count = int(variables.get('_ai_turn_count') or 0) + 1
    if turn_count > max_turns:
        return _exit_ai(executor, node, reason='max_turns_exceeded')

    persona = render(data.get('persona') or _DEFAULT_PERSONA, executor.variables)

    # Build conversation history from the audit trail
    history = _build_history(conv)

    system = (
        f'{persona}\n\n'
        f'You are talking to {executor.contact.name or "a customer"} '
        f'on WhatsApp. Variables we already collected: '
        + ', '.join(f'{k}={v}' for k, v in (executor.variables or {}).items() if not k.startswith('_'))
        + '\n\nIf you cannot help, politely say so and suggest connecting them to a human agent.'
    )

    prompt_blocks: List[str] = []
    for h in history[-10:]:
        prompt_blocks.append(f'{h["who"]}: {h["text"]}')
    prompt_blocks.append(f'User: {user_message}')
    prompt = '\n'.join(prompt_blocks) + '\nAssistant:'

    try:
        from ...ai.client import AIClient
        ai = AIClient(client=executor.client, user=None, feature='ctwa_ai_chat')
        reply = ai.complete(
            prompt=prompt, system=system,
            max_tokens=max_tokens, temperature=0.6,
            fast=True,           # Haiku — cheap + fast for chat
            use_cache=False,
        ).strip()
    except Exception as e:  # noqa: BLE001
        logger.exception('AI chat failed for conv=%s', conv.id)
        executor.pinbot.send_text(
            executor.contact.phone,
            'Sorry, I had a hiccup. Let me hand you to a human teammate.',
        )
        return _exit_ai(executor, node, reason=f'ai_error:{e}')

    if not reply:
        reply = "Sorry, I'm not sure how to answer that. Want me to connect you to a teammate?"

    executor.pinbot.send_text(executor.contact.phone, reply)
    executor.log_step(node, direction='bot_to_user', payload={
        'text': reply, 'mode': 'ai_chat', 'turn': turn_count,
    })
    executor.set_variable('_ai_turn_count', turn_count)
    executor.conversation.save()


def _exit_ai(executor, node, *, reason: str):
    """Leave AI mode and walk the next outgoing edge — the flow author can
    wire a `human_handoff` or `end_conversation` node after `ai_chat`."""
    executor.conversation.ai_takeover_active = False
    v = dict(executor.variables or {})
    v.pop('_ai_node_id', None); v.pop('_ai_turn_count', None)
    executor.conversation.variables = v
    executor.conversation.save()
    executor.log_step(node, direction='system', payload={'note': 'ai_exit', 'reason': reason})
    return executor.advance_to_next(node['id'])


def _build_history(conv) -> List[dict]:
    """Reconstruct the chat history from BotConversationStep rows for AI context."""
    rows = list(conv.steps.order_by('created_at').values('direction', 'payload', 'node_type'))
    out = []
    for r in rows:
        text = (r['payload'] or {}).get('text', '')
        if not text:
            continue
        out.append({
            'who':  'User' if r['direction'] == 'user_to_bot' else 'Assistant',
            'text': text,
        })
    return out
