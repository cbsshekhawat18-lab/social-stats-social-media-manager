# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
User invites agency (reverse direction).

Endpoints:
    POST /api/end-user/invite-agency/             (auth user → AgencyInviteFromUser)
    GET  /api/end-user/sent-agency-invites/       (auth user lists their sent invites)
    GET  /api/agency-invite/<token>/              (public — for the agency response page)
    POST /api/agency-invite/<token>/accept/       (agency-member accepts; relation is created)
    POST /api/agency-invite/<token>/decline/      (agency-member declines)
    GET  /api/agency/<slug>/incoming-invites/     (agency-side list for the agency owner/admin)

Acceptance creates an `AgencyClientRelation(status='active', initiated_by='end_user')`
with the proposed permissions (the agency cannot widen them at accept time).
"""
from __future__ import annotations

import logging

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .activity_logger import log_activity
from .auth_views import _email_html
from .marketplace_permissions import _is_owner
from .models import (
    AGENCY_CLIENT_PERMISSIONS,
    Agency,
    AgencyClientRelation,
    AgencyInviteFromUser,
    AgencyMembership,
    Client,
)


logger = logging.getLogger(__name__)

FRONTEND_URL = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
FROM_EMAIL   = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@socialstats.app')


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
def _validate_permissions_payload(payload) -> dict:
    if not isinstance(payload, dict):
        payload = {}
    return {key: bool(payload.get(key, False)) for key in AGENCY_CLIENT_PERMISSIONS}


def _resolve_target_agency(data) -> tuple[Agency | None, str, dict | None]:
    """Returns (agency_or_None, target_email, errors_or_None)."""
    agency_id   = data.get('target_agency_id')
    agency_slug = data.get('target_agency_slug')
    target_email = (data.get('target_agency_email') or '').strip().lower()

    if agency_id:
        try:
            return (Agency.objects.get(pk=int(agency_id)), '', None)
        except (Agency.DoesNotExist, TypeError, ValueError):
            return (None, '', {'target_agency_id': 'agency not found'})
    if agency_slug:
        try:
            return (Agency.objects.get(slug=agency_slug), '', None)
        except Agency.DoesNotExist:
            return (None, '', {'target_agency_slug': 'agency not found'})
    if target_email:
        # Maybe this email matches an existing agency owner
        agency = Agency.objects.filter(owner_user__email__iexact=target_email).first()
        return (agency, target_email, None)
    return (None, '', {'target_agency': 'pick an agency or provide an email'})


def _resolve_user_workspace(user, data) -> Client | None:
    """Pick which workspace this invite is for."""
    cid = data.get('client_id')
    if cid:
        c = Client.objects.filter(pk=cid).first()
        if c and _is_owner(user, c):
            return c
    profile = getattr(user, 'profile', None)
    if profile and profile.default_workspace_id:
        return profile.default_workspace
    return Client.objects.filter(owner_user=user).order_by('id').first()


def _serialize_invite(inv: AgencyInviteFromUser, *, perspective: str = 'user',
                      include_token: bool = False) -> dict:
    out = {
        'id':                  inv.id,
        'inviter_user_id':     inv.inviter_user_id,
        'inviter_user_name':   (inv.inviter_user.get_full_name() or '').strip() or inv.inviter_user.email,
        'inviter_user_email':  inv.inviter_user.email,
        'client_id':           inv.client_id,
        'client_company':      inv.client.company,
        'client_industry':     inv.client.industry,
        'target_agency_id':    inv.target_agency_id,
        'target_agency_name':  inv.target_agency.name if inv.target_agency else None,
        'target_agency_slug':  inv.target_agency.slug if inv.target_agency else None,
        'target_agency_email': inv.target_agency_email,
        'proposed_permissions': inv.proposed_permissions,
        'message':             inv.message,
        'desired_services':    inv.desired_services,
        'budget_range':        inv.budget_range,
        'status':              inv.status,
        'sent_at':             inv.sent_at.isoformat() if inv.sent_at else None,
        'decided_at':          inv.decided_at.isoformat() if inv.decided_at else None,
        'expires_at':          inv.expires_at.isoformat() if inv.expires_at else None,
        'resulting_relation_id': inv.resulting_relation_id,
        'perspective':         perspective,
    }
    if include_token:
        out['token'] = str(inv.token)
    return out


def _send_invite_email(inv: AgencyInviteFromUser):
    target_email = (inv.target_agency.owner_user.email if inv.target_agency else inv.target_agency_email)
    if not target_email:
        return
    inviter_name = inv.inviter_user.get_full_name() or inv.inviter_user.email
    link = f"{FRONTEND_URL}/agency-invite/{inv.token}"
    subject = f"{inviter_name} ({inv.client.company}) wants you to manage their social on Social Stats"

    granted = sorted([k for k, v in (inv.proposed_permissions or {}).items() if v])
    perm_chips = ''.join(
        f'<span style="display:inline-block;padding:3px 9px;margin:2px 4px 2px 0;background:#e0f7ff;'
        f'color:#006080;border-radius:99px;font-size:11px;font-weight:600;">{k}</span>'
        for k in granted[:8]
    )
    if len(granted) > 8:
        perm_chips += f'<span style="font-size:12px;color:#64748b;">+{len(granted) - 8} more</span>'

    greeting = (
        f'<strong style="color:#0f172a;">{inviter_name}</strong> from '
        f'<strong style="color:#0f172a;">{inv.client.company}</strong> would like '
        f'your agency to manage their social media on Social Stats.'
    )
    body_html = (
        f'<div style="background:linear-gradient(135deg,#f0f9ff,#f8faff);border:1px solid rgba(0,215,255,0.18);'
        f'border-radius:14px;padding:20px 24px;margin:0 0 16px;">'
        f'<p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#00b8d9;text-transform:uppercase;letter-spacing:0.08em;">Message</p>'
        f'<p style="margin:0;font-size:15px;color:#1e293b;line-height:1.7;">{inv.message or "(no message)"}</p>'
        f'</div>'
        f'<div style="margin:0 0 16px;font-size:13px;color:#64748b;">'
        f'<strong style="color:#0f172a;">Proposed access:</strong><br>{perm_chips or "—"}'
        f'</div>'
    )
    plain = (
        f'{inviter_name} from {inv.client.company} would like your agency to manage their social on SocialStats.\n\n'
        f'Message: {inv.message or "(none)"}\n\n'
        f'Review and respond: {link}\n\n'
        f'This invitation expires in 7 days.\n'
    )
    html = _email_html(
        title='Manage-account request',
        greeting=greeting,
        body_html=body_html,
        cta_url=link,
        cta_label='Review the request',
        expiry_note='&#9203; This invitation expires in <strong>7 days</strong>.',
        frontend_url=FRONTEND_URL,
    )
    try:
        send_mail(subject, plain, FROM_EMAIL, [target_email],
                  html_message=html, fail_silently=True)
    except Exception:
        logger.exception('agency_invite: failed to send email to %s', target_email)


# ─────────────────────────────────────────────────────────────────────────────
# 1. Send (end-user)
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_agency_invite(request):
    """POST {target_agency_id | target_agency_slug | target_agency_email,
    proposed_permissions, message?, desired_services?, budget_range?, client_id?}.

    The auth user must own the targeted workspace.
    """
    data = request.data or {}
    agency, target_email, err = _resolve_target_agency(data)
    if err:
        return Response({'errors': err}, status=400)

    workspace = _resolve_user_workspace(request.user, data)
    if not workspace:
        return Response({'error': 'no workspace owned by this user'}, status=400)
    if not _is_owner(request.user, workspace):
        return Response({'error': 'you do not own this workspace'}, status=403)

    if agency and AgencyClientRelation.objects.filter(
        agency=agency, client=workspace, status__in=('active', 'pending'),
    ).exists():
        return Response({'error': 'a relation with this agency is already active or pending'}, status=409)

    proposed = _validate_permissions_payload(data.get('proposed_permissions'))

    with transaction.atomic():
        inv = AgencyInviteFromUser.objects.create(
            inviter_user=request.user,
            client=workspace,
            target_agency=agency,
            target_agency_email=target_email if not agency else '',
            proposed_permissions=proposed,
            message=(data.get('message') or '').strip(),
            desired_services=data.get('desired_services') or [],
            budget_range=(data.get('budget_range') or '').strip(),
        )
        if agency and agency.owner_user:
            # In-app only — `_send_invite_email` below sends a richer email
            # with perm chips and we don't want a duplicate.
            from .notification_dispatcher import dispatch as dispatch_notification
            dispatch_notification(
                agency.owner_user,
                event_type='agency_invite_received',
                title=f'{request.user.get_full_name() or request.user.email} wants you to manage their account',
                body=inv.message or '(no message)',
                channels=['in_app'],
                data={
                    'kind':       'agency_invite',
                    'token':      str(inv.token),
                    'invite_id':  inv.id,
                    'client_id':  workspace.id,
                    'expires_at': inv.expires_at.isoformat(),
                },
            )

    _send_invite_email(inv)
    return Response(_serialize_invite(inv, perspective='user', include_token=True), status=201)


# ─────────────────────────────────────────────────────────────────────────────
# 2. List sent (end-user side)
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_sent_agency_invites(request):
    qs = (
        AgencyInviteFromUser.objects
        .filter(inviter_user=request.user)
        .select_related('client', 'target_agency', 'inviter_user')
        .order_by('-sent_at')[:200]
    )
    return Response({'invites': [_serialize_invite(inv, perspective='user', include_token=True) for inv in qs]})


# ─────────────────────────────────────────────────────────────────────────────
# 3. Public fetch (anyone with token)
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([AllowAny])
def get_agency_invite(request, token):
    try:
        inv = (
            AgencyInviteFromUser.objects
            .select_related('client', 'target_agency', 'inviter_user')
            .get(token=token)
        )
    except (AgencyInviteFromUser.DoesNotExist, ValueError):
        return Response({'error': 'invitation not found'}, status=404)

    is_expired = inv.expires_at and timezone.now() >= inv.expires_at
    if is_expired and inv.status == 'sent':
        inv.status = 'expired'
        inv.save(update_fields=['status'])

    if inv.status == 'sent' and inv.target_agency_id:
        # mark "viewed" by the recipient agency context
        inv.status = 'viewed'
        inv.save(update_fields=['status'])

    payload = _serialize_invite(inv, perspective='agency')
    payload['permission_catalog'] = AGENCY_CLIENT_PERMISSIONS
    payload['is_expired'] = is_expired
    return Response(payload)


# ─────────────────────────────────────────────────────────────────────────────
# 4. Accept (agency member)
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def accept_agency_invite(request, token):
    """Acting user must be an active member (owner / admin / manager) of the
    target_agency. The invite must still be open."""
    try:
        inv = (
            AgencyInviteFromUser.objects
            .select_related('client', 'target_agency', 'inviter_user')
            .get(token=token)
        )
    except (AgencyInviteFromUser.DoesNotExist, ValueError):
        return Response({'error': 'invitation not found'}, status=404)

    if inv.status not in ('sent', 'viewed'):
        return Response({'error': f'invitation already {inv.status}'}, status=400)
    if inv.expires_at and timezone.now() >= inv.expires_at:
        inv.status = 'expired'; inv.save(update_fields=['status'])
        return Response({'error': 'invitation has expired'}, status=410)

    agency = inv.target_agency
    if not agency:
        return Response({
            'error': 'this invite was sent to an email — sign up your agency on Social Stats first, then re-open this link from your account',
        }, status=409)

    membership = AgencyMembership.objects.filter(
        user=request.user, agency=agency, is_active=True,
        role__in=('owner', 'admin', 'manager'),
    ).first()
    if not membership:
        return Response({'error': 'only an owner/admin/manager of this agency can accept'}, status=403)

    if AgencyClientRelation.objects.filter(
        agency=agency, client=inv.client, status__in=('active', 'pending'),
    ).exists():
        return Response({'error': 'a relation with this client is already active or pending'}, status=409)

    from .usage_limits import check_agency_limit
    ok, reason, info = check_agency_limit(agency, 'managed_clients')
    if not ok:
        return Response({'error': reason, 'limit': info}, status=402)

    with transaction.atomic():
        relation = AgencyClientRelation.objects.create(
            agency=agency,
            client=inv.client,
            status='active',
            initiated_by='end_user',
            initiated_by_user=inv.inviter_user,
            permissions=dict(inv.proposed_permissions or {}),
            requires_approval_for=[],
            approved_at=timezone.now(),
        )
        inv.status = 'accepted'
        inv.decided_at = timezone.now()
        inv.resulting_relation = relation
        inv.save(update_fields=['status', 'decided_at', 'resulting_relation'])

        log_activity(
            inv.client,
            actor_user=request.user,
            actor_type='agency',
            actor_agency_id=agency.id,
            action_type='agency_relation_accepted',
            description=f'{agency.name} accepted your invitation to manage this workspace',
            severity='notice',
            target_object_type='AgencyClientRelation',
            target_object_id=relation.id,
            metadata={'agency_id': agency.id, 'invite_id': inv.id, 'initiated_by': 'end_user'},
        )

    from .notification_dispatcher import dispatch as _dispatch
    _dispatch(
        inv.inviter_user,
        event_type='agency_invite_accepted',
        title=f'{agency.name} accepted your invitation',
        body=f'They can now manage {inv.client.company}.',
        data={
            'kind':         'agency_invite_accepted',
            'invite_id':    inv.id,
            'relation_id':  relation.id,
            'agency_id':    agency.id,
            'agency_name':  agency.name,
            'client_id':    inv.client_id,
        },
    )
    return Response({
        'id':           inv.id,
        'status':       inv.status,
        'relation_id':  relation.id,
        'agency_id':    agency.id,
    })


# ─────────────────────────────────────────────────────────────────────────────
# 5. Decline (agency member)
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def decline_agency_invite(request, token):
    try:
        inv = (
            AgencyInviteFromUser.objects
            .select_related('client', 'target_agency', 'inviter_user')
            .get(token=token)
        )
    except (AgencyInviteFromUser.DoesNotExist, ValueError):
        return Response({'error': 'invitation not found'}, status=404)

    if inv.status not in ('sent', 'viewed'):
        return Response({'error': f'invitation already {inv.status}'}, status=400)

    agency = inv.target_agency
    if agency:
        ok = AgencyMembership.objects.filter(
            user=request.user, agency=agency, is_active=True,
            role__in=('owner', 'admin', 'manager'),
        ).exists()
        if not ok:
            return Response({'error': 'only an owner/admin/manager of this agency can decline'}, status=403)

    inv.status = 'declined'
    inv.decided_at = timezone.now()
    inv.save(update_fields=['status', 'decided_at'])

    from .notification_dispatcher import dispatch as _dispatch
    _dispatch(
        inv.inviter_user,
        event_type='agency_invite_declined',
        title=f'{(agency.name if agency else inv.target_agency_email) or "An agency"} declined your invitation',
        data={
            'kind': 'agency_invite_declined',
            'invite_id': inv.id,
            'client_id': inv.client_id,
        },
    )
    return Response({'id': inv.id, 'status': inv.status})


# ─────────────────────────────────────────────────────────────────────────────
# 6. Agency-side incoming list
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def agency_incoming_invites(request, slug):
    try:
        agency = Agency.objects.get(slug=slug)
    except Agency.DoesNotExist:
        return Response({'error': 'agency not found'}, status=404)

    if not AgencyMembership.objects.filter(
        user=request.user, agency=agency, is_active=True,
    ).exists():
        return Response({'error': 'forbidden'}, status=403)

    qs = (
        AgencyInviteFromUser.objects
        .filter(target_agency=agency)
        .select_related('client', 'target_agency', 'inviter_user')
        .order_by('-sent_at')[:200]
    )
    return Response({'invites': [
        _serialize_invite(inv, perspective='agency', include_token=True) for inv in qs
    ]})
