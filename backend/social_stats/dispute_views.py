# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Dispute filing + admin resolution.

Endpoints:
    POST /api/disputes/file/                     (auth user, must be workspace owner of relation.client)
    GET  /api/admin/disputes/                    (superadmin)
    GET  /api/admin/disputes/<id>/               (superadmin)
    POST /api/admin/disputes/<id>/resolve/       (superadmin) — sets status + action
"""
from __future__ import annotations

from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .activity_logger import log_activity
from .marketplace_permissions import _is_owner, _is_superadmin
from .models import AgencyClientRelation, Dispute, Notification
from .notification_dispatcher import dispatch as dispatch_notification


def _serialize(d: Dispute) -> dict:
    return {
        'id':            d.id,
        'relation_id':   d.relation_id,
        'agency_name':   d.relation.agency.name,
        'agency_slug':   d.relation.agency.slug,
        'client_id':     d.relation.client_id,
        'client_name':   d.relation.client.company,
        'filer_email':   d.filer.email,
        'reason':        d.reason,
        'severity':      d.severity,
        'evidence_urls': d.evidence_urls,
        'status':        d.status,
        'decided_by':    d.decided_by.email if d.decided_by else None,
        'decided_at':    d.decided_at.isoformat() if d.decided_at else None,
        'resolution':    d.resolution,
        'action_taken':  d.action_taken,
        'created_at':    d.created_at.isoformat() if d.created_at else None,
    }


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def file_dispute(request):
    """POST {relation_id, reason, severity?, evidence_urls?}."""
    rid = request.data.get('relation_id')
    if not rid:
        return Response({'error': 'relation_id is required'}, status=400)
    try:
        rel = AgencyClientRelation.objects.select_related('client', 'agency').get(pk=rid)
    except AgencyClientRelation.DoesNotExist:
        return Response({'error': 'relation not found'}, status=404)

    if not _is_owner(request.user, rel.client):
        return Response({'error': 'only the workspace owner can file a dispute'}, status=403)

    reason = (request.data.get('reason') or '').strip()
    if not reason:
        return Response({'error': 'reason is required'}, status=400)

    severity = request.data.get('severity') or 'medium'
    if severity not in {'low', 'medium', 'high', 'critical'}:
        severity = 'medium'

    evidence = request.data.get('evidence_urls') or []
    if not isinstance(evidence, list):
        evidence = []
    evidence = [str(u)[:500] for u in evidence if u][:10]

    d = Dispute.objects.create(
        relation=rel, filer=request.user,
        reason=reason, severity=severity, evidence_urls=evidence,
    )

    log_activity(
        rel.client,
        actor_user=request.user, actor_type='end_user',
        action_type='dispute_filed',
        description=f'Filed a dispute against {rel.agency.name} ({severity})',
        severity='critical' if severity in ('high', 'critical') else 'warning',
        target_object_type='Dispute', target_object_id=d.id,
        metadata={'agency_id': rel.agency_id, 'severity': severity, 'reason': reason[:200]},
    )

    # Notify all superadmins
    from django.contrib.auth.models import User
    for sa in User.objects.filter(profile__role='superadmin'):
        dispatch_notification(
            sa,
            event_type='marketplace_inquiry',
            title=f'Dispute filed against {rel.agency.name} ({severity})',
            body=reason[:300],
            data={'kind': 'dispute_filed', 'dispute_id': d.id, 'severity': severity},
            channels=['in_app'],
        )

    return Response(_serialize(d), status=201)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_disputes(request):
    if not _is_superadmin(request.user):
        return Response({'error': 'forbidden'}, status=403)
    status_filter = request.query_params.get('status')
    qs = Dispute.objects.select_related('relation', 'relation__agency', 'relation__client', 'filer', 'decided_by')
    if status_filter:
        qs = qs.filter(status=status_filter)
    qs = qs.order_by('-created_at')[:200]
    return Response({'disputes': [_serialize(d) for d in qs]})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_dispute(request, dispute_id):
    if not _is_superadmin(request.user):
        return Response({'error': 'forbidden'}, status=403)
    try:
        d = Dispute.objects.select_related('relation', 'relation__agency', 'relation__client', 'filer', 'decided_by').get(pk=dispute_id)
    except Dispute.DoesNotExist:
        return Response({'error': 'dispute not found'}, status=404)
    return Response(_serialize(d))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def resolve_dispute(request, dispute_id):
    """POST {status, action, resolution?}.

    `status` ∈ {'resolved', 'rejected', 'escalated'}
    `action` ∈ {'paused', 'terminated', 'warned', 'dismissed', 'escalated'}
    """
    if not _is_superadmin(request.user):
        return Response({'error': 'forbidden'}, status=403)
    try:
        d = Dispute.objects.select_related('relation', 'relation__agency', 'relation__client').get(pk=dispute_id)
    except Dispute.DoesNotExist:
        return Response({'error': 'dispute not found'}, status=404)

    new_status = request.data.get('status') or ''
    if new_status not in {'resolved', 'rejected', 'escalated', 'under_review'}:
        return Response({'error': 'invalid status'}, status=400)
    action = request.data.get('action') or ''
    if action not in {'paused', 'terminated', 'warned', 'dismissed', 'escalated', ''}:
        return Response({'error': 'invalid action'}, status=400)

    d.status      = new_status
    d.action_taken = action
    d.resolution  = (request.data.get('resolution') or '').strip()
    d.decided_by  = request.user
    d.decided_at  = timezone.now()
    d.save()

    rel = d.relation
    if action == 'paused' and rel.status == 'active':
        rel.status = 'paused'
        rel.paused_at = timezone.now()
        rel.save(update_fields=['status', 'paused_at'])
    elif action == 'terminated' and rel.status != 'terminated':
        rel.status = 'terminated'
        rel.terminated_at = timezone.now()
        rel.terminated_by = 'platform_admin'
        rel.termination_reason = d.resolution or 'Resolved via dispute'
        rel.save()

    # Notify both sides
    body = f'Status: {new_status}' + (f' · Action: {action}' if action else '') + (f'\n{d.resolution}' if d.resolution else '')
    for u, side in [(rel.client.owner_user, 'end_user'), (rel.agency.owner_user, 'agency')]:
        if u:
            dispatch_notification(
                u, event_type='marketplace_inquiry',
                title=f'Dispute decision · {rel.agency.name} ↔ {rel.client.company}',
                body=body,
                data={'kind': 'dispute_resolved', 'dispute_id': d.id, 'action': action},
                channels=['in_app'],
            )

    return Response(_serialize(d))
