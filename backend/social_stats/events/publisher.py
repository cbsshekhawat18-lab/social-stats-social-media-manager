# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Event publishing + async dispatch.

Three pieces:

  • `EventPublisher.publish(...)` — the SINGLE entry point producers call.
    Synchronously inserts an EventLog row, then schedules `dispatch_event`
    asynchronously so the original request returns immediately.

  • `dispatch_event(event_id)` — looks up the handlers registered for the
    event_type and schedules `run_event_handler` for each. Tiny task; just
    a fan-out.

  • `run_event_handler(event_id, handler_path)` — runs a single handler
    function inside a `select_for_update` transaction so we can append
    to `processed_by_handlers` atomically. Idempotent: a handler that's
    already in the list is skipped.

The two-stage dispatch (`dispatch_event` → fan-out → `run_event_handler`) gives
us per-handler retry semantics: if one handler fails and gets retried, the
others aren't affected.

Publishers should NEVER call handlers directly — always go through
`EventPublisher.publish()`. Handlers should NEVER `import` each other —
they're meant to be loosely coupled, fired by the dispatcher.
"""
from __future__ import annotations

import logging
import uuid
from importlib import import_module
from typing import Any

from celery import shared_task
from django.db import transaction

logger = logging.getLogger(__name__)


class EventPublisher:
    """Single entry point for emitting domain events.

    Usage:

        from social_stats.events.publisher import EventPublisher

        EventPublisher.publish(
            'lead.captured',
            client=lead.client,
            actor=request.user,
            payload={'lead_id': lead.id, 'source': 'bot'},
            correlation_id=request_correlation_id,  # optional
        )

    The `correlation_id` lets you stitch related events together (a webhook
    landing → bot starting → lead captured → notification sent should all
    share the same correlation_id so debugging traces the full chain).
    """

    @classmethod
    def publish(cls, event_type, *, client, actor=None, payload=None, correlation_id=None, actor_type=None):
        """Insert an EventLog row and schedule async dispatch.

        Returns the EventLog instance so callers can attach the id to traces.
        Synchronous DB write keeps the audit guarantee — the row exists before
        the function returns. Dispatch is async so producers don't pay the
        cost of running every handler.
        """
        from social_stats.models import EventLog

        event = EventLog.objects.create(
            client=client,
            event_type=event_type,
            actor_user=actor,
            actor_type=actor_type or cls._resolve_actor_type(actor),
            payload=payload or {},
            correlation_id=correlation_id or uuid.uuid4(),
        )

        # Dispatch on commit so we never schedule a task for an event that
        # rolled back. This is the same pattern Django docs recommend for
        # any post-save side-effect.
        transaction.on_commit(lambda: dispatch_event.delay(event.id))
        return event

    @staticmethod
    def _resolve_actor_type(actor) -> str:
        """Best-effort actor classification. Producers can override with
        an explicit `actor_type=` kwarg if they have richer context."""
        if actor is None:
            return 'system'
        # AI tool-use actor sets a flag we can read; fall through to user
        # otherwise. Agency vs end-user nuance is also up to the caller —
        # default 'user' is correct unless explicitly overridden.
        if getattr(actor, 'is_ai_actor', False):
            return 'ai'
        return 'user'


# ── Async machinery ───────────────────────────────────────────────────────────
@shared_task(bind=True, max_retries=3, default_retry_delay=60, ignore_result=True)
def dispatch_event(self, event_id: int):
    """Fan an event out to its registered handlers.

    Looks up the handler list in events/registry.py, then schedules
    `run_event_handler` for each. Idempotent at the handler level — re-running
    this whole task is safe because each handler dedupes itself.
    """
    from social_stats.models import EventLog
    from social_stats.events.registry import EVENT_HANDLERS

    try:
        event = EventLog.objects.get(id=event_id)
    except EventLog.DoesNotExist:
        logger.warning('dispatch_event: EventLog#%s vanished — skipping', event_id)
        return

    handlers = EVENT_HANDLERS.get(event.event_type, [])
    if not handlers:
        # No subscribers for this event_type. Not an error — events can be
        # emitted "for the record" without anything wanting to react.
        logger.debug('dispatch_event: no handlers for %s', event.event_type)
        return

    for handler_path in handlers:
        run_event_handler.delay(event_id, handler_path)


@shared_task(bind=True, max_retries=3, default_retry_delay=60, ignore_result=True)
def run_event_handler(self, event_id: int, handler_path: str):
    """Execute one handler against one event. Idempotent + retryable.

    Idempotency: we acquire a row lock on the EventLog, check whether this
    handler_path has already run, and skip if so. The append-and-save happens
    inside the same transaction so two parallel workers can't both run the
    handler. (Postgres `SELECT FOR UPDATE`; works on every supported backend.)

    Retries: Celery retries on raised exceptions up to `max_retries` with
    60s backoff. Each retry re-acquires the lock + re-checks the dedupe list.
    """
    from social_stats.models import EventLog

    try:
        handler = _resolve_handler(handler_path)
    except (ImportError, AttributeError) as exc:
        # Bad handler path is a config bug, not a transient failure. Don't
        # retry — log and move on.
        logger.error('run_event_handler: cannot resolve %s: %s', handler_path, exc)
        return

    with transaction.atomic():
        try:
            event = EventLog.objects.select_for_update().get(id=event_id)
        except EventLog.DoesNotExist:
            logger.warning('run_event_handler: EventLog#%s vanished', event_id)
            return

        if handler_path in (event.processed_by_handlers or []):
            # Already done in a prior run. Not an error.
            return

        try:
            handler(event)
        except Exception as exc:
            logger.exception(
                'run_event_handler: %s failed for event#%s (%s) — retrying',
                handler_path, event_id, event.event_type,
            )
            # Don't append to processed_by_handlers; let Celery retry.
            raise self.retry(exc=exc)

        # Append + save. Inside the SELECT FOR UPDATE so no race with parallel
        # workers reading a stale processed_by_handlers list.
        event.processed_by_handlers = list(event.processed_by_handlers or []) + [handler_path]
        event.save(update_fields=['processed_by_handlers'])


# ── helpers ───────────────────────────────────────────────────────────────────
def _resolve_handler(dotted_path: str):
    """Turn 'social_stats.events.handlers.activity.log_post_published' into
    the actual function object. Validates that the result is callable."""
    module_path, func_name = dotted_path.rsplit('.', 1)
    module = import_module(module_path)
    func = getattr(module, func_name)
    if not callable(func):
        raise AttributeError(f'{dotted_path} resolved to non-callable {type(func).__name__}')
    return func


def publish_event(event_type: str, **kwargs: Any):
    """Module-level convenience wrapper. Equivalent to
    `EventPublisher.publish(event_type, **kwargs)`."""
    return EventPublisher.publish(event_type, **kwargs)
