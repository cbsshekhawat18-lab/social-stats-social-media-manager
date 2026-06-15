# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
ActivityLog hook helpers.

ActivityLog is the user-facing audit trail (distinct from ActionLog, which is
the technical/operational log). Mutating views call `log_activity(...)` after
a successful mutation so the end-user sees in their Activity feed who did
what, when, and on what target.
"""
from __future__ import annotations

from typing import Optional

from .models import ActivityLog, AgencyMembership, Client


def _resolve_actor(user) -> tuple[str, Optional[int]]:
    """Return (actor_type, actor_agency_id_or_None) for ActivityLog.

    Heuristic: an authenticated user with at least one active AgencyMembership
    counts as 'agency'. A client-role user (or the workspace owner) counts as
    'end_user'. AnonymousUser/None counts as 'system'.
    """
    if not user or not getattr(user, 'is_authenticated', False):
        return ('system', None)

    profile = getattr(user, 'profile', None)
    membership = (
        AgencyMembership.objects.filter(user=user, is_active=True)
        .order_by('joined_at').first()
    )
    if membership:
        # Prefer primary_agency on the profile when set.
        primary_id = getattr(profile, 'primary_agency_id', None)
        if primary_id and AgencyMembership.objects.filter(
            user=user, agency_id=primary_id, is_active=True,
        ).exists():
            return ('agency', primary_id)
        return ('agency', membership.agency_id)

    if profile and profile.role == 'client':
        return ('end_user', None)
    return ('system', None)


def log_activity(
    client: Client,
    *,
    action_type: str,
    description: str,
    actor_user=None,
    actor_type: Optional[str] = None,
    actor_agency_id: Optional[int] = None,
    severity: str = 'info',
    target_object_type: str = '',
    target_object_id: Optional[int] = None,
    metadata: Optional[dict] = None,
    is_reversible: bool = False,
) -> ActivityLog:
    """Write a single ActivityLog row.

    If `actor_type` / `actor_agency_id` are not supplied and `actor_user` is,
    they are resolved automatically.
    """
    if actor_type is None:
        actor_type, resolved_agency_id = _resolve_actor(actor_user)
        if actor_agency_id is None:
            actor_agency_id = resolved_agency_id

    return ActivityLog.objects.create(
        client=client,
        actor_user=actor_user,
        actor_agency_id=actor_agency_id,
        actor_type=actor_type,
        action_type=action_type,
        severity=severity,
        target_object_type=target_object_type,
        target_object_id=target_object_id,
        description=description,
        metadata=metadata or {},
        is_reversible=is_reversible,
    )


def log_activity_for_request(request, client: Client, **kwargs) -> ActivityLog:
    """Convenience wrapper used by view code: pulls actor_user from the request."""
    return log_activity(client, actor_user=request.user, **kwargs)
