# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Shared Meta Graph API helper used by FacebookPublisher and InstagramPublisher.

Provides:
  - GraphClient: thin wrapper around requests with consistent timeouts,
    auth header injection, and centralized error → typed-exception mapping.
  - GRAPH_VERSION constant matching the rest of the codebase.

Error mapping cheatsheet (see Meta Graph API error codes):
  code 190             → TokenExpiredError
  code 4   (rate)      → RateLimitError
  code 17  (user rate) → RateLimitError
  code 32  (page rate) → RateLimitError
  code 200/210 (perm)  → PermissionDeniedError
  code 506 (duplicate) → PublishError(code='duplicate')
  HTTP 429             → RateLimitError
  HTTP 5xx             → PublishError (caller may retry)
"""
from __future__ import annotations

import logging
from typing import Any, Optional

import requests

from .base import (
    PublishError, TokenExpiredError, RateLimitError, PermissionDeniedError,
    MediaTooLargeError,
)

logger = logging.getLogger(__name__)

GRAPH_VERSION = 'v21.0'
GRAPH_BASE = f'https://graph.facebook.com/{GRAPH_VERSION}'

# (connect, read) — videos take longer to upload, callers can override per call.
DEFAULT_TIMEOUT = (10, 30)
LONG_TIMEOUT = (15, 120)

# Subset of Graph error codes worth mapping explicitly. Anything else falls
# through to a generic PublishError carrying the platform's message.
_TOKEN_EXPIRED_CODES = {190}
_PERMISSION_CODES    = {200, 210, 220, 230, 240, 100}  # 100 = "Invalid parameter / permission"
_RATE_LIMIT_CODES    = {4, 17, 32, 613}
_DUPLICATE_CODES     = {506}
_MEDIA_TOO_LARGE_CODES = {1366046, 36000}


class GraphClient:
    """
    Tiny HTTP wrapper. Stateless aside from the optional `default_token`,
    which the Facebook publisher passes per-call but the Instagram publisher
    sometimes pins (the page token used for IG is the same as FB's).
    """

    def __init__(self, access_token: Optional[str] = None, *, timeout=DEFAULT_TIMEOUT):
        self.access_token = access_token
        self.timeout = timeout

    # ── Public helpers ────────────────────────────────────────────────────
    def get(self, path: str, *, params: Optional[dict] = None, access_token: Optional[str] = None,
            timeout=None) -> dict:
        return self._request('GET', path, params=params, access_token=access_token, timeout=timeout)

    def post(self, path: str, *, params: Optional[dict] = None, data: Optional[dict] = None,
             json: Optional[dict] = None, files: Optional[dict] = None,
             access_token: Optional[str] = None, timeout=None) -> dict:
        return self._request('POST', path, params=params, data=data, json=json, files=files,
                             access_token=access_token, timeout=timeout)

    def delete(self, path: str, *, params: Optional[dict] = None, access_token: Optional[str] = None,
               timeout=None) -> dict:
        return self._request('DELETE', path, params=params, access_token=access_token, timeout=timeout)

    # ── Internals ─────────────────────────────────────────────────────────
    def _request(self, method: str, path: str, *,
                 params=None, data=None, json=None, files=None,
                 access_token=None, timeout=None) -> dict:
        url = path if path.startswith('http') else f'{GRAPH_BASE}{path if path.startswith("/") else "/" + path}'
        params = dict(params or {})
        token = access_token or self.access_token
        if token and 'access_token' not in params:
            params['access_token'] = token

        try:
            resp = requests.request(
                method=method,
                url=url,
                params=params,
                data=data,
                json=json,
                files=files,
                timeout=timeout or self.timeout,
            )
        except requests.Timeout as e:
            raise PublishError(f'Meta Graph timed out: {e}', code='timeout', raw=str(e))
        except requests.RequestException as e:
            raise PublishError(f'Network error talking to Meta Graph: {e}', code='network', raw=str(e))

        return _map_response(method, url, resp)


def _map_response(method: str, url: str, resp: requests.Response) -> dict:
    """Convert HTTP + Meta error envelopes into typed exceptions or parsed JSON."""
    try:
        body = resp.json()
    except ValueError:
        body = {'raw': resp.text[:500]}

    sc = resp.status_code

    # 2xx → success
    if 200 <= sc < 300 and not (isinstance(body, dict) and 'error' in body):
        return body

    err = (body or {}).get('error') or {}
    code = err.get('code') or err.get('error_subcode') or 0
    message = err.get('message') or body.get('raw') or f'HTTP {sc}'
    subcode = err.get('error_subcode') or 0

    # Sanitize logging — never log access_token query string back
    logger.warning('Graph %s %s failed status=%s code=%s subcode=%s msg=%s',
                   method, _strip_token(url), sc, code, subcode, message[:200])

    # Map specific error codes
    if code in _TOKEN_EXPIRED_CODES or err.get('type') == 'OAuthException' and code == 190:
        raise TokenExpiredError(message, status_code=sc, raw=body)
    if code in _PERMISSION_CODES:
        raise PermissionDeniedError(message, status_code=sc, raw=body)
    if code in _RATE_LIMIT_CODES or sc == 429:
        retry_after = _parse_retry_after(resp.headers)
        raise RateLimitError(message, retry_after=retry_after, status_code=sc, raw=body)
    if code in _MEDIA_TOO_LARGE_CODES:
        raise MediaTooLargeError(message, status_code=sc, raw=body)
    if code in _DUPLICATE_CODES:
        raise PublishError(message, code='duplicate', status_code=sc, raw=body)

    # Server errors — caller may retry
    if sc >= 500:
        raise PublishError(message, code='server_error', status_code=sc, raw=body)

    # Generic failure
    raise PublishError(message, code='graph_error', status_code=sc, raw=body)


def _strip_token(url: str) -> str:
    if 'access_token=' not in url:
        return url
    head, _, tail = url.partition('access_token=')
    rest = tail.split('&', 1)[1] if '&' in tail else ''
    return head + 'access_token=***' + (('&' + rest) if rest else '')


def _parse_retry_after(headers) -> Optional[int]:
    try:
        v = headers.get('Retry-After') or headers.get('X-Business-Use-Case-Usage')
        return int(v) if v and str(v).isdigit() else None
    except Exception:
        return None
