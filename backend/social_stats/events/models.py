# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Central event bus storage.

`EventLog` is the single append-only table that records every domain event
crossing a feature boundary. Producers (Composer, Inbox, Bot engine, WhatsApp,
Lead CRM, Marketplace) write rows; subscribers (Notification dispatcher,
Activity logger, AI handlers, Analytics aggregator) consume them via the
Celery dispatch_event task in events/publisher.py .

Why a table-backed event log instead of in-process signals or a queue:

  • Auditable — we can replay an event after a handler bug fix.
  • Debuggable — one query shows the full chain of cross-feature reactions
    that followed a single user action via `correlation_id`.
  • Multi-tenant safe — every row carries `client` so subscribers can scope
    their queries without trusting payload contents.
  • Idempotent — `processed_by_handlers` lets each subscriber dedupe its own
    runs even when Celery retries the dispatch task.

Retention: rows are kept hot for 90 days then archived . The
`created_at` index makes the cold-archive sweep cheap.
"""
from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models


class EventLog(models.Model):
    """Append-only domain event row. One row = one cross-feature event.

    `event_type` follows a `<noun>.<verb>` convention. Established types:

        post.published            post.failed             post.engagement_spike
        message.received          message.sent            comment.received
        review.received           bot.conversation_started
        bot.conversation_completed                        bot.handoff_requested
        lead.captured             lead.status_changed     lead.converted
        whatsapp_campaign.launched   whatsapp_campaign.completed
        agency_relation.created   agency_relation.terminated
        permission.changed        approval.requested      approval.granted
        approval.rejected         user.signed_up          user.logged_in
        token.expired             ai.insight_generated    ai.cost_threshold_reached
        platform.synced           platform.sync_failed

    Add new types in `events/registry.py` alongside their handlers .
    """

    ACTOR_TYPE_CHOICES = [
        ('user',   'User'),         # an authenticated end-user took the action
        ('agency', 'Agency'),       # an agency member acted on a managed client
        ('system', 'System'),       # scheduled task / webhook / no human
        ('ai',     'AI'),           # AI Assistant tool call
    ]

    # Tenant scope. Every event belongs to exactly one client. Indexed so
    # subscribers can filter cheaply without scanning the whole log.
    client = models.ForeignKey(
        'social_stats.Client',
        on_delete=models.CASCADE,
        related_name='event_log',
        db_index=True,
    )

    # `noun.verb` — see docstring above for established types.
    event_type = models.CharField(max_length=100, db_index=True)

    # Who did the thing. `actor_user` is null for system/scheduled events.
    actor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='+',
    )
    actor_type = models.CharField(max_length=20, choices=ACTOR_TYPE_CHOICES, default='system')

    # Free-form structured payload. Each event_type has its own shape — see the
    # handler that produces the event for the contract. Keep payloads small —
    # store IDs, not full objects. Handlers re-fetch by ID.
    payload = models.JSONField(default=dict, blank=True)

    # Links related events together. When a webhook arrives and triggers
    # a bot conversation, which captures a lead, which fires a notification —
    # all four EventLog rows share the same correlation_id so debugging traces
    # the full chain from a single query.
    correlation_id = models.UUIDField(default=uuid.uuid4, db_index=True)

    # Idempotency. Each handler appends its dotted module path here after
    # success. The dispatcher checks this list before re-running.
    processed_by_handlers = models.JSONField(default=list, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        app_label = 'social_stats'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['client', 'event_type', '-created_at']),
            models.Index(fields=['correlation_id']),
        ]

    def __str__(self):
        return f'EventLog<#{self.id} {self.event_type} client#{self.client_id}>'
