# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
LinkedInPublisher — publishes to a LinkedIn Company Page via the v2 REST API.

Auth: Bearer token (PlatformCredential.access_token). The author URN is
`urn:li:organization:{organization_id}` — built from credential.organization_id.

Image / video posts use the 3-step "register upload → PUT bytes → create post"
flow. Carousels are multi-image posts referencing several uploaded image URNs.

Supported actions:
  publish_text, publish_image (1 / N), publish_carousel, publish_video
  delete_post, get_post_metrics, reply_to_comment

Unsupported on LinkedIn:
  publish_story, publish_reel
  → raise PublishError(supported=False).
"""
from __future__ import annotations

import logging
import os
import tempfile
from typing import Optional

import requests

from .base import (
    BasePublisher, PublishResult, PublishError,
    register_publisher,
)

logger = logging.getLogger(__name__)

API_BASE = 'https://api.linkedin.com'
DEFAULT_TIMEOUT = (10, 30)
LONG_TIMEOUT = (15, 180)

# LinkedIn requires Versioning header for v2 REST endpoints. Use a fixed,
# stable version; bump as needed. https://learn.microsoft.com/linkedin/marketing
LINKEDIN_VERSION = '202404'


class LinkedInPublisher(BasePublisher):
    platform = 'linkedin'
    MAX_TEXT_LENGTH = 3000
    MAX_IMAGE_BYTES = 5 * 1024 * 1024
    MAX_VIDEO_BYTES = 5 * 1024 * 1024 * 1024
    MAX_VIDEO_SECONDS = 10 * 60
    SUPPORTED_TYPES = frozenset({'text', 'image', 'video', 'carousel'})

    # ── Public surface ───────────────────────────────────────────────────
    def publish_text(self, credential, content: str, **kwargs) -> PublishResult:
        self._require_org(credential)
        body = {
            'author':            self._author_urn(credential),
            'commentary':        content or '',
            'visibility':        'PUBLIC',
            'distribution': {
                'feedDistribution':                'MAIN_FEED',
                'targetEntities':                  [],
                'thirdPartyDistributionChannels':  [],
            },
            'lifecycleState':    'PUBLISHED',
            'isReshareDisabledByAuthor': False,
        }
        resp = self._post('/rest/posts', credential, json=body)
        # Non-JSON 201 — LinkedIn returns the post URN in `x-restli-id` header
        post_urn = resp.get('x-restli-id') or resp.get('id') or ''
        return PublishResult(
            success=True,
            platform_post_id=post_urn,
            platform_url=self._post_url(post_urn),
            raw_response=resp,
        )

    def publish_image(self, credential, content: str, image_urls: list[str], **kwargs) -> PublishResult:
        self._require_org(credential)
        if not image_urls:
            raise PublishError('At least one image URL is required', code='missing_media')

        # Single image
        if len(image_urls) == 1:
            image_urn = self._upload_image(credential, image_urls[0])
            body = {
                'author':         self._author_urn(credential),
                'commentary':     content or '',
                'visibility':     'PUBLIC',
                'distribution':   {'feedDistribution': 'MAIN_FEED', 'targetEntities': [], 'thirdPartyDistributionChannels': []},
                'content': {
                    'media': {'id': image_urn, 'altText': kwargs.get('alt_text', '')},
                },
                'lifecycleState': 'PUBLISHED',
                'isReshareDisabledByAuthor': False,
            }
            resp = self._post('/rest/posts', credential, json=body)
            post_urn = resp.get('x-restli-id') or resp.get('id') or ''
            return PublishResult(success=True, platform_post_id=post_urn,
                                 platform_url=self._post_url(post_urn),
                                 raw_response=resp)

        # Multi-image → carousel
        return self.publish_carousel(credential, content, image_urls, **kwargs)

    def publish_video(self, credential, content: str, video_url: str, *,
                      thumbnail: Optional[str] = None, **kwargs) -> PublishResult:
        self._require_org(credential)
        video_urn = self._upload_video(credential, video_url)
        body = {
            'author':         self._author_urn(credential),
            'commentary':     content or '',
            'visibility':     'PUBLIC',
            'distribution':   {'feedDistribution': 'MAIN_FEED', 'targetEntities': [], 'thirdPartyDistributionChannels': []},
            'content': {
                'media': {
                    'id': video_urn,
                    'title': kwargs.get('title', '')[:200],
                },
            },
            'lifecycleState': 'PUBLISHED',
            'isReshareDisabledByAuthor': False,
        }
        resp = self._post('/rest/posts', credential, json=body)
        post_urn = resp.get('x-restli-id') or resp.get('id') or ''
        return PublishResult(success=True, platform_post_id=post_urn,
                             platform_url=self._post_url(post_urn),
                             raw_response=resp)

    def publish_carousel(self, credential, content: str, image_urls: list[str], **kwargs) -> PublishResult:
        self._require_org(credential)
        if len(image_urls) < 2:
            raise PublishError('Carousel needs ≥2 images', code='missing_media')
        if len(image_urls) > 20:
            raise PublishError('LinkedIn carousel max 20 images', code='too_many_media')

        urns = [self._upload_image(credential, u) for u in image_urls]
        body = {
            'author':         self._author_urn(credential),
            'commentary':     content or '',
            'visibility':     'PUBLIC',
            'distribution':   {'feedDistribution': 'MAIN_FEED', 'targetEntities': [], 'thirdPartyDistributionChannels': []},
            'content': {
                'multiImage': {
                    'images': [{'id': u, 'altText': ''} for u in urns],
                },
            },
            'lifecycleState': 'PUBLISHED',
            'isReshareDisabledByAuthor': False,
        }
        resp = self._post('/rest/posts', credential, json=body)
        post_urn = resp.get('x-restli-id') or resp.get('id') or ''
        return PublishResult(success=True, platform_post_id=post_urn,
                             platform_url=self._post_url(post_urn),
                             raw_response=resp)

    def delete_post(self, credential, platform_post_id: str) -> dict:
        # LinkedIn URNs need to be URL-encoded in the path
        from urllib.parse import quote
        urn = quote(platform_post_id, safe='')
        return self._request('DELETE', f'/rest/posts/{urn}', credential)

    def get_post_metrics(self, credential, platform_post_id: str) -> dict:
        from urllib.parse import quote
        urn = quote(platform_post_id, safe='')
        # socialActions returns likes/comments/shares counts
        return self._request('GET', f'/rest/socialActions/{urn}', credential)

    def reply_to_comment(self, credential, comment_id: str, text: str, **kwargs) -> PublishResult:
        from urllib.parse import quote
        # comment_id should be the parent URN (e.g. urn:li:share:xxx)
        parent = quote(comment_id, safe='')
        body = {
            'actor':   self._author_urn(credential),
            'message': {'text': text},
        }
        resp = self._post(f'/rest/socialActions/{parent}/comments', credential, json=body)
        return PublishResult(success=True, platform_post_id=resp.get('id', ''), raw_response=resp)

    # ── Internals ────────────────────────────────────────────────────────
    def _author_urn(self, credential) -> str:
        org_id = str(credential.organization_id or '').strip()
        if org_id.startswith('urn:li:'):
            return org_id
        return f'urn:li:organization:{org_id}'

    def _post_url(self, post_urn: str) -> str:
        # ugc-style URNs: urn:li:share:7000... → https://www.linkedin.com/feed/update/urn:li:activity:..
        # The activity ID and share ID don't always match; just fall back to the URN.
        if not post_urn:
            return ''
        return f'https://www.linkedin.com/feed/update/{post_urn}'

    # ── HTTP plumbing ────────────────────────────────────────────────────
    def _headers(self, credential) -> dict:
        return {
            'Authorization':              f'Bearer {credential.access_token}',
            'X-Restli-Protocol-Version':  '2.0.0',
            'LinkedIn-Version':           LINKEDIN_VERSION,
            'Content-Type':               'application/json',
        }

    def _post(self, path: str, credential, *, json=None) -> dict:
        return self._request('POST', path, credential, json=json)

    def _request(self, method: str, path: str, credential, *, json=None,
                 params=None, timeout=None, headers=None) -> dict:
        url = f'{API_BASE}{path if path.startswith("/") else "/" + path}'
        h = self._headers(credential)
        if headers:
            h.update(headers)
        try:
            resp = requests.request(
                method=method, url=url,
                json=json, params=params, headers=h,
                timeout=timeout or DEFAULT_TIMEOUT,
            )
        except requests.RequestException as e:
            raise PublishError(f'Network error talking to LinkedIn: {e}', code='network')
        return _map_linkedin_response(method, url, resp)

    # ── Image upload (3 calls) ───────────────────────────────────────────
    def _upload_image(self, credential, image_url: str) -> str:
        # Step 1: register upload
        init = self._post('/rest/images?action=initializeUpload', credential, json={
            'initializeUploadRequest': {
                'owner': self._author_urn(credential),
            },
        })
        value = (init or {}).get('value') or init or {}
        upload_url = value.get('uploadUrl')
        image_urn = value.get('image')
        if not upload_url or not image_urn:
            raise PublishError('LinkedIn image init missing uploadUrl/image', raw=init)

        # Step 2: download bytes from the public URL
        bytes_ = self._download(image_url)

        # Step 3: PUT bytes to upload_url (no auth header — pre-signed)
        try:
            put_resp = requests.put(
                upload_url, data=bytes_,
                headers={'Authorization': f'Bearer {credential.access_token}'},
                timeout=LONG_TIMEOUT,
            )
        except requests.RequestException as e:
            raise PublishError(f'Network error during LinkedIn image upload: {e}', code='network')
        if put_resp.status_code not in (200, 201):
            raise PublishError(
                f'LinkedIn rejected image bytes (status {put_resp.status_code})',
                status_code=put_resp.status_code,
                raw=put_resp.text[:300],
            )
        return image_urn

    def _upload_video(self, credential, video_url: str) -> str:
        init = self._post('/rest/videos?action=initializeUpload', credential, json={
            'initializeUploadRequest': {
                'owner': self._author_urn(credential),
                'fileSizeBytes': 0,  # 0 = let LinkedIn infer; for huge files prefer chunked
                'uploadCaptions': False,
                'uploadThumbnail': False,
            },
        })
        value = (init or {}).get('value') or init or {}
        upload_instructions = value.get('uploadInstructions') or []
        video_urn = value.get('video')
        if not upload_instructions or not video_urn:
            raise PublishError('LinkedIn video init missing uploadInstructions/video', raw=init)

        bytes_ = self._download(video_url)

        # LinkedIn returns a single instruction for small videos (one-PUT),
        # and multiple for chunked. Handle the single-PUT case here.
        first = upload_instructions[0]
        upload_url = first.get('uploadUrl')
        try:
            put_resp = requests.put(
                upload_url, data=bytes_,
                headers={'Authorization': f'Bearer {credential.access_token}'},
                timeout=LONG_TIMEOUT,
            )
        except requests.RequestException as e:
            raise PublishError(f'Network error during LinkedIn video upload: {e}', code='network')
        if put_resp.status_code not in (200, 201):
            raise PublishError(
                f'LinkedIn rejected video bytes (status {put_resp.status_code})',
                status_code=put_resp.status_code, raw=put_resp.text[:300],
            )

        # Step 3: finalize
        self._post('/rest/videos?action=finalizeUpload', credential, json={
            'finalizeUploadRequest': {
                'video': video_urn,
                'uploadToken': first.get('uploadToken', ''),
                'uploadedPartIds': [],
            },
        })
        return video_urn

    def _download(self, url: str) -> bytes:
        try:
            with requests.get(url, stream=True, timeout=LONG_TIMEOUT) as resp:
                if resp.status_code != 200:
                    raise PublishError(
                        f'Failed to download media (status {resp.status_code})',
                        code='media_unreachable',
                    )
                return resp.content
        except requests.RequestException as e:
            raise PublishError(f'Network error downloading media: {e}', code='network')

    def _require_org(self, credential):
        if not getattr(credential, 'organization_id', None):
            raise PublishError('PlatformCredential.organization_id is missing', code='missing_config')
        if not getattr(credential, 'access_token', None):
            raise PublishError('PlatformCredential.access_token is missing', code='missing_config')


# ── Response mapping ─────────────────────────────────────────────────────────
def _map_linkedin_response(method: str, url: str, resp: requests.Response) -> dict:
    sc = resp.status_code

    # Pull the post URN from the x-restli-id header into the body for the caller
    rest_li_id = resp.headers.get('x-restli-id') or resp.headers.get('X-RestLi-Id')

    try:
        body = resp.json() if resp.content else {}
    except ValueError:
        body = {'raw': (resp.text or '')[:300]}

    if 200 <= sc < 300:
        if rest_li_id and isinstance(body, dict):
            body = {**body, 'x-restli-id': rest_li_id}
        return body

    msg = (body or {}).get('message') or (body or {}).get('error') or f'HTTP {sc}'
    code = (body or {}).get('serviceErrorCode') or sc

    logger.warning('LinkedIn %s %s failed status=%s code=%s msg=%s',
                   method, url.split('?')[0], sc, code, str(msg)[:200])

    from .base import TokenExpiredError, PermissionDeniedError, RateLimitError
    if sc == 401:
        raise TokenExpiredError(msg, status_code=sc, raw=body)
    if sc == 403:
        raise PermissionDeniedError(msg, status_code=sc, raw=body)
    if sc == 429:
        raise RateLimitError(msg, status_code=sc, raw=body)
    if sc >= 500:
        raise PublishError(msg, code='server_error', status_code=sc, raw=body)
    raise PublishError(msg, code='linkedin_error', status_code=sc, raw=body)


# Self-register on import
register_publisher('linkedin', LinkedInPublisher)
