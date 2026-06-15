# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
AgencyClientRelation management endpoints.

Endpoints:
    GET  /api/relations/                          — list relations relevant to the current user
                                                    (end-user sees their own; agency member sees
                                                     all relations their agency manages)
    GET  /api/relations/<id>/                     — detail with permission matrix + agency profile
    PUT  /api/relations/<id>/permissions/         — owner updates permissions / requires_approval_for
    POST /api/relations/<id>/pause/               — owner pauses agency access
    POST /api/relations/<id>/resume/              — owner resumes paused access
    POST /api/relations/<id>/terminate/           — owner ends the relationship (any side, really)
    POST /api/relations/<id>/flag/                — owner flags suspicious activity
    GET  /api/relations/<id>/agency-profile/      — public agency profile (callable by either side)

All mutations write an ActivityLog row with severity and metadata.
"""
from __future__ import annotations

from django.db.models import Q
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .activity_logger import log_activity
from .marketplace_permissions import _is_owner, _is_superadmin
from .models import (
    AGENCY_CLIENT_PERMISSIONS,
    AgencyClientRelation,
    AgencyMembership,
)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
def _can_view(user, relation: AgencyClientRelation) -> bool:
    if _is_superadmin(user):
        return True
    if _is_owner(user, relation.client):
        return True
    return AgencyMembership.objects.filter(
        user=user, agency=relation.agency, is_active=True,
    ).exists()


def _is_workspace_owner(user, relation: AgencyClientRelation) -> bool:
    return _is_superadmin(user) or _is_owner(user, relation.client)


def _serialize_relation(relation: AgencyClientRelation, *, perspective: str = 'owner') -> dict:
    agency = relation.agency
    return {
        'id':                relation.id,
        'status':            relation.status,
        'initiated_by':      relation.initiated_by,
        'permissions':       relation.permissions,
        'requires_approval_for': relation.requires_approval_for or [],
        'proposed_at':       relation.proposed_at.isoformat() if relation.proposed_at else None,
        'approved_at':       relation.approved_at.isoformat() if relation.approved_at else None,
        'paused_at':         relation.paused_at.isoformat() if relation.paused_at else None,
        'terminated_at':     relation.terminated_at.isoformat() if relation.terminated_at else None,
        'terminated_by':     relation.terminated_by,
        'termination_reason': relation.termination_reason,
        'monthly_fee':       float(relation.monthly_fee) if relation.monthly_fee is not None else None,
        'fee_currency':      relation.fee_currency,
        'user_trust_level':  relation.user_trust_level,
        'notes_from_user':   relation.notes_from_user,
        'notes_from_agency': relation.notes_from_agency if perspective == 'owner' else '',
        'agency': {
            'id':           agency.id,
            'name':         agency.name,
            'slug':         agency.slug,
            'logo_url':     agency.logo_url,
            'description':  agency.description,
            'website':      agency.website,
            'is_verified':  agency.is_verified,
            'avg_rating':   agency.avg_rating,
            'review_count': agency.review_count,
            'location':     ', '.join([p for p in (agency.location_city, agency.location_country) if p]),
        },
        'client': {
            'id':       relation.client_id,
            'company':  relation.client.company,
            'industry': relation.client.industry,
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# 1. List
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_relations(request):
    """Returns relations the current user can see — both perspectives folded
    into one list, each tagged with `perspective: 'owner' | 'agency'`."""
    user = request.user
    profile = getattr(user, 'profile', None)

    # Workspaces this user owns (end-user perspective)
    owned_qs = AgencyClientRelation.objects.filter(client__owner_user=user)
    if profile and profile.role == 'client' and profile.client_id:
        owned_qs = owned_qs | AgencyClientRelation.objects.filter(client_id=profile.client_id)

    # Agencies this user is a member of (agency perspective)
    agency_ids = list(
        AgencyMembership.objects.filter(user=user, is_active=True).values_list('agency_id', flat=True)
    )
    agency_qs = AgencyClientRelation.objects.filter(agency_id__in=agency_ids) if agency_ids else AgencyClientRelation.objects.none()

    seen = set()
    out = []
    for r in owned_qs.select_related('agency', 'client').order_by('-proposed_at'):
        if r.id in seen: continue
        seen.add(r.id)
        out.append({**_serialize_relation(r, perspective='owner'), 'perspective': 'owner'})
    for r in agency_qs.select_related('agency', 'client').order_by('-proposed_at'):
        if r.id in seen: continue
        seen.add(r.id)
        out.append({**_serialize_relation(r, perspective='agency'), 'perspective': 'agency'})

    return Response({'relations': out})


# ─────────────────────────────────────────────────────────────────────────────
# 2. Detail
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_relation(request, relation_id):
    try:
        rel = AgencyClientRelation.objects.select_related('agency', 'client').get(pk=relation_id)
    except AgencyClientRelation.DoesNotExist:
        return Response({'error': 'relation not found'}, status=404)
    if not _can_view(request.user, rel):
        return Response({'error': 'forbidden'}, status=403)
    perspective = 'owner' if _is_workspace_owner(request.user, rel) else 'agency'
    payload = _serialize_relation(rel, perspective=perspective)
    payload['perspective'] = perspective
    payload['permission_catalog'] = AGENCY_CLIENT_PERMISSIONS
    return Response(payload)


# ─────────────────────────────────────────────────────────────────────────────
# 3. Update permissions (owner only)
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_relation_permissions(request, relation_id):
    """PUT {permissions?, requires_approval_for?}. Only the workspace owner
    can update. Each toggled key writes one ActivityLog row."""
    try:
        rel = AgencyClientRelation.objects.select_related('agency', 'client').get(pk=relation_id)
    except AgencyClientRelation.DoesNotExist:
        return Response({'error': 'relation not found'}, status=404)
    if not _is_workspace_owner(request.user, rel):
        return Response({'error': 'only the workspace owner can change permissions'}, status=403)

    data = request.data or {}
    new_perms = rel.permissions or {}
    new_perms = dict(new_perms)
    changed = []
    if 'permissions' in data and isinstance(data['permissions'], dict):
        for key, val in data['permissions'].items():
            if key not in AGENCY_CLIENT_PERMISSIONS:
                continue
            old = bool(new_perms.get(key, False))
            nxt = bool(val)
            if old != nxt:
                changed.append((key, old, nxt))
                new_perms[key] = nxt

    new_approval = list(rel.requires_approval_for or [])
    if 'requires_approval_for' in data and isinstance(data['requires_approval_for'], list):
        clean = [k for k in data['requires_approval_for'] if k in AGENCY_CLIENT_PERMISSIONS]
        if set(clean) != set(new_approval):
            new_approval = clean

    rel.permissions = new_perms
    rel.requires_approval_for = new_approval
    rel.save(update_fields=['permissions', 'requires_approval_for'])

    if changed or new_approval != (rel.requires_approval_for or []):
        log_activity(
            rel.client,
            actor_user=request.user,
            actor_type='end_user',
            action_type='permissions_changed',
            description=(
                f'Updated permissions for {rel.agency.name}: '
                + (', '.join(f'{k}={"on" if nxt else "off"}' for k, _o, nxt in changed) or '(approval list updated)')
            ),
            severity='warning',
            target_object_type='AgencyClientRelation',
            target_object_id=rel.id,
            metadata={
                'changed':              [{'key': k, 'old': o, 'new': n} for k, o, n in changed],
                'requires_approval_for': new_approval,
                'agency_id':            rel.agency_id,
            },
        )
        from .notification_dispatcher import dispatch as _dispatch
        _dispatch(
            rel.agency.owner_user,
            event_type='permission_changed',
            title=f'{rel.client.company} updated your permissions',
            data={'kind': 'permissions_changed', 'relation_id': rel.id, 'client_id': rel.client_id},
        )

    return Response(_serialize_relation(rel, perspective='owner'))


# ─────────────────────────────────────────────────────────────────────────────
# 4. Pause / Resume / Terminate
# ─────────────────────────────────────────────────────────────────────────────
def _set_status(rel: AgencyClientRelation, new_status: str, *, request, reason: str = ''):
    rel.status = new_status
    if new_status == 'paused':
        rel.paused_at = timezone.now()
    elif new_status == 'active':
        rel.paused_at = None
    elif new_status == 'terminated':
        rel.terminated_at = timezone.now()
        rel.terminated_by = 'end_user' if _is_owner(request.user, rel.client) else 'agency'
        rel.termination_reason = reason
    rel.save()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def pause_relation(request, relation_id):
    try:
        rel = AgencyClientRelation.objects.select_related('agency', 'client').get(pk=relation_id)
    except AgencyClientRelation.DoesNotExist:
        return Response({'error': 'relation not found'}, status=404)
    if not _is_workspace_owner(request.user, rel):
        return Response({'error': 'only the workspace owner can pause'}, status=403)
    if rel.status != 'active':
        return Response({'error': f'cannot pause a {rel.status} relation'}, status=400)

    _set_status(rel, 'paused', request=request)
    log_activity(
        rel.client,
        actor_user=request.user, actor_type='end_user',
        action_type='agency_paused',
        description=f'Paused {rel.agency.name}',
        severity='warning',
        target_object_type='AgencyClientRelation',
        target_object_id=rel.id,
        metadata={'agency_id': rel.agency_id},
    )
    from .notification_dispatcher import dispatch as _dispatch
    _dispatch(
        rel.agency.owner_user,
        event_type='relation_paused',
        title=f'{rel.client.company} paused your access',
        data={'kind': 'relation_paused', 'relation_id': rel.id, 'client_id': rel.client_id},
    )
    return Response(_serialize_relation(rel, perspective='owner'))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def resume_relation(request, relation_id):
    try:
        rel = AgencyClientRelation.objects.select_related('agency', 'client').get(pk=relation_id)
    except AgencyClientRelation.DoesNotExist:
        return Response({'error': 'relation not found'}, status=404)
    if not _is_workspace_owner(request.user, rel):
        return Response({'error': 'only the workspace owner can resume'}, status=403)
    if rel.status != 'paused':
        return Response({'error': f'cannot resume a {rel.status} relation'}, status=400)

    _set_status(rel, 'active', request=request)
    log_activity(
        rel.client,
        actor_user=request.user, actor_type='end_user',
        action_type='agency_resumed',
        description=f'Resumed {rel.agency.name}',
        severity='notice',
        target_object_type='AgencyClientRelation',
        target_object_id=rel.id,
        metadata={'agency_id': rel.agency_id},
    )
    from .notification_dispatcher import dispatch as _dispatch
    _dispatch(
        rel.agency.owner_user,
        event_type='relation_resumed',
        title=f'{rel.client.company} resumed your access',
        data={'kind': 'relation_resumed', 'relation_id': rel.id, 'client_id': rel.client_id},
    )
    return Response(_serialize_relation(rel, perspective='owner'))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def terminate_relation(request, relation_id):
    try:
        rel = AgencyClientRelation.objects.select_related('agency', 'client').get(pk=relation_id)
    except AgencyClientRelation.DoesNotExist:
        return Response({'error': 'relation not found'}, status=404)
    # Either side can terminate (owner OR agency member)
    if not _can_view(request.user, rel):
        return Response({'error': 'forbidden'}, status=403)
    if rel.status == 'terminated':
        return Response({'error': 'already terminated'}, status=400)

    reason = (request.data.get('reason') or '').strip()
    _set_status(rel, 'terminated', request=request, reason=reason)
    actor_type = 'end_user' if _is_owner(request.user, rel.client) else 'agency'
    log_activity(
        rel.client,
        actor_user=request.user, actor_type=actor_type,
        action_type='agency_terminated',
        description=f'Terminated relation with {rel.agency.name}' + (f' — {reason}' if reason else ''),
        severity='critical',
        target_object_type='AgencyClientRelation',
        target_object_id=rel.id,
        metadata={'agency_id': rel.agency_id, 'reason': reason, 'by': rel.terminated_by},
    )
    # Notify the other side — high-impact event, on by default for email
    other = rel.agency.owner_user if actor_type == 'end_user' else rel.client.owner_user
    if other:
        from django.conf import settings
        from .notification_dispatcher import dispatch as dispatch_notification
        frontend = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        dispatch_notification(
            other,
            event_type='relation_terminated',
            title=(f'{rel.client.company} ended the relationship'
                   if actor_type == 'end_user' else
                   f'{rel.agency.name} ended the relationship'),
            body=reason or '(no reason given)',
            cta_url=f'{frontend}/u/agency' if actor_type != 'end_user' else f'{frontend}/admin/clients',
            cta_label='Open Social Stats',
            data={'kind': 'relation_terminated', 'relation_id': rel.id, 'reason': reason},
        )
    return Response(_serialize_relation(rel, perspective='owner' if actor_type == 'end_user' else 'agency'))


# ─────────────────────────────────────────────────────────────────────────────
# 5. Flag (owner)
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def flag_relation(request, relation_id):
    try:
        rel = AgencyClientRelation.objects.select_related('agency', 'client').get(pk=relation_id)
    except AgencyClientRelation.DoesNotExist:
        return Response({'error': 'relation not found'}, status=404)
    if not _is_workspace_owner(request.user, rel):
        return Response({'error': 'only the workspace owner can flag'}, status=403)

    reason = (request.data.get('reason') or '').strip()
    rel.status = 'flagged'
    rel.save(update_fields=['status'])
    log_activity(
        rel.client,
        actor_user=request.user, actor_type='end_user',
        action_type='agency_flagged',
        description=f'Flagged {rel.agency.name} for review' + (f' — {reason}' if reason else ''),
        severity='critical',
        target_object_type='AgencyClientRelation',
        target_object_id=rel.id,
        metadata={'agency_id': rel.agency_id, 'reason': reason},
    )
    return Response(_serialize_relation(rel, perspective='owner'))


# ─────────────────────────────────────────────────────────────────────────────
# 6. Agency profile shortcut
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def relation_agency_profile(request, relation_id):
    try:
        rel = AgencyClientRelation.objects.select_related('agency').get(pk=relation_id)
    except AgencyClientRelation.DoesNotExist:
        return Response({'error': 'relation not found'}, status=404)
    if not _can_view(request.user, rel):
        return Response({'error': 'forbidden'}, status=403)
    a = rel.agency
    return Response({
        'id':                a.id,
        'name':              a.name,
        'slug':              a.slug,
        'logo_url':          a.logo_url,
        'description':       a.description,
        'website':           a.website,
        'industries_served': a.industries_served,
        'services_offered':  a.services_offered,
        'is_verified':       a.is_verified,
        'avg_rating':        a.avg_rating,
        'review_count':      a.review_count,
        'location':          ', '.join([p for p in (a.location_city, a.location_country) if p]),
    })
