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

A pluggable `pinbot` attribute lets tests swap in a fake sender — the engine
otherwise calls `get_pinbot_for_client(client_id)` lazily.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from django.db import transaction
from django.utils import timezone

from ..models import BotConversation, BotConversationStep


logger = logging.getLogger(__name__)


class BotExecutorError(Exception):
    pass


# Hard cap on how many nodes one webhook delivery may walk. Protects against
# loops in user-authored flows (and matches CTWA_MAX_FLOW_DEPTH from settings).
_MAX_DEPTH_DEFAULT = 20


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
        from ..whatsapp_service import get_pinbot_for_client
        self._pinbot = get_pinbot_for_client(self.client.id)
        return self._pinbot

    # ── Node lookup ──────────────────────────────────────────────────────
    def get_node(self, node_id: str) -> Optional[dict]:
        for n in (self.flow.nodes or []):
            if n.get('id') == node_id:
                return n
        return None

    # ── Step audit logging ───────────────────────────────────────────────
    def log_step(self, node: dict, *, direction: str, payload: dict | None = None,
                 duration_ms: Optional[int] = None) -> None:
        BotConversationStep.objects.create(
            conversation=self.conversation,
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

    def consume_waiting(self) -> Optional[str]:
        """Pop the `_waiting_for` marker (set by ask_* handlers). Returns the
        variable name the next user reply should populate, or None."""
        v = dict(self.conversation.variables or {})
        target = v.pop('_waiting_for', None)
        self.conversation.variables = v
        return target

    # ── Movement primitives ──────────────────────────────────────────────
    def advance_to_next(self, current_node_id: str, branch: str | None = None) -> Optional[BotConversation]:
        """Find the next node via outgoing edges (filtered by `branch` /
        sourceHandle when provided), then execute it.

        Returns the (possibly mutated) conversation row.
        """
        edges = [e for e in (self.flow.edges or []) if e.get('source') == current_node_id]
        if branch is not None:
            picked = [e for e in edges if e.get('sourceHandle') == branch]
            edges = picked or edges  # fall back to any edge if no branch match
        if not edges:
            return self.end_conversation('completed')

        next_id = edges[0].get('target')
        return self._step_into(next_id)

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

        try:
            return handler(self, node)
        except BotExecutorError as e:
            return self._fail(str(e))
        except Exception as e:  # noqa: BLE001
            logger.exception('node handler crashed type=%s id=%s', node.get('type'), node_id)
            return self._fail(f'handler crash: {e}')

    def wait_for_user(self, node_id: str, store_var: Optional[str] = None) -> BotConversation:
        """Persist state and stop walking. The next inbound webhook for this
        contact will resume from this node via runner.continue_conversation."""
        v = dict(self.conversation.variables or {})
        v['_waiting_for_node'] = node_id
        if store_var:
            v['_waiting_for'] = store_var
        else:
            v.pop('_waiting_for', None)
        self.conversation.variables = v
        self.conversation.current_node_id = node_id
        with transaction.atomic():
            self.conversation.save()
        return self.conversation

    def end_conversation(self, status: str = 'completed') -> BotConversation:
        self.conversation.status = status
        self.conversation.ended_at = timezone.now()
        # Clean any waiting markers on exit
        v = dict(self.conversation.variables or {})
        v.pop('_waiting_for', None)
        v.pop('_waiting_for_node', None)
        self.conversation.variables = v
        with transaction.atomic():
            self.conversation.save()

        if status == 'completed' and self.flow:
            type(self.flow).objects.filter(pk=self.flow.pk).update(
                total_completed=type(self.flow)._meta.get_field('total_completed').default + 0,
            )
            # Use F-expression for atomic increment
            from django.db.models import F
            type(self.flow).objects.filter(pk=self.flow.pk).update(
                total_completed=F('total_completed') + 1,
            )
        return self.conversation

    def _fail(self, message: str) -> BotConversation:
        BotConversationStep.objects.create(
            conversation=self.conversation,
            node_id=self.conversation.current_node_id or '',
            node_type='_error',
            direction='system',
            payload={'error': message},
        )
        return self.end_conversation('failed')
