# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Approval workflow endpoints (end-user side).

Endpoints:
    GET  /api/approvals/pending/              — current user's pending approvals
    GET  /api/approvals/history/              — past approvals (any non-pending)
    GET  /api/approvals/<id>/                 — full detail with payload preview
    POST /api/approvals/<id>/approve/         — body: {edited_payload?, response?}
    POST /api/approvals/<id>/reject/          — body: {reason}

Visibility:
    - Workspace owner sees their workspace's approvals (any state).
    - Superadmin sees everything.
    - Agency members see approvals their agency originated (read-only on
      `pending`; useful for status indicators in the agency UI).

Approval flow:
's `check_action()` already creates ApprovalRequest rows when a
    relation marks an action as requires_approval. This module is the
    consume-side: the user reviews + approves/rejects, and on approve the
    `approval_executors` dispatcher runs the original action.
"""
from __future__ import annotations

from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .activity_logger import log_activity
from .approval_executors import execute_approval
from .marketplace_permissions import _is_owner, _is_superadmin
from .models import (
    AgencyMembership, ApprovalRequest,
)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
def _user_owns_approval(user, approval: ApprovalRequest) -> bool:
    return _is_superadmin(user) or _is_owner(user, approval.client)


def _user_can_view(user, approval: ApprovalRequest) -> bool:
    if _user_owns_approval(user, approval):
        return True
    return AgencyMembership.objects.filter(
        user=user, agency_id=approval.relation.agency_id, is_active=True,
    ).exists()


def _serialize_approval(a: ApprovalRequest, *, perspective: str = 'owner') -> dict:
    return {
        'id':                 a.id,
        'relation_id':        a.relation_id,
        'client_id':          a.client_id,
        'client_name':        a.client.company,
        'agency_id':          a.relation.agency_id,
        'agency_name':        a.relation.agency.name,
        'requested_by_id':    a.requested_by_id,
        'requested_by_email': a.requested_by.email,
        'requested_by_name':  (a.requested_by.get_full_name() or '').strip() or a.requested_by.email,
        'action_type':        a.action_type,
        'target_object_type': a.target_object_type,
        'target_object_id':   a.target_object_id,
        'payload':            a.payload,
        'preview':            a.preview,
        'status':             a.status,
        'user_response':      a.user_response if perspective == 'owner' else '',
        'edited_payload':     a.edited_payload,
        'execution_result':   a.execution_result,
        'created_at':         a.created_at.isoformat() if a.created_at else None,
        'expires_at':         a.expires_at.isoformat() if a.expires_at else None,
        'decided_at':         a.decided_at.isoformat() if a.decided_at else None,
        'executed_at':        a.executed_at.isoformat() if a.executed_at else None,
        'perspective':        perspective,
    }


def _accessible_qs(user):
    """All approvals visible to the user across both perspectives."""
    if _is_superadmin(user):
        return ApprovalRequest.objects.all()
    profile = getattr(user, 'profile', None)
    qs = ApprovalRequest.objects.filter(client__owner_user=user)
    if profile and profile.role == 'client' and profile.client_id:
        qs = qs | ApprovalRequest.objects.filter(client_id=profile.client_id)
    agency_ids = list(
        AgencyMembership.objects.filter(user=user, is_active=True)
        .values_list('agency_id', flat=True)
    )
    if agency_ids:
        qs = qs | ApprovalRequest.objects.filter(relation__agency_id__in=agency_ids)
    return qs.distinct()


def _perspective(user, approval: ApprovalRequest) -> str:
    return 'owner' if _user_owns_approval(user, approval) else 'agency'


# ─────────────────────────────────────────────────────────────────────────────
# 1. List
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_pending(request):
    qs = (
        _accessible_qs(request.user)
        .filter(status='pending')
        .select_related('client', 'relation', 'relation__agency', 'requested_by')
        .order_by('-created_at')[:200]
    )
    out = [_serialize_approval(a, perspective=_perspective(request.user, a)) for a in qs]
    return Response({'count': len(out), 'rows': out})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_history(request):
    qs = (
        _accessible_qs(request.user)
        .exclude(status='pending')
        .select_related('client', 'relation', 'relation__agency', 'requested_by')
        .order_by('-created_at')[:200]
    )
    out = [_serialize_approval(a, perspective=_perspective(request.user, a)) for a in qs]
    return Response({'count': len(out), 'rows': out})


# ─────────────────────────────────────────────────────────────────────────────
# 2. Detail
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_approval(request, approval_id):
    try:
        a = ApprovalRequest.objects.select_related(
            'client', 'relation', 'relation__agency', 'requested_by',
        ).get(pk=approval_id)
    except ApprovalRequest.DoesNotExist:
        return Response({'error': 'approval not found'}, status=404)
    if not _user_can_view(request.user, a):
        return Response({'error': 'forbidden'}, status=403)
    return Response(_serialize_approval(a, perspective=_perspective(request.user, a)))


# ─────────────────────────────────────────────────────────────────────────────
# 3. Approve (owner)
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def approve_approval(request, approval_id):
    """POST {edited_payload?, response?}.

    Owner-only. On success the original action runs via the executor; the
    approval row records both decision metadata and execution result.
    """
    try:
        a = ApprovalRequest.objects.select_related(
            'client', 'relation', 'relation__agency', 'requested_by',
        ).get(pk=approval_id)
    except ApprovalRequest.DoesNotExist:
        return Response({'error': 'approval not found'}, status=404)
    if not _user_owns_approval(request.user, a):
        return Response({'error': 'only the workspace owner can approve'}, status=403)
    if a.status != 'pending':
        return Response({'error': f'already {a.status}'}, status=400)
    if a.expires_at and timezone.now() >= a.expires_at:
        a.status = 'expired'
        a.save(update_fields=['status'])
        return Response({'error': 'this approval has expired'}, status=410)

    data = request.data or {}
    edited = data.get('edited_payload') or {}
    if isinstance(edited, dict) and edited:
        a.edited_payload = edited

    a.status        = 'approved'
    a.user_response = (data.get('response') or '').strip()
    a.decided_at    = timezone.now()
    a.decided_by    = request.user
    a.save(update_fields=['edited_payload', 'status', 'user_response', 'decided_at', 'decided_by'])

    success, msg, result = execute_approval(a)
    a.executed_at      = timezone.now() if success else None
    a.execution_result = {'success': success, 'message': msg, 'result': result}
    a.save(update_fields=['executed_at', 'execution_result'])

    log_activity(
        a.client,
        actor_user=request.user, actor_type='end_user',
        action_type='approval_approved',
        description=(
            f'Approved {a.action_type} requested by {a.relation.agency.name}'
            + ('' if success else f' — execution failed: {msg}')
        ),
        severity='warning' if not success else 'notice',
        target_object_type='ApprovalRequest',
        target_object_id=a.id,
        metadata={'agency_id': a.relation.agency_id, 'success': success, 'message': msg, 'action_type': a.action_type},
    )

    from .notification_dispatcher import dispatch as _dispatch
    _dispatch(
        a.requested_by,
        event_type='approval_decided',
        title=f'{a.client.company} approved your request',
        body=msg,
        data={
            'kind':         'approval_approved',
            'approval_id':  a.id,
            'action_type':  a.action_type,
            'success':      success,
            'client_id':    a.client_id,
        },
    )
    return Response(_serialize_approval(a, perspective='owner'))


# ─────────────────────────────────────────────────────────────────────────────
# 4. Reject (owner)
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reject_approval(request, approval_id):
    """POST {reason}."""
    try:
        a = ApprovalRequest.objects.select_related(
            'client', 'relation', 'relation__agency', 'requested_by',
        ).get(pk=approval_id)
    except ApprovalRequest.DoesNotExist:
        return Response({'error': 'approval not found'}, status=404)
    if not _user_owns_approval(request.user, a):
        return Response({'error': 'only the workspace owner can reject'}, status=403)
    if a.status != 'pending':
        return Response({'error': f'already {a.status}'}, status=400)

    reason = (request.data.get('reason') or '').strip()
    a.status        = 'rejected'
    a.user_response = reason
    a.decided_at    = timezone.now()
    a.decided_by    = request.user
    a.save(update_fields=['status', 'user_response', 'decided_at', 'decided_by'])

    log_activity(
        a.client,
        actor_user=request.user, actor_type='end_user',
        action_type='approval_rejected',
        description=f'Rejected {a.action_type} from {a.relation.agency.name}' + (f' — {reason}' if reason else ''),
        severity='notice',
        target_object_type='ApprovalRequest',
        target_object_id=a.id,
        metadata={'agency_id': a.relation.agency_id, 'reason': reason, 'action_type': a.action_type},
    )

    from .notification_dispatcher import dispatch as _dispatch
    _dispatch(
        a.requested_by,
        event_type='approval_decided',
        title=f'{a.client.company} rejected your request',
        body=reason or '(no reason given)',
        data={
            'kind':        'approval_rejected',
            'approval_id': a.id,
            'action_type': a.action_type,
            'reason':      reason,
            'client_id':   a.client_id,
        },
    )
    return Response(_serialize_approval(a, perspective='owner'))
