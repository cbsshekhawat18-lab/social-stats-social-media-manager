# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
FacebookPublisher — publishes to a Facebook Page via the Graph API.

Uses the Page access token stored in PlatformCredential.access_token. All Graph
calls go through GraphClient so error mapping is consistent.

Supported actions:
  publish_text                — POST /{page_id}/feed
  publish_image  (1)          — POST /{page_id}/photos
  publish_image  (n) / carousel — uploads N photos as published=false, then a
                                  feed post with attached_media[]
  publish_video               — POST /{page_id}/videos
  delete_post                 — DELETE /{post_id}
  get_post_metrics            — GET /{post_id}/insights
  reply_to_comment            — POST /{comment_id}/comments
  reply_to_dm                 — POST /me/messages (Page Inbox)

Scheduling:
  Pass scheduled_publish_time=<unix-seconds> AND published=False in kwargs to
  schedule the post. Meta requires the timestamp to be 10+ minutes in the
  future and within ~6 months. The orchestrator handles validation upstream.

Reels / Stories:
  Stories aren't supported on Pages (Meta deprecated Page stories API).
  Reels are still supported via /{page_id}/video_reels — implemented in
  publish_reel.
"""
from __future__ import annotations

import logging
from typing import Optional

from .base import (
    BasePublisher, PublishResult, PublishError,
    register_publisher,
)
from ._graph_client import GraphClient, LONG_TIMEOUT

logger = logging.getLogger(__name__)


class FacebookPublisher(BasePublisher):
    platform = 'facebook'
    MAX_TEXT_LENGTH = 63206
    MAX_IMAGE_BYTES = 10 * 1024 * 1024
    MAX_VIDEO_BYTES = 4 * 1024 * 1024 * 1024
    MAX_VIDEO_SECONDS = 240 * 60
    SUPPORTED_TYPES = frozenset({'text', 'image', 'video', 'carousel', 'reel'})

    # ── Public surface ────────────────────────────────────────────────────
    def publish_text(self, credential, content: str, **kwargs) -> PublishResult:
        self._require_page(credential)
        client = GraphClient(credential.access_token)
        params = self._scheduling_params(kwargs)
        body = client.post(
            f'/{credential.page_id}/feed',
            data={'message': content or '', **params},
        )
        return self._result(credential, body, post_id=body.get('id') or body.get('post_id'))

    def publish_image(self, credential, content: str, image_urls: list[str], **kwargs) -> PublishResult:
        self._require_page(credential)
        if not image_urls:
            raise PublishError('At least one image URL is required', code='missing_media')
        if len(image_urls) == 1:
            return self._publish_single_photo(credential, content, image_urls[0], **kwargs)
        return self._publish_multi_photo(credential, content, image_urls, **kwargs)

    def publish_video(self, credential, content: str, video_url: str, *,
                      thumbnail: Optional[str] = None, **kwargs) -> PublishResult:
        self._require_page(credential)
        client = GraphClient(credential.access_token, timeout=LONG_TIMEOUT)
        params = self._scheduling_params(kwargs)
        data = {'description': content or '', 'file_url': video_url, **params}
        if thumbnail:
            data['thumb'] = thumbnail
        title = kwargs.get('title')
        if title:
            data['title'] = title
        body = client.post(f'/{credential.page_id}/videos', data=data)
        post_id = body.get('post_id') or body.get('id')
        return self._result(credential, body, post_id=post_id)

    def publish_carousel(self, credential, content: str, image_urls: list[str], **kwargs) -> PublishResult:
        # Same machinery as multi-photo
        return self._publish_multi_photo(credential, content, image_urls, **kwargs)

    def publish_reel(self, credential, video_url: str, content: str, **kwargs) -> PublishResult:
        """Page Reels — POST /{page_id}/video_reels. 3-step flow handled by Meta."""
        self._require_page(credential)
        client = GraphClient(credential.access_token, timeout=LONG_TIMEOUT)
        # Step 1: initiate upload session
        init = client.post(
            f'/{credential.page_id}/video_reels',
            data={'upload_phase': 'start'},
        )
        upload_url = init.get('upload_url')
        video_id = init.get('video_id')
        if not upload_url or not video_id:
            raise PublishError('Reel init did not return upload_url/video_id', raw=init)
        # Step 2: hand the URL to Meta to pull (file_url method)
        # Note: real implementation would PUT the bytes to upload_url; for now we
        # use the file_url path if provided (Meta accepts both).
        client.post(
            f'/{credential.page_id}/video_reels',
            data={'upload_phase': 'finish', 'video_id': video_id,
                  'video_state': 'PUBLISHED', 'description': content or '',
                  'file_url': video_url},
        )
        return PublishResult(
            success=True,
            platform_post_id=video_id,
            platform_url=f'https://www.facebook.com/reel/{video_id}',
        )

    def delete_post(self, credential, platform_post_id: str) -> dict:
        client = GraphClient(credential.access_token)
        return client.delete(f'/{platform_post_id}')

    def get_post_metrics(self, credential, platform_post_id: str) -> dict:
        client = GraphClient(credential.access_token)
        metrics = ','.join([
            'post_impressions', 'post_impressions_unique',
            'post_reactions_by_type_total', 'post_clicks',
            'post_video_views', 'post_video_view_time',
        ])
        return client.get(f'/{platform_post_id}/insights', params={'metric': metrics})

    def reply_to_comment(self, credential, comment_id: str, text: str, **kwargs) -> PublishResult:
        client = GraphClient(credential.access_token)
        body = client.post(f'/{comment_id}/comments', data={'message': text})
        return PublishResult(success=True, platform_post_id=body.get('id', ''),
                             raw_response=body)

    def reply_to_dm(self, credential, conversation_id: str, text: str, *,
                    media: Optional[list] = None, **kwargs) -> PublishResult:
        """Page Inbox messaging API. `recipient` is the PSID, not conversation_id."""
        client = GraphClient(credential.access_token)
        psid = kwargs.get('psid') or conversation_id
        body = client.post(
            f'/{credential.page_id}/messages',
            json={
                'recipient': {'id': psid},
                'messaging_type': 'RESPONSE',
                'message': {'text': text},
            },
        )
        return PublishResult(success=True, platform_post_id=body.get('message_id', ''),
                             raw_response=body)

    # ── Internals ─────────────────────────────────────────────────────────
    def _publish_single_photo(self, credential, content: str, image_url: str, **kwargs) -> PublishResult:
        client = GraphClient(credential.access_token, timeout=LONG_TIMEOUT)
        params = self._scheduling_params(kwargs)
        body = client.post(
            f'/{credential.page_id}/photos',
            data={'url': image_url, 'caption': content or '', **params},
        )
        post_id = body.get('post_id') or body.get('id')
        return self._result(credential, body, post_id=post_id)

    def _publish_multi_photo(self, credential, content: str, image_urls: list[str], **kwargs) -> PublishResult:
        client = GraphClient(credential.access_token, timeout=LONG_TIMEOUT)
        # 1. Upload each photo unpublished
        media_ids = []
        for url in image_urls:
            up = client.post(
                f'/{credential.page_id}/photos',
                data={'url': url, 'published': 'false'},
            )
            mid = up.get('id')
            if not mid:
                raise PublishError('Photo upload missing id', raw=up)
            media_ids.append(mid)

        # 2. Create feed post referencing the unpublished photos
        attached = [{'media_fbid': mid} for mid in media_ids]
        params = self._scheduling_params(kwargs)
        body = client.post(
            f'/{credential.page_id}/feed',
            json={
                'message': content or '',
                'attached_media': attached,
                **params,
            },
        )
        post_id = body.get('id') or body.get('post_id')
        return self._result(credential, body, post_id=post_id)

    def _scheduling_params(self, kwargs: dict) -> dict:
        """Translate caller scheduling kwargs into Graph parameters."""
        out = {}
        if kwargs.get('scheduled_publish_time'):
            out['published'] = 'false'
            out['scheduled_publish_time'] = int(kwargs['scheduled_publish_time'])
        elif kwargs.get('published') is False:
            out['published'] = 'false'
        return out

    def _require_page(self, credential):
        if not getattr(credential, 'page_id', None):
            raise PublishError('PlatformCredential.page_id is missing', code='missing_config')
        if not getattr(credential, 'access_token', None):
            raise PublishError('PlatformCredential.access_token is missing', code='missing_config')

    def _result(self, credential, body: dict, *, post_id: Optional[str]) -> PublishResult:
        url = ''
        if post_id and credential.page_id:
            # post_id arrives in the form "{page_id}_{post_short_id}"; URL works either way
            url = f'https://www.facebook.com/{post_id}'
        return PublishResult(
            success=True,
            platform_post_id=str(post_id or ''),
            platform_url=url,
            raw_response=body,
        )


# Self-register on import
register_publisher('facebook', FacebookPublisher)
