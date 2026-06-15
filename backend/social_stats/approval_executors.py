# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
When an end-user approves an ApprovalRequest, the original action
needs to actually run. This module is the dispatch layer.

A handler takes the approval (which carries `payload`, `target_object_type`,
`target_object_id`, plus `edited_payload` if the user tweaked the post body
before approving) and performs the action. It returns
`(success: bool, message: str, result: dict)` — the caller writes that to
ApprovalRequest.execution_result and updates status.

NEW action_types must register a handler here. Until they do, approving
returns `success=False, message='no executor for action_type=<x>'` so the
approval is recorded as approved-but-not-executed and the agency can be told
to re-run from their UI.
"""
from __future__ import annotations

import logging
from typing import Callable

from django.utils import timezone

from .models import (
    Conversation, Message, PlatformCredential,
    UnifiedPost, WhatsAppCampaign,
)


logger = logging.getLogger(__name__)


def _payload(approval) -> dict:
    """Return effective payload — edited_payload overrides the original
    proposal key-by-key."""
    base = dict(approval.payload or {})
    base.update(approval.edited_payload or {})
    return base


# ─────────────────────────────────────────────────────────────────────────────
# publish_post
# ─────────────────────────────────────────────────────────────────────────────
def _exec_publish_post(approval) -> tuple[bool, str, dict]:
    from .orchestrator import publish_unified_post

    payload = _payload(approval)
    post_id = payload.get('post_id') or approval.target_object_id
    try:
        post = UnifiedPost.objects.get(pk=post_id)
    except UnifiedPost.DoesNotExist:
        return (False, 'post no longer exists', {})

    # If the user edited the body before approving, persist that
    body = payload.get('body') or payload.get('content')
    if body and body != post.content:
        post.content = body
        post.save(update_fields=['content'])

    if post.status not in ('draft', 'scheduled', 'failed', 'partial', 'pending_approval'):
        return (False, f'post is in status {post.status}; cannot publish', {'post_id': post.id})

    post.status = 'queued'
    post.scheduled_at = timezone.now()
    post.save(update_fields=['status', 'scheduled_at'])
    publish_unified_post.delay(post.id)
    return (True, 'queued for publishing', {'post_id': post.id})


# ─────────────────────────────────────────────────────────────────────────────
# send_campaign
# ─────────────────────────────────────────────────────────────────────────────
def _exec_send_campaign(approval) -> tuple[bool, str, dict]:
    from .whatsapp_tasks import run_whatsapp_campaign

    payload = _payload(approval)
    campaign_id = payload.get('campaign_id') or approval.target_object_id
    try:
        campaign = WhatsAppCampaign.objects.get(pk=campaign_id)
    except WhatsAppCampaign.DoesNotExist:
        return (False, 'campaign no longer exists', {})
    if campaign.status not in ('draft', 'scheduled'):
        return (False, f'campaign is in status {campaign.status}', {'campaign_id': campaign.id})

    campaign.status = 'scheduled'
    campaign.scheduled_at = campaign.scheduled_at or timezone.now()
    campaign.save(update_fields=['status', 'scheduled_at'])
    run_whatsapp_campaign.delay(campaign.id)
    return (True, 'campaign queued', {'campaign_id': campaign.id})


# ─────────────────────────────────────────────────────────────────────────────
# Replies (DM / comment / review)
# ─────────────────────────────────────────────────────────────────────────────
def _exec_reply(approval) -> tuple[bool, str, dict]:
    from .publishers import (
        get_publisher, PublishError, TokenExpiredError, RateLimitError,
    )

    payload = _payload(approval)
    conv_id = payload.get('conversation_id')
    text = (payload.get('text') or '').strip()
    if not conv_id or not text:
        return (False, 'missing conversation_id or text', {})

    try:
        conv = Conversation.objects.get(pk=conv_id)
    except Conversation.DoesNotExist:
        return (False, 'conversation no longer exists', {})

    cred = PlatformCredential.objects.filter(
        client_id=conv.client_id, platform=conv.platform, is_active=True,
    ).first()
    if not cred:
        return (False, f'no active {conv.platform} credential', {})

    publisher = get_publisher(conv.platform)
    last_inbound = (Message.objects
                    .filter(conversation=conv, direction='inbound')
                    .order_by('-created_at').first())

    try:
        if conv.type == 'comment':
            if not last_inbound or not last_inbound.platform_message_id:
                return (False, 'no inbound comment to reply to', {})
            result = publisher.reply_to_comment(cred, last_inbound.platform_message_id, text)
        elif conv.type == 'dm':
            psid = (last_inbound.author_handle if last_inbound else conv.contact_handle)
            if not psid:
                return (False, 'no recipient ID on this thread', {})
            result = publisher.reply_to_dm(cred, conv.platform_thread_id, text, psid=psid, recipient_id=psid)
        elif conv.type == 'review':
            if not last_inbound or not last_inbound.platform_message_id:
                return (False, 'no review to reply to', {})
            result = publisher.reply_to_review(cred, last_inbound.platform_message_id, text)
        else:
            return (False, f'reply not supported for type={conv.type}', {})
    except TokenExpiredError as e:
        return (False, str(e), {'code': 'token_expired'})
    except RateLimitError as e:
        return (False, str(e), {'code': 'rate_limited'})
    except PublishError as e:
        return (False, str(e), {'code': e.code or 'publish_error'})

    msg = Message.objects.create(
        conversation=conv,
        platform_message_id=getattr(result, 'platform_post_id', '') or '',
        direction='outbound',
        author_name=approval.requested_by.get_full_name() or approval.requested_by.email or 'Social Stats',
        author_handle=approval.requested_by.email or '',
        content=text,
        sent_at=timezone.now(),
        replied_at=timezone.now(),
        sentiment=last_inbound.sentiment if last_inbound else 'unknown',
        sent_by=approval.requested_by,
    )
    conv.last_message_preview = text[:500]
    conv.last_message_at = msg.sent_at
    conv.save(update_fields=['last_message_preview', 'last_message_at'])

    return (True, f'replied via {conv.platform}', {'message_id': msg.id, 'conversation_id': conv.id})


# ─────────────────────────────────────────────────────────────────────────────
# disconnect_platform
# ─────────────────────────────────────────────────────────────────────────────
def _exec_disconnect_platform(approval) -> tuple[bool, str, dict]:
    payload = _payload(approval)
    platform = payload.get('platform')
    if not platform:
        return (False, 'no platform in payload', {})
    PlatformCredential.objects.filter(
        client=approval.client, platform=platform,
    ).update(access_token='', refresh_token='', is_active=False)
    return (True, f'{platform} disconnected', {'platform': platform})


# ─────────────────────────────────────────────────────────────────────────────
def _exec_draft_post(approval) -> tuple[bool, str, dict]:
    """draft_post — agency wanted to create a new draft, owner approved.

    payload contract (best-effort):
      content: str — body
      target_platforms: list[str]
      title: str (optional)
      media_urls: list[str] (optional)
      platform_overrides: dict (optional)
    """
    payload = _payload(approval)
    content = payload.get('content') or payload.get('body') or ''
    if not content and not payload.get('media_urls'):
        return (False, 'no content or media in payload — cannot create draft', {})

    post = UnifiedPost.objects.create(
        client=approval.client,
        created_by=approval.requested_by,
        title=(payload.get('title') or '')[:255],
        content=content,
        target_platforms=list(payload.get('target_platforms') or []),
        media_urls=list(payload.get('media_urls') or []),
        platform_overrides=dict(payload.get('platform_overrides') or {}),
        status='draft',
    )
    return (True, 'draft created', {'post_id': post.id})


def _exec_delete_post(approval) -> tuple[bool, str, dict]:
    """delete_post — agency requested deletion of an existing post."""
    payload = _payload(approval)
    post_id = payload.get('post_id') or approval.target_object_id
    if not post_id:
        return (False, 'no post_id in payload', {})

    target_type = approval.target_object_type or 'UnifiedPost'
    if target_type == 'CalendarPost':
        from .models import CalendarPost
        try:
            post = CalendarPost.objects.get(pk=post_id)
        except CalendarPost.DoesNotExist:
            return (False, 'calendar post no longer exists', {'post_id': post_id})
        if getattr(post, 'status', None) == 'published':
            return (False, 'cannot delete a published post', {'post_id': post.id})
        post.delete()
        return (True, 'calendar post deleted', {'post_id': post_id})

    try:
        post = UnifiedPost.objects.get(pk=post_id)
    except UnifiedPost.DoesNotExist:
        return (False, 'post no longer exists', {'post_id': post_id})
    post.delete()
    return (True, 'post deleted', {'post_id': post_id})


def _exec_publish_bot(approval) -> tuple[bool, str, dict]:
    """publish_bot — agency wanted to activate a bot flow on the workspace."""
    from .bot_models import BotFlow
    payload = _payload(approval)
    flow_id = payload.get('flow_id') or approval.target_object_id
    if not flow_id:
        return (False, 'no flow_id in payload', {})
    try:
        flow = BotFlow.objects.get(pk=flow_id)
    except BotFlow.DoesNotExist:
        return (False, 'bot flow no longer exists', {'flow_id': flow_id})
    flow.is_active = True
    flow.published_version = flow.version
    flow.last_published_at = timezone.now()
    flow.save(update_fields=['is_active', 'published_version', 'last_published_at'])
    return (True, 'bot flow published', {'flow_id': flow.id})


def _exec_unpublish_bot(approval) -> tuple[bool, str, dict]:
    """unpublish_bot — agency wanted to deactivate a live bot flow."""
    from .bot_models import BotFlow
    payload = _payload(approval)
    flow_id = payload.get('flow_id') or approval.target_object_id
    if not flow_id:
        return (False, 'no flow_id in payload', {})
    try:
        flow = BotFlow.objects.get(pk=flow_id)
    except BotFlow.DoesNotExist:
        return (False, 'bot flow no longer exists', {'flow_id': flow_id})
    flow.is_active = False
    flow.save(update_fields=['is_active'])
    return (True, 'bot flow unpublished', {'flow_id': flow.id})


# ─────────────────────────────────────────────────────────────────────────────
# Dispatch table
# ─────────────────────────────────────────────────────────────────────────────
EXECUTORS: dict[str, Callable] = {
    'publish_post':        _exec_publish_post,
    'send_campaign':       _exec_send_campaign,
    'reply_comment':       _exec_reply,
    'reply_dm':            _exec_reply,
    'reply_review':        _exec_reply,
    'disconnect_platform': _exec_disconnect_platform,
    'draft_post':          _exec_draft_post,
    'delete_post':         _exec_delete_post,
    'publish_bot':         _exec_publish_bot,
    'unpublish_bot':       _exec_unpublish_bot,
}


def execute_approval(approval) -> tuple[bool, str, dict]:
    """Dispatch by action_type. Failures are recoverable — the approval is
    still marked approved, but execution_result records the error and the
    UI shows it so the agency can resubmit / fix the underlying issue."""
    handler = EXECUTORS.get(approval.action_type)
    if not handler:
        return (False, f'no executor for action_type={approval.action_type}', {})
    try:
        return handler(approval)
    except Exception as e:  # noqa: BLE001
        logger.exception('approval executor crashed for action_type=%s', approval.action_type)
        return (False, f'executor error: {e}', {})
