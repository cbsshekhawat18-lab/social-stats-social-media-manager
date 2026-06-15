# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
GMBPublisher — Google Business Profile (formerly Google My Business).

API note: Google has split the legacy "My Business" v4 API into multiple
named services (BusinessInformation, AccountManagement, Notifications, Q&A,
etc.). The Local Posts CRUD endpoint still lives on the legacy host
`mybusiness.googleapis.com/v4/...` for partners that retained access. New
direct-developer access is restricted; agencies running through partner
programs continue to have full posting capability. Social Stats's manual-token mode
inherits whatever access the user's own Google Cloud project has.

Supported actions:
  publish_text   → creates a STANDARD local post
  publish_image  → uploads a media item attached to a STANDARD local post
  delete_post    → DELETE on the local post
  get_post_metrics → returns post metadata; engagement is via Insights API
                    (read-only, populated by sync tasks, not by this method)
  reply_to_review → POST a reply to a review

Unsupported:
  publish_video, publish_carousel, publish_story, publish_reel
  → raise PublishError(supported=False).
"""
from __future__ import annotations

import logging
from typing import Optional

import requests

from .base import (
    BasePublisher, PublishResult, PublishError,
    register_publisher,
)
from ._google_client import GoogleClient, LONG_TIMEOUT

logger = logging.getLogger(__name__)

API_BASE = 'https://mybusiness.googleapis.com/v4'

DEFAULT_POST_TOPIC_TYPE = 'STANDARD'  # STANDARD | EVENT | OFFER | ALERT


class GMBPublisher(BasePublisher):
    platform = 'google_my_business'
    MAX_TEXT_LENGTH = 1500
    MAX_IMAGE_BYTES = 5 * 1024 * 1024
    MAX_VIDEO_BYTES = 100 * 1024 * 1024
    MAX_VIDEO_SECONDS = 30
    SUPPORTED_TYPES = frozenset({'text', 'image'})

    # ── Public surface ───────────────────────────────────────────────────
    def publish_text(self, credential, content: str, **kwargs) -> PublishResult:
        return self._create_local_post(credential, content, image_url=None, **kwargs)

    def publish_image(self, credential, content: str, image_urls: list[str], **kwargs) -> PublishResult:
        if not image_urls:
            raise PublishError('At least one image URL is required', code='missing_media')
        if len(image_urls) > 1:
            # GMB local posts support a single media item; if multi, take the first
            # and warn through the result.
            return self._create_local_post(
                credential, content, image_url=image_urls[0],
                warnings=['GMB local posts only attach one image — extras dropped'],
                **kwargs,
            )
        return self._create_local_post(credential, content, image_url=image_urls[0], **kwargs)

    def delete_post(self, credential, platform_post_id: str) -> dict:
        client = GoogleClient(credential)
        # `platform_post_id` should be the full resource name returned by Google
        # e.g. accounts/{accountId}/locations/{locId}/localPosts/{postId}
        return client.delete(f'{API_BASE}/{platform_post_id}')

    def get_post_metrics(self, credential, platform_post_id: str) -> dict:
        client = GoogleClient(credential)
        return client.get(f'{API_BASE}/{platform_post_id}')

    def reply_to_review(self, credential, review_id: str, text: str, **kwargs) -> PublishResult:
        """
        `review_id` should be the full resource name:
            accounts/{accountId}/locations/{locId}/reviews/{reviewId}
        """
        client = GoogleClient(credential)
        access_token = client.access_token()
        resp = requests.put(
            f'{API_BASE}/{review_id}/reply',
            json={'comment': text},
            headers={'Authorization': f'Bearer {access_token}',
                     'Content-Type': 'application/json'},
            timeout=LONG_TIMEOUT,
        )
        if resp.status_code not in (200, 201):
            from ._google_client import _map_response
            _map_response('PUT', f'{API_BASE}/{review_id}/reply', resp)
        try:
            data = resp.json()
        except Exception:
            data = {}
        return PublishResult(
            success=True,
            platform_post_id=review_id,
            raw_response=data,
            warnings=[],
        )

    # ── Internals ────────────────────────────────────────────────────────
    def _create_local_post(self, credential, content: str, *,
                           image_url: Optional[str], warnings=None,
                           **kwargs) -> PublishResult:
        self._require_gmb(credential)
        client = GoogleClient(credential, timeout=LONG_TIMEOUT)

        parent = self._location_resource(credential)
        body = {
            'languageCode': kwargs.get('language_code', 'en'),
            'summary':      content or '',
            'topicType':    (kwargs.get('topic_type') or DEFAULT_POST_TOPIC_TYPE).upper(),
        }
        if kwargs.get('cta_action_type') and kwargs.get('cta_url'):
            body['callToAction'] = {
                'actionType': kwargs['cta_action_type'].upper(),
                'url':        kwargs['cta_url'],
            }
        if image_url:
            body['media'] = [{'mediaFormat': 'PHOTO', 'sourceUrl': image_url}]
        # Optional event/offer attributes
        if body['topicType'] == 'EVENT' and kwargs.get('event'):
            body['event'] = kwargs['event']
        if body['topicType'] == 'OFFER' and kwargs.get('offer'):
            body['offer'] = kwargs['offer']

        resp = client.post(f'{API_BASE}/{parent}/localPosts', json=body)
        post_resource = resp.get('name', '')
        return PublishResult(
            success=True,
            platform_post_id=post_resource,
            platform_url=resp.get('searchUrl', ''),
            raw_response=resp,
            warnings=warnings or [],
        )

    def _location_resource(self, credential) -> str:
        acct = (credential.gmb_account_id or '').strip()
        loc  = (credential.gmb_location_id or '').strip()
        if not acct or not loc:
            raise PublishError(
                'PlatformCredential.gmb_account_id / gmb_location_id missing',
                code='missing_config',
            )
        # Allow callers to pass either bare IDs ("12345") or already-prefixed
        # resource paths ("accounts/12345").
        acct = acct if acct.startswith('accounts/') else f'accounts/{acct}'
        loc = loc if loc.startswith(('locations/', f'{acct}/locations/')) else f'locations/{loc}'
        if not loc.startswith(f'{acct}/'):
            loc = f'{acct}/{loc}'
        return loc

    def _require_gmb(self, credential):
        if not getattr(credential, 'gmb_account_id', None) or not getattr(credential, 'gmb_location_id', None):
            raise PublishError(
                'PlatformCredential.gmb_account_id and gmb_location_id are required',
                code='missing_config',
            )
        if not (getattr(credential, 'access_token', None) or getattr(credential, 'refresh_token', None)):
            raise PublishError('No access_token or refresh_token on credential', code='missing_config')


# Self-register on import
register_publisher('google_my_business', GMBPublisher)
