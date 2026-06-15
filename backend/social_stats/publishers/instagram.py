# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
InstagramPublisher — publishes to an IG Business/Creator account via the
Graph API's Content Publishing endpoints.

Auth: same Page Access Token that connects the parent Facebook Page (stored
in PlatformCredential.access_token). Target account is in
PlatformCredential.instagram_account_id.

Two-step container flow:
  1. POST /{ig_id}/media           — create a media container (returns container_id)
  2. POST /{ig_id}/media_publish   — publish the container
For VIDEO / REEL containers, step 1 returns immediately but the container
needs to "finish" before we can publish; we poll status_code until FINISHED.

Supported actions:
  publish_image (1 / N), publish_video, publish_reel, publish_story, publish_carousel
  delete_post (limited — IG only allows delete on a subset of media types)
  get_post_metrics
  reply_to_comment, reply_to_dm
"""
from __future__ import annotations

import logging
import time
from typing import Optional

from .base import (
    BasePublisher, PublishResult, PublishError,
    register_publisher,
)
from ._graph_client import GraphClient, LONG_TIMEOUT

logger = logging.getLogger(__name__)


CONTAINER_POLL_INTERVAL = 3   # seconds between polls
CONTAINER_POLL_TIMEOUT  = 180 # max seconds to wait for video container


class InstagramPublisher(BasePublisher):
    platform = 'instagram'
    MAX_TEXT_LENGTH = 2200      # caption cap on feed posts
    MAX_IMAGE_BYTES = 8 * 1024 * 1024
    MAX_VIDEO_BYTES = 1024 * 1024 * 1024
    MAX_VIDEO_SECONDS = 90      # IG Reels limit; feed video is shorter
    SUPPORTED_TYPES = frozenset({'image', 'video', 'carousel', 'reel', 'story'})

    # ── Public surface ───────────────────────────────────────────────────
    def publish_image(self, credential, content: str, image_urls: list[str], **kwargs) -> PublishResult:
        self._require_ig(credential)
        if not image_urls:
            raise PublishError('At least one image URL is required', code='missing_media')

        if len(image_urls) == 1:
            container_id = self._create_image_container(credential, image_urls[0], caption=content)
            return self._publish_container(credential, container_id)

        return self.publish_carousel(credential, content, image_urls, **kwargs)

    def publish_video(self, credential, content: str, video_url: str, *,
                      thumbnail: Optional[str] = None, **kwargs) -> PublishResult:
        self._require_ig(credential)
        client = GraphClient(credential.access_token, timeout=LONG_TIMEOUT)
        data = {
            'media_type':  'VIDEO',
            'video_url':   video_url,
            'caption':     content or '',
        }
        if thumbnail:
            data['thumb_offset'] = kwargs.get('thumb_offset', 0)
        body = client.post(f'/{credential.instagram_account_id}/media', data=data)
        container_id = body.get('id')
        if not container_id:
            raise PublishError('IG media container missing id', raw=body)
        self._wait_for_container_ready(credential, container_id)
        return self._publish_container(credential, container_id)

    def publish_reel(self, credential, video_url: str, content: str, **kwargs) -> PublishResult:
        self._require_ig(credential)
        client = GraphClient(credential.access_token, timeout=LONG_TIMEOUT)
        data = {
            'media_type':  'REELS',
            'video_url':   video_url,
            'caption':     content or '',
        }
        if kwargs.get('share_to_feed') is not None:
            data['share_to_feed'] = 'true' if kwargs['share_to_feed'] else 'false'
        if kwargs.get('cover_url'):
            data['cover_url'] = kwargs['cover_url']
        body = client.post(f'/{credential.instagram_account_id}/media', data=data)
        container_id = body.get('id')
        if not container_id:
            raise PublishError('IG reel container missing id', raw=body)
        self._wait_for_container_ready(credential, container_id)
        return self._publish_container(credential, container_id)

    def publish_story(self, credential, media_url: str, **kwargs) -> PublishResult:
        self._require_ig(credential)
        client = GraphClient(credential.access_token, timeout=LONG_TIMEOUT)
        # Decide whether the story is image or video based on caller hint;
        # default to image (most common).
        media_type = (kwargs.get('media_type') or '').upper()
        if not media_type:
            media_type = 'VIDEO' if str(media_url).lower().endswith(('.mp4', '.mov', '.webm')) else 'IMAGE'

        data = {'media_type': 'STORIES'}  # IG story marker
        if media_type == 'IMAGE':
            data['image_url'] = media_url
        else:
            data['video_url'] = media_url

        body = client.post(f'/{credential.instagram_account_id}/media', data=data)
        container_id = body.get('id')
        if not container_id:
            raise PublishError('IG story container missing id', raw=body)
        if media_type == 'VIDEO':
            self._wait_for_container_ready(credential, container_id)
        return self._publish_container(credential, container_id)

    def publish_carousel(self, credential, content: str, image_urls: list[str], **kwargs) -> PublishResult:
        self._require_ig(credential)
        if len(image_urls) < 2:
            raise PublishError('Carousel needs ≥2 items', code='missing_media')
        if len(image_urls) > 10:
            raise PublishError('IG carousel max 10 items', code='too_many_media')

        client = GraphClient(credential.access_token, timeout=LONG_TIMEOUT)

        # 1. Create children (each with is_carousel_item=true)
        children = []
        for url in image_urls:
            is_video = str(url).lower().endswith(('.mp4', '.mov', '.webm'))
            data = {'is_carousel_item': 'true'}
            if is_video:
                data['media_type'] = 'VIDEO'
                data['video_url'] = url
            else:
                data['image_url'] = url
            child_body = client.post(f'/{credential.instagram_account_id}/media', data=data)
            cid = child_body.get('id')
            if not cid:
                raise PublishError('IG carousel child missing id', raw=child_body)
            if is_video:
                self._wait_for_container_ready(credential, cid)
            children.append(cid)

        # 2. Create the CAROUSEL container that bundles them
        carousel = client.post(
            f'/{credential.instagram_account_id}/media',
            data={
                'media_type': 'CAROUSEL',
                'children':   ','.join(children),
                'caption':    content or '',
            },
        )
        container_id = carousel.get('id')
        if not container_id:
            raise PublishError('IG carousel container missing id', raw=carousel)
        self._wait_for_container_ready(credential, container_id)
        return self._publish_container(credential, container_id)

    def publish_text(self, credential, content: str, **kwargs):
        # IG requires media — can't post text-only.
        raise PublishError('Instagram requires media — text-only posts are not supported',
                           code='unsupported', supported=False)

    def delete_post(self, credential, platform_post_id: str) -> dict:
        client = GraphClient(credential.access_token)
        return client.delete(f'/{platform_post_id}')

    def get_post_metrics(self, credential, platform_post_id: str) -> dict:
        client = GraphClient(credential.access_token)
        metrics = ','.join(['impressions', 'reach', 'engagement', 'saved', 'video_views'])
        return client.get(f'/{platform_post_id}/insights', params={'metric': metrics})

    def reply_to_comment(self, credential, comment_id: str, text: str, **kwargs) -> PublishResult:
        client = GraphClient(credential.access_token)
        body = client.post(f'/{comment_id}/replies', data={'message': text})
        return PublishResult(success=True, platform_post_id=body.get('id', ''), raw_response=body)

    def reply_to_dm(self, credential, conversation_id: str, text: str, *,
                    media: Optional[list] = None, **kwargs) -> PublishResult:
        """IG DM via Messenger Platform — POST /{ig_id}/messages."""
        client = GraphClient(credential.access_token)
        recipient_id = kwargs.get('recipient_id') or conversation_id
        body = client.post(
            f'/{credential.instagram_account_id}/messages',
            json={
                'recipient': {'id': recipient_id},
                'message':   {'text': text},
            },
        )
        return PublishResult(success=True, platform_post_id=body.get('message_id', ''), raw_response=body)

    # ── Internals ────────────────────────────────────────────────────────
    def _create_image_container(self, credential, image_url: str, *, caption: str) -> str:
        client = GraphClient(credential.access_token, timeout=LONG_TIMEOUT)
        body = client.post(
            f'/{credential.instagram_account_id}/media',
            data={'image_url': image_url, 'caption': caption or ''},
        )
        cid = body.get('id')
        if not cid:
            raise PublishError('IG image container missing id', raw=body)
        return cid

    def _wait_for_container_ready(self, credential, container_id: str):
        """Poll /{container_id}?fields=status_code until FINISHED, ERROR, or timeout."""
        client = GraphClient(credential.access_token)
        deadline = time.monotonic() + CONTAINER_POLL_TIMEOUT
        while time.monotonic() < deadline:
            res = client.get(f'/{container_id}', params={'fields': 'status_code,status'})
            status = (res.get('status_code') or '').upper()
            if status == 'FINISHED':
                return
            if status == 'ERROR':
                raise PublishError(
                    f'IG container failed: {res.get("status") or status}',
                    code='container_error', raw=res,
                )
            # IN_PROGRESS / PUBLISHED / EXPIRED handled below
            if status == 'EXPIRED':
                raise PublishError('IG container expired before publish',
                                   code='container_expired', raw=res)
            time.sleep(CONTAINER_POLL_INTERVAL)
        raise PublishError('IG container did not finish in time',
                           code='container_timeout')

    def _publish_container(self, credential, container_id: str) -> PublishResult:
        client = GraphClient(credential.access_token)
        body = client.post(
            f'/{credential.instagram_account_id}/media_publish',
            data={'creation_id': container_id},
        )
        media_id = body.get('id')
        if not media_id:
            raise PublishError('IG publish did not return media id', raw=body)
        # Permalink fetch is a separate call but only when the orchestrator wants it.
        return PublishResult(
            success=True,
            platform_post_id=str(media_id),
            platform_url=f'https://www.instagram.com/p/{media_id}',
            raw_response=body,
        )

    def _require_ig(self, credential):
        if not getattr(credential, 'instagram_account_id', None):
            raise PublishError('PlatformCredential.instagram_account_id is missing',
                               code='missing_config')
        if not getattr(credential, 'access_token', None):
            raise PublishError('PlatformCredential.access_token is missing',
                               code='missing_config')


# Self-register on import
register_publisher('instagram', InstagramPublisher)
