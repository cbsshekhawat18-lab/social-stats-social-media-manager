# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Permission enforcement layer for the two-sided marketplace.

This module provides two helpers that mutating views call BEFORE executing
the mutation:

    resolve_acting_context(request, client) -> ('owner'|'superadmin'|'agency'|'forbidden', relation_or_None)

    check_action(request, client, action_key, *, action_type=None,
                 payload=None, target_object_type='', target_object_id=None,
                 preview='') -> ('allowed'|'denied'|'approval_required', extra)

Semantics:
    - Superadmin bypasses everything.
    - Owner (UserProfile.role='client' AND profile.client_id == client.id, OR
      Client.owner_user == request.user) is always allowed for any action on
      their own workspace.
    - Otherwise the user must be an active member of an agency that has an
      *active* AgencyClientRelation against this client, and that relation
      must grant the action_key in its `permissions` dict.
    - If the relation grants the action BUT lists it under
      `requires_approval_for`, the helper creates an ApprovalRequest and
      returns ('approval_required', approval_request). The caller MUST NOT
      proceed with the mutation in that case — it should return 202 with
      {'requires_approval': True, 'approval_id': ar.id}.

Rule-of-thumb: legacy data stays unchanged. The backfill set every
permission to True for every legacy relation, so existing agency staff still
get through this gate untouched.

Note on Rule #9 of the marketplace spec: end-users can ALWAYS disconnect
their platforms even when agency-managed. Callers handling
`disconnect_platforms` should call `check_action` only when the actor is
agency-side; the owner branch passes through naturally.
"""
from __future__ import annotations

from typing import Optional

from .models import (
    AGENCY_CLIENT_PERMISSIONS,
    AgencyClientRelation,
    AgencyMembership,
    ApprovalRequest,
    Client,
)


# ─────────────────────────────────────────────────────────────────────────────
# Acting context resolution
# ─────────────────────────────────────────────────────────────────────────────
def _profile(user):
    return getattr(user, 'profile', None)


def _is_owner(user, client: Client) -> bool:
    """True if `user` owns `client` directly (or is the legacy client-role user
    pointing at it)."""
    if not user or not user.is_authenticated:
        return False
    if client.owner_user_id and client.owner_user_id == user.id:
        return True
    prof = _profile(user)
    if prof and prof.role == 'client' and prof.client_id == client.id:
        return True
    return False


def _is_superadmin(user) -> bool:
    prof = _profile(user)
    return bool(prof and prof.role == 'superadmin')


def _resolve_relation(user, client: Client) -> Optional[AgencyClientRelation]:
    """Find the active AgencyClientRelation that lets `user` act on `client`.

    A user can act on behalf of any agency they are an active member of.
    We pick the relation for the agency they are most likely "currently
    representing" — for now: the one matching `profile.primary_agency` if set,
    else the first active relation found.
    """
    prof = _profile(user)
    if not prof:
        return None

    agency_ids = list(
        AgencyMembership.objects.filter(user=user, is_active=True)
        .values_list('agency_id', flat=True)
    )
    if not agency_ids:
        return None

    qs = AgencyClientRelation.objects.filter(
        client=client, agency_id__in=agency_ids, status='active',
    )
    if prof.primary_agency_id:
        primary = qs.filter(agency_id=prof.primary_agency_id).first()
        if primary:
            return primary
    return qs.first()


def resolve_acting_context(request, client: Client):
    """Return (role, relation_or_None).

    role is one of 'superadmin', 'owner', 'agency', 'forbidden'.
    """
    user = getattr(request, 'user', None)
    if not user or not user.is_authenticated:
        return ('forbidden', None)
    if _is_superadmin(user):
        return ('superadmin', None)
    if _is_owner(user, client):
        return ('owner', None)
    relation = _resolve_relation(user, client)
    if relation:
        return ('agency', relation)
    return ('forbidden', None)


# ─────────────────────────────────────────────────────────────────────────────
# Action check (the call sites use this)
# ─────────────────────────────────────────────────────────────────────────────
def check_action(
    request,
    client: Client,
    action_key: str,
    *,
    action_type: Optional[str] = None,
    payload: Optional[dict] = None,
    target_object_type: str = '',
    target_object_id: Optional[int] = None,
    preview: str = '',
):
    """Check whether the request may perform `action_key` on `client`.

    Returns one of:
        ('allowed',           {'role': 'superadmin'|'owner'|'agency', 'relation': r|None})
        ('denied',            {'reason': str})
        ('approval_required', {'approval': ApprovalRequest, 'relation': r})

    `action_key` must be a key in AGENCY_CLIENT_PERMISSIONS.

    `action_type` (free-form string like 'publish_post', 'send_campaign')
    is recorded on the ApprovalRequest when one is created. If omitted,
    the action_key is used.
    """
    if action_key not in AGENCY_CLIENT_PERMISSIONS:
        return ('denied', {'reason': f'unknown action: {action_key}'})

    role, relation = resolve_acting_context(request, client)

    if role in ('superadmin', 'owner'):
        return ('allowed', {'role': role, 'relation': None})

    if role == 'forbidden':
        return ('denied', {'reason': 'no active agency relation for this workspace'})

    # role == 'agency'
    if not relation.can(action_key):
        return ('denied', {
            'reason': f'agency does not have permission "{action_key}" on this workspace',
        })

    if relation.needs_approval(action_key):
        ar = ApprovalRequest.objects.create(
            relation=relation,
            client=client,
            requested_by=request.user,
            action_type=(action_type or action_key),
            payload=payload or {},
            preview=preview,
            target_object_type=target_object_type,
            target_object_id=target_object_id,
        )
        if client.owner_user_id:
            from django.conf import settings
            from .notification_dispatcher import dispatch as dispatch_notification
            frontend = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
            dispatch_notification(
                client.owner_user,
                event_type='approval_requested',
                title=f'{relation.agency.name} needs your approval',
                body=(preview or f'They want to: {action_type or action_key}')[:300],
                cta_url=f'{frontend}/u/approvals',
                cta_label='Review approval',
                data={
                    'kind':         'approval_requested',
                    'approval_id':  ar.id,
                    'agency_name':  relation.agency.name,
                    'action_type':  action_type or action_key,
                    'expires_at':   ar.expires_at.isoformat() if ar.expires_at else None,
                },
            )
        return ('approval_required', {'approval': ar, 'relation': relation})

    return ('allowed', {'role': 'agency', 'relation': relation})


# ─────────────────────────────────────────────────────────────────────────────
# Convenience: turn a check result into a DRF Response
# ─────────────────────────────────────────────────────────────────────────────
def deny_response(reason: str, status_code: int = 403):
    from rest_framework.response import Response
    return Response({'error': reason}, status=status_code)


def approval_pending_response(approval: ApprovalRequest):
    """Standard 202 envelope when an action is intercepted for approval."""
    from rest_framework.response import Response
    return Response(
        {
            'requires_approval': True,
            'approval_id':       approval.id,
            'action_type':       approval.action_type,
            'expires_at':        approval.expires_at.isoformat(),
            'message':           f'Submitted to {approval.client.company} for approval.',
        },
        status=202,
    )
