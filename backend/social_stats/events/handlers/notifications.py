# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
— Notification handlers.

These handlers fire when domain events land on the bus. Each one resolves
recipients and routes through the central `notification_dispatcher.dispatch`
helper so user channel preferences (in-app / email / WhatsApp / browser-push)
are honoured and the email fan-out happens for free.

every handler now goes through `_dispatch_to_user()` instead of
writing `Notification.objects.create` directly. The compatibility wrapper
preserves the `client` FK on the in-app row (Audit gap 1.1) by
augmenting the Notification AFTER the dispatcher creates it. The legacy
direct-create callsites elsewhere in the codebase are documented in
INTEGRATION_AUDIT.md and left untouched in this stage to keep the diff
narrow — the migration is mechanical and can land per-feature later.

All handlers idempotent: re-fetch by ID, write at most one Notification per
(event_id, recipient_user) pair. The dispatcher's `processed_by_handlers`
dedupe protects against double-dispatch from Celery retries.
"""
from __future__ import annotations

import logging
from typing import Iterable

from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)
User = get_user_model()


# ── Recipient helpers ────────────────────────────────────────────────────────
def _agency_members_for_client(client) -> Iterable:
    """Active agency members managing this client. Used when an event
    should reach "whoever is running the workspace" rather than a specific
    assignee — e.g. brand-new lead arrives, no assignee yet."""
    from social_stats.models import AgencyClientRelation, AgencyMembership

    relation = AgencyClientRelation.objects.filter(
        client=client, status='active',
    ).select_related('agency').first()
    if not relation:
        return User.objects.none()

    member_ids = AgencyMembership.objects.filter(
        agency=relation.agency, is_active=True,
    ).values_list('user_id', flat=True)
    return User.objects.filter(id__in=list(member_ids))


def _client_owner(client):
    """Returns the end-user who owns this client workspace, if any."""
    return getattr(client, 'owner_user', None)


def _runners_of_workspace(client) -> list:
    """Active humans responsible for this workspace.

    Returns the agency members managing the client if a relation exists,
    otherwise falls back to the workspace owner. Both can be empty (system
    workspace, etc.) — caller should be tolerant of that.
    """
    members = list(_agency_members_for_client(client))
    if members:
        return members
    owner = _client_owner(client)
    return [owner] if owner else []


def _create_notification(*, user, client, title, body, data, notif_type='system'):
    """— route every event-bus notification through the central
    `notification_dispatcher.dispatch` so the user's per-channel preferences
    (in-app / email / WhatsApp / browser-push) are honoured.

    The dispatcher writes the in-app row and fans out to enabled channels. We
    augment the resulting row with the `client` FK (Audit gap 1.1)
    since the dispatcher's signature predates that field.

    `data['event_type']` (the bus-level type like `lead.captured`) is mapped to
    the dispatcher's SMART_NOTIFICATION_EVENT_CHOICES vocabulary via
    `_DISPATCHER_EVENT_TYPE` so preference matching works. The original bus
    event_type stays in the data payload for frontend deep-linking.

    Returns the Notification, or None if user is missing.
    """
    from social_stats.notification_dispatcher import dispatch

    if user is None:
        return None

    bus_event_type = (data or {}).get('event_type', '')
    dispatcher_event = _DISPATCHER_EVENT_TYPE.get(bus_event_type, 'system')

    # The dispatcher overwrites data['event_type'] with the dispatcher's
    # vocabulary value (line 134 of notification_dispatcher.py). Preserve
    # the bus event_type under a separate key so frontend deep-link logic
    # can still read it.
    enriched_data = dict(data or {})
    if bus_event_type:
        enriched_data['bus_event_type'] = bus_event_type

    cta_url = ''
    link = enriched_data.get('link')
    if link:
        from django.conf import settings
        frontend = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        cta_url = f'{frontend.rstrip("/")}{link}' if link.startswith('/') else link

    note = dispatch(
        user,
        event_type=dispatcher_event,
        title=title,
        body=body or '',
        data=enriched_data,
        cta_url=cta_url,
        notif_type=notif_type,
    )

    if note and client and note.client_id != client.id:
        note.client = client
        try:
            note.save(update_fields=['client'])
        except Exception:
            pass
    return note


# Maps event-bus types (`<noun>.<verb>`) to the existing
# SMART_NOTIFICATION_EVENT_CHOICES vocabulary used by the dispatcher's
# preference matrix. Anything unmapped routes as 'system' (no preference key,
# always in-app, no email by default).
_DISPATCHER_EVENT_TYPE = {
    'post.published':         'post_published',
    'post.failed':            'publish_failed',
    'message.received':       'inbox_message',
    'review.received':        'inbox_review',
    'bot.handoff_requested':  'bot_handoff',
    'lead.captured':          'bot_lead_captured',
    'lead.assigned':          'bot_lead_captured',  # future: dedicated `lead_assigned`
    'approval.granted':       'approval_decided',
    'approval.rejected':      'approval_decided',
    'token.expired':          'token_expiring',
    'platform.sync_failed':   'publish_failed',     # future: dedicated `sync_failed`
}


# ── Post lifecycle ───────────────────────────────────────────────────────────
def notify_post_published(event):
    """Notify the author + workspace owner when their post goes live."""
    from social_stats.models import UnifiedPost
    post_id = event.payload.get('post_id')
    if not post_id:
        return
    try:
        post = UnifiedPost.objects.get(id=post_id)
    except UnifiedPost.DoesNotExist:
        return

    recipients = {event.actor_user, _client_owner(event.client)}
    recipients.discard(None)

    platforms = event.payload.get('platforms') or post.target_platforms
    title = f'Post published on {", ".join(platforms or [])}'.strip()
    for user in recipients:
        _create_notification(
            user=user,
            client=event.client,
            title=title[:200],
            body=(post.content or '')[:500],
            data={
                'event_type': 'post.published',
                'post_id': post.id,
                'link': f'/admin/composer/{post.id}',
            },
        )


def notify_post_failed(event):
    """Notify author + workspace owner when a publish fails."""
    from social_stats.models import UnifiedPost
    post_id = event.payload.get('post_id')
    if not post_id:
        return
    try:
        post = UnifiedPost.objects.get(id=post_id)
    except UnifiedPost.DoesNotExist:
        return

    recipients = {event.actor_user, _client_owner(event.client)}
    recipients.discard(None)
    reason = event.payload.get('reason') or 'Unknown error'

    for user in recipients:
        _create_notification(
            user=user,
            client=event.client,
            title=f'Post failed to publish'[:200],
            body=f'{reason}\n\n{(post.content or "")[:300]}',
            data={
                'event_type': 'post.failed',
                'post_id': post.id,
                'reason': reason,
                'link': f'/admin/composer/{post.id}',
            },
        )


# ── Inbox / messaging ────────────────────────────────────────────────────────
def notify_inbox_new_message(event):
    """Notify the conversation's assignee (if any) or all agency members.

    Fixes audit gap 6.x — inbound inbox messages were silent.

    payload contract: {'message_id': int, 'channel': str}.
    """
    from social_stats.models import Message
    msg_id = event.payload.get('message_id')
    if not msg_id:
        return
    try:
        msg = Message.objects.select_related('conversation').get(id=msg_id)
    except Message.DoesNotExist:
        return

    conv = msg.conversation
    if conv.is_archived or conv.is_resolved:
        return  # the agent has already closed this — don't re-ping

    if conv.assigned_to_id:
        recipients = [conv.assigned_to]
    else:
        recipients = _runners_of_workspace(event.client)

    title = f'New message on {conv.platform} from {conv.contact_name or conv.contact_handle or "unknown"}'
    for user in recipients:
        _create_notification(
            user=user,
            client=event.client,
            title=title[:200],
            body=(msg.content or '')[:300],
            data={
                'event_type': 'message.received',
                'conversation_id': conv.id,
                'message_id': msg.id,
                'link': f'/admin/inbox/{conv.id}',
            },
        )


def notify_review_received(event):
    """A new review came in. Notify owner + agency members.

    payload contract: {'review_id': int, 'rating': int, 'platform': str}.
    """
    rating = event.payload.get('rating')
    platform = event.payload.get('platform') or 'platform'
    severity_hint = '⭐' * (rating or 0) if rating else ''

    recipients = list(_agency_members_for_client(event.client))
    owner = _client_owner(event.client)
    if owner and owner not in recipients:
        recipients.append(owner)

    for user in recipients:
        _create_notification(
            user=user,
            client=event.client,
            title=f'New {platform} review {severity_hint}'.strip()[:200],
            body=event.payload.get('preview', ''),
            data={
                'event_type': 'review.received',
                'review_id': event.payload.get('review_id'),
                'rating': rating,
                'link': f'/admin/inbox?tab=reviews&review={event.payload.get("review_id")}',
            },
        )


# ── Bot / leads ──────────────────────────────────────────────────────────────
def notify_human_handoff(event):
    """Bot escalated to a human. Notify all agency members; whoever picks up first owns it.

    payload contract: {'conversation_id': int, 'reason': str}.
    """
    from social_stats.bot_models import BotConversation
    conv_id = event.payload.get('conversation_id')
    if not conv_id:
        return
    try:
        conv = BotConversation.objects.select_related('contact').get(id=conv_id)
    except BotConversation.DoesNotExist:
        return

    contact = conv.contact.phone if conv.contact_id else 'unknown contact'
    reason = event.payload.get('reason', '')

    for user in _runners_of_workspace(event.client):
        _create_notification(
            user=user,
            client=event.client,
            title=f'Bot handoff: {contact}'[:200],
            body=reason[:300],
            data={
                'event_type': 'bot.handoff_requested',
                'bot_conversation_id': conv.id,
                'link': f'/admin/bots/conversations/{conv.id}',
            },
        )


def notify_new_lead(event):
    """Lead captured — notify the assignee or all agency members.

    Fixes audit gap 6.x (lead-assigned not notified). Payload-only path so
    handler doesn't depend on the notification dispatch happening elsewhere.

    payload contract: {'lead_id': int, 'source': str}.
    """
    from social_stats.bot_models import Lead
    lead_id = event.payload.get('lead_id')
    if not lead_id:
        return
    try:
        lead = Lead.objects.get(id=lead_id)
    except Lead.DoesNotExist:
        return

    if lead.assigned_to_id:
        recipients = [lead.assigned_to]
    else:
        recipients = _runners_of_workspace(event.client)

    name = lead.name or lead.phone or 'unnamed lead'
    source = event.payload.get('source') or 'unknown source'
    for user in recipients:
        _create_notification(
            user=user,
            client=event.client,
            title=f'New lead: {name}'[:200],
            body=f'Source: {source}'
                 + (f'\nCampaign: {lead.source_campaign_name}' if lead.source_campaign_name else ''),
            data={
                'event_type': 'lead.captured',
                'lead_id': lead.id,
                'source': source,
                'link': f'/admin/leads/{lead.id}',
            },
        )


def notify_lead_assigned(event):
    """Lead assigned to a user → notify the new assignee.

    Fires on `lead.status_changed` events that include an `assigned_to_changed`
    flag. Idempotent — only fires when the assignment field actually changed.

    payload contract: {'lead_id': int, 'assigned_to_user_id': int|None}.
    """
    from social_stats.bot_models import Lead
    if not event.payload.get('assigned_to_changed'):
        return  # not an assignment event; another handler (lead.captured) covers initial

    lead_id = event.payload.get('lead_id')
    user_id = event.payload.get('assigned_to_user_id')
    if not (lead_id and user_id):
        return
    try:
        lead = Lead.objects.get(id=lead_id)
        user = User.objects.get(id=user_id)
    except (Lead.DoesNotExist, User.DoesNotExist):
        return

    name = lead.name or lead.phone or 'unnamed lead'
    _create_notification(
        user=user,
        client=event.client,
        title=f'Lead assigned to you: {name}'[:200],
        body=f'Status: {lead.status}',
        data={
            'event_type': 'lead.assigned',
            'lead_id': lead.id,
            'link': f'/admin/leads/{lead.id}',
        },
    )


# ── Marketplace / approvals ──────────────────────────────────────────────────
def notify_approval_decided(event):
    """Notify the agency requester when their approval is granted/rejected.

    Fixes audit gap 6.x — requester wasn't notified when end user decided.

    payload contract: {'approval_id': int}.
    """
    try:
        from social_stats.models import ApprovalRequest
    except ImportError:
        # ApprovalRequest may live elsewhere; tolerate.
        return
    approval_id = event.payload.get('approval_id')
    if not approval_id:
        return
    try:
        approval = ApprovalRequest.objects.select_related('requested_by').get(id=approval_id)
    except ApprovalRequest.DoesNotExist:
        return

    if not approval.requested_by_id:
        return

    decision = event.event_type.split('.', 1)[1]  # 'granted' or 'rejected'
    title = f'Your request was {decision}'
    _create_notification(
        user=approval.requested_by,
        client=event.client,
        title=title,
        body=getattr(approval, 'decision_note', '') or '',
        data={
            'event_type': event.event_type,
            'approval_id': approval.id,
            'decision': decision,
            'link': f'/admin/approvals/{approval.id}',
        },
    )


# ── Auth / Security ──────────────────────────────────────────────────────────
def notify_token_expired(event):
    """Platform OAuth token expired. Notify the workspace owner.

    payload contract: {'platform': str, 'credential_id': int}.
    """
    owner = _client_owner(event.client)
    if not owner:
        return

    platform = event.payload.get('platform', 'platform')
    _create_notification(
        user=owner,
        client=event.client,
        title=f'{platform.title()} authentication expired'[:200],
        body=f'Reconnect {platform} to resume syncing.',
        data={
            'event_type': 'token.expired',
            'platform': platform,
            'credential_id': event.payload.get('credential_id'),
            'link': f'/admin/settings/integrations',
        },
    )


def notify_sync_failed(event):
    """A scheduled sync task failed. Notify owner if recurring.

    payload contract: {'platform': str, 'error': str, 'consecutive_failures': int}.
    """
    consecutive = event.payload.get('consecutive_failures', 1)
    if consecutive < 3:
        return  # transient — don't spam on a single failure

    owner = _client_owner(event.client)
    if not owner:
        return

    platform = event.payload.get('platform', 'platform')
    _create_notification(
        user=owner,
        client=event.client,
        title=f'{platform.title()} sync failing repeatedly'[:200],
        body=f'{consecutive} consecutive failures. Check connection.',
        data={
            'event_type': 'platform.sync_failed',
            'platform': platform,
            'consecutive_failures': consecutive,
            'link': f'/admin/settings/integrations',
        },
    )
