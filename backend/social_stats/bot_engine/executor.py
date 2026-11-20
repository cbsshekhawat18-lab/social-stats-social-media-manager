# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
BotExecutor — walks a flow's node graph for a single BotConversation.

The executor is the only thing that mutates conversation state during a run.
All node handlers receive an executor instance, perform their work, then
call back into one of:
    executor.advance_to_next(node_id, branch?)   — proceed to the next node
    executor.wait_for_user(node_id, store_var?)  — halt; webhook resumes
    executor.end_conversation(status)            — terminate

The graph comes from the conversation's pinned `flow_version` (the snapshot
taken at publish time), falling back to the live flow for conversations that
predate versioning or test runs of a draft.

Every free-form WhatsApp send goes through `send_freeform`, which enforces the
24-hour customer-service window (see window.py).

A pluggable `pinbot` attribute lets tests swap in a fake sender — the engine
otherwise calls `get_whatsapp_client(client_id)` lazily.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from ..models import BotConversation, BotConversationStep
from .window import in_service_window


logger = logging.getLogger(__name__)


class BotExecutorError(Exception):
    pass


# Hard cap on how many nodes one webhook delivery may walk. Protects against
# loops in user-authored flows (and matches CTWA_MAX_FLOW_DEPTH from settings).
_MAX_DEPTH_DEFAULT = 20

# Nodes that send a prompt and halt until the user answers.
WAITING_TYPES = frozenset({
    'ask_question', 'ask_email', 'ask_phone', 'ask_number', 'ask_location',
    'ask_attachment', 'message_buttons', 'message_list',
})

# Named outputs with special meaning. When a node advances without a branch
# ("carry on"), these are never picked as the default edge.
SPECIAL_HANDLES = frozenset({
    'no_match', 'invalid', 'timeout', 'failure', 'missing', 'other',
})

DEFAULT_MAX_RETRIES = 3
MAX_TIMEOUT_MINUTES = 7 * 24 * 60


def timeout_minutes(node: dict) -> int:
    """`data.timeout_minutes` of an answer node, clamped to 1 minute … 7 days
    (0 = no timeout)."""
    try:
        minutes = int((node.get('data') or {}).get('timeout_minutes') or 0)
    except (TypeError, ValueError):
        return 0
    return min(minutes, MAX_TIMEOUT_MINUTES) if minutes > 0 else 0


