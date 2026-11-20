# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
WhatsApp webhook receivers — delivery/read receipts and inbound messages.

Two endpoints:

  /api/whatsapp/webhook/<webhook_key>/   one per WhatsAppAccount. The key in
      the path selects the account; the delivery must then prove itself with
      either
        • a valid `X-Hub-Signature-256` (HMAC-SHA256 of the raw body with the
          account's Meta App Secret) — Meta Cloud API, or
        • `X-Webhook-Secret: <the account's verify token>` — Pinbot and other
          providers that let you set a header.
      The GET handshake echoes `hub.challenge` when `hub.verify_token` equals
      the account's verify token. Events are processed for that account only.

  /api/whatsapp/webhook/                 the original shared endpoint, checked
      against `settings.WHATSAPP_WEBHOOK_SECRET`. Kept for installs that
      registered it with Pinbot before per-account webhooks existed.

Secrets are only accepted in headers — never in the query string, where they
would end up in proxy/access logs and browser history. Everything fails
closed: no secret configured means no delivery is accepted.
"""
import hashlib
import hmac
import logging

from django.conf import settings
from django.http import HttpResponse
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import WhatsAppAccount, WhatsAppWebhookLog
from .whatsapp_tasks import process_whatsapp_webhook

logger = logging.getLogger(__name__)


def _equal(a: str, b: str) -> bool:
    return bool(a) and bool(b) and hmac.compare_digest(a.encode(), b.encode())


def _event_type(payload) -> str:
    try:
        if isinstance(payload, dict):
            event_type = payload.get('type') or payload.get('object') or 'unknown'
            entry = (payload.get('entry') or [{}])[0]
            change = (entry.get('changes') or [{}])[0] if isinstance(entry, dict) else {}
            if change and change.get('field'):
                event_type = change['field']
            return str(event_type)[:100]
    except Exception:  # noqa: BLE001
        pass
    return 'unknown'


def _handshake(request, expected: str):
    challenge = request.query_params.get('hub.challenge')
    verify_token = request.query_params.get('hub.verify_token') or ''
    if challenge and _equal(verify_token, expected):
        return HttpResponse(challenge, content_type='text/plain')
    return Response(status=403)


def _valid_meta_signature(request, app_secret: str) -> bool:
    signature = request.headers.get('X-Hub-Signature-256') or ''
    if not app_secret or not signature.startswith('sha256='):
        return False
    expected = 'sha256=' + hmac.new(app_secret.encode(), request.body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(signature, expected)


@api_view(['POST', 'GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def whatsapp_account_webhook(request, webhook_key: str):
    """Webhook of one workspace's WhatsApp account."""
    account = WhatsAppAccount.objects.filter(webhook_key=webhook_key, is_active=True).first()
    if not account:
        return Response(status=404)

    if request.method == 'GET':
        return _handshake(request, account.webhook_verify_token)

    # Read the raw body for the signature before DRF parses it.
    app_secret = account.app_secret
    if app_secret:
        authentic = _valid_meta_signature(request, app_secret)
    else:
        authentic = _equal(request.headers.get('X-Webhook-Secret', ''), account.webhook_verify_token)
    if not authentic:
        logger.warning('WhatsApp webhook rejected for account=%s: bad signature/secret', account.id)
        return Response(status=403)

    payload = request.data or {}
    log = WhatsAppWebhookLog.objects.create(
        client_id=account.client_id, event_type=_event_type(payload), payload=payload,
    )
    process_whatsapp_webhook.delay(log.id)
    return Response({'ok': True}, status=200)


@api_view(['POST', 'GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def pinbot_webhook(request):
    """The shared, pre-provider endpoint (global WHATSAPP_WEBHOOK_SECRET)."""
    expected = getattr(settings, 'WHATSAPP_WEBHOOK_SECRET', '')

    if request.method == 'GET':
        return _handshake(request, expected)

    if not _equal(request.headers.get('X-Webhook-Secret', ''), expected):
        logger.warning('WhatsApp webhook rejected: bad secret')
        return Response(status=403)

    payload = request.data or {}
    log = WhatsAppWebhookLog.objects.create(event_type=_event_type(payload), payload=payload)
    process_whatsapp_webhook.delay(log.id)
    return Response({'ok': True}, status=200)
