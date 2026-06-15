# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Real-time webhook receivers.

Endpoints:
  GET  /api/webhooks/meta/   — Meta verification handshake (hub.challenge)
  POST /api/webhooks/meta/   — Page/Instagram event push (X-Hub-Signature-256)
  POST /api/webhooks/youtube/  — PubSubHubbub topic notification

For platforms without webhooks (LinkedIn, GMB), the existing 5-min beat
schedule keeps polling. The webhook layer just *accelerates* refresh on
platforms that do support it — it does NOT replace the polling fallback.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging

from django.conf import settings
from django.http import HttpResponse
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import PlatformCredential

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════════════
# Meta (Facebook + Instagram) — same webhook for both, dispatches by `object`
# ══════════════════════════════════════════════════════════════════════
@api_view(['GET', 'POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def meta_webhook(request):
    if request.method == 'GET':
        return _meta_verify(request)
    return _meta_event(request)


def _meta_verify(request):
    """Meta's verification handshake — echoes hub.challenge when token matches."""
    expected = getattr(settings, 'META_WEBHOOK_VERIFY_TOKEN', '')
    mode      = request.GET.get('hub.mode')
    token     = request.GET.get('hub.verify_token')
    challenge = request.GET.get('hub.challenge')
    if mode == 'subscribe' and expected and token == expected and challenge:
        return HttpResponse(challenge, content_type='text/plain')
    return HttpResponse(status=403)


def _meta_event(request):
    """
    Meta event push. We:
      1. Verify the X-Hub-Signature-256 HMAC.
      2. For each entry, find the PlatformCredential by page_id / IG account ID.
      3. Trigger the relevant inbox sync immediately so the new comment/DM
         appears within seconds (instead of waiting for the next 5-min poll).
    """
    secret = getattr(settings, 'META_WEBHOOK_SECRET', '')
    if not _verify_meta_signature(request, secret):
        logger.warning('Meta webhook rejected — bad signature')
        return Response(status=403)

    payload = request.data or {}
    obj = payload.get('object', '')   # 'page' or 'instagram'
    entries = payload.get('entry') or []
    fired_clients = set()

    for entry in entries:
        entry_id = str(entry.get('id') or '')
        if not entry_id:
            continue

        # Resolve the tenant by page_id (FB) or instagram_account_id (IG)
        if obj == 'page':
            cred = PlatformCredential.objects.filter(
                page_id=entry_id, platform='facebook', is_active=True,
            ).first()
        elif obj == 'instagram':
            cred = PlatformCredential.objects.filter(
                instagram_account_id=entry_id, platform='instagram', is_active=True,
            ).first()
        else:
            cred = None

        if not cred:
            logger.info('Meta webhook entry %s has no matching credential', entry_id)
            continue

        if cred.client_id not in fired_clients:
            fired_clients.add(cred.client_id)
            from .inbox_tasks import sync_facebook_inbox, sync_instagram_inbox
            if obj == 'page':
                sync_facebook_inbox.delay(cred.client_id)
            else:
                sync_instagram_inbox.delay(cred.client_id)

    return Response({'ok': True, 'fired_clients': len(fired_clients)})


def _verify_meta_signature(request, secret: str) -> bool:
    """Verify X-Hub-Signature-256 against the request body."""
    if not secret:
        # No secret configured → accept anything (dev mode). Production
        # deployments should always set META_WEBHOOK_SECRET.
        return True
    sig = request.headers.get('X-Hub-Signature-256') or ''
    if not sig.startswith('sha256='):
        return False
    expected = 'sha256=' + hmac.new(
        secret.encode(), request.body, hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(sig, expected)


# ══════════════════════════════════════════════════════════════════════
# YouTube PubSubHubbub
# ══════════════════════════════════════════════════════════════════════
@api_view(['GET', 'POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def youtube_webhook(request):
    """
    PubSubHubbub flow:
      - GET  with hub.mode=subscribe → echo hub.challenge to confirm subscription
      - POST with Atom XML body     → topic notification (channel got a new
                                        upload or activity)

    The body is Atom/XML; we parse minimally to extract the channel id and fire
    a sync task. Any X-Hub-Signature header is verified against
    YOUTUBE_WEBHOOK_SECRET when configured.
    """
    if request.method == 'GET':
        if request.GET.get('hub.mode') in ('subscribe', 'unsubscribe'):
            challenge = request.GET.get('hub.challenge', '')
            return HttpResponse(challenge, content_type='text/plain')
        return HttpResponse(status=400)

    secret = getattr(settings, 'YOUTUBE_WEBHOOK_SECRET', '')
    if secret and not _verify_yt_signature(request, secret):
        logger.warning('YouTube webhook rejected — bad signature')
        return Response(status=403)

    body = (request.body or b'').decode('utf-8', errors='ignore')
    channel_id = _extract_yt_channel_id(body)
    if not channel_id:
        return Response({'ok': True, 'note': 'no channel id parsed'})

    creds = PlatformCredential.objects.filter(
        platform='youtube', channel_id=channel_id, is_active=True,
    ).only('client_id')

    fired = 0
    from .inbox_tasks import sync_youtube_inbox
    for c in creds:
        sync_youtube_inbox.delay(c.client_id)
        fired += 1
    return Response({'ok': True, 'fired_clients': fired})


def _verify_yt_signature(request, secret: str) -> bool:
    sig = request.headers.get('X-Hub-Signature') or ''
    # PubSubHubbub historically used sha1; some now use sha256
    if sig.startswith('sha256='):
        expected = 'sha256=' + hmac.new(secret.encode(), request.body, hashlib.sha256).hexdigest()
    elif sig.startswith('sha1='):
        expected = 'sha1=' + hmac.new(secret.encode(), request.body, hashlib.sha1).hexdigest()
    else:
        return False
    return hmac.compare_digest(sig, expected)


def _extract_yt_channel_id(body: str) -> str | None:
    """
    Atom payload contains <yt:channelId>UC…</yt:channelId>. Parse without
    pulling in a dependency — just a regex.
    """
    import re
    m = re.search(r'<yt:channelId>([^<]+)</yt:channelId>', body)
    if m: return m.group(1).strip()
    m = re.search(r'<yt:channelId xmlns:[^>]*>([^<]+)</yt:channelId>', body)
    if m: return m.group(1).strip()
    return None