class BotExecutor:
    def __init__(self, conversation: BotConversation, *, pinbot=None, max_depth: int = _MAX_DEPTH_DEFAULT):
        self.conversation = conversation
        self.flow         = conversation.flow
        self.client       = conversation.client
        self.contact      = conversation.contact
        self.max_depth    = max_depth
        self._pinbot      = pinbot
        self._depth       = 0

    # ── Pinbot accessor (lazy so tests can pass a fake) ──────────────────
    @property
    def pinbot(self):
        if self._pinbot is not None:
            return self._pinbot
        from ..whatsapp_service import get_whatsapp_client
        self._pinbot = get_whatsapp_client(self.client.id)
        return self._pinbot

    # ── Graph (pinned version → live flow) ───────────────────────────────
    @property
    def graph(self):
        """The object whose nodes/edges this conversation runs on."""
        return self.conversation.flow_version or self.flow

    @property
    def nodes(self) -> list:
        return list(getattr(self.graph, 'nodes', None) or [])

    @property
    def edges(self) -> list:
        return list(getattr(self.graph, 'edges', None) or [])

    def get_node(self, node_id: str) -> Optional[dict]:
        for n in self.nodes:
            if n.get('id') == node_id:
                return n
        return None

    def find_node_of_type(self, node_type: str) -> Optional[dict]:
        for n in self.nodes:
            if n.get('type') == node_type:
                return n
        return None

    def outgoing_edges(self, node_id: str) -> list:
        return [e for e in self.edges if e.get('source') == node_id]

    def has_branch(self, node_id: str, handle: Optional[str]) -> bool:
        if not handle:
            return False
        return any(e.get('sourceHandle') == handle for e in self.outgoing_edges(node_id))

    # ── Step audit logging ───────────────────────────────────────────────
    def log_step(self, node: dict, *, direction: str, payload: dict | None = None,
                 duration_ms: Optional[int] = None) -> None:
        BotConversationStep.objects.create(
            conversation=self.conversation,
            client_id=self.conversation.client_id,
            node_id=node.get('id', ''),
            node_type=node.get('type', ''),
            direction=direction,
            payload=payload or {},
            duration_ms=duration_ms,
        )

    # ── Variable helpers ─────────────────────────────────────────────────
    @property
    def variables(self) -> dict:
        return self.conversation.variables or {}

    def set_variable(self, name: str, value: Any) -> None:
        if not name:
            return
        v = dict(self.conversation.variables or {})
        v[name] = value
        self.conversation.variables = v
        # caller is responsible for the eventual save; we don't write per-set
        # to keep one DB round-trip per run.

    def pop_variable(self, name: str, default: Any = None) -> Any:
        v = dict(self.conversation.variables or {})
        value = v.pop(name, default)
        self.conversation.variables = v
        return value

    def consume_waiting(self) -> Optional[str]:
        """Pop the `_waiting_for` marker (set by ask_* handlers). Returns the
        variable name the next user reply should populate, or None."""
        return self.pop_variable('_waiting_for')

    def save(self) -> None:
        with transaction.atomic():
            self.conversation.save()

    # ── 24-hour window ───────────────────────────────────────────────────
    def send_freeform(self, node: dict, method: str, *args, **kwargs) -> bool:
        """Send a non-template message via `pinbot.<method>` if the 24-hour
        window is open. Returns True when sent.

        Outside the window: send `node.data.fallback_template` instead (and
        return False — the caller skips its own audit row), or raise so the
        conversation ends as failed with `_error: outside_24h_window`.
        """
        if in_service_window(self.contact):
            getattr(self.pinbot, method)(*args, **kwargs)
            return True
        return self._send_window_fallback(node)

    def _send_window_fallback(self, node: dict) -> bool:
        fb = (node.get('data') or {}).get('fallback_template')
        cfg = {'name': fb} if isinstance(fb, str) else (dict(fb) if isinstance(fb, dict) else {})
        name = cfg.get('name') or cfg.get('template_name')
        if not name:
            raise BotExecutorError('outside_24h_window')
        from .handlers.messages import _render_components
        language = cfg.get('language') or 'en_US'
        components = _render_components(cfg.get('components') or [], self.variables)
        self.pinbot.send_text_template(self.contact.phone, name, language, components)
        self.log_step(node, direction='bot_to_user', payload={
            'template_name': name, 'language': language, 'components': components,
            'reason': 'outside_24h_window',
        })
        if node.get('type') in WAITING_TYPES:
            # The template re-opens the conversation; when the user replies
            # (window open again) the node re-sends its real prompt.
            self.set_variable('_resend_on_reply', node.get('id'))
        return False

    # ── Movement primitives ──────────────────────────────────────────────
    def advance_to_next(self, current_node_id: str, branch: str | None = None) -> Optional[BotConversation]:
        """Find the next node via outgoing edges (filtered by `branch` /
        sourceHandle when provided), then execute it.

        Without a branch, special outputs (`invalid`, `timeout`, `no_match`…)
        are never taken as the default edge. With a branch that has no edge,
        an explicit `no_match` edge wins, then the legacy first-edge fallback.
        """
        self.clear_retries(current_node_id)
        if ((self.conversation.variables or {}).get('_timeout') or {}).get('node') == current_node_id:
            self.pop_variable('_timeout')       # answered (or timed out): disarm the timer
        edges = self.outgoing_edges(current_node_id)
        plain = [e for e in edges if e.get('sourceHandle') not in SPECIAL_HANDLES]
        if branch is not None:
            edges = (
                [e for e in edges if e.get('sourceHandle') == branch]
                or [e for e in edges if e.get('sourceHandle') == 'no_match']
                or [e for e in edges if not e.get('sourceHandle')]   # the node's single plain output
                or plain or edges                                    # legacy: any edge
            )
        else:
            edges = plain or edges
        if not edges:
            return self.end_conversation('completed')

        next_id = edges[0].get('target')
        return self._step_into(next_id)

    def step_to(self, node_id: str) -> Optional[BotConversation]:
        """Jump straight to `node_id` (used when a handler has already chosen
        the edge itself, e.g. random_split)."""
        return self._step_into(node_id)

    def _step_into(self, node_id: str) -> Optional[BotConversation]:
        if self._depth >= self.max_depth:
            return self._fail(f'flow depth exceeded {self.max_depth}; possible loop')
        self._depth += 1

        history = list(self.conversation.path_history or [])
        history.append(node_id)
        self.conversation.path_history = history
        self.conversation.current_node_id = node_id
        return self.execute_node(node_id)

    def execute_node(self, node_id: str) -> Optional[BotConversation]:
        from .handlers import NODE_HANDLERS

        node = self.get_node(node_id)
        if not node:
            return self._fail(f'node not found: {node_id}')

        handler = NODE_HANDLERS.get(node.get('type'))
        if not handler:
            return self._fail(f"no handler for node_type={node.get('type')!r}")

        # The savepoint keeps a database error inside one handler from
        # poisoning the surrounding transaction, so _fail can still record it.
        try:
            with transaction.atomic():
                return handler(self, node)
        except BotExecutorError as e:
            return self._fail(str(e))
        except Exception as e:  # noqa: BLE001
            logger.exception('node handler crashed type=%s id=%s', node.get('type'), node_id)
            return self._fail(f'handler crash: {e}')

    def run_reply_handler(self, handler, node: dict, text: str, kind: str, payload: dict):
        """Run an ask_* / buttons / list reply handler with the same error
        handling execute_node gives send handlers."""
        try:
            with transaction.atomic():
                return handler(self, node, text, kind, payload)
        except BotExecutorError as e:
            return self._fail(str(e))
        except Exception as e:  # noqa: BLE001
            logger.exception('reply handler crashed type=%s id=%s', node.get('type'), node.get('id'))
            return self._fail(f'handler crash: {e}')

    def wait_for_user(self, node_id: str, store_var: Optional[str] = None) -> BotConversation:
        """Persist state and stop walking. The next inbound webhook for this
        contact will resume from this node via runner.continue_conversation.

        If the node has `timeout_minutes`, a timer is armed: a reminder once
        (if `reminder_text` is set), then the node's `timeout` output."""
        node = self.get_node(node_id)
        if node:
            self.schedule_timeout(node)
        v = dict(self.conversation.variables or {})
        v['_waiting_for_node'] = node_id
        if store_var:
            v['_waiting_for'] = store_var
        else:
            v.pop('_waiting_for', None)
        self.conversation.variables = v
        self.conversation.current_node_id = node_id
        self.save()
        return self.conversation

    def end_conversation(self, status: str = 'completed') -> BotConversation:
        self.conversation.status = status
        self.conversation.ended_at = timezone.now()
        self.conversation.ai_takeover_active = False
        # Clean any waiting markers on exit
        v = dict(self.conversation.variables or {})
        for k in ('_waiting_for', '_waiting_for_node', '_resend_on_reply',
                  '_waiting_for_resume', '_resume_node_id', '_timeout'):
            v.pop(k, None)
        self.conversation.variables = v
        self.save()

        if status == 'completed' and self.flow:
            type(self.flow).objects.filter(pk=self.flow.pk).update(
                total_completed=F('total_completed') + 1,
            )
        return self.conversation

    def _fail(self, message: str) -> BotConversation:
        BotConversationStep.objects.create(
            conversation=self.conversation,
            client_id=self.conversation.client_id,
            node_id=self.conversation.current_node_id or '',
            node_type='_error',
            direction='system',
            payload={'error': message},
        )
        return self.end_conversation('failed')

    # ── Answer timeout (ask nodes, buttons, lists) ───────────────────────
    def schedule_timeout(self, node: dict, *, reminded: bool = False) -> None:
        """Arm (or re-arm) the node's answer timer. Each arming gets a fresh
        token, so timers from an earlier prompt — or from before the customer
        replied — find a different token and do nothing."""
        minutes = timeout_minutes(node)
        if not minutes:
            self.pop_variable('_timeout')
            return
        import uuid
        token = uuid.uuid4().hex[:12]
        self.set_variable('_timeout', {'node': node['id'], 'token': token, 'reminded': reminded})
        from .tasks import ask_node_timeout
        try:
            ask_node_timeout.apply_async(
                args=[self.conversation.id, node['id'], token], countdown=minutes * 60,
            )
        except Exception:  # noqa: BLE001 — a broker hiccup must not break the conversation
            logger.exception('could not schedule ask timeout for conv=%s', self.conversation.id)

    # ── Retries (ask nodes, buttons, lists) ──────────────────────────────
    def register_retry(self, node: dict) -> bool:
        """Count one more invalid answer on `node`. True once the count goes
        past `data.max_retries` (default 3)."""
        try:
            limit = int((node.get('data') or {}).get('max_retries', DEFAULT_MAX_RETRIES))
        except (TypeError, ValueError):
            limit = DEFAULT_MAX_RETRIES
        v = dict(self.conversation.variables or {})
        retries = dict(v.get('_retries') or {})
        count = int(retries.get(node['id'], 0)) + 1
        retries[node['id']] = count
        v['_retries'] = retries
        self.conversation.variables = v
        return count > limit

    def clear_retries(self, node_id: str) -> None:
        retries = dict((self.conversation.variables or {}).get('_retries') or {})
        if node_id in retries:
            retries.pop(node_id)
            self.set_variable('_retries', retries)

    def on_retries_exceeded(self, node: dict) -> Optional[BotConversation]:
        """Too many invalid answers: take the node's `invalid` output if it is
        wired, else hand off to a human if the flow has a handoff node, else
        end the conversation as failed."""
        node_id = node['id']
        self.consume_waiting()
        self.pop_variable('_waiting_for_node')
        self.log_step(node, direction='system', payload={'note': 'max_retries_exceeded'})
        if self.has_branch(node_id, 'invalid'):
            return self.advance_to_next(node_id, branch='invalid')
        self.clear_retries(node_id)
        handoff = self.find_node_of_type('human_handoff')
        if handoff:
            return self._step_into(handoff['id'])
        return self._fail('max_retries_exceeded')

    # ── No matching branch (buttons, lists, conditions) ──────────────────
    def handle_no_match(self, node: dict, user_text: str) -> Optional[BotConversation]:
        """The user's input matched none of the node's branches.

        1. an explicit `no_match` edge, if the author wired one;
        2. with `flow.ai_fallback_enabled`: one AI reply in the
           `ai_fallback_persona`, then ask the same question again;
        3. otherwise the legacy behaviour (first edge out of the node).
        """
        node_id = node['id']
        if self.has_branch(node_id, 'no_match'):
            self.consume_waiting()
            return self.advance_to_next(node_id, branch='no_match')
        if self.flow and self.flow.ai_fallback_enabled and (user_text or '').strip():
            from .handlers.smart import ai_fallback_turn
            ai_fallback_turn(self, node, user_text)
            return self.reask(node)
        self.consume_waiting()
        return self.advance_to_next(node_id)

    def reask(self, node: dict) -> Optional[BotConversation]:
        """Re-send the question the user is answering: `node` itself when it
        waits for input, otherwise the last prompt node on the path (for
        conditions evaluated right after an answer)."""
        target = node if node.get('type') in WAITING_TYPES else self._last_prompt_node(node['id'])
        if not target:
            return self.advance_to_next(node['id'])
        if self.register_retry(target):
            return self.on_retries_exceeded(target)
        self.conversation.current_node_id = target['id']
        return self.execute_node(target['id'])

    def _last_prompt_node(self, exclude_id: str) -> Optional[dict]:
        for node_id in reversed(self.conversation.path_history or []):
            if node_id == exclude_id:
                continue
            n = self.get_node(node_id)
            if n and n.get('type') in WAITING_TYPES:
                return n
        return None
