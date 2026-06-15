# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Manual-mode connect endpoints.

Each endpoint:
  1. Validates the request body via a platform-specific serializer.
  2. Calls token_verifier to confirm the credentials work against the live API.
  3. On success, upserts a PlatformCredential row with auth_method='manual_token'
     plus a sibling ManualCredentialExtras row for Google client-id/secret/api_key
     when applicable.
  4. Returns the live entity (page name, channel title, etc.) so the UI can
     echo it back to the user.

Tenant isolation:
  Superadmins may target any client. Staff may target clients they're assigned
  to. Clients may only target their own client_id.
"""
import logging
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Client, PlatformCredential, ManualCredentialExtras
from . import token_verifier as verifier
from .manual_token_serializers import (
    FacebookManualSerializer, InstagramManualSerializer,
    YoutubeManualSerializer, LinkedinManualSerializer, GmbManualSerializer,
)
from .manual_setup_guides import get_guide

logger = logging.getLogger(__name__)

# Default expiry windows for tokens that platforms don't tell us about.
LINKEDIN_DEFAULT_DAYS = 60


def _has_client_access(request, client_id) -> bool:
    """Tenant guard. Same logic the rest of the app uses."""
    try:
        profile = request.user.profile
    except Exception:
        return False
    if profile.role == 'superadmin':
        return True
    if profile.role == 'staff':
        return profile.assigned_clients.filter(id=client_id).exists()
    if profile.role == 'client':
        return profile.client_id == int(client_id)
    return False


def _get_client(request, client_id):
    if not _has_client_access(request, client_id):
        return None, Response({'detail': 'Access denied'}, status=403)
    try:
        return Client.objects.get(id=client_id), None
    except Client.DoesNotExist:
        return None, Response({'detail': 'Client not found'}, status=404)


def _save_credential(client, platform: str, defaults: dict, manual_extras: dict | None = None):
    """Upsert PlatformCredential and (optionally) its ManualCredentialExtras row."""
    with transaction.atomic():
        cred, _ = PlatformCredential.objects.update_or_create(
            client=client, platform=platform,
            defaults={
                **defaults,
                'is_active':   True,
                'auth_method': 'manual_token',
            },
        )
        if manual_extras:
            ManualCredentialExtras.objects.update_or_create(
                credential=cred,
                defaults=manual_extras,
            )
        return cred


# ── Facebook ──────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def connect_facebook_manual(request, client_id):
    client, err = _get_client(request, client_id)
    if err:
        return err

    s = FacebookManualSerializer(data=request.data)
    if not s.is_valid():
        return Response({'detail': 'Invalid input', 'errors': s.errors}, status=400)
    data = s.validated_data

    result = verifier.verify_facebook(data['page_id'], data['page_access_token'])
    if not result['ok']:
        return Response({'detail': result['error']}, status=400)

    entity = result['entity']
    cred = _save_credential(
        client, 'facebook',
        defaults={
            'page_id':      entity['page_id'],
            'page_name':    entity.get('page_name', ''),
            'access_token': data['page_access_token'],
            'expires_at':   result.get('expires_at'),
            'scope':        'pages_show_list,pages_read_engagement,read_insights',
        },
    )
    return Response({
        'success':        True,
        'credential_id':  cred.id,
        'page_id':        entity['page_id'],
        'page_name':      entity.get('page_name'),
        'fan_count':      entity.get('fan_count'),
        'expires_at':     cred.expires_at,
    })


# ── Instagram ─────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def connect_instagram_manual(request, client_id):
    client, err = _get_client(request, client_id)
    if err:
        return err

    s = InstagramManualSerializer(data=request.data)
    if not s.is_valid():
        return Response({'detail': 'Invalid input', 'errors': s.errors}, status=400)
    data = s.validated_data

    result = verifier.verify_instagram(data['instagram_account_id'], data['page_access_token'])
    if not result['ok']:
        return Response({'detail': result['error']}, status=400)

    entity = result['entity']
    cred = _save_credential(
        client, 'instagram',
        defaults={
            'instagram_account_id': entity['instagram_account_id'],
            'access_token':         data['page_access_token'],
            'expires_at':           result.get('expires_at'),
            'scope':                'instagram_manage_insights,pages_show_list',
        },
    )
    return Response({
        'success':              True,
        'credential_id':        cred.id,
        'instagram_account_id': entity['instagram_account_id'],
        'username':             entity.get('username'),
        'followers_count':      entity.get('followers_count'),
        'expires_at':           cred.expires_at,
    })


# ── YouTube ───────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def connect_youtube_manual(request, client_id):
    client, err = _get_client(request, client_id)
    if err:
        return err

    s = YoutubeManualSerializer(data=request.data)
    if not s.is_valid():
        return Response({'detail': 'Invalid input', 'errors': s.errors}, status=400)
    data = s.validated_data

    result = verifier.verify_youtube(
        data['channel_id'],
        data['oauth_client_id'],
        data['oauth_client_secret'],
        data['refresh_token'],
        data.get('api_key', ''),
    )
    if not result['ok']:
        return Response({'detail': result['error']}, status=400)

    entity = result['entity']
    cred = _save_credential(
        client, 'youtube',
        defaults={
            'channel_id':    entity['channel_id'],
            'channel_name':  entity.get('channel_name', ''),
            'access_token':  entity.get('access_token', ''),
            'refresh_token': data['refresh_token'],
            'expires_at':    result.get('expires_at'),
            'scope':         'youtube.readonly,yt-analytics.readonly',
        },
        manual_extras={
            'oauth_client_id':     data['oauth_client_id'],
            'oauth_client_secret': data['oauth_client_secret'],
            'api_key':             data.get('api_key', ''),
        },
    )
    return Response({
        'success':          True,
        'credential_id':    cred.id,
        'channel_id':       entity['channel_id'],
        'channel_name':     entity.get('channel_name'),
        'subscriber_count': entity.get('subscriber_count'),
        'expires_at':       cred.expires_at,
    })


# ── LinkedIn ──────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def connect_linkedin_manual(request, client_id):
    client, err = _get_client(request, client_id)
    if err:
        return err

    s = LinkedinManualSerializer(data=request.data)
    if not s.is_valid():
        return Response({'detail': 'Invalid input', 'errors': s.errors}, status=400)
    data = s.validated_data

    result = verifier.verify_linkedin(data['organization_id'], data['access_token'])
    if not result['ok']:
        return Response({'detail': result['error']}, status=400)

    entity = result['entity']
    expires_at = result.get('expires_at') or (timezone.now() + timedelta(days=LINKEDIN_DEFAULT_DAYS))

    cred = _save_credential(
        client, 'linkedin',
        defaults={
            'organization_id':   entity['organization_id'],
            'organization_name': entity.get('organization_name', ''),
            'access_token':      data['access_token'],
            'expires_at':        expires_at,
            'scope':             'r_organization_social,rw_organization_admin',
        },
    )
    return Response({
        'success':           True,
        'credential_id':     cred.id,
        'organization_id':   entity['organization_id'],
        'organization_name': entity.get('organization_name'),
        'expires_at':        cred.expires_at,
    })


# ── GMB ───────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def connect_gmb_manual(request, client_id):
    client, err = _get_client(request, client_id)
    if err:
        return err

    s = GmbManualSerializer(data=request.data)
    if not s.is_valid():
        return Response({'detail': 'Invalid input', 'errors': s.errors}, status=400)
    data = s.validated_data

    result = verifier.verify_gmb(
        data['account_id'],
        data['location_id'],
        data['oauth_client_id'],
        data['oauth_client_secret'],
        data['refresh_token'],
    )
    if not result['ok']:
        return Response({'detail': result['error']}, status=400)

    entity = result['entity']
    cred = _save_credential(
        client, 'google_my_business',
        defaults={
            'gmb_account_id':  entity['gmb_account_id'],
            'gmb_location_id': entity['gmb_location_id'],
            'access_token':    entity.get('access_token', ''),
            'refresh_token':   data['refresh_token'],
            'expires_at':      result.get('expires_at'),
            'scope':           'business.manage',
        },
        manual_extras={
            'oauth_client_id':     data['oauth_client_id'],
            'oauth_client_secret': data['oauth_client_secret'],
            'api_key':             '',
        },
    )
    return Response({
        'success':         True,
        'credential_id':   cred.id,
        'gmb_account_id':  entity['gmb_account_id'],
        'gmb_location_id': entity['gmb_location_id'],
        'business_name':   entity.get('business_name'),
        'expires_at':      cred.expires_at,
    })


# ── Test an existing credential ───────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def test_credential(request, credential_id):
    """
    Re-verify a stored credential by replaying token_verifier with the saved
    fields. Used by the "Test connection" button in ConnectedAccounts.
    """
    try:
        cred = PlatformCredential.objects.select_related('client').get(id=credential_id)
    except PlatformCredential.DoesNotExist:
        return Response({'detail': 'Credential not found'}, status=404)

    if not _has_client_access(request, cred.client_id):
        return Response({'detail': 'Access denied'}, status=403)

    payload = _build_verify_payload(cred)
    result = verifier.verify_token(cred.platform, payload)

    # Persist auto-derived state on success/failure
    if result['ok']:
        if not cred.is_active:
            cred.is_active = True
            cred.save(update_fields=['is_active'])
    return Response({
        'ok':        bool(result['ok']),
        'error':     result.get('error'),
        'entity':    result.get('entity'),
        'platform':  cred.platform,
    })


def _build_verify_payload(cred: PlatformCredential) -> dict:
    """Reconstruct the kwargs token_verifier expects from a stored credential."""
    extras = getattr(cred, 'manual_extras', None)
    base = {}
    p = cred.platform
    if p == 'facebook':
        base = {'page_id': cred.page_id, 'page_access_token': cred.access_token}
    elif p == 'instagram':
        base = {'instagram_account_id': cred.instagram_account_id, 'page_access_token': cred.access_token}
    elif p == 'youtube':
        base = {
            'channel_id':          cred.channel_id,
            'oauth_client_id':     extras.oauth_client_id     if extras else '',
            'oauth_client_secret': extras.oauth_client_secret if extras else '',
            'refresh_token':       cred.refresh_token,
            'api_key':             extras.api_key             if extras else '',
        }
    elif p == 'linkedin':
        base = {'organization_id': cred.organization_id, 'access_token': cred.access_token}
    elif p == 'google_my_business':
        base = {
            'account_id':          cred.gmb_account_id,
            'location_id':         cred.gmb_location_id,
            'oauth_client_id':     extras.oauth_client_id     if extras else '',
            'oauth_client_secret': extras.oauth_client_secret if extras else '',
            'refresh_token':       cred.refresh_token,
        }
    return base


# ── Setup instructions ────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_setup_instructions(request, platform):
    guide = get_guide(platform)
    if not guide:
        return Response({'detail': f'No setup guide for {platform}'}, status=404)
    return Response(guide)
