# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Notification preference + approval queue API.

Endpoints:
  GET  /api/notifications/preferences/        — current user's matrix
  PUT  /api/notifications/preferences/        — bulk update
  GET  /api/composer/posts/?status=pending_approval  — already supported by UnifiedPostViewSet
  GET  /api/composer/approvals/               — convenience: queue across the user's tenant
"""
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .composer_serializers import UnifiedPostListSerializer
from .models import (
    NotificationPreference, UnifiedPost,
    SMART_NOTIFICATION_EVENT_CHOICES, NOTIFICATION_CHANNEL_CHOICES,
)


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = ['event_type', 'channel', 'enabled']


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def notification_preferences(request):
    user = request.user

    if request.method == 'GET':
        rows = NotificationPreference.objects.filter(user=user)
        explicit = {(r.event_type, r.channel): r.enabled for r in rows}
        # Render the full event×channel matrix using DEFAULT_CHANNEL_POLICY
        from .notification_dispatch import DEFAULT_CHANNEL_POLICY
        events = [e[0] for e in SMART_NOTIFICATION_EVENT_CHOICES]
        channels = [c[0] for c in NOTIFICATION_CHANNEL_CHOICES]
        matrix = []
        for ev in events:
            row = {'event_type': ev}
            for ch in channels:
                row[ch] = explicit.get((ev, ch), DEFAULT_CHANNEL_POLICY.get(ch, False))
            matrix.append(row)
        return Response({
            'events':   [{'id': k, 'label': v} for k, v in SMART_NOTIFICATION_EVENT_CHOICES],
            'channels': [{'id': k, 'label': v} for k, v in NOTIFICATION_CHANNEL_CHOICES],
            'matrix':   matrix,
        })

    # PUT — bulk update the matrix
    payload = request.data.get('matrix') or request.data
    if not isinstance(payload, list):
        return Response({'error': 'Body must be {matrix: [{event_type, channel, enabled}, ...]} '
                                  'or a flat list with the same items.'},
                        status=400)

    written = 0
    valid_events = {e[0] for e in SMART_NOTIFICATION_EVENT_CHOICES}
    valid_channels = {c[0] for c in NOTIFICATION_CHANNEL_CHOICES}
    for item in payload:
        ev = item.get('event_type')
        ch = item.get('channel')
        if ev not in valid_events or ch not in valid_channels:
            continue
        NotificationPreference.objects.update_or_create(
            user=user, event_type=ev, channel=ch,
            defaults={'enabled': bool(item.get('enabled'))},
        )
        written += 1

    return Response({'updated': written})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def approval_queue(request):
    """
    Returns UnifiedPost rows in `pending_approval` status that the current
    user can approve. Same tenant rules as TenantScopedMixin.
    """
    try:
        profile = request.user.profile
    except Exception:
        return Response({'error': 'No profile'}, status=403)

    qs = UnifiedPost.objects.filter(status='pending_approval')
    if profile.role == 'client':
        qs = qs.filter(client_id=profile.client_id)
    elif profile.role == 'staff':
        qs = qs.filter(client__in=profile.assigned_clients.all())
    # superadmin sees all (optionally filter by ?client_id=)
    cid = request.query_params.get('client_id')
    if cid:
        qs = qs.filter(client_id=cid)

    qs = qs.order_by('-created_at')[:200]
    return Response({
        'count':  qs.count() if hasattr(qs, 'count') else len(qs),
        'queue':  UnifiedPostListSerializer(qs, many=True).data,
    })
