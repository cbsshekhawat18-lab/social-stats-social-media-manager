# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Centralized token-verification helpers used by manual-mode connect endpoints
and the daily credential health check task.

Each verify_<platform>(...) returns:
    { 'ok': bool, 'entity': dict | None, 'error': str | None, 'expires_at': datetime | None }

`entity` carries platform metadata (e.g. page name, channel title) so the UI can
echo it back to the user.

These helpers do EXACTLY one HTTP call to the platform's API. They never write
to the DB; the calling view decides how to persist on success.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Optional

import requests
from django.utils import timezone

logger = logging.getLogger(__name__)

GRAPH_VERSION = 'v21.0'  # match the version used by oauth_views.py / tasks.py

DEFAULT_TIMEOUT = (8, 15)  # connect, read


def _result(ok=False, entity=None, error=None, expires_at=None):
    return {'ok': bool(ok), 'entity': entity or None, 'error': error or None, 'expires_at': expires_at}


def _safe_json(resp):
    try:
        return resp.json()
    except Exception:
        return {'raw': resp.text[:500]}


# ── Facebook ──────────────────────────────────────────────────────────────────
def verify_facebook(page_id: str, page_access_token: str) -> dict:
    """Confirm the page token can read the page itself."""
    if not page_id or not page_access_token:
        return _result(error='page_id and page_access_token are required')

    try:
        resp = requests.get(
            f'https://graph.facebook.com/{GRAPH_VERSION}/{page_id}',
            params={'fields': 'id,name,category,fan_count,access_token', 'access_token': page_access_token},
            timeout=DEFAULT_TIMEOUT,
        )
    except requests.RequestException as e:
        return _result(error=f'Network error: {e}')

    if resp.status_code != 200:
        body = _safe_json(resp)
        msg = (body.get('error') or {}).get('message') or 'Token rejected by Facebook'
        return _result(error=msg)

    body = _safe_json(resp)
    if str(body.get('id')) != str(page_id):
        return _result(error='Token does not belong to the specified Page ID')

    expires_at = _facebook_token_expiry(page_access_token)

    return _result(
        ok=True,
        entity={
            'page_id':   body.get('id'),
            'page_name': body.get('name'),
            'category':  body.get('category'),
            'fan_count': body.get('fan_count'),
        },
        expires_at=expires_at,
    )


def _facebook_token_expiry(token: str) -> Optional[datetime]:
    """Best-effort lookup via debug_token. Page tokens are typically long-lived."""
    try:
        from django.conf import settings
        app_token = f"{settings.META_APP_ID}|{settings.META_APP_SECRET}" if (settings.META_APP_ID and settings.META_APP_SECRET) else None
        if not app_token:
            return None
        resp = requests.get(
            f'https://graph.facebook.com/{GRAPH_VERSION}/debug_token',
            params={'input_token': token, 'access_token': app_token},
            timeout=DEFAULT_TIMEOUT,
        )
        data = _safe_json(resp).get('data') or {}
        exp = data.get('expires_at') or data.get('data_access_expires_at') or 0
        if exp and int(exp) > 0:
            return datetime.fromtimestamp(int(exp), tz=timezone.utc)
        # 0 = never expires (long-lived page token w/ system user)
        return None
    except Exception:
        return None


# ── Instagram ─────────────────────────────────────────────────────────────────
def verify_instagram(instagram_account_id: str, page_access_token: str) -> dict:
    if not instagram_account_id or not page_access_token:
        return _result(error='instagram_account_id and page_access_token are required')

    try:
        resp = requests.get(
            f'https://graph.facebook.com/{GRAPH_VERSION}/{instagram_account_id}',
            params={'fields': 'id,username,name,followers_count,media_count', 'access_token': page_access_token},
            timeout=DEFAULT_TIMEOUT,
        )
    except requests.RequestException as e:
        return _result(error=f'Network error: {e}')

    if resp.status_code != 200:
        body = _safe_json(resp)
        msg = (body.get('error') or {}).get('message') or 'Token rejected by Instagram'
        return _result(error=msg)

    body = _safe_json(resp)
    return _result(
        ok=True,
        entity={
            'instagram_account_id': body.get('id'),
            'username':             body.get('username'),
            'name':                 body.get('name'),
            'followers_count':      body.get('followers_count'),
            'media_count':          body.get('media_count'),
        },
        expires_at=_facebook_token_expiry(page_access_token),
    )


# ── Google: refresh-token exchange ────────────────────────────────────────────
def _exchange_google_refresh(client_id: str, client_secret: str, refresh_token: str) -> tuple[Optional[str], Optional[datetime], Optional[str]]:
    """Returns (access_token, expires_at, error)."""
    try:
        resp = requests.post(
            'https://oauth2.googleapis.com/token',
            data={
                'client_id':     client_id,
                'client_secret': client_secret,
                'refresh_token': refresh_token,
                'grant_type':    'refresh_token',
            },
            timeout=DEFAULT_TIMEOUT,
        )
    except requests.RequestException as e:
        return None, None, f'Network error: {e}'

    body = _safe_json(resp)
    if resp.status_code != 200 or 'access_token' not in body:
        msg = body.get('error_description') or body.get('error') or 'Google rejected the refresh token'
        return None, None, msg

    expires_at = timezone.now() + timedelta(seconds=int(body.get('expires_in', 3600)))
    return body['access_token'], expires_at, None


