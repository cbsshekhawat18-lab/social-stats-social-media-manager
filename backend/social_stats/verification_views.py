# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Agency verification submission + admin queue.

Endpoints:
    POST /api/agency/<slug>/verification/submit/   (agency owner/admin)
    GET  /api/admin/verifications/pending/         (superadmin)
    GET  /api/admin/verifications/<agency_id>/     (superadmin)
    POST /api/admin/verifications/<agency_id>/approve/   (superadmin)
    POST /api/admin/verifications/<agency_id>/reject/    (superadmin)

Verification status lives on the Agency row itself:
    is_verified            : final mark (default False)
    verification_documents : JSON dict — submitted documents
        {
            'submitted_at':  iso,
            'submitted_by':  user_id,
            'documents': [
                {'type': 'gst', 'url': '…', 'note': '…'},
                {'type': 'business_reg', 'url': '…'},
                ...
            ],
            'decision': 'pending' | 'approved' | 'rejected',
            'decision_by': user_id,
            'decision_at': iso,
            'decision_note': '…',
        }
    verified_at            : set when admin approves

A reject keeps `verification_documents` so the agency can iterate; the
agency can re-submit by POSTing again, which resets `decision` to pending.
"""
from __future__ import annotations

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Agency, AgencyMembership
from .notification_dispatcher import dispatch as dispatch_notification


def _is_superadmin(user) -> bool:
    profile = getattr(user, 'profile', None)
    return bool(profile and profile.role == 'superadmin')


def _serialize_agency_verification(a: Agency) -> dict:
    return {
        'id':               a.id,
        'slug':             a.slug,
        'name':             a.name,
        'is_verified':      a.is_verified,
        'verified_at':      a.verified_at.isoformat() if a.verified_at else None,
        'documents':        a.verification_documents or {},
    }


# ─────────────────────────────────────────────────────────────────────────────
# Agency-side: submit
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def submit_verification(request, slug):
    """POST {documents: [{type, url, note?}]}."""
    try:
        agency = Agency.objects.get(slug=slug)
    except Agency.DoesNotExist:
        return Response({'error': 'agency not found'}, status=404)

    if not AgencyMembership.objects.filter(
        user=request.user, agency=agency, is_active=True, role__in=('owner', 'admin'),
    ).exists():
        return Response({'error': 'only an owner/admin can submit verification'}, status=403)

    documents = request.data.get('documents') or []
    if not isinstance(documents, list) or not documents:
        return Response({'error': 'at least one document is required'}, status=400)

    cleaned = []
    for doc in documents:
        if not isinstance(doc, dict):
            continue
        url = (doc.get('url') or '').strip()
        if not url:
            continue
        cleaned.append({
            'type': (doc.get('type') or 'other').strip()[:40],
            'url':  url[:500],
            'note': (doc.get('note') or '').strip()[:500],
        })
    if not cleaned:
        return Response({'error': 'no valid documents in payload'}, status=400)

    agency.verification_documents = {
        'submitted_at': timezone.now().isoformat(),
        'submitted_by': request.user.id,
        'documents':    cleaned,
        'decision':     'pending',
        'decision_by':  None,
        'decision_at':  None,
        'decision_note': '',
    }
    agency.save(update_fields=['verification_documents'])

    # Notify all superadmins so the queue gets attention
    for sa in User.objects.filter(profile__role='superadmin'):
        dispatch_notification(
            sa,
            event_type='marketplace_inquiry',  # closest existing event_type
            title=f'Verification submitted: {agency.name}',
            body=f'{len(cleaned)} document{"s" if len(cleaned) != 1 else ""} attached. Review the queue.',
            data={'kind': 'verification_submitted', 'agency_id': agency.id, 'agency_slug': agency.slug},
            channels=['in_app'],
        )

    return Response(_serialize_agency_verification(agency))


# ─────────────────────────────────────────────────────────────────────────────
# Admin queue
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_pending_verifications(request):
    if not _is_superadmin(request.user):
        return Response({'error': 'forbidden'}, status=403)

    qs = (
        Agency.objects
        .exclude(verification_documents__decision__exact='approved')
        .exclude(verification_documents__exact={})
        .order_by('-updated_at')[:200]
    )
    return Response({'agencies': [_serialize_agency_verification(a) for a in qs]})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_verification(request, agency_id):
    if not _is_superadmin(request.user):
        return Response({'error': 'forbidden'}, status=403)
    try:
        agency = Agency.objects.get(pk=agency_id)
    except Agency.DoesNotExist:
        return Response({'error': 'agency not found'}, status=404)
    return Response(_serialize_agency_verification(agency))


def _decide(request, agency_id, *, approve: bool):
    if not _is_superadmin(request.user):
        return Response({'error': 'forbidden'}, status=403)
    try:
        agency = Agency.objects.get(pk=agency_id)
    except Agency.DoesNotExist:
        return Response({'error': 'agency not found'}, status=404)
    note = (request.data.get('note') or '').strip()

    docs = dict(agency.verification_documents or {})
    docs['decision']      = 'approved' if approve else 'rejected'
    docs['decision_by']   = request.user.id
    docs['decision_at']   = timezone.now().isoformat()
    docs['decision_note'] = note

    update_fields = ['verification_documents']
    agency.verification_documents = docs
    if approve:
        agency.is_verified = True
        agency.verified_at = timezone.now()
        update_fields += ['is_verified', 'verified_at']
    agency.save(update_fields=update_fields)

    if agency.owner_user:
        dispatch_notification(
            agency.owner_user,
            event_type='marketplace_inquiry',
            title=(f'Your agency was verified ✅' if approve else 'Verification needs more info'),
            body=note or ('You\'ll see the verified badge wherever your agency appears.' if approve
                          else 'Please re-submit with the requested clarifications.'),
            data={
                'kind':        'verification_decision',
                'approved':    bool(approve),
                'agency_slug': agency.slug,
                'note':        note,
            },
        )

    return Response(_serialize_agency_verification(agency))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def approve_verification(request, agency_id):
    return _decide(request, agency_id, approve=True)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reject_verification(request, agency_id):
    return _decide(request, agency_id, approve=False)
