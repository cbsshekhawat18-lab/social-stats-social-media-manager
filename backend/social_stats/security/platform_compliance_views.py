# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
public callback endpoints for Meta + Google compliance.

  POST /api/meta/data-deletion-callback/    — Meta: user requested deletion
  POST /api/meta/deauth-callback/           — Meta: user removed app
  POST /api/google/data-deletion/           — Google: user requested deletion
  GET  /privacy/platform-deletion/<code>/   — public status page (HTML)

All POST endpoints are CSRF-exempt + AllowAny + rely on signature
verification (Meta) or shared-secret header (Google) for trust.
"""
from __future__ import annotations

import logging

from django.conf import settings
from django.http import HttpResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .platform_compliance import (
    PlatformDataDeletionRequest, SignedRequestError,
    parse_meta_signed_request, mint_confirmation_code,
)


logger = logging.getLogger(__name__)


def _frontend_status_url(code: str) -> str:
    base = getattr(settings, 'BACKEND_PUBLIC_URL', None) or \
           getattr(settings, 'FRONTEND_URL', 'http://localhost:8000')
    return f'{base.rstrip("/")}/api/privacy/platform-deletion/{code}/'


def _enqueue_processor(req_id: int) -> None:
    """Best-effort Celery dispatch. Eager mode in dev runs synchronously."""
    try:
        from .platform_compliance_tasks import process_platform_deletion_task
        process_platform_deletion_task.delay(req_id)
    except Exception:
        logger.warning('platform deletion processor enqueue failed for req=%s',
                       req_id, exc_info=True)


# ─────────────────────────────────────────────────────────────────────────────
# Meta — Data Deletion Callback
# ─────────────────────────────────────────────────────────────────────────────
@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def meta_data_deletion_callback(request):
    """Meta posts ``signed_request=...`` (form-encoded). Returns JSON with
    ``url`` (status URL) + ``confirmation_code``.

    https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback/
    """
    return _meta_callback(request, kind='data_deletion')


@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def meta_deauth_callback(request):
    """Meta posts ``signed_request`` when a user removes the app from FB.
    Same response shape as data-deletion."""
    return _meta_callback(request, kind='deauthorize')


def _meta_callback(request, *, kind: str):
    signed = (request.data.get('signed_request')
              or request.POST.get('signed_request')
              or '').strip()
    try:
        payload = parse_meta_signed_request(signed)
    except SignedRequestError as e:
        logger.warning('meta callback: %s', e)
        return Response({'error': str(e)}, status=400)

    user_id = str(payload.get('user_id') or '').strip()
    if not user_id:
        return Response({'error': 'missing user_id in signed_request'}, status=400)

    code = mint_confirmation_code()
    req = PlatformDataDeletionRequest.objects.create(
        provider='meta', kind=kind,
        external_user_id=user_id,
        confirmation_code=code,
        raw_payload=payload,
    )
    _enqueue_processor(req.id)

    return Response({
        'url':              _frontend_status_url(code),
        'confirmation_code': code,
    })


# ─────────────────────────────────────────────────────────────────────────────
# Google — Data Deletion endpoint
# ─────────────────────────────────────────────────────────────────────────────
@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def google_data_deletion_callback(request):
    """Google's data-deletion request. Body: {"google_user_id": "...", ...}.
    Authenticated via the X-Goog-Channel-Token header against
    ``GOOGLE_DELETION_SHARED_SECRET`` env. Returns the same shape as Meta."""
    expected = (getattr(settings, 'GOOGLE_DELETION_SHARED_SECRET', '') or '').strip()
    incoming = (request.META.get('HTTP_X_GOOG_CHANNEL_TOKEN') or '').strip()
    if expected:
        if not incoming or incoming != expected:
            return Response({'error': 'invalid shared secret'}, status=401)
    elif incoming:
        # Secret not configured but client sent one — log and allow (so dev
        # endpoints stay usable), but warn loudly.
        logger.warning('GOOGLE_DELETION_SHARED_SECRET unset but request had a token')

    user_id = str(request.data.get('google_user_id')
                  or request.data.get('user_id')
                  or request.data.get('sub')
                  or '').strip()
    if not user_id:
        return Response({'error': 'missing google_user_id / user_id'}, status=400)

    code = mint_confirmation_code()
    req = PlatformDataDeletionRequest.objects.create(
        provider='google', kind='data_deletion',
        external_user_id=user_id,
        confirmation_code=code,
        raw_payload=dict(request.data) if hasattr(request.data, 'keys') else {},
    )
    _enqueue_processor(req.id)

    return Response({
        'url':              _frontend_status_url(code),
        'confirmation_code': code,
    })


# ─────────────────────────────────────────────────────────────────────────────
# Public status URL
# ─────────────────────────────────────────────────────────────────────────────
@csrf_exempt
@api_view(['GET'])
@permission_classes([AllowAny])
def platform_deletion_status(request, code: str):
    """Plain-text status page reachable from the URL we returned to Meta/Google.
    Returns HTML (Meta + Google explicitly want a human-readable status page,
    not JSON). Anyone with the code can view it — the code is the credential.
    """
    req = PlatformDataDeletionRequest.objects.filter(confirmation_code=code).first()
    if not req:
        body = (
            '<!doctype html><html><body style="font-family: sans-serif; max-width: 640px; margin: 60px auto; padding: 0 20px;">'
            '<h1>Deletion request not found</h1>'
            '<p>The confirmation code in this URL does not match any record. '
            'If you believe this is a mistake, contact <a href="mailto:privacy@socialstats.app">privacy@socialstats.app</a>.</p>'
            '</body></html>'
        )
        return HttpResponse(body, status=404, content_type='text/html')

    received = req.received_at.strftime('%Y-%m-%d %H:%M UTC')
    completed = req.completed_at.strftime('%Y-%m-%d %H:%M UTC') if req.completed_at else 'In progress'
    status_msg = {
        'queued':     'Your deletion request has been received and is queued.',
        'processing': 'Your deletion is being processed right now.',
        'completed':  'Your data associated with this account has been deleted.',
        'failed':     'We hit a snag — please contact privacy@socialstats.app.',
    }.get(req.status, 'Status unknown')

    body = f'''<!doctype html>
<html>
<head><meta charset="utf-8"><title>Social Stats — deletion request status</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 640px; margin: 60px auto; padding: 0 20px; color: #1e293b;">
  <h1 style="margin: 0 0 8px;">Deletion request status</h1>
  <p style="color: #64748b; margin: 0 0 20px;">Confirmation code: <code>{code}</code></p>
  <div style="padding: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;">
    <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">{req.get_status_display()}</div>
    <p style="margin: 0 0 12px; color: #475569;">{status_msg}</p>
    <table style="width: 100%; font-size: 13px; color: #64748b;">
      <tr><td style="padding: 4px 0;">Provider</td><td>{req.get_provider_display()}</td></tr>
      <tr><td style="padding: 4px 0;">Type</td><td>{req.get_kind_display()}</td></tr>
      <tr><td style="padding: 4px 0;">Received</td><td>{received}</td></tr>
      <tr><td style="padding: 4px 0;">Completed</td><td>{completed}</td></tr>
    </table>
  </div>
  <p style="margin-top: 24px; font-size: 13px; color: #64748b;">
    Questions? <a href="mailto:privacy@socialstats.app">privacy@socialstats.app</a>
  </p>
</body>
</html>'''
    return HttpResponse(body, content_type='text/html')
