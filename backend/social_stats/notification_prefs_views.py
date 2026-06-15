# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""notification preference endpoints."""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .notification_dispatcher import (
    CHANNELS, EVENT_TYPES,
    get_preferences_matrix, update_preferences,
)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_notification_preferences(request):
    return Response({
        'channels':    CHANNELS,
        'event_types': EVENT_TYPES,
        'matrix':      get_preferences_matrix(request.user),
    })


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_notification_preferences(request):
    """PUT { rows: [{event_type, channel, enabled}, ...] }"""
    rows = (request.data or {}).get('rows') or []
    n = update_preferences(request.user, rows)
    return Response({
        'updated':  n,
        'matrix':   get_preferences_matrix(request.user),
    })
