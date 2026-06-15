# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
End-user (B2C) auth + workspace endpoints.

End-users are individuals who self-signup directly (real-estate agents,
clinic owners, restaurant operators, creators) and own their own workspace.
Distinct from agency staff (who manage other people's workspaces).

Endpoints:
    POST /api/end-user/signup       — self-signup → JWT + new workspace
    GET  /api/end-user/me           — current end-user + workspace summary
    PUT  /api/end-user/profile      — update first/last name + avatar
    GET  /api/end-user/workspace    — fetch the owned workspace
    PUT  /api/end-user/workspace    — update workspace profile

The signup flow auto-activates the account (no email verification step) so
the user lands in the dashboard immediately. We trade a verification step
for a faster onboarding — appropriate for a free B2C tier where the only
sensitive thing is their own data. (Email verification can be added later
as a separate "verified" badge without blocking signup.)
"""
from __future__ import annotations

import re

from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .activity_logger import log_activity
from .models import Client, UserProfile
from .social_auth_views import _make_jwt


EMAIL_RE = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
def _workspace_for(user) -> Client | None:
    """Return the workspace this end-user owns. Prefer profile.default_workspace,
    fall back to Client.owner_user lookup."""
    profile = getattr(user, 'profile', None)
    if profile and profile.default_workspace_id:
        return profile.default_workspace
    return Client.objects.filter(owner_user=user).order_by('id').first()


def _serialize_workspace(client: Client) -> dict:
    return {
        'id':              client.id,
        'name':            client.name,
        'company':         client.company,
        'display_name':    client.display_name,
        'industry':        client.industry,
        'location_city':   client.location_city,
        'location_country': client.location_country,
        'subscription_plan': client.subscription_plan,
        'ownership_type':  client.ownership_type,
        'created_via':     client.created_via,
        'is_discoverable_in_marketplace': client.is_discoverable_in_marketplace,
        'onboarding_complete': client.onboarding_complete,
        'whatsapp_enabled':    client.whatsapp_enabled,
        'timezone':            client.timezone,
        'created_at':          client.created_at.isoformat() if client.created_at else None,
    }


def _serialize_user(user: User) -> dict:
    profile = getattr(user, 'profile', None)
    return {
        'id':         user.id,
        'email':      user.email,
        'first_name': user.first_name,
        'last_name':  user.last_name,
        'full_name':  user.get_full_name(),
        'account_type': profile.account_type if profile else None,
        'role':         profile.role if profile else None,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Signup
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([AllowAny])
def end_user_signup(request):
    """POST {email, password, full_name, industry?, company_name?, phone?, terms_accepted}.

    Creates User + UserProfile(account_type='end_user') + Client owned by user.
    Returns JWT immediately so the frontend can drop the user into /u.
    """
    data = request.data or {}
    email     = (data.get('email') or '').strip().lower()
    password  = data.get('password') or ''
    full_name = (data.get('full_name') or '').strip()
    industry  = (data.get('industry') or '').strip()
    company   = (data.get('company_name') or full_name).strip()
    phone     = (data.get('phone') or '').strip()
    terms     = bool(data.get('terms_accepted'))

    errors: dict[str, str] = {}
    if not full_name:
        errors['full_name'] = 'Full name is required.'
    if not email:
        errors['email'] = 'Email is required.'
    elif not EMAIL_RE.match(email):
        errors['email'] = 'Enter a valid email address.'
    if not password:
        errors['password'] = 'Password is required.'
    if not terms:
        errors['terms'] = 'You must accept the Terms of Service.'
    if errors:
        return Response({'errors': errors}, status=400)

    temp = User(username=email, email=email)
    try:
        validate_password(password, temp)
    except ValidationError as e:
        return Response({'errors': {'password': ' '.join(e.messages)}}, status=400)

    if User.objects.filter(username=email).exists() or Client.objects.filter(email=email).exists():
        return Response({'errors': {'email': 'An account with this email already exists.'}}, status=400)

    parts = full_name.split(' ', 1)
    with transaction.atomic():
        user = User.objects.create_user(
            username=email, email=email, password=password,
            first_name=parts[0],
            last_name=parts[1] if len(parts) > 1 else '',
            is_active=True,
        )
        client = Client.objects.create(
            name=full_name,
            company=company,
            email=email,
            phone=phone,
            industry=industry,
            owner_user=user,
            ownership_type='end_user_owned',
            created_via='end_user_signup',
            subscription_plan='free',
        )
        profile = UserProfile.objects.create(
            user=user,
            role='client',
            account_type='end_user',
            client=client,
            default_workspace=client,
            is_self_registered=True,
            email_verified=True,
            terms_accepted=True,
            terms_accepted_at=timezone.now(),
        )

        log_activity(
            client,
            actor_user=user,
            actor_type='end_user',
            action_type='workspace_created',
            description='Workspace created via end-user self-signup',
            severity='info',
            metadata={'industry': industry},
        )

    access, refresh = _make_jwt(user)
    return Response(
        {
            'access':    access,
            'refresh':   refresh,
            'user':      _serialize_user(user),
            'workspace': _serialize_workspace(client),
        },
        status=201,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Me / Profile / Workspace
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def end_user_me(request):
    """Summary of the end-user + their workspace + active relations count."""
    user = request.user
    workspace = _workspace_for(user)
    payload = {
        'user':      _serialize_user(user),
        'workspace': _serialize_workspace(workspace) if workspace else None,
    }
    if workspace:
        from .models import AgencyClientRelation
        payload['relations'] = {
            'active':  AgencyClientRelation.objects.filter(client=workspace, status='active').count(),
            'pending': AgencyClientRelation.objects.filter(client=workspace, status='pending').count(),
        }
    return Response(payload)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def end_user_update_profile(request):
    """PUT {first_name?, last_name?} — update the user's name."""
    user = request.user
    data = request.data or {}
    fields_changed = []
    for key in ('first_name', 'last_name'):
        if key in data:
            setattr(user, key, (data.get(key) or '').strip())
            fields_changed.append(key)
    if fields_changed:
        user.save(update_fields=fields_changed)
    return Response(_serialize_user(user))


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def end_user_workspace(request):
    """GET or PUT the end-user's owned workspace."""
    workspace = _workspace_for(request.user)
    if not workspace:
        return Response({'error': 'no workspace owned by this user'}, status=404)

    if request.method == 'GET':
        return Response(_serialize_workspace(workspace))

    # PUT — update editable fields only
    data = request.data or {}
    EDITABLE = (
        'name', 'company', 'phone', 'whatsapp_number', 'website',
        'display_name', 'industry', 'location_city', 'location_country',
        'is_discoverable_in_marketplace', 'timezone',
    )
    changed = []
    for f in EDITABLE:
        if f in data:
            setattr(workspace, f, data.get(f))
            changed.append(f)
    if changed:
        workspace.save(update_fields=changed)
        log_activity(
            workspace, actor_user=request.user, actor_type='end_user',
            action_type='workspace_updated',
            description=f'Workspace fields updated: {", ".join(changed)}',
            severity='info',
            metadata={'fields': changed},
        )
    return Response(_serialize_workspace(workspace))
