# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Composer scheduler — Celery beat tasks.

Two top-level tasks (registered in CELERY_BEAT_SCHEDULE in settings.py):

  process_scheduled_posts  — every minute. Picks UnifiedPost rows whose
    `scheduled_at` is in the past with status='scheduled' and dispatches
    them via the orchestrator.

  process_post_queues — every minute. Walks active PostQueue rows, evaluates
    their `schedule_rule` (cron expression) against `last_dispatched_at`,
    pulls the next QueuedItem according to `queue_strategy`, materializes it
    into a UnifiedPost, and queues for publishing.

Timezone: each tick respects `Client.timezone` when computing "next fire" so
that "every weekday 10am" means 10am in the *client's* tz.
"""
from __future__ import annotations

import logging
import random
from datetime import datetime
from typing import Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from celery import shared_task
from croniter import croniter
from django.db import transaction
from django.utils import timezone

from .models import UnifiedPost, PostQueue, QueuedItem
from .orchestrator import publish_unified_post

logger = logging.getLogger(__name__)


# ── Scheduled posts ───────────────────────────────────────────────────────────
@shared_task(bind=True)
def process_scheduled_posts(self):
    """Find scheduled UnifiedPosts whose time has come and dispatch them."""
    now = timezone.now()
    due = UnifiedPost.objects.filter(
        status='scheduled',
        scheduled_at__lte=now,
    ).order_by('scheduled_at')[:200]

    dispatched = 0
    for post in due:
        # Use status='queued' as an in-flight marker so a slow worker pool
        # doesn't double-fire if this task overlaps the next tick.
        with transaction.atomic():
            updated = (UnifiedPost.objects
                       .filter(id=post.id, status='scheduled')
                       .update(status='queued'))
            if not updated:
                continue
        publish_unified_post.delay(post.id)
        dispatched += 1

    if dispatched:
        logger.info('process_scheduled_posts dispatched %s posts', dispatched)
    return dispatched


# ── Recurring queues ──────────────────────────────────────────────────────────
@shared_task(bind=True)
def process_post_queues(self):
    """For each active queue, fire the next item if its cron slot is due."""
    fired = 0
    queues = PostQueue.objects.filter(is_active=True).only(
        'id', 'client_id', 'name', 'platforms', 'schedule_rule',
        'queue_strategy', 'last_dispatched_at',
    )
    now = timezone.now()
    for queue in queues:
        try:
            if _queue_is_due(queue, now):
                item = _pick_next_queued_item(queue)
                if item:
                    _dispatch_queued_item(queue, item)
                    fired += 1
        except Exception:
            logger.exception('process_post_queues: queue %s failed', queue.id)
    if fired:
        logger.info('process_post_queues dispatched %s queue items', fired)
    return fired


# ── Internals ─────────────────────────────────────────────────────────────────
def _queue_is_due(queue: PostQueue, now) -> bool:
    """
    A queue is due when its cron expression's next-fire-time after
    `last_dispatched_at` (or queue creation) is on or before `now`.
    """
    rule = (queue.schedule_rule or '').strip()
    if not rule:
        return False

    base_dt = queue.last_dispatched_at or queue.created_at or now
    tz = _client_tz(queue.client_id)
    try:
        cron = croniter(rule, base_dt.astimezone(tz))
    except (ValueError, KeyError):
        logger.warning('Bad schedule_rule on queue %s: %s', queue.id, rule)
        return False
    next_fire = cron.get_next(datetime)
    # croniter returns naive in given tz — re-attach
    if next_fire.tzinfo is None:
        next_fire = next_fire.replace(tzinfo=tz)
    return next_fire <= now.astimezone(tz)


def _client_tz(client_id):
    from .models import Client
    try:
        c = Client.objects.only('timezone').get(id=client_id)
        if c.timezone:
            return ZoneInfo(c.timezone)
    except (Client.DoesNotExist, ZoneInfoNotFoundError):
        pass
    return ZoneInfo('UTC')


def _pick_next_queued_item(queue: PostQueue) -> Optional[QueuedItem]:
    """Pull the next item according to the queue's strategy."""
    waiting = queue.items.filter(status='waiting')
    strategy = (queue.queue_strategy or 'sequential')

    if strategy == 'random':
        return waiting.order_by('?').first()
    if strategy == 'round_robin':
        # round_robin == sequential but loops back: when all used, recycle
        item = waiting.order_by('sort_order', 'id').first()
        if item:
            return item
        # Recycle: mark all 'used' as 'waiting' again then take the first
        queue.items.filter(status='used').update(status='waiting')
        return queue.items.filter(status='waiting').order_by('sort_order', 'id').first()
    # sequential (default)
    return waiting.order_by('sort_order', 'id').first()


def _dispatch_queued_item(queue: PostQueue, item: QueuedItem):
    """Materialize a QueuedItem into a UnifiedPost and queue it."""
    with transaction.atomic():
        post = UnifiedPost.objects.create(
            client_id=queue.client_id,
            content=item.content or '',
            media_urls=item.media_urls or [],
            media_type=_guess_media_type(item),
            target_platforms=queue.platforms or [],
            status='queued',
            ai_generated=False,
        )
        item.status = 'used'
        item.used_at = timezone.now()
        item.unified_post = post
        item.save(update_fields=['status', 'used_at', 'unified_post'])
        queue.last_dispatched_at = timezone.now()
        queue.save(update_fields=['last_dispatched_at'])
    publish_unified_post.delay(post.id)


def _guess_media_type(item: QueuedItem) -> str:
    urls = item.media_urls or []
    if not urls:
        return 'text'
    first = str(urls[0]).lower()
    if first.endswith(('.mp4', '.mov', '.webm', '.m4v')):
        return 'video'
    if len(urls) > 1:
        return 'carousel'
    return 'image'
