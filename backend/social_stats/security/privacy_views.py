# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
privacy / data-subject-rights API.

Endpoints (all under /api/privacy/):
  POST /export-request/             — queue a data export
  GET  /export-request/             — list this user's exports + statuses
  GET  /download/<token>/           — public-link download of the assembled ZIP

  POST /delete-account/             — request account deletion (30d grace)
  POST /delete-account/cancel/      — cancel before grace ends

  GET  /processing-status/          — show is_processing_paused for owned workspaces
  POST /processing-status/          — toggle (body: {paused: bool, client_id?})

  GET  /consents/                   — list this user's consent record
  POST /consents/                   — record consent change (body: {consent_type, given, given_via?})
"""
from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.http import FileResponse, Http404
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from . import audit
from .privacy_models import (
    DataExportRequest, AccountDeletionRequest, UserConsent, CONSENT_TYPES,
)


# ─────────────────────────────────────────────────────────────────────────────
# Data export
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['POST', 'GET'])
@permission_classes([IsAuthenticated])
def data_export_collection(request):
    if request.method == 'GET':
        rows = DataExportRequest.objects.filter(user=request.user).order_by('-requested_at')[:25]
        return Response({'requests': [_export_summary(r) for r in rows]})

    # POST — queue a new export. Rate limit: one in-flight + one cooldown per day.
    today = timezone.now() - timedelta(hours=24)
    if DataExportRequest.objects.filter(
        user=request.user, status__in=('queued', 'processing'),
    ).exists():
        return Response({'error': 'an export is already in progress'}, status=409)
    if DataExportRequest.objects.filter(
        user=request.user, requested_at__gte=today, status='completed',
    ).exists():
        return Response({'error': 'one completed export per 24h — try again tomorrow'}, status=429)

    req = DataExportRequest.objects.create(user=request.user)
    audit.record(
        event_type='data_export_requested', actor_user=request.user, request=request,
        target_object_type='DataExportRequest', target_object_id=req.id,
    )
    try:
        from .privacy_tasks import assemble_data_export
        assemble_data_export.delay(req.id)
    except Exception:
        # eager mode in dev runs synchronously; that's fine
        pass
    return Response(_export_summary(req), status=202)


def _export_summary(r: DataExportRequest) -> dict:
    return {
        'id':            r.id,
        'status':        r.status,
        'requested_at':  r.requested_at.isoformat(),
        'completed_at':  r.completed_at.isoformat() if r.completed_at else None,
        'size_bytes':    r.archive_size_bytes,
        'download_url':  f'/api/privacy/download/{r.download_token.hex}/' if r.download_token else None,
        'expires_at':    r.download_expires_at.isoformat() if r.download_expires_at else None,
        'error_message': r.error_message,
    }


@api_view(['GET'])
@permission_classes([AllowAny])  # token in URL is the auth
def data_export_download(request, token: str):
    """Token-gated download. Token is the ``download_token`` UUID we minted
    when the export completed. Expires after 7 days."""
    import uuid as uuid_mod
    try:
        tok = uuid_mod.UUID(token)
    except ValueError:
        raise Http404
    req = DataExportRequest.objects.filter(
        download_token=tok, status='completed',
    ).first()
    if not req:
        raise Http404
    if not req.download_expires_at or timezone.now() > req.download_expires_at:
        # mark expired so the UI shows it correctly
        if req.status != 'expired':
            req.status = 'expired'
            req.save(update_fields=['status'])
        raise Http404

    try:
        return FileResponse(
            open(req.archive_path, 'rb'),
            as_attachment=True,
            filename=f'socialstats-export-{req.id}.zip',
            content_type='application/zip',
        )
    except FileNotFoundError:
        raise Http404


# ─────────────────────────────────────────────────────────────────────────────
# Account deletion
# ─────────────────────────────────────────────────────────────────────────────
GRACE_DAYS = 30


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def delete_account_request(request):
    """Schedule the calling user's account for deletion in 30 days. Idempotent —
    re-calling returns the existing request."""
    existing = AccountDeletionRequest.objects.filter(
        user=request.user, status='queued',
    ).first()
    if existing:
        return Response(_deletion_summary(existing), status=200)

    reason = (request.data.get('reason') or '')[:1000]
    req = AccountDeletionRequest.objects.create(
        user                  = request.user,
        user_email_at_request = request.user.email or request.user.username,
        reason                = reason,
        grace_until           = timezone.now() + timedelta(days=GRACE_DAYS),
    )
    audit.record(
        event_type='data_deletion_requested', actor_user=request.user, request=request,
        target_object_type='AccountDeletionRequest', target_object_id=req.id,
        severity='critical',
        metadata={'grace_days': GRACE_DAYS, 'reason_len': len(reason)},
    )
    return Response(_deletion_summary(req), status=202)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def delete_account_cancel(request):
    req = AccountDeletionRequest.objects.filter(
        user=request.user, status='queued',
    ).first()
    if not req:
        return Response({'error': 'no pending deletion to cancel'}, status=404)
    req.status       = 'cancelled'
    req.cancelled_at = timezone.now()
    req.save(update_fields=['status', 'cancelled_at'])
    audit.record(
        event_type='admin_action', actor_user=request.user, request=request,
        target_object_type='AccountDeletionRequest', target_object_id=req.id,
        description='deletion cancelled',
    )
    return Response(_deletion_summary(req))


def _deletion_summary(r: AccountDeletionRequest) -> dict:
    return {
        'id':            r.id,
        'status':        r.status,
        'requested_at':  r.requested_at.isoformat(),
        'grace_until':   r.grace_until.isoformat(),
        'cancelled_at':  r.cancelled_at.isoformat() if r.cancelled_at else None,
        'processed_at':  r.processed_at.isoformat() if r.processed_at else None,
        'reason':        r.reason,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Right to restrict processing
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def processing_status(request):
    """GET — list workspaces this user owns + their pause state.
    POST {paused, client_id?} — flip the flag on one (or all owned) workspaces."""
    from ..models import Client
    owned = Client.objects.filter(owner_user=request.user)

    if request.method == 'GET':
        return Response({
            'workspaces': [
                {'id': c.id, 'name': c.name, 'is_processing_paused': c.is_processing_paused}
                for c in owned
            ],
        })

    # POST
    paused = bool(request.data.get('paused'))
    client_id = request.data.get('client_id')
    qs = owned.filter(pk=client_id) if client_id else owned
    n = qs.update(is_processing_paused=paused)

    audit.record(
        event_type='privacy_settings_changed', actor_user=request.user, request=request,
        target_object_type='Client',
        target_object_id=str(client_id) if client_id else 'all_owned',
        metadata={'is_processing_paused': paused, 'workspaces_affected': n},
    )
    return Response({'ok': True, 'workspaces_affected': n, 'is_processing_paused': paused})


# ─────────────────────────────────────────────────────────────────────────────
# Consent management
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def consents_collection(request):
    if request.method == 'GET':
        # Return the LATEST decision per consent_type, plus the full history
        latest = {}
        for row in UserConsent.objects.filter(user=request.user).order_by('given_at'):
            latest[row.consent_type] = row.given
        return Response({
            'consents':    latest,
            'available':   [{'type': k, 'label': v} for k, v in CONSENT_TYPES],
        })

    consent_type = (request.data.get('consent_type') or '').strip()
    given        = bool(request.data.get('given'))
    given_via    = (request.data.get('given_via') or 'settings_page')[:40]
    valid_types  = {k for k, _ in CONSENT_TYPES}
    if consent_type not in valid_types:
        return Response({'error': f'unknown consent_type — must be one of {sorted(valid_types)}'},
                        status=400)

    # XFF-aware IP capture for the consent record (regulator-friendly)
    xff = request.META.get('HTTP_X_FORWARDED_FOR') or ''
    ip  = xff.split(',')[0].strip() if xff else request.META.get('REMOTE_ADDR')

    row = UserConsent.objects.create(
        user         = request.user,
        consent_type = consent_type,
        given        = given,
        given_via    = given_via,
        ip_address   = ip,
        user_agent   = (request.META.get('HTTP_USER_AGENT') or '')[:1000],
        text_version = getattr(settings, 'PRIVACY_POLICY_VERSION', '')[:20],
    )
    audit.record(
        event_type='consent_given' if given else 'consent_withdrawn',
        actor_user=request.user, request=request,
        target_object_type='UserConsent', target_object_id=row.id,
        metadata={'consent_type': consent_type, 'given_via': given_via},
    )
    return Response({'ok': True, 'consent_type': consent_type, 'given': given,
                     'recorded_at': row.given_at.isoformat()})
