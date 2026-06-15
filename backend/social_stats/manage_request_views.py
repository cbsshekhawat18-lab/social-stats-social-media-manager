# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Manage Request flow (agency invites end-user to be managed).

Endpoints:
    POST   /api/manage-request/send/                  (agency)
    GET    /api/manage-request/sent/                  (agency — alias for /inbox/)
    DELETE /api/manage-request/<id>/                  (agency cancels)
    GET    /api/manage-invite/<token>/                (public — fetch details)
    POST   /api/manage-invite/<token>/accept/         (auth user accepts)
    POST   /api/manage-invite/<token>/decline/        (auth user declines)
    GET    /api/end-user/incoming-requests/           (current user's pending)

Acceptance creates an `AgencyClientRelation(status='active')` with the
proposed permissions, sets ManageRequest.status='accepted', writes an
ActivityLog entry and notifies the agency.
"""
from __future__ import annotations

import logging

from django.conf import settings
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .activity_logger import log_activity
from .auth_views import _email_html
from .models import (
    AGENCY_CLIENT_PERMISSIONS,
    Agency,
    AgencyClientRelation,
    AgencyMembership,
    Client,
    ManageRequest,
    UserProfile,
)


logger = logging.getLogger(__name__)

FRONTEND_URL = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
FROM_EMAIL   = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@socialstats.app')

ALLOWED_AGENCY_ROLES = ('owner', 'admin', 'manager')


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
def _resolve_acting_agency(user) -> tuple[Agency | None, str]:
    """Return (agency, role) the user can act as. Prefers profile.primary_agency
    when set; falls back to the first active membership."""
    profile = getattr(user, 'profile', None)
    primary_id = getattr(profile, 'primary_agency_id', None)
    if primary_id:
        m = AgencyMembership.objects.filter(
            user=user, agency_id=primary_id, is_active=True,
        ).first()
        if m:
            return (m.agency, m.role)
    m = AgencyMembership.objects.filter(user=user, is_active=True).select_related('agency').first()
    if m:
        return (m.agency, m.role)
    return (None, '')


def _serialize_agency_public(agency: Agency) -> dict:
    return {
        'id':           agency.id,
        'name':         agency.name,
        'slug':         agency.slug,
        'logo_url':     agency.logo_url,
        'description':  agency.description,
        'website':      agency.website,
        'location':     ', '.join([p for p in (agency.location_city, agency.location_country) if p]),
        'is_verified':  agency.is_verified,
        'avg_rating':   agency.avg_rating,
        'review_count': agency.review_count,
    }


def _serialize_request(req: ManageRequest, *, include_token=False) -> dict:
    out = {
        'id':                  req.id,
        'agency':              _serialize_agency_public(req.agency),
        'target_email':        req.target_email,
        'target_phone':        req.target_phone,
        'target_user_id':      req.target_user_id,
        'target_client_id':    req.target_client_id,
        'proposed_permissions': req.proposed_permissions,
        'proposed_message':    req.proposed_message,
        'proposed_pricing':    float(req.proposed_pricing) if req.proposed_pricing is not None else None,
        'proposed_services':   req.proposed_services,
        'status':              req.status,
        'sent_at':             req.sent_at.isoformat() if req.sent_at else None,
        'viewed_at':           req.viewed_at.isoformat() if req.viewed_at else None,
        'decided_at':          req.decided_at.isoformat() if req.decided_at else None,
        'expires_at':          req.expires_at.isoformat() if req.expires_at else None,
        'decline_reason':      req.decline_reason,
        'resulting_relation_id': req.resulting_relation_id,
    }
    if include_token:
        out['token'] = str(req.token)
    return out


def _validate_permissions_payload(payload) -> dict:
    """Coerce a partial permission dict into a fully-keyed map matching
    AGENCY_CLIENT_PERMISSIONS — defaults missing keys to False, ignores extras."""
    if not isinstance(payload, dict):
        payload = {}
    return {key: bool(payload.get(key, False)) for key in AGENCY_CLIENT_PERMISSIONS}


def _send_manage_request_email(req: ManageRequest):
    agency_name = req.agency.name
    link = f"{FRONTEND_URL}/invite/{req.token}"
    subject = f"{agency_name} wants to manage your social media on Social Stats"

    granted_keys = sorted([k for k, v in (req.proposed_permissions or {}).items() if v])
    perm_chips = ''.join(
        f'<span style="display:inline-block;padding:3px 9px;margin:2px 4px 2px 0;background:#e0f7ff;'
        f'color:#006080;border-radius:99px;font-size:11px;font-weight:600;">{k}</span>'
        for k in granted_keys[:8]
    )
    if len(granted_keys) > 8:
        perm_chips += f'<span style="font-size:12px;color:#64748b;">+{len(granted_keys) - 8} more</span>'

    greeting = (
        f'<strong style="color:#0f172a;">{agency_name}</strong> would like to help manage your '
        'social media accounts on Social Stats. You stay in control — you can pause or terminate at any time.'
    )
    body_html = (
        f'<div style="background:linear-gradient(135deg,#f0f9ff,#f8faff);border:1px solid rgba(0,215,255,0.18);'
        f'border-radius:14px;padding:20px 24px;margin:0 0 16px;">'
        f'<p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#00b8d9;text-transform:uppercase;letter-spacing:0.08em;">Message from {agency_name}</p>'
        f'<p style="margin:0;font-size:15px;color:#1e293b;line-height:1.7;">{req.proposed_message or "(no message)"}</p>'
        f'</div>'
        f'<div style="margin:0 0 16px;font-size:13px;color:#64748b;">'
        f'<strong style="color:#0f172a;">What they\'re asking to do:</strong><br>{perm_chips or "—"}'
        f'</div>'
    )
    plain = (
        f"{agency_name} would like to manage your social media accounts on Social Stats.\n\n"
        f'Message: {req.proposed_message or "(none)"}\n\n'
        f'Review and respond: {link}\n\n'
        f'This invitation expires in 7 days. You can pause or terminate at any time after accepting.\n'
    )
    html = _email_html(
        title='Manage-account invitation',
        greeting=greeting,
        body_html=body_html,
        cta_url=link,
        cta_label='Review the invitation',
        expiry_note='&#9203; This invitation expires in <strong>7 days</strong>.',
        frontend_url=FRONTEND_URL,
    )
    try:
        send_mail(subject, plain, FROM_EMAIL, [req.target_email],
                  html_message=html, fail_silently=True)
    except Exception:
        logger.exception('manage_request: failed to send email to %s', req.target_email)


# ─────────────────────────────────────────────────────────────────────────────
# 1. Send (agency)
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_manage_request(request):
    """POST {target_email, target_phone?, target_client_id?, proposed_permissions,
    proposed_message?, proposed_pricing?, proposed_services?}."""
    agency, role = _resolve_acting_agency(request.user)
    if not agency or role not in ALLOWED_AGENCY_ROLES:
        return Response({'error': 'Only agency owners/admins/managers can invite clients.'}, status=403)

    data = request.data or {}
    target_email = (data.get('target_email') or '').strip().lower()
    target_phone = (data.get('target_phone') or '').strip()
    if not target_email:
        return Response({'error': 'target_email is required'}, status=400)

    proposed = _validate_permissions_payload(data.get('proposed_permissions'))

    # If the email matches an existing user, attach for in-app notification
    target_user = User.objects.filter(email__iexact=target_email).first()

    # Optional pre-existing client (existing agency-side workflow)
    target_client = None
    target_client_id = data.get('target_client_id')
    if target_client_id:
        target_client = Client.objects.filter(id=target_client_id).first()

    # Reject duplicate active relation
    if target_client and AgencyClientRelation.objects.filter(
        agency=agency, client=target_client, status__in=('active', 'pending'),
    ).exists():
        return Response({'error': 'A relation with this client is already active or pending.'}, status=409)

    from .usage_limits import check_agency_limit
    ok, reason, info = check_agency_limit(agency, 'managed_clients')
    if not ok:
        return Response({'error': reason, 'limit': info}, status=402)

    from datetime import timedelta as _td
    DAILY_INVITE_LIMIT = 50
    cutoff = timezone.now() - _td(hours=24)
    recent = ManageRequest.objects.filter(agency=agency, sent_at__gte=cutoff).count()
    if recent >= DAILY_INVITE_LIMIT:
        return Response({
            'error': f'Daily invite limit reached ({DAILY_INVITE_LIMIT}/24h). Try again tomorrow or contact support.',
            'limit': {'sent_24h': recent, 'cap': DAILY_INVITE_LIMIT},
        }, status=429)

    pricing = data.get('proposed_pricing')
    try:
        pricing = float(pricing) if pricing not in (None, '') else None
    except (TypeError, ValueError):
        pricing = None

    with transaction.atomic():
        req = ManageRequest.objects.create(
            agency=agency,
            target_email=target_email,
            target_phone=target_phone,
            target_user=target_user,
            target_client=target_client,
            proposed_permissions=proposed,
            proposed_message=(data.get('proposed_message') or '').strip(),
            proposed_pricing=pricing,
            proposed_services=data.get('proposed_services') or [],
        )

        if target_user:
            # In-app only — `_send_manage_request_email` below sends a richer
            # email (with perm chips) regardless, and we don't want a duplicate.
            from .notification_dispatcher import dispatch as dispatch_notification
            dispatch_notification(
                target_user,
                event_type='manage_request_received',
                title=f'{agency.name} wants to manage your account',
                body=req.proposed_message or '(no message)',
                notif_type='manage_request_received',
                channels=['in_app'],
                data={
                    'kind':         'manage_request',
                    'token':        str(req.token),
                    'agency_name':  agency.name,
                    'agency_slug':  agency.slug,
                    'request_id':   req.id,
                    'expires_at':   req.expires_at.isoformat(),
                },
            )

    _send_manage_request_email(req)
    return Response(_serialize_request(req, include_token=True), status=201)


# ─────────────────────────────────────────────────────────────────────────────
# 2. Sent / inbox (agency)
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_sent_requests(request):
    agency, role = _resolve_acting_agency(request.user)
    if not agency:
        return Response({'requests': []})

    status_filter = request.query_params.get('status')
    qs = ManageRequest.objects.filter(agency=agency).select_related('agency')
    if status_filter:
        qs = qs.filter(status=status_filter)
    qs = qs.order_by('-sent_at')[:200]

    return Response({'requests': [_serialize_request(r, include_token=True) for r in qs]})


# ─────────────────────────────────────────────────────────────────────────────
# 3. Cancel (agency)
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def cancel_manage_request(request, request_id):
    try:
        req = ManageRequest.objects.select_related('agency').get(pk=request_id)
    except ManageRequest.DoesNotExist:
        return Response({'error': 'request not found'}, status=404)

    agency, role = _resolve_acting_agency(request.user)
    if not agency or req.agency_id != agency.id or role not in ALLOWED_AGENCY_ROLES:
        return Response({'error': 'forbidden'}, status=403)

    if req.status not in ('sent', 'viewed'):
        return Response({'error': f'cannot cancel a {req.status} request'}, status=400)

    req.status = 'cancelled'
    req.decided_at = timezone.now()
    req.save(update_fields=['status', 'decided_at'])

    if req.target_user:
        from .notification_dispatcher import dispatch as _dispatch
        _dispatch(
            req.target_user,
            event_type='manage_request_cancelled',
            notif_type='manage_request_cancelled',
            title=f'{req.agency.name} cancelled their invitation',
            data={'kind': 'manage_request', 'request_id': req.id},
        )

    return Response({'id': req.id, 'status': req.status})


# ─────────────────────────────────────────────────────────────────────────────
# 4. Public fetch (anyone with token)
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([AllowAny])
def get_manage_invite(request, token):
    try:
        req = ManageRequest.objects.select_related('agency').get(token=token)
    except (ManageRequest.DoesNotExist, ValueError):
        return Response({'error': 'invitation not found'}, status=404)

    is_expired = req.expires_at and timezone.now() >= req.expires_at
    if is_expired and req.status == 'sent':
        req.status = 'expired'
        req.save(update_fields=['status'])

    # Mark "viewed" the first time the link is opened
    if req.status == 'sent' and not req.viewed_at:
        req.status   = 'viewed'
        req.viewed_at = timezone.now()
        req.save(update_fields=['status', 'viewed_at'])

    payload = _serialize_request(req)
    # Include AGENCY_CLIENT_PERMISSIONS metadata so the public page can render
    # human-friendly labels next to the booleans without an extra API call.
    payload['permission_catalog'] = AGENCY_CLIENT_PERMISSIONS
    payload['is_expired'] = is_expired
    return Response(payload)


# ─────────────────────────────────────────────────────────────────────────────
# 5. Accept (auth user)
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def accept_manage_invite(request, token):
    """POST {permissions_overrides?, requires_approval_for?, notes?}.

    The accepting user must match req.target_email. They must have a workspace —
    if `target_client` is set we use that; otherwise we use their default
    workspace; otherwise we error.
    """
    try:
        req = ManageRequest.objects.select_related('agency').get(token=token)
    except (ManageRequest.DoesNotExist, ValueError):
        return Response({'error': 'invitation not found'}, status=404)

    if req.status not in ('sent', 'viewed'):
        return Response({'error': f'invitation already {req.status}'}, status=400)
    if req.expires_at and timezone.now() >= req.expires_at:
        req.status = 'expired'
        req.save(update_fields=['status'])
        return Response({'error': 'invitation has expired'}, status=410)
    if (request.user.email or '').lower() != req.target_email.lower():
        return Response({'error': 'this invitation is not for your email address'}, status=403)

    profile = getattr(request.user, 'profile', None)
    workspace = req.target_client or (profile.default_workspace if profile else None) or \
        Client.objects.filter(owner_user=request.user).order_by('id').first()
    if not workspace:
        return Response({'error': 'no workspace found for your account; finish onboarding first'}, status=400)

    if AgencyClientRelation.objects.filter(
        agency=req.agency, client=workspace, status__in=('active', 'pending'),
    ).exists():
        return Response({'error': 'a relation with this agency is already active or pending'}, status=409)

    from .usage_limits import check_limit
    ok, reason, info = check_limit(workspace, 'active_relations')
    if not ok:
        return Response({'error': reason, 'limit': info}, status=402)

    data = request.data or {}
    overrides = data.get('permissions_overrides') or {}
    final_perms = dict(req.proposed_permissions or {})
    for k, v in overrides.items():
        if k in AGENCY_CLIENT_PERMISSIONS:
            final_perms[k] = bool(v)
    requires_approval_for = [
        k for k in (data.get('requires_approval_for') or []) if k in AGENCY_CLIENT_PERMISSIONS
    ]
    notes = (data.get('notes') or '').strip()

    with transaction.atomic():
        relation = AgencyClientRelation.objects.create(
            agency=req.agency,
            client=workspace,
            status='active',
            initiated_by='agency',
            initiated_by_user=request.user,
            permissions=final_perms,
            requires_approval_for=requires_approval_for,
            approved_at=timezone.now(),
            notes_from_user=notes,
        )
        req.status     = 'accepted'
        req.decided_at = timezone.now()
        req.target_user   = req.target_user or request.user
        req.target_client = workspace
        req.resulting_relation = relation
        req.save(update_fields=[
            'status', 'decided_at', 'target_user', 'target_client', 'resulting_relation',
        ])

        log_activity(
            workspace,
            actor_user=request.user,
            actor_type='end_user',
            action_type='agency_relation_accepted',
            description=f'Accepted management invitation from {req.agency.name}',
            severity='notice',
            metadata={
                'agency_id':   req.agency_id,
                'agency_name': req.agency.name,
                'request_id':  req.id,
                'permissions_granted': sorted([k for k, v in final_perms.items() if v]),
            },
            target_object_type='AgencyClientRelation',
            target_object_id=relation.id,
        )

    from .notification_dispatcher import dispatch as _dispatch
    _dispatch(
        req.agency.owner_user,
        event_type='manage_request_accepted',
        notif_type='manage_request_accepted',
        title=f'{request.user.get_full_name() or request.user.email} accepted your invitation',
        body=f'You can now manage {workspace.company}.',
        data={
            'kind':         'manage_request',
            'request_id':   req.id,
            'relation_id':  relation.id,
            'client_id':    workspace.id,
            'client_name':  workspace.company,
        },
    )

    return Response({
        'id':          req.id,
        'status':      req.status,
        'relation_id': relation.id,
        'workspace_id': workspace.id,
    })


# ─────────────────────────────────────────────────────────────────────────────
# 6. Decline (auth user)
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def decline_manage_invite(request, token):
    try:
        req = ManageRequest.objects.select_related('agency').get(token=token)
    except (ManageRequest.DoesNotExist, ValueError):
        return Response({'error': 'invitation not found'}, status=404)

    if req.status not in ('sent', 'viewed'):
        return Response({'error': f'invitation already {req.status}'}, status=400)
    if (request.user.email or '').lower() != req.target_email.lower():
        return Response({'error': 'this invitation is not for your email address'}, status=403)

    reason = (request.data.get('reason') or '').strip()
    req.status = 'declined'
    req.decided_at = timezone.now()
    req.decline_reason = reason
    req.save(update_fields=['status', 'decided_at', 'decline_reason'])

    from .notification_dispatcher import dispatch as _dispatch
    _dispatch(
        req.agency.owner_user,
        event_type='manage_request_declined',
        notif_type='manage_request_declined',
        title=f'{request.user.get_full_name() or request.user.email} declined your invitation',
        body=reason or '(no reason given)',
        data={'kind': 'manage_request', 'request_id': req.id, 'reason': reason},
    )
    return Response({'id': req.id, 'status': req.status})


# ─────────────────────────────────────────────────────────────────────────────
# 7. Incoming requests for the current end-user
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_incoming_requests(request):
    email = (request.user.email or '').lower()
    qs = (
        ManageRequest.objects
        .filter(target_email__iexact=email, status__in=('sent', 'viewed'))
        .select_related('agency')
        .order_by('-sent_at')
    )
    return Response({'requests': [_serialize_request(r, include_token=True) for r in qs]})
