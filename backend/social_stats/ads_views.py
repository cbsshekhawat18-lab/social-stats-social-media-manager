# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""Tiny stub views for the Ads module (waitlist signup)."""
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import AdsWaitlist


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def notify_ads(request):
    email = (request.data.get('email') or '').strip().lower()
    if not email or '@' not in email or '.' not in email.split('@')[-1]:
        return Response({'detail': 'Please provide a valid email'}, status=400)

    user = request.user if request.user.is_authenticated else None
    AdsWaitlist.objects.create(
        email=email,
        source=request.data.get('source', 'web'),
        user=user,
    )
    return Response({'ok': True})
