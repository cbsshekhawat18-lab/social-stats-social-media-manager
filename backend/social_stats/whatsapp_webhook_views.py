# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Pinbot webhook receiver — accepts delivery/read receipts and inbound messages.

Authentication: shared-secret header `X-Webhook-Secret` checked against
`settings.WHATSAPP_WEBHOOK_SECRET`. Configure this URL + secret in Pinbot.
"""
import logging

from django.conf import settings
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import WhatsAppWebhookLog
from .whatsapp_tasks import process_whatsapp_webhook

logger = logging.getLogger(__name__)


@api_view(['POST', 'GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def pinbot_webhook(request):
    # GET = Meta-style verification handshake (returns hub.challenge if supported)
    if request.method == 'GET':
        challenge = request.query_params.get('hub.challenge')
        verify_token = request.query_params.get('hub.verify_token')
        if challenge and verify_token == getattr(settings, 'WHATSAPP_WEBHOOK_SECRET', ''):
            from django.http import HttpResponse
            return HttpResponse(challenge, content_type='text/plain')
        return Response(status=403)

    expected = getattr(settings, 'WHATSAPP_WEBHOOK_SECRET', '')
    secret = request.headers.get('X-Webhook-Secret', '') or request.query_params.get('secret', '')
    if not expected or secret != expected:
        logger.warning('Pinbot webhook rejected: bad secret')
        return Response(status=403)

    payload = request.data or {}
    event_type = 'unknown'
    try:
        # Best-effort event type extraction
        if isinstance(payload, dict):
            event_type = payload.get('type') or payload.get('object') or 'unknown'
            entry = (payload.get('entry') or [{}])[0]
            change = (entry.get('changes') or [{}])[0] if isinstance(entry, dict) else {}
            if change and change.get('field'):
                event_type = change['field']
    except Exception:
        pass

    log = WhatsAppWebhookLog.objects.create(event_type=str(event_type)[:100], payload=payload)
    process_whatsapp_webhook.delay(log.id)
    return Response({'ok': True}, status=200)
