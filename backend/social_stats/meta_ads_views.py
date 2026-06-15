# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Meta Ads (Marketing API) integration.

Endpoints (auth, tenant-scoped via the user's facebook PlatformCredential):
    GET /api/meta-ads/accounts/                       — list /me/adaccounts
    GET /api/meta-ads/campaigns/?ad_account_id=…      — list CTWA-eligible campaigns
    GET /api/meta-ads/ads/?campaign_id=…              — list ads under a campaign

The daily Celery task and the CTWACampaign `/sync-meta` action both
call `sync_campaign_spend(campaign)` here. In dev (no facebook credential
configured for the workspace), all endpoints degrade gracefully with a
`{'error': 'meta ads not connected', ...}` response so the frontend can
prompt the user to connect.
"""
from __future__ import annotations

import logging

import requests
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import CTWACampaign, PlatformCredential


logger = logging.getLogger(__name__)


GRAPH_BASE = 'https://graph.facebook.com/v21.0'


def _resolve_token(user) -> tuple[str | None, int | None]:
    """Return (access_token, client_id) for the calling user's facebook
    PlatformCredential. None when not connected."""
    profile = getattr(user, 'profile', None)
    if not profile:
        return (None, None)
    if profile.role == 'superadmin':
        return (None, None)
    cred = (
        PlatformCredential.objects.filter(
            client_id=profile.client_id, platform='facebook', is_active=True,
        ).first()
    )
    if not cred or not cred.access_token:
        return (None, profile.client_id)
    return (cred.access_token, profile.client_id)


def _graph(method: str, path: str, *, token: str, params: dict | None = None,
          timeout: int = 8) -> tuple[bool, dict]:
    """Minimal Graph API client. Returns (ok, body)."""
    url = f'{GRAPH_BASE}{path}'
    p = {'access_token': token, **(params or {})}
    try:
        r = requests.request(method, url, params=p, timeout=timeout)
        body = r.json() if r.content else {}
    except Exception as e:  # noqa: BLE001
        logger.exception('Graph %s %s failed', method, path)
        return (False, {'error': str(e)})
    if r.status_code >= 400:
        return (False, {'error': body.get('error', {}).get('message', 'graph error'),
                        'status_code': r.status_code, 'raw': body})
    return (True, body)


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def meta_ads_health(request):
    """surface Meta Ads connection health to the frontend so it can
    nudge the user to reconnect before tokens expire."""
    profile = getattr(request.user, 'profile', None)
    if not profile or profile.role == 'superadmin':
        return Response({'connected': False, 'error': 'no client context'})

    cred = (
        PlatformCredential.objects.filter(
            client_id=profile.client_id, platform='facebook', is_active=True,
        ).first()
    )
    if not cred or not cred.access_token:
        return Response({'connected': False})

    # Cheap probe: GET /me with the token. Costs nothing in rate-limit terms.
    ok, body = _graph('GET', '/me', token=cred.access_token, params={'fields': 'id,name'}, timeout=4)
    if not ok:
        return Response({
            'connected': False,
            'error': body.get('error') or 'token invalid',
            'expires_at': cred.expires_at.isoformat() if cred.expires_at else None,
        })

    expires_at = cred.expires_at
    days_left = None
    if expires_at:
        delta = expires_at - timezone.now()
        days_left = int(delta.total_seconds() // 86400)

    # Optional pixel sanity check (CAPI works without one but the UI can
    # encourage configuring it for better attribution).
    from .models import Client
    client = Client.objects.filter(pk=profile.client_id).first()
    pixel_id = (getattr(client, 'meta_pixel_id', '') or '').strip()

    return Response({
        'connected':  True,
        'fb_user':    {'id': body.get('id'), 'name': body.get('name')},
        'expires_at': expires_at.isoformat() if expires_at else None,
        'days_left':  days_left,
        'expired':    bool(expires_at and timezone.now() >= expires_at),
        'pixel_configured': bool(pixel_id),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_ad_accounts(request):
    token, client_id = _resolve_token(request.user)
    if not token:
        return Response({'error': 'meta ads not connected', 'connected': False})
    ok, body = _graph('GET', '/me/adaccounts', token=token, params={
        'fields': 'id,name,account_status,currency,balance,amount_spent',
        'limit': 50,
    })
    if not ok:
        return Response({'error': body.get('error') or 'graph error'}, status=502)
    return Response({
        'connected': True,
        'accounts': [{
            'id':             a.get('id'),
            'name':           a.get('name'),
            'account_status': a.get('account_status'),
            'currency':       a.get('currency'),
            'balance':        a.get('balance'),
            'amount_spent':   a.get('amount_spent'),
        } for a in (body.get('data') or [])],
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_ad_campaigns(request):
    token, _ = _resolve_token(request.user)
    if not token:
        return Response({'error': 'meta ads not connected', 'connected': False})
    ad_account_id = (request.query_params.get('ad_account_id') or '').strip()
    if not ad_account_id:
        return Response({'error': 'ad_account_id is required'}, status=400)
    if not ad_account_id.startswith('act_'):
        ad_account_id = f'act_{ad_account_id}'
    ok, body = _graph('GET', f'/{ad_account_id}/campaigns', token=token, params={
        'fields': 'id,name,objective,status,effective_status,daily_budget,lifetime_budget,start_time,stop_time',
        'limit': 100,
    })
    if not ok:
        return Response({'error': body.get('error') or 'graph error'}, status=502)
    # CTWA campaigns use OUTCOME_ENGAGEMENT or LEAD_GENERATION objectives —
    # we surface ALL active campaigns so the UI can filter; the picker can
    # show a "CTWA-eligible" badge.
    return Response({
        'connected': True,
        'campaigns': body.get('data') or [],
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_ads(request):
    token, _ = _resolve_token(request.user)
    if not token:
        return Response({'error': 'meta ads not connected', 'connected': False})
    campaign_id = (request.query_params.get('campaign_id') or '').strip()
    if not campaign_id:
        return Response({'error': 'campaign_id is required'}, status=400)
    ok, body = _graph('GET', f'/{campaign_id}/ads', token=token, params={
        'fields': (
            'id,name,status,effective_status,creative{title,body,call_to_action_type,'
            'object_story_spec,thumbnail_url,image_url}'
        ),
        'limit': 200,
    })
    if not ok:
        return Response({'error': body.get('error') or 'graph error'}, status=502)
    ads = body.get('data') or []
    # Detect CTWA — creative.call_to_action_type == 'WHATSAPP_MESSAGE' OR
    # object_story_spec has a whatsapp destination.
    for a in ads:
        creative = a.get('creative') or {}
        cta = (creative.get('call_to_action_type') or '').upper()
        story = creative.get('object_story_spec') or {}
        is_ctwa = (
            cta == 'WHATSAPP_MESSAGE'
            or 'whatsapp' in (story.get('link_data', {}) or {})
            or any('whatsapp' in str(v).lower() for v in story.values())
        )
        a['is_ctwa'] = bool(is_ctwa)
    return Response({'connected': True, 'ads': ads})


# ─────────────────────────────────────────────────────────────────────────────
# Spend sync (used by CTWACampaignViewSet.sync_meta + Stage-13 Celery beat)
# ─────────────────────────────────────────────────────────────────────────────
def sync_campaign_spend(campaign: CTWACampaign) -> dict:
    """Pull yesterday's insights from Meta and update `total_spent`. Used by
    the CTWACampaign sync-meta endpoint and's daily beat task."""
    cred = (
        PlatformCredential.objects.filter(
            client=campaign.client, platform='facebook', is_active=True,
        ).first()
    )
    if not cred or not cred.access_token:
        return {'ok': False, 'error': 'meta ads not connected'}

    ad_account_id = campaign.ad_account_id
    if not ad_account_id.startswith('act_'):
        ad_account_id = f'act_{ad_account_id}'

    ok, body = _graph('GET', f'/{campaign.campaign_id}/insights', token=cred.access_token, params={
        'fields': 'spend,clicks,impressions,reach,ctr,cpc,cpp,actions',
        'date_preset': 'last_30d',
        'level': 'campaign',
    })
    if not ok:
        return {'ok': False, 'error': body.get('error') or 'graph error'}

    rows = body.get('data') or []
    total_spent = sum(float(r.get('spend') or 0) for r in rows)
    total_clicks = sum(int(r.get('clicks') or 0) for r in rows)

    campaign.total_spent = total_spent
    campaign.total_clicks = total_clicks
    campaign.last_synced_at = timezone.now()
    campaign.save(update_fields=['total_spent', 'total_clicks', 'last_synced_at'])

    return {
        'ok': True,
        'total_spent': total_spent,
        'total_clicks': total_clicks,
        'cpl': (total_spent / campaign.total_leads) if campaign.total_leads else None,
        'last_synced_at': campaign.last_synced_at.isoformat(),
    }


def fetch_per_ad_insights(campaign: CTWACampaign) -> dict:
    """break campaign performance down per ad. Returns
    `{'ok': bool, 'ads': [{ad_id, ad_name, spend, clicks, ctr, cpc, impressions}, ...]}`.

    The UI calls this lazily when the campaign detail page expands the
    per-ad section, so we don't block the main /analytics call.
    """
    cred = (
        PlatformCredential.objects.filter(
            client=campaign.client, platform='facebook', is_active=True,
        ).first()
    )
    if not cred or not cred.access_token:
        return {'ok': False, 'error': 'meta ads not connected'}

    ok, body = _graph('GET', f'/{campaign.campaign_id}/insights',
                      token=cred.access_token, params={
        'fields': 'ad_id,ad_name,spend,clicks,impressions,ctr,cpc',
        'date_preset': 'last_30d',
        'level': 'ad',
        'limit': 100,
    })
    if not ok:
        return {'ok': False, 'error': body.get('error') or 'graph error'}

    rows = body.get('data') or []
    ads = []
    for r in rows:
        ads.append({
            'ad_id':       r.get('ad_id'),
            'ad_name':     r.get('ad_name') or '—',
            'spend':       float(r.get('spend') or 0),
            'clicks':      int(r.get('clicks') or 0),
            'impressions': int(r.get('impressions') or 0),
            'ctr':         float(r.get('ctr') or 0),
            'cpc':         float(r.get('cpc') or 0),
        })
    # Sort by spend desc — surface the heaviest spenders first.
    ads.sort(key=lambda a: a['spend'], reverse=True)
    return {'ok': True, 'ads': ads}
