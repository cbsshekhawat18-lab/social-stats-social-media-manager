# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Unified Inbox API.

ViewSets:
  - ConversationViewSet  — list / retrieve + actions: mark_read / archive /
                            star / unstar / assign / resolve
  - MessageViewSet       — read-only nested view + reply action that routes
                            through the appropriate publisher's reply method
                            and writes an outbound Message row.
  - UnifiedReviewViewSet — list / retrieve + actions: reply / flag

APIView:
  - InboxStatsView       — aggregates across the user's tenant: total unread,
                            unread by platform, by sentiment, average response
                            time over the last 30 days.
"""
from __future__ import annotations

import logging
from datetime import timedelta
from typing import Optional

from django.db.models import Avg, Count, F, Q
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .inbox_serializers import (
    ConversationListSerializer, ConversationDetailSerializer,
    MessageSerializer, UnifiedReviewSerializer,
)
from .models import (
    Conversation, Message, UnifiedReview, PlatformCredential,
)
from .publishers import (
    get_publisher,
    PublishError, TokenExpiredError, RateLimitError,
)
from .tenant_mixins import TenantScopedMixin
from .marketplace_permissions import (
    check_action, deny_response, approval_pending_response,
)
from .activity_logger import log_activity_for_request

logger = logging.getLogger(__name__)


_REPLY_PERMISSION_BY_TYPE = {
    'comment': 'reply_comments',
    'dm':      'reply_messages',
    'review':  'reply_reviews',
}


# ── Conversations ────────────────────────────────────────────────────────────
class ConversationViewSet(TenantScopedMixin, viewsets.ReadOnlyModelViewSet):
    """List + detail for inbox conversations. Mutations via action endpoints."""
    queryset = Conversation.objects.prefetch_related('messages').all()

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ConversationDetailSerializer
        return ConversationListSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        # Common list filters
        if params.get('platform'):
            qs = qs.filter(platform=params['platform'])
        if params.get('type'):
            qs = qs.filter(type=params['type'])
        if params.get('sentiment'):
            qs = qs.filter(sentiment=params['sentiment'])
        if params.get('starred') in ('1', 'true', 'True'):
            qs = qs.filter(is_starred=True)
        if params.get('unread') in ('1', 'true', 'True'):
            qs = qs.filter(unread_count__gt=0)
        # Default the LIST view to active (non-archived) only — action endpoints
        # like /unarchive/ must be able to load archived rows by id.
        if self.action == 'list':
            if params.get('archived') in ('1', 'true', 'True'):
                qs = qs.filter(is_archived=True)
            elif params.get('include_archived') not in ('1', 'true', 'True'):
                qs = qs.filter(is_archived=False)
        if params.get('resolved') in ('1', 'true', 'True'):
            qs = qs.filter(is_resolved=True)
        if params.get('assigned_to'):
            qs = qs.filter(assigned_to_id=params['assigned_to'])
        if params.get('search'):
            term = params['search']
            qs = qs.filter(
                Q(contact_name__icontains=term) |
                Q(contact_handle__icontains=term) |
                Q(last_message_preview__icontains=term)
            )
        return qs

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        conv = self.get_object()
        Message.objects.filter(conversation=conv, direction='inbound', read_at__isnull=True) \
                       .update(read_at=timezone.now())
        conv.unread_count = 0
        conv.save(update_fields=['unread_count'])
        return Response({'unread_count': 0})

    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        conv = self.get_object()
        conv.is_archived = True
        conv.save(update_fields=['is_archived'])
        return Response({'is_archived': True})

    @action(detail=True, methods=['post'])
    def unarchive(self, request, pk=None):
        conv = self.get_object()
        conv.is_archived = False
        conv.save(update_fields=['is_archived'])
        return Response({'is_archived': False})

    @action(detail=True, methods=['post'])
    def star(self, request, pk=None):
        conv = self.get_object()
        conv.is_starred = True
        conv.save(update_fields=['is_starred'])
        return Response({'is_starred': True})

    @action(detail=True, methods=['post'])
    def unstar(self, request, pk=None):
        conv = self.get_object()
        conv.is_starred = False
        conv.save(update_fields=['is_starred'])
        return Response({'is_starred': False})

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        conv = self.get_object()
        conv.is_resolved = True
        conv.save(update_fields=['is_resolved'])
        return Response({'is_resolved': True})

    @action(detail=True, methods=['post'])
    def reopen(self, request, pk=None):
        conv = self.get_object()
        conv.is_resolved = False
        conv.save(update_fields=['is_resolved'])
        return Response({'is_resolved': False})

    @action(detail=True, methods=['post'])
    def assign(self, request, pk=None):
        from django.contrib.auth.models import User
        conv = self.get_object()
        user_id = request.data.get('user_id')
        if user_id is None:
            conv.assigned_to = None
        else:
            try:
                conv.assigned_to = User.objects.get(id=int(user_id))
            except (User.DoesNotExist, ValueError):
                return Response({'detail': 'user_id not found'}, status=400)
        conv.save(update_fields=['assigned_to'])
        return Response({'assigned_to': conv.assigned_to_id})

    @action(detail=True, methods=['post'])
    def reply(self, request, pk=None):
        """Compose a reply: routes through the right publisher and persists outbound Message."""
        conv = self.get_object()
        text = (request.data.get('text') or '').strip()
        if not text:
            return Response({'detail': 'text is required'}, status=400)

        # Marketplace gate (): pick the permission key by conversation type.
        perm_key = _REPLY_PERMISSION_BY_TYPE.get(conv.type)
        if perm_key:
            verdict, ctx = check_action(
                request, conv.client, perm_key,
                action_type=f'reply_{conv.type}',
                payload={'conversation_id': conv.id, 'platform': conv.platform, 'text': text},
                target_object_type='Conversation',
                target_object_id=conv.id,
                preview=text[:300],
            )
            if verdict == 'denied':
                return deny_response(ctx['reason'])
            if verdict == 'approval_required':
                return approval_pending_response(ctx['approval'])

        # Resolve credentials + the originating message we're replying to.
        cred = PlatformCredential.objects.filter(
            client_id=conv.client_id, platform=conv.platform, is_active=True,
        ).first()
        if not cred:
            return Response({'detail': f'No active {conv.platform} credential'}, status=400)

        publisher = get_publisher(conv.platform)
        last_inbound = (Message.objects
                        .filter(conversation=conv, direction='inbound')
                        .order_by('-created_at').first())

        try:
            if conv.type == 'comment':
                if not last_inbound or not last_inbound.platform_message_id:
                    return Response({'detail': 'No inbound comment to reply to'}, status=400)
                result = publisher.reply_to_comment(cred, last_inbound.platform_message_id, text)
            elif conv.type == 'dm':
                psid = (last_inbound.author_handle if last_inbound else conv.contact_handle)
                if not psid:
                    return Response({'detail': 'No recipient ID on this thread'}, status=400)
                result = publisher.reply_to_dm(cred, conv.platform_thread_id, text, psid=psid, recipient_id=psid)
            elif conv.type == 'review':
                if not last_inbound or not last_inbound.platform_message_id:
                    return Response({'detail': 'No review to reply to'}, status=400)
                result = publisher.reply_to_review(cred, last_inbound.platform_message_id, text)
            else:
                return Response({'detail': f'Reply not supported for type={conv.type}'}, status=400)
        except TokenExpiredError as e:
            cred.is_active = False
            cred.save(update_fields=['is_active'])
            return Response({'detail': str(e), 'code': 'token_expired'}, status=400)
        except RateLimitError as e:
            return Response({'detail': str(e), 'code': 'rate_limited'}, status=429)
        except PublishError as e:
            return Response({'detail': str(e), 'code': e.code or 'publish_error'}, status=400)

        # Persist outbound message
        msg = Message.objects.create(
            conversation=conv,
            platform_message_id=getattr(result, 'platform_post_id', '') or '',
            direction='outbound',
            author_name=request.user.get_full_name() or request.user.email or 'Social Stats',
            author_handle=request.user.email or '',
            content=text,
            sent_at=timezone.now(),
            replied_at=timezone.now(),
            sentiment=last_inbound.sentiment if last_inbound else 'unknown',
            sent_by=request.user,
        )
        # Touch the conversation
        conv.last_message_preview = text[:500]
        conv.last_message_at = msg.sent_at
        conv.save(update_fields=['last_message_preview', 'last_message_at'])

        log_activity_for_request(
            request, conv.client,
            action_type=f'reply_{conv.type}',
            description=f'Replied to a {conv.platform} {conv.type}',
            severity='notice' if conv.type == 'review' else 'info',
            target_object_type='Message',
            target_object_id=msg.id,
            metadata={'platform': conv.platform, 'conversation_id': conv.id},
            is_reversible=False,
        )
        return Response(MessageSerializer(msg).data, status=201)


# ── Messages (read-only nested view) ─────────────────────────────────────────
class MessageViewSet(viewsets.ReadOnlyModelViewSet):
    """Lists messages within a conversation. Tenant-isolated via the parent."""
    queryset = Message.objects.select_related('conversation').all()
    serializer_class = MessageSerializer

    def get_queryset(self):
        try:
            profile = self.request.user.profile
        except Exception:
            return self.queryset.none()
        qs = self.queryset
        # Filter by tenant via the parent conversation
        if profile.role == 'superadmin':
            cid = self.request.query_params.get('client_id')
            if cid: qs = qs.filter(conversation__client_id=cid)
        elif profile.role == 'staff':
            qs = qs.filter(conversation__client__in=profile.assigned_clients.all())
        else:
            qs = qs.filter(conversation__client_id=profile.client_id)
        if self.request.query_params.get('conversation'):
            qs = qs.filter(conversation_id=self.request.query_params['conversation'])
        return qs.order_by('sent_at', 'id')


# ── Reviews ──────────────────────────────────────────────────────────────────
class UnifiedReviewViewSet(TenantScopedMixin, viewsets.ReadOnlyModelViewSet):
    queryset = UnifiedReview.objects.all()
    serializer_class = UnifiedReviewSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get('status'):
            qs = qs.filter(status=self.request.query_params['status'])
        if self.request.query_params.get('rating'):
            try:
                qs = qs.filter(rating=int(self.request.query_params['rating']))
            except ValueError:
                pass
        return qs

    @action(detail=True, methods=['post'])
    def reply(self, request, pk=None):
        review = self.get_object()
        text = (request.data.get('text') or '').strip()
        if not text:
            return Response({'detail': 'text is required'}, status=400)

        cred = PlatformCredential.objects.filter(
            client_id=review.client_id, platform=review.platform, is_active=True,
        ).first()
        if not cred:
            return Response({'detail': f'No active {review.platform} credential'}, status=400)

        publisher = get_publisher(review.platform)
        try:
            publisher.reply_to_review(cred, review.platform_review_id, text)
        except TokenExpiredError as e:
            cred.is_active = False; cred.save(update_fields=['is_active'])
            return Response({'detail': str(e), 'code': 'token_expired'}, status=400)
        except PublishError as e:
            return Response({'detail': str(e), 'code': e.code or 'reply_failed'}, status=400)

        review.reply_text = text
        review.replied_at = timezone.now()
        review.replied_by = request.user
        review.status = 'replied'
        review.save(update_fields=['reply_text', 'replied_at', 'replied_by', 'status'])
        return Response(UnifiedReviewSerializer(review).data)

    @action(detail=True, methods=['post'])
    def flag(self, request, pk=None):
        review = self.get_object()
        review.status = 'flagged'
        review.save(update_fields=['status'])
        return Response({'status': 'flagged'})


# ── Stats ────────────────────────────────────────────────────────────────────
class InboxStatsView(APIView):
    """Aggregates inbox health for the current tenant."""

    def get(self, request):
        client_ids = self._tenant_client_ids(request)
        if client_ids is None:
            return Response({'detail': 'No tenant context'}, status=403)

        convs = Conversation.objects.filter(client_id__in=client_ids, is_archived=False)
        unread_total = convs.filter(unread_count__gt=0).aggregate(t=Count('id'))['t'] or 0

        by_platform = {
            row['platform']: row['n']
            for row in (
                convs.filter(unread_count__gt=0)
                     .values('platform')
                     .annotate(n=Count('id'))
            )
        }
        by_sentiment = {
            row['sentiment']: row['n']
            for row in (
                convs.values('sentiment').annotate(n=Count('id'))
            )
        }

        # Avg response time over the last 30 days: time between first inbound
        # in a conversation and the first outbound that follows.
        cutoff = timezone.now() - timedelta(days=30)
        replied_msgs = Message.objects.filter(
            conversation__client_id__in=client_ids,
            direction='outbound',
            replied_at__gte=cutoff,
        ).select_related('conversation')

        deltas = []
        for m in replied_msgs.iterator():
            inbound = (Message.objects
                       .filter(conversation=m.conversation_id,
                               direction='inbound',
                               sent_at__lt=m.sent_at or timezone.now())
                       .order_by('-sent_at').first())
            if inbound and inbound.sent_at and m.sent_at:
                deltas.append((m.sent_at - inbound.sent_at).total_seconds())
        avg_response_seconds = round(sum(deltas) / len(deltas)) if deltas else None

        return Response({
            'total_unread':         unread_total,
            'by_platform':          by_platform,
            'by_sentiment':         by_sentiment,
            'response_time_avg_s':  avg_response_seconds,
            'sample_size':          len(deltas),
        })

    def _tenant_client_ids(self, request) -> Optional[list]:
        try:
            profile = request.user.profile
        except Exception:
            return None
        if profile.role == 'superadmin':
            from .models import Client
            cid = request.query_params.get('client_id')
            return [int(cid)] if cid else list(Client.objects.values_list('id', flat=True))
        if profile.role == 'staff':
            return list(profile.assigned_clients.values_list('id', flat=True))
        if profile.client_id:
            return [profile.client_id]
        return []
