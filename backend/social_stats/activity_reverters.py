# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
revert dispatchers for ActivityLog rows flagged `is_reversible`.

A reverter takes the ActivityLog row + the user performing the revert and
returns `(success, message, follow_up_meta)`. On success the activity_views
endpoint stamps `reverted_at` + `reverted_by` and writes a follow-up
ActivityLog row so both the original and the revert show up in the feed.

The platforms expose delete APIs unevenly we ship a
"local delete" reverter for `post_published` (sets the UnifiedPost to
'cancelled' and best-effort deletes platform copies if they exist) plus a
note-only reverter for replies. New action types layer on by appending to
REVERTERS.
"""
from __future__ import annotations

import logging

from django.utils import timezone

from .models import ActivityLog, PlatformCredential, PlatformPublishLog, UnifiedPost


logger = logging.getLogger(__name__)


def _exec_revert_post_published(row: ActivityLog, user) -> tuple[bool, str, dict]:
    """Cancel the local post + best-effort delete the platform copies.

    The platform-side delete is opportunistic: where the publisher supports
    `delete_post`, we call it; otherwise we log a warning and continue. The
    local row always flips so the UI never shows the post as live again.
    """
    post_id = row.target_object_id
    if not post_id:
        return (False, 'no post_id on activity row', {})

    try:
        post = UnifiedPost.objects.get(pk=post_id, client=row.client)
    except UnifiedPost.DoesNotExist:
        return (False, 'post no longer exists', {})

    if post.status == 'cancelled':
        return (False, 'post already cancelled', {})

    deleted_platforms: list[str] = []
    failed_platforms:  list[str] = []
    for plog in PlatformPublishLog.objects.filter(unified_post=post, status='success'):
        publisher = _get_publisher_for(plog.platform)
        delete_fn = getattr(publisher, 'delete_post', None) if publisher else None
        if not delete_fn:
            failed_platforms.append(plog.platform)
            continue
        cred = PlatformCredential.objects.filter(
            client=row.client, platform=plog.platform, is_active=True,
        ).first()
        if not cred:
            failed_platforms.append(plog.platform)
            continue
        try:
            delete_fn(cred, plog.platform_post_id)
            deleted_platforms.append(plog.platform)
        except Exception as e:  # noqa: BLE001
            logger.exception('revert delete failed for platform=%s post=%s', plog.platform, post.id)
            failed_platforms.append(plog.platform)

    post.status = 'cancelled'
    post.save(update_fields=['status'])

    msg = (
        f'Cancelled post locally'
        + (f'; deleted on {", ".join(deleted_platforms)}' if deleted_platforms else '')
        + (f'; manual cleanup needed on {", ".join(failed_platforms)}' if failed_platforms else '')
    )
    return (True, msg, {
        'deleted_platforms': deleted_platforms,
        'failed_platforms':  failed_platforms,
    })


def _exec_revert_reply(row: ActivityLog, user) -> tuple[bool, str, dict]:
    """Replies don't have a uniform delete API on our publishers. Mark the
    revert intent so the agency can handle it manually, and let the UI show
    the row as "reverted" with this caveat."""
    return (False, 'reply replies cannot be auto-deleted; please remove from the platform manually', {})


def _get_publisher_for(platform: str):
    try:
        from .publishers import get_publisher
        return get_publisher(platform)
    except Exception:
        return None


REVERTERS = {
    'post_published': _exec_revert_post_published,
    'reply_dm':       _exec_revert_reply,
    'reply_comment':  _exec_revert_reply,
    'reply_review':   _exec_revert_reply,
}


def revert_activity(row: ActivityLog, user) -> tuple[bool, str, dict]:
    if not row.is_reversible:
        return (False, 'this action is not reversible', {})
    if row.reverted_at:
        return (False, 'this action has already been reverted', {})
    handler = REVERTERS.get(row.action_type)
    if not handler:
        return (False, f'no reverter registered for action_type={row.action_type}', {})
    try:
        return handler(row, user)
    except Exception as e:  # noqa: BLE001
        logger.exception('revert handler crashed for action_type=%s', row.action_type)
        return (False, f'revert error: {e}', {})
