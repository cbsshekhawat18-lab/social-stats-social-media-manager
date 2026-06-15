# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Unified publishing orchestrator.

Two Celery tasks:
  - publish_unified_post(unified_post_id):
      Fan-out task: looks at the UnifiedPost's target_platforms, creates one
      PlatformPublishLog per platform, and dispatches publish_to_platform
      for each. Sets the parent post status to 'publishing'.

  - publish_to_platform(unified_post_id, platform):
      Per-platform task. Picks the right publisher method based on
      media_type, applies platform_overrides, persists the result on the
      log row, handles typed exceptions (token expired → deactivate +
      Alert; rate-limited → Celery retry; everything else → mark failed).

A small helper update_unified_post_status() recomputes the parent's status
from the children's statuses after each child task finishes.
"""
from __future__ import annotations

import logging
from typing import Optional

from celery import shared_task
from django.utils import timezone

from .models import (
    UnifiedPost, PlatformPublishLog, PlatformCredential, Alert,
    MediaAsset,
)
from .publishers import (
    get_publisher,
    PublishError, TokenExpiredError, RateLimitError,
    PermissionDeniedError, MediaTooLargeError,
)
from . import media_service
from .realtime import push_event
from .audit import log_action

logger = logging.getLogger(__name__)


# ── Public entry points ───────────────────────────────────────────────────────
@shared_task(bind=True)
def publish_unified_post(self, unified_post_id: int):
    """Fan-out a UnifiedPost across all of its target platforms."""
    try:
        post = UnifiedPost.objects.get(id=unified_post_id)
    except UnifiedPost.DoesNotExist:
        logger.warning('publish_unified_post: post %s not found', unified_post_id)
        return

    if post.status not in ('draft', 'scheduled', 'queued', 'pending_approval', 'partial', 'failed'):
        logger.info('publish_unified_post: post %s already in status %s — skipping',
                    unified_post_id, post.status)
        return

    # Approval gate
    if post.client.requires_approval and post.status != 'scheduled' and not post.approved_by_id:
        post.status = 'pending_approval'
        post.save(update_fields=['status'])
        from .notification_watchers import notify_approver_for_post
        notify_approver_for_post.delay(post.id)
        return

    targets = list(post.target_platforms or [])
    if not targets:
        post.status = 'failed'
        post.save(update_fields=['status'])
        logger.warning('publish_unified_post: no target_platforms on post %s', unified_post_id)
        return

    post.status = 'publishing'
    post.save(update_fields=['status'])

    for platform in targets:
        # Materialize a log row per platform up-front so the UI shows them.
        PlatformPublishLog.objects.update_or_create(
            unified_post=post, platform=platform,
            defaults={'status': 'pending', 'attempted_at': None,
                      'error_code': '', 'error_message': ''},
        )
        publish_to_platform.delay(post.id, platform)


@shared_task(bind=True, max_retries=3, default_retry_delay=120, acks_late=True)
def publish_to_platform(self, unified_post_id: int, platform: str):
    """Publish one UnifiedPost to one platform. Retries on transient errors."""
    try:
        post = UnifiedPost.objects.select_related('client').get(id=unified_post_id)
    except UnifiedPost.DoesNotExist:
        return

    log = PlatformPublishLog.objects.filter(unified_post=post, platform=platform).first()
    if not log:
        log = PlatformPublishLog.objects.create(
            unified_post=post, platform=platform, status='pending',
        )

    log.status = 'publishing'
    log.attempted_at = timezone.now()
    log.save(update_fields=['status', 'attempted_at'])

    # Find an active credential for this client+platform
    cred = PlatformCredential.objects.filter(
        client=post.client, platform=platform, is_active=True,
    ).first()
    if not cred:
        _mark_failed(log, code='no_credential',
                     message=f'No active {platform} credential — connect first')
        update_unified_post_status(post.id)
        return

    # Resolve content + media (apply per-platform overrides)
    overrides = (post.platform_overrides or {}).get(platform, {}) or {}
    content    = overrides.get('content', post.content) or ''
    media_urls = overrides.get('media_urls', post.media_urls) or []
    media_type = overrides.get('media_type', post.media_type) or 'text'

    # Resolve any internal MediaAsset IDs to public URLs (S3 presigned or local).
    media_urls = _resolve_media_urls(post, media_urls)

    publisher = get_publisher(platform)

    try:
        result = _dispatch_publish(publisher, cred, content, media_urls, media_type, post=post)
    except TokenExpiredError as e:
        # Mark credential dead + alert + persist
        _mark_failed(log, code='token_expired', message=str(e))
        cred.is_active = False
        cred.save(update_fields=['is_active'])
        Alert.objects.create(
            client=post.client, platform=platform, alert_type='token_expired',
            message=f'{platform} token expired — please reconnect to keep publishing.',
            dedup_key=f'token_expired:{platform}:{cred.id}:{timezone.now().date()}',
        )
        push_event('credential.token_expired', post.client_id, {
            'platform': platform, 'credential_id': cred.id,
        })
        log_action(post.created_by, post.client, 'credential.deactivated',
                   platform=platform, object_type='PlatformCredential', object_id=cred.id,
                   result='failed', error='Token expired during publish')
        update_unified_post_status(post.id)
        return

    except RateLimitError as e:
        wait = max(int(getattr(e, 'retry_after', None) or 60), 30)
        log.status = 'pending'
        log.error_code = 'rate_limited'
        log.error_message = str(e)[:500]
        log.save(update_fields=['status', 'error_code', 'error_message'])
        try:
            raise self.retry(exc=e, countdown=wait)
        except self.MaxRetriesExceededError:
            _mark_failed(log, code='rate_limited',
                         message=f'Rate limit exceeded after {self.max_retries} retries')
            update_unified_post_status(post.id)
        return

    except (PermissionDeniedError, MediaTooLargeError, PublishError) as e:
        _mark_failed(log, code=getattr(e, 'code', 'publish_error') or 'publish_error',
                     message=str(e)[:500])
        update_unified_post_status(post.id)
        return

    except Exception as e:
        logger.exception('publish_to_platform unexpected error post=%s platform=%s', post.id, platform)
        _mark_failed(log, code='unexpected', message=str(e)[:500])
        update_unified_post_status(post.id)
        return

    # Success
    log.status = 'success'
    log.platform_post_id = result.platform_post_id or ''
    log.platform_url = result.platform_url or ''
    log.completed_at = timezone.now()
    log.error_code = ''
    log.error_message = ''
    log.raw_response = result.raw_response or {}
    log.save(update_fields=[
        'status', 'platform_post_id', 'platform_url',
        'completed_at', 'error_code', 'error_message', 'raw_response',
    ])

    # Mark referenced media as used
    MediaAsset.objects.filter(used_in_posts=post, is_used=False).update(is_used=True)

    update_unified_post_status(post.id)


# ── Helpers ───────────────────────────────────────────────────────────────────
def _dispatch_publish(publisher, credential, content, media_urls, media_type, *, post):
    """Pick the right publisher method based on media_type."""
    media_type = (media_type or 'text').lower()

    if media_type == 'text':
        return publisher.publish_text(credential, content)
    if media_type == 'image':
        return publisher.publish_image(credential, content, media_urls)
    if media_type == 'video':
        first = media_urls[0] if media_urls else ''
        return publisher.publish_video(credential, content, first)
    if media_type == 'carousel':
        return publisher.publish_carousel(credential, content, media_urls)
    if media_type == 'reel':
        first = media_urls[0] if media_urls else ''
        return publisher.publish_reel(credential, first, content)
    if media_type == 'story':
        first = media_urls[0] if media_urls else ''
        return publisher.publish_story(credential, first)

    raise PublishError(f'Unknown media_type: {media_type}', code='unknown_media_type')


def _resolve_media_urls(post: UnifiedPost, media_urls: list) -> list:
    """
    Translate a mix of bare URLs and `asset:<id>` placeholders into final URLs.
    Real apps will store everything as `asset:<id>` so the orchestrator can
    swap to S3 presigned URLs at publish time. Bare URLs pass through unchanged.
    """
    out = []
    for u in media_urls or []:
        if isinstance(u, str) and u.startswith('asset:'):
            try:
                asset_id = int(u.split(':', 1)[1])
                asset = MediaAsset.objects.filter(
                    id=asset_id, client=post.client,
                ).first()
                if asset:
                    out.append(media_service.presigned_url(asset) or '')
                    continue
            except (ValueError, IndexError):
                pass
        out.append(u)
    return [u for u in out if u]


def _mark_failed(log: PlatformPublishLog, *, code: str, message: str):
    log.status = 'failed'
    log.error_code = (code or 'failed')[:80]
    log.error_message = (message or '')[:500]
    log.completed_at = timezone.now()
    log.save(update_fields=['status', 'error_code', 'error_message', 'completed_at'])


def update_unified_post_status(unified_post_id: int):
    """Recompute the parent UnifiedPost.status from its child publish_logs."""
    try:
        post = UnifiedPost.objects.get(id=unified_post_id)
    except UnifiedPost.DoesNotExist:
        return

    statuses = list(post.publish_logs.values_list('status', flat=True))
    targets = post.target_platforms or []
    if not statuses or len(statuses) < len(targets):
        # Some children haven't been touched yet → still publishing.
        if post.status not in ('publishing',):
            return
        return

    if all(s == 'success' for s in statuses):
        post.status = 'published'
        if not post.published_at:
            post.published_at = timezone.now()
        post.save(update_fields=['status', 'published_at'])
        push_event('composer.post_published', post.client_id, {
            'unified_post_id': post.id,
            'title':           post.title or post.content[:60],
            'platforms':       post.target_platforms or [],
        })
        log_action(post.created_by, post.client, 'composer.published',
                   object_type='UnifiedPost', object_id=post.id,
                   result='success',
                   details={'platforms': post.target_platforms,
                            'title': post.title or post.content[:120]})
        try:
            from .events.publisher import EventPublisher
            EventPublisher.publish(
                'post.published',
                client=post.client,
                actor=post.created_by,
                payload={
                    'post_id': post.id,
                    'platforms': list(post.target_platforms or []),
                },
            )
        except Exception:
            pass
        return

    if all(s == 'failed' for s in statuses):
        post.status = 'failed'
        post.save(update_fields=['status'])
        push_event('composer.post_failed', post.client_id, {
            'unified_post_id': post.id,
            'title':           post.title or post.content[:60],
        })
        log_action(post.created_by, post.client, 'composer.published',
                   object_type='UnifiedPost', object_id=post.id,
                   result='failed',
                   details={'platforms': post.target_platforms,
                            'title': post.title or post.content[:120]})
        try:
            from .events.publisher import EventPublisher
            # Pull a representative reason from the first failed publish_log.
            failed_log = post.publish_logs.filter(status='failed').first()
            reason = (failed_log.error if failed_log and failed_log.error else 'all platforms failed')
            EventPublisher.publish(
                'post.failed',
                client=post.client,
                actor=post.created_by,
                payload={
                    'post_id': post.id,
                    'reason': reason[:300],
                },
            )
        except Exception:
            pass
        return

    # Mixed → partial
    if any(s == 'success' for s in statuses) and any(s == 'failed' for s in statuses):
        post.status = 'partial'
        if not post.published_at:
            post.published_at = timezone.now()
        post.save(update_fields=['status', 'published_at'])
        push_event('composer.post_partial', post.client_id, {
            'unified_post_id': post.id,
            'title':           post.title or post.content[:60],
            'success_count':   sum(1 for s in statuses if s == 'success'),
            'failed_count':    sum(1 for s in statuses if s == 'failed'),
        })
        log_action(post.created_by, post.client, 'composer.published',
                   object_type='UnifiedPost', object_id=post.id,
                   result='partial',
                   details={'platforms': post.target_platforms,
                            'success_count': sum(1 for s in statuses if s == 'success'),
                            'failed_count':  sum(1 for s in statuses if s == 'failed')})
