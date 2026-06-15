# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Shared Google REST helper used by YouTubePublisher and GMBPublisher.

Responsibilities:
  - Refresh the access token when expired (using the user-supplied client_id /
    client_secret + refresh_token stored in ManualCredentialExtras, or the
    Social Stats-owned OAuth app for the legacy `auth_method='oauth'` rows).
  - Send authenticated REST requests with consistent timeouts + error mapping.

Error mapping (cheatsheet):
  HTTP 401                  → TokenExpiredError (after one auto-refresh attempt)
  HTTP 403 + "permission"   → PermissionDeniedError
  HTTP 429 / quotaExceeded  → RateLimitError
  HTTP 5xx                  → PublishError(code='server_error')
"""
from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any, Optional

import requests
from django.utils import timezone

from .base import (
    PublishError, TokenExpiredError, RateLimitError, PermissionDeniedError,
)

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = (10, 30)
LONG_TIMEOUT = (15, 180)
TOKEN_URL = 'https://oauth2.googleapis.com/token'


class GoogleClient:
    """
    Bound to a single PlatformCredential. On 401 retries once after refreshing
    the access_token. Tokens are persisted back onto the credential row so the
    next call doesn't re-spend the refresh.
    """

    def __init__(self, credential, *, timeout=DEFAULT_TIMEOUT):
        self.credential = credential
        self.timeout = timeout

    # ── Public helpers ────────────────────────────────────────────────────
    def get(self, url: str, *, params=None, timeout=None) -> Any:
        return self._request('GET', url, params=params, timeout=timeout)

    def post(self, url: str, *, params=None, json=None, data=None, headers=None, timeout=None) -> Any:
        return self._request('POST', url, params=params, json=json, data=data,
                             headers=headers, timeout=timeout)

    def put(self, url: str, *, data=None, headers=None, timeout=None) -> Any:
        return self._request('PUT', url, data=data, headers=headers, timeout=timeout)

    def delete(self, url: str, *, params=None, timeout=None) -> Any:
        return self._request('DELETE', url, params=params, timeout=timeout)

    # ── Token plumbing ────────────────────────────────────────────────────
    def access_token(self) -> str:
        cred = self.credential
        # Refresh when token is missing OR expires_at within the next 60s
        needs_refresh = (
            not cred.access_token or
            (cred.expires_at and cred.expires_at <= timezone.now() + timedelta(seconds=60))
        )
        if needs_refresh:
            self._refresh_token()
        return cred.access_token

    def _refresh_token(self):
        """Exchange the refresh_token for a new access_token. Persists the result."""
        cred = self.credential
        if not cred.refresh_token:
            raise TokenExpiredError('No refresh_token on credential — reconnect required')

        client_id, client_secret = self._client_app_creds()
        if not client_id or not client_secret:
            raise TokenExpiredError(
                'Google OAuth client_id/secret missing — manual_extras row not configured',
                code='missing_config',
            )

        try:
            resp = requests.post(TOKEN_URL, data={
                'client_id':     client_id,
                'client_secret': client_secret,
                'refresh_token': cred.refresh_token,
                'grant_type':    'refresh_token',
            }, timeout=DEFAULT_TIMEOUT)
        except requests.RequestException as e:
            raise PublishError(f'Network error while refreshing token: {e}', code='network')

        body = _safe_json(resp)
        if resp.status_code != 200 or 'access_token' not in body:
            msg = body.get('error_description') or body.get('error') or 'Refresh rejected'
            raise TokenExpiredError(f'Google rejected refresh: {msg}', raw=body)

        cred.access_token = body['access_token']
        cred.expires_at = timezone.now() + timedelta(seconds=int(body.get('expires_in', 3600)))
        cred.save(update_fields=['access_token', 'expires_at'])

    def _client_app_creds(self) -> tuple[str, str]:
        """Pull client_id/secret from ManualCredentialExtras (manual mode) or
        the Social Stats-owned OAuth app (oauth mode)."""
        cred = self.credential
        # Manual mode — extras row holds per-client app creds
        extras = getattr(cred, 'manual_extras', None)
        if extras and extras.oauth_client_id and extras.oauth_client_secret:
            return extras.oauth_client_id, extras.oauth_client_secret
        # Social Stats-owned OAuth (analytics auth_method='oauth')
        from django.conf import settings
        return (
            getattr(settings, 'GOOGLE_CLIENT_ID', '') or '',
            getattr(settings, 'GOOGLE_CLIENT_SECRET', '') or '',
        )

    # ── Internals ─────────────────────────────────────────────────────────
    def _request(self, method, url, *, params=None, data=None, json=None,
                 headers=None, timeout=None, _retried=False) -> Any:
        h = {'Authorization': f'Bearer {self.access_token()}'}
        if headers:
            h.update(headers)
        try:
            resp = requests.request(
                method=method, url=url, params=params, data=data, json=json,
                headers=h, timeout=timeout or self.timeout,
            )
        except requests.Timeout as e:
            raise PublishError(f'Google API timed out: {e}', code='timeout')
        except requests.RequestException as e:
            raise PublishError(f'Network error talking to Google API: {e}', code='network')

        # 401 → try one refresh + retry
        if resp.status_code == 401 and not _retried:
            logger.info('Google %s %s returned 401 — refreshing and retrying once',
                        method, _strip_qs(url))
            try:
                self._refresh_token()
            except (TokenExpiredError, PublishError):
                raise
            return self._request(method, url, params=params, data=data, json=json,
                                 headers=headers, timeout=timeout, _retried=True)

        return _map_response(method, url, resp)


# ── Response mapping ─────────────────────────────────────────────────────────
def _map_response(method: str, url: str, resp: requests.Response) -> Any:
    sc = resp.status_code
    body = _safe_json(resp)

    if 200 <= sc < 300:
        # Some endpoints return empty body (e.g. DELETE → 204)
        return body if body is not None else {'ok': True}

    err = (body or {}).get('error') or {}
    message = err.get('message') or (body or {}).get('raw') or f'HTTP {sc}'
    code = err.get('code') or sc
    reason = ''
    errors = err.get('errors') or []
    if errors and isinstance(errors, list):
        reason = (errors[0] or {}).get('reason') or ''

    logger.warning('Google %s %s failed status=%s code=%s reason=%s msg=%s',
                   method, _strip_qs(url), sc, code, reason, str(message)[:200])

    if sc == 401:
        raise TokenExpiredError(message, status_code=sc, raw=body)
    if sc == 403 and reason in ('forbidden', 'permissionDenied', 'insufficientPermissions'):
        raise PermissionDeniedError(message, status_code=sc, raw=body)
    if sc == 429 or reason in ('rateLimitExceeded', 'quotaExceeded', 'userRateLimitExceeded'):
        retry_after = _parse_retry_after(resp.headers)
        raise RateLimitError(message, retry_after=retry_after, status_code=sc, raw=body)
    if sc >= 500:
        raise PublishError(message, code='server_error', status_code=sc, raw=body)

    raise PublishError(message, code='google_error', status_code=sc, raw=body)


def _safe_json(resp):
    if resp.status_code == 204:
        return None
    try:
        return resp.json()
    except Exception:
        return {'raw': (resp.text or '')[:500]}


def _strip_qs(url: str) -> str:
    return url.split('?', 1)[0] if '?' in url else url


def _parse_retry_after(headers) -> Optional[int]:
    try:
        v = headers.get('Retry-After')
        return int(v) if v and str(v).isdigit() else None
    except Exception:
        return None
