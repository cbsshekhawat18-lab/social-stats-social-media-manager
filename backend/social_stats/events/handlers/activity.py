# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Activity-log handlers.

Each function reads an EventLog row and writes a corresponding ActivityLog
entry so the user-facing activity feed reflects every cross-feature event.

These handlers fix audit findings 5.x (un-logged actions: lead capture, bot
conversation start, WhatsApp campaign launch, etc.). They live alongside the
existing direct `log_activity(...)` callsites — duplicate logging is gated by
the dispatcher's `processed_by_handlers` dedupe, but will remove the
direct calls once we trust the event flow.

All handlers are idempotent: they re-fetch by ID from the payload and do
exactly one ActivityLog write per (event_id, handler_path) pair.
"""
from __future__ import annotations

import logging

from social_stats.activity_logger import log_activity

logger = logging.getLogger(__name__)


# ── Post lifecycle ───────────────────────────────────────────────────────────
def log_post_published(event):
    """post.published → ActivityLog row.

    payload contract: {'post_id': int, 'platforms': [str, ...]}.
    """
    from social_stats.models import UnifiedPost

    post_id = event.payload.get('post_id')
    if not post_id:
        logger.warning('log_post_published: event#%s missing post_id', event.id)
        return
    try:
        post = UnifiedPost.objects.get(id=post_id)
    except UnifiedPost.DoesNotExist:
        logger.warning('log_post_published: UnifiedPost#%s missing', post_id)
        return

    platforms = event.payload.get('platforms') or post.target_platforms
    log_activity(
        client=event.client,
        actor_user=event.actor_user,
        action_type='post_published',
        severity='info',
        target_object_type='UnifiedPost',
        target_object_id=post.id,
        description=f'Published post on {", ".join(platforms or [])}'.strip(),
        metadata={
            'post_id': post.id,
            'platforms': list(platforms or []),
            'content_preview': (post.content or '')[:200],
        },
        is_reversible=False,
    )


def log_post_failed(event):
    """post.failed → ActivityLog row with severity='warning'.

    payload contract: {'post_id': int, 'reason': str}.
    """
    from social_stats.models import UnifiedPost

    post_id = event.payload.get('post_id')
    if not post_id:
        return
    try:
        post = UnifiedPost.objects.get(id=post_id)
    except UnifiedPost.DoesNotExist:
        return

    reason = event.payload.get('reason') or 'Unknown error'
    log_activity(
        client=event.client,
        actor_user=event.actor_user,
        action_type='post_failed',
        severity='warning',
        target_object_type='UnifiedPost',
        target_object_id=post.id,
        description=f'Post publish failed: {reason}'[:300],
        metadata={'post_id': post.id, 'reason': reason},
    )


# ── Inbox ────────────────────────────────────────────────────────────────────
def log_message_received(event):
    """message.received → ActivityLog only for high-signal messages.

    Inbound messages are high-volume (every social DM, every WhatsApp inbound).
    Logging every one would drown the activity feed. Strategy: log only when
    the conversation is a NEW thread (first message) or when the inbound is
    flagged as a complaint/review/lead-trigger. Best-effort heuristic
    AI sentiment classification will refine.

    payload contract: {'message_id': int, 'is_new_thread': bool, 'channel': str}.
    """
    if not event.payload.get('is_new_thread'):
        return  # high-volume; skip individual messages by default
    from social_stats.models import Message
    msg_id = event.payload.get('message_id')
    if not msg_id:
        return
    try:
        msg = Message.objects.select_related('conversation').get(id=msg_id)
    except Message.DoesNotExist:
        return

    log_activity(
        client=event.client,
        actor_user=None,
        actor_type='system',
        action_type='message_received',
        severity='info',
        target_object_type='Conversation',
        target_object_id=msg.conversation_id,
        description=f'New conversation on {msg.conversation.platform} from {msg.author_name or msg.author_handle or "unknown"}'[:300],
        metadata={
            'message_id': msg.id,
            'conversation_id': msg.conversation_id,
            'channel': event.payload.get('channel') or msg.conversation.platform,
        },
    )


def log_message_sent(event):
    """message.sent → ActivityLog (outbound replies are low-volume + worth logging).

    payload contract: {'message_id': int}.
    """
    from social_stats.models import Message
    msg_id = event.payload.get('message_id')
    if not msg_id:
        return
    try:
        msg = Message.objects.select_related('conversation').get(id=msg_id)
    except Message.DoesNotExist:
        return

    log_activity(
        client=event.client,
        actor_user=event.actor_user,
        action_type='message_sent',
        severity='info',
        target_object_type='Conversation',
        target_object_id=msg.conversation_id,
        description=f'Replied on {msg.conversation.platform} to {msg.conversation.contact_name or msg.conversation.contact_handle}'[:300],
        metadata={
            'message_id': msg.id,
            'conversation_id': msg.conversation_id,
            'preview': (msg.content or '')[:200],
        },
    )


# ── Bot / leads ──────────────────────────────────────────────────────────────
def log_bot_conversation_started(event):
    """bot.conversation_started → ActivityLog.

    payload contract: {'conversation_id': int, 'flow_id': int, 'contact_phone': str}.
    """
    from social_stats.bot_models import BotConversation
    conv_id = event.payload.get('conversation_id')
    if not conv_id:
        return
    try:
        conv = BotConversation.objects.select_related('flow', 'contact').get(id=conv_id)
    except BotConversation.DoesNotExist:
        return

    flow_name = conv.flow.name if conv.flow_id else 'unknown flow'
    contact = conv.contact.phone if conv.contact_id else event.payload.get('contact_phone', '')
    log_activity(
        client=event.client,
        actor_user=None,
        actor_type='system',
        action_type='bot_conversation_started',
        severity='info',
        target_object_type='BotConversation',
        target_object_id=conv.id,
        description=f'Bot flow "{flow_name}" started for {contact}'[:300],
        metadata={
            'conversation_id': conv.id,
            'flow_id': conv.flow_id,
            'contact_phone': contact,
        },
    )


def log_lead_captured(event):
    """lead.captured → ActivityLog. Fixes audit gap 5.x.

    payload contract: {'lead_id': int, 'source': str ('bot'|'csv'|'manual'|'organic')}.
    """
    from social_stats.bot_models import Lead
    lead_id = event.payload.get('lead_id')
    if not lead_id:
        return
    try:
        lead = Lead.objects.get(id=lead_id)
    except Lead.DoesNotExist:
        return

    source = event.payload.get('source', 'unknown')
    name = lead.name or lead.phone or 'unnamed lead'
    log_activity(
        client=event.client,
        actor_user=event.actor_user,
        action_type='lead_captured',
        severity='info',
        target_object_type='Lead',
        target_object_id=lead.id,
        description=f'Lead captured: {name} (via {source})'[:300],
        metadata={
            'lead_id': lead.id,
            'source': source,
            'campaign': lead.source_campaign_name,
            'flow_id': lead.source_flow_id,
        },
    )


def log_lead_status_changed(event):
    """lead.status_changed → ActivityLog.

    payload contract: {'lead_id': int, 'from_status': str, 'to_status': str}.
    """
    from social_stats.bot_models import Lead
    lead_id = event.payload.get('lead_id')
    if not lead_id:
        return
    try:
        lead = Lead.objects.get(id=lead_id)
    except Lead.DoesNotExist:
        return

    fr = event.payload.get('from_status', '')
    to = event.payload.get('to_status', lead.status)
    log_activity(
        client=event.client,
        actor_user=event.actor_user,
        action_type='lead_status_changed',
        severity='info',
        target_object_type='Lead',
        target_object_id=lead.id,
        description=f'Lead "{lead.name or lead.phone}" moved {fr} → {to}'[:300],
        metadata={'lead_id': lead.id, 'from': fr, 'to': to},
    )


def log_lead_converted(event):
    """lead.converted → ActivityLog with severity='info' and conversion value.

    payload contract: {'lead_id': int, 'value': decimal_str (optional)}.
    """
    from social_stats.bot_models import Lead
    lead_id = event.payload.get('lead_id')
    if not lead_id:
        return
    try:
        lead = Lead.objects.get(id=lead_id)
    except Lead.DoesNotExist:
        return

    value = event.payload.get('value') or lead.conversion_value
    log_activity(
        client=event.client,
        actor_user=event.actor_user,
        action_type='lead_converted',
        severity='info',
        target_object_type='Lead',
        target_object_id=lead.id,
        description=f'Lead "{lead.name or lead.phone}" converted'
                    + (f' (₹{value})' if value else ''),
        metadata={'lead_id': lead.id, 'value': str(value) if value else None},
    )


# ── WhatsApp ─────────────────────────────────────────────────────────────────
def log_whatsapp_campaign_launched(event):
    """whatsapp_campaign.launched → ActivityLog. Fixes audit gap 5.x.

    payload contract: {'campaign_id': int, 'recipient_count': int}.
    """
    from social_stats.models import WhatsAppCampaign
    camp_id = event.payload.get('campaign_id')
    if not camp_id:
        return
    try:
        camp = WhatsAppCampaign.objects.get(id=camp_id)
    except WhatsAppCampaign.DoesNotExist:
        return

    recipients = event.payload.get('recipient_count', 0)
    log_activity(
        client=event.client,
        actor_user=event.actor_user,
        action_type='whatsapp_campaign_launched',
        severity='info',
        target_object_type='WhatsAppCampaign',
        target_object_id=camp.id,
        description=f'Launched WhatsApp campaign "{camp.name}" to {recipients} recipients'[:300],
        metadata={'campaign_id': camp.id, 'recipient_count': recipients},
    )


# ── Marketplace ──────────────────────────────────────────────────────────────
def log_permission_changed(event):
    """permission.changed → ActivityLog with severity='warning' (sensitive).

    payload contract: {'relation_id': int, 'permission_key': str, 'enabled': bool}.
    """
    relation_id = event.payload.get('relation_id')
    perm_key = event.payload.get('permission_key', '')
    enabled = event.payload.get('enabled', False)
    log_activity(
        client=event.client,
        actor_user=event.actor_user,
        action_type='permission_changed',
        severity='warning',
        target_object_type='AgencyClientRelation',
        target_object_id=relation_id,
        description=f'Permission "{perm_key}" {"granted" if enabled else "revoked"}',
        metadata={
            'relation_id': relation_id,
            'permission_key': perm_key,
            'enabled': enabled,
        },
    )


def log_approval_granted(event):
    """approval.granted → ActivityLog.

    payload contract: {'approval_id': int}.
    """
    log_activity(
        client=event.client,
        actor_user=event.actor_user,
        action_type='approval_granted',
        severity='info',
        target_object_type='ApprovalRequest',
        target_object_id=event.payload.get('approval_id'),
        description='Approval granted',
        metadata=event.payload,
    )


def log_approval_rejected(event):
    """approval.rejected → ActivityLog with severity='warning'."""
    log_activity(
        client=event.client,
        actor_user=event.actor_user,
        action_type='approval_rejected',
        severity='warning',
        target_object_type='ApprovalRequest',
        target_object_id=event.payload.get('approval_id'),
        description='Approval rejected',
        metadata=event.payload,
    )