# ── YouTube ───────────────────────────────────────────────────────────────────
def verify_youtube(channel_id: str, oauth_client_id: str, oauth_client_secret: str,
                   refresh_token: str, api_key: str = '') -> dict:
    if not channel_id or not oauth_client_id or not oauth_client_secret or not refresh_token:
        return _result(error='channel_id, oauth_client_id, oauth_client_secret, refresh_token are required')

    access_token, expires_at, err = _exchange_google_refresh(oauth_client_id, oauth_client_secret, refresh_token)
    if err:
        return _result(error=err)

    try:
        resp = requests.get(
            'https://youtube.googleapis.com/youtube/v3/channels',
            params={'part': 'snippet,statistics', 'id': channel_id},
            headers={'Authorization': f'Bearer {access_token}'},
            timeout=DEFAULT_TIMEOUT,
        )
    except requests.RequestException as e:
        return _result(error=f'Network error: {e}')

    if resp.status_code != 200:
        body = _safe_json(resp)
        msg = (body.get('error') or {}).get('message') or 'YouTube rejected the request'
        return _result(error=msg)

    items = (_safe_json(resp).get('items') or [])
    if not items:
        return _result(error='Channel not found — check the Channel ID')

    snippet = items[0].get('snippet') or {}
    stats   = items[0].get('statistics') or {}
    return _result(
        ok=True,
        entity={
            'channel_id':       items[0].get('id'),
            'channel_name':     snippet.get('title'),
            'subscriber_count': stats.get('subscriberCount'),
            'video_count':      stats.get('videoCount'),
            'access_token':     access_token,  # caller should persist
        },
        expires_at=expires_at,
    )


# ── LinkedIn ──────────────────────────────────────────────────────────────────
def verify_linkedin(organization_id: str, access_token: str) -> dict:
    if not organization_id or not access_token:
        return _result(error='organization_id and access_token are required')

    org_id = str(organization_id).strip()
    if org_id.startswith('urn:li:organization:'):
        org_id = org_id.split(':')[-1]

    try:
        resp = requests.get(
            f'https://api.linkedin.com/v2/organizations/{org_id}',
            headers={'Authorization': f'Bearer {access_token}', 'X-Restli-Protocol-Version': '2.0.0'},
            timeout=DEFAULT_TIMEOUT,
        )
    except requests.RequestException as e:
        return _result(error=f'Network error: {e}')

    if resp.status_code != 200:
        body = _safe_json(resp)
        msg = body.get('message') or body.get('error_description') or 'LinkedIn rejected the token'
        return _result(error=msg)

    body = _safe_json(resp)
    name = body.get('localizedName') or (body.get('name') or {}).get('localized', {}).values()
    name = name if isinstance(name, str) else (next(iter(name), '') if name else '')

    # LinkedIn 60-day tokens — assume 60 days from now if expiry not known.
    expires_at = timezone.now() + timedelta(days=60)

    return _result(
        ok=True,
        entity={'organization_id': org_id, 'organization_name': name},
        expires_at=expires_at,
    )


# ── Google My Business ────────────────────────────────────────────────────────
def verify_gmb(account_id: str, location_id: str, oauth_client_id: str,
               oauth_client_secret: str, refresh_token: str) -> dict:
    if not account_id or not location_id or not oauth_client_id or not oauth_client_secret or not refresh_token:
        return _result(error='account_id, location_id, oauth_client_id, oauth_client_secret, refresh_token are required')

    access_token, expires_at, err = _exchange_google_refresh(oauth_client_id, oauth_client_secret, refresh_token)
    if err:
        return _result(error=err)

    # Verify by reading the location via Business Information API
    try:
        resp = requests.get(
            f'https://mybusinessbusinessinformation.googleapis.com/v1/locations/{location_id}',
            params={'readMask': 'name,title,categories'},
            headers={'Authorization': f'Bearer {access_token}'},
            timeout=DEFAULT_TIMEOUT,
        )
    except requests.RequestException as e:
        return _result(error=f'Network error: {e}')

    if resp.status_code != 200:
        body = _safe_json(resp)
        msg = (body.get('error') or {}).get('message') or 'GMB rejected the request'
        return _result(error=msg)

    body = _safe_json(resp)
    return _result(
        ok=True,
        entity={
            'gmb_account_id':  account_id,
            'gmb_location_id': location_id,
            'business_name':   body.get('title'),
            'access_token':    access_token,  # caller should persist
        },
        expires_at=expires_at,
    )


# ── Dispatcher ────────────────────────────────────────────────────────────────
def verify_token(platform: str, payload: dict) -> dict:
    """Generic dispatcher used by `test_credential` endpoint."""
    p = (platform or '').lower()
    try:
        if p == 'facebook':
            return verify_facebook(payload.get('page_id'), payload.get('page_access_token'))
        if p == 'instagram':
            return verify_instagram(payload.get('instagram_account_id'), payload.get('page_access_token'))
        if p == 'youtube':
            return verify_youtube(
                payload.get('channel_id'),
                payload.get('oauth_client_id'),
                payload.get('oauth_client_secret'),
                payload.get('refresh_token'),
                payload.get('api_key', ''),
            )
        if p == 'linkedin':
            return verify_linkedin(payload.get('organization_id'), payload.get('access_token'))
        if p in ('gmb', 'google_my_business'):
            return verify_gmb(
                payload.get('account_id'),
                payload.get('location_id'),
                payload.get('oauth_client_id'),
                payload.get('oauth_client_secret'),
                payload.get('refresh_token'),
            )
    except Exception as e:
        logger.exception('verify_token unexpected error for platform=%s', platform)
        return _result(error=f'Unexpected error: {e}')

    return _result(error=f'Unsupported platform: {platform}')
