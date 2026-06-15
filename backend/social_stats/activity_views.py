# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
ActivityLog endpoints (the user-facing audit feed).

Endpoints:
    GET  /api/activity/             — list activity for the current context
    POST /api/activity/<id>/flag/   — owner flags an action as suspicious

Filters:
    ?client_id=<id>   — restrict to one workspace (default: any visible to user)
    ?actor_type=...   — filter by 'end_user' | 'agency' | 'system' | 'ai'
    ?action_type=...
    ?severity=...
    ?flagged=1
    ?from=<iso>&to=<iso>
    ?limit=<n> (default 100, max 500)

Visibility:
    - Workspace owner sees all rows for their workspaces.
    - Agency members see rows for clients their agency manages.
    - Superadmin sees everything.
"""
from __future__ import annotations

import csv
import io

from django.http import StreamingHttpResponse
from django.utils.dateparse import parse_datetime
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .activity_logger import log_activity
from .activity_reverters import revert_activity as _do_revert
from .models import (
    ActivityLog, AgencyMembership, AgencyClientRelation, Client,
)
from .marketplace_permissions import _is_owner, _is_superadmin


def _accessible_client_ids(user) -> tuple[set[int], bool]:
    """Return (set of client ids visible to this user, is_superadmin).

    Includes:
      - clients owned by this user
      - clients linked via legacy UserProfile.client (role='client')
      - clients accessible through any active AgencyClientRelation where the
        user is an active agency member
    """
    if _is_superadmin(user):
        return (set(), True)

    ids = set(Client.objects.filter(owner_user=user).values_list('id', flat=True))

    profile = getattr(user, 'profile', None)
    if profile and profile.role == 'client' and profile.client_id:
        ids.add(profile.client_id)

    agency_ids = list(
        AgencyMembership.objects.filter(user=user, is_active=True)
        .values_list('agency_id', flat=True)
    )
    if agency_ids:
        ids.update(
            AgencyClientRelation.objects
            .filter(agency_id__in=agency_ids)
            .values_list('client_id', flat=True)
        )
    return (ids, False)


def _serialize_activity(row: ActivityLog) -> dict:
    return {
        'id':                row.id,
        'client_id':         row.client_id,
        'actor_user_id':     row.actor_user_id,
        'actor_user_email':  row.actor_user.email if row.actor_user else None,
        'actor_user_name':   (row.actor_user.get_full_name() if row.actor_user else '') or '',
        'actor_agency_id':   row.actor_agency_id,
        'actor_agency_name': row.actor_agency.name if row.actor_agency else None,
        'actor_type':        row.actor_type,
        'action_type':       row.action_type,
        'severity':          row.severity,
        'target_object_type': row.target_object_type,
        'target_object_id':  row.target_object_id,
        'description':       row.description,
        'metadata':          row.metadata,
        'is_reversible':     row.is_reversible,
        'reverted_at':       row.reverted_at.isoformat() if row.reverted_at else None,
        'flagged_by_user':   row.flagged_by_user,
        'flagged_at':        row.flagged_at.isoformat() if row.flagged_at else None,
        'created_at':        row.created_at.isoformat() if row.created_at else None,
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_activity(request):
    user = request.user
    ids, sa = _accessible_client_ids(user)
    qs = ActivityLog.objects.select_related('actor_user', 'actor_agency').order_by('-created_at')
    if not sa:
        if not ids:
            return Response({'count': 0, 'rows': []})
        qs = qs.filter(client_id__in=ids)

    p = request.query_params
    if p.get('client_id'):
        try:
            qs = qs.filter(client_id=int(p['client_id']))
        except (TypeError, ValueError):
            pass
    if p.get('actor_type'):
        qs = qs.filter(actor_type=p['actor_type'])
    if p.get('action_type'):
        qs = qs.filter(action_type=p['action_type'])
    if p.get('severity'):
        qs = qs.filter(severity=p['severity'])
    if p.get('flagged'):
        qs = qs.filter(flagged_by_user=True)
    if p.get('from'):
        dt = parse_datetime(p['from'])
        if dt: qs = qs.filter(created_at__gte=dt)
    if p.get('to'):
        dt = parse_datetime(p['to'])
        if dt: qs = qs.filter(created_at__lte=dt)

    try:
        limit = max(1, min(int(p.get('limit', 100) or 100), 500))
    except (TypeError, ValueError):
        limit = 100

    rows = list(qs[:limit])
    return Response({
        'count': len(rows),
        'rows':  [_serialize_activity(r) for r in rows],
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def flag_activity(request, activity_id):
    try:
        row = ActivityLog.objects.select_related('client').get(pk=activity_id)
    except ActivityLog.DoesNotExist:
        return Response({'error': 'activity not found'}, status=404)
    if not _is_superadmin(request.user) and not _is_owner(request.user, row.client):
        return Response({'error': 'only the workspace owner can flag activity'}, status=403)
    if row.flagged_by_user:
        return Response(_serialize_activity(row))

    row.flagged_by_user = True
    row.flagged_at = timezone.now()
    if 'reason' in (request.data or {}):
        meta = dict(row.metadata or {})
        meta['flag_reason'] = (request.data['reason'] or '').strip()
        row.metadata = meta
    row.save(update_fields=['flagged_by_user', 'flagged_at', 'metadata'])

    return Response(_serialize_activity(row))


# ─────────────────────────────────────────────────────────────────────────────
# Revert ()
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def revert_activity(request, activity_id):
    """Owner-only. Dispatches by action_type via activity_reverters.py."""
    try:
        row = ActivityLog.objects.select_related('client').get(pk=activity_id)
    except ActivityLog.DoesNotExist:
        return Response({'error': 'activity not found'}, status=404)
    if not _is_superadmin(request.user) and not _is_owner(request.user, row.client):
        return Response({'error': 'only the workspace owner can revert activity'}, status=403)

    success, message, meta = _do_revert(row, request.user)
    if not success:
        return Response({'ok': False, 'error': message, 'meta': meta}, status=400)

    row.reverted_at = timezone.now()
    row.reverted_by = request.user
    row.save(update_fields=['reverted_at', 'reverted_by'])

    # Trail the revert as its own activity row so both show up in the feed.
    log_activity(
        row.client,
        actor_user=request.user,
        actor_type='end_user',
        action_type=f'reverted_{row.action_type}',
        description=f'Reverted: {row.description}',
        severity='warning',
        target_object_type=row.target_object_type,
        target_object_id=row.target_object_id,
        metadata={'reverted_activity_id': row.id, **(meta or {})},
    )
    return Response({'ok': True, 'message': message, 'activity': _serialize_activity(row)})


# ─────────────────────────────────────────────────────────────────────────────
# CSV export ()
# ─────────────────────────────────────────────────────────────────────────────
def _csv_iter(rows):
    """Stream CSV row-by-row so a large feed doesn't pin the worker."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    header = [
        'id', 'client_id', 'created_at', 'severity', 'actor_type',
        'actor_user_email', 'actor_agency_name',
        'action_type', 'target_object_type', 'target_object_id',
        'description', 'is_reversible', 'reverted_at',
        'flagged_by_user', 'flagged_at',
    ]
    writer.writerow(header)
    yield buf.getvalue(); buf.seek(0); buf.truncate()

    for r in rows:
        writer.writerow([
            r.id,
            r.client_id,
            r.created_at.isoformat() if r.created_at else '',
            r.severity,
            r.actor_type,
            r.actor_user.email if r.actor_user else '',
            r.actor_agency.name if r.actor_agency else '',
            r.action_type,
            r.target_object_type,
            r.target_object_id or '',
            r.description.replace('\n', ' ').strip(),
            int(r.is_reversible),
            r.reverted_at.isoformat() if r.reverted_at else '',
            int(r.flagged_by_user),
            r.flagged_at.isoformat() if r.flagged_at else '',
        ])
        yield buf.getvalue(); buf.seek(0); buf.truncate()


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_activity_csv(request):
    """Streams a CSV of the visible activity feed honouring the same filters
    as `list_activity`. No row-cap (use filters to keep the file sane)."""
    user = request.user
    ids, sa = _accessible_client_ids(user)
    qs = ActivityLog.objects.select_related('actor_user', 'actor_agency').order_by('-created_at')
    if not sa:
        if not ids:
            qs = qs.none()
        else:
            qs = qs.filter(client_id__in=ids)

    p = request.query_params
    if p.get('client_id'):
        try: qs = qs.filter(client_id=int(p['client_id']))
        except (TypeError, ValueError): pass
    if p.get('actor_type'):  qs = qs.filter(actor_type=p['actor_type'])
    if p.get('action_type'): qs = qs.filter(action_type=p['action_type'])
    if p.get('severity'):    qs = qs.filter(severity=p['severity'])
    if p.get('flagged'):     qs = qs.filter(flagged_by_user=True)
    if p.get('from'):
        dt = parse_datetime(p['from'])
        if dt: qs = qs.filter(created_at__gte=dt)
    if p.get('to'):
        dt = parse_datetime(p['to'])
        if dt: qs = qs.filter(created_at__lte=dt)

    qs = qs.iterator()
    response = StreamingHttpResponse(_csv_iter(qs), content_type='text/csv')
    filename = f'socialstats-activity-{timezone.now().date().isoformat()}.csv'
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response
