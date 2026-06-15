# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
YouTubePublisher — uploads videos via YouTube Data API v3 resumable upload.

Three-step upload flow:
  1. POST /upload/youtube/v3/videos?uploadType=resumable&part=snippet,status
     with the metadata JSON body. The response's `Location` header is the
     resumable upload URL.
  2. Stream the video bytes (downloaded from `video_url`) PUT to that URL.
  3. (Optional) Set thumbnail via /youtube/v3/thumbnails/set.

`publish_reel` calls the same upload path; YouTube auto-classifies a video as
a Short when the duration is ≤60s and the aspect ratio is 9:16. We just nudge
it by appending `#shorts` to the description.

Supported actions:
  publish_video, publish_reel, delete_post, get_post_metrics, reply_to_comment

Unsupported on YouTube:
  publish_text, publish_image, publish_carousel, publish_story
  → all raise PublishError(supported=False).
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
from ._google_client import GoogleClient, LONG_TIMEOUT

logger = logging.getLogger(__name__)

UPLOAD_URL    = 'https://www.googleapis.com/upload/youtube/v3/videos'
VIDEOS_URL    = 'https://www.googleapis.com/youtube/v3/videos'
THUMBS_URL    = 'https://www.googleapis.com/upload/youtube/v3/thumbnails/set'
COMMENTS_URL  = 'https://www.googleapis.com/youtube/v3/comments'

DEFAULT_PRIVACY = 'public'  # public | unlisted | private


class YouTubePublisher(BasePublisher):
    platform = 'youtube'
    MAX_TEXT_LENGTH = 5000      # description cap
    MAX_VIDEO_BYTES = 256 * 1024 * 1024 * 1024  # 256GB upload cap
    MAX_VIDEO_SECONDS = 12 * 3600
    SUPPORTED_TYPES = frozenset({'video', 'reel'})

    # ── Public surface ───────────────────────────────────────────────────
    def publish_video(self, credential, content: str, video_url: str, *,
                      thumbnail: Optional[str] = None, **kwargs) -> PublishResult:
        return self._upload_video(
            credential, video_url=video_url, content=content,
            thumbnail=thumbnail, is_short=False, **kwargs,
        )

    def publish_reel(self, credential, video_url: str, content: str, **kwargs) -> PublishResult:
        # Add the #shorts hint so YouTube classifies this as a Short.
        marker = '#shorts'
        if marker not in (content or '').lower():
            content = (content or '').rstrip() + ('\n\n' if content else '') + marker
        return self._upload_video(
            credential, video_url=video_url, content=content,
            is_short=True, **kwargs,
        )

    def delete_post(self, credential, platform_post_id: str) -> dict:
        client = GoogleClient(credential)
        return client.delete(VIDEOS_URL, params={'id': platform_post_id})

    def get_post_metrics(self, credential, platform_post_id: str) -> dict:
        client = GoogleClient(credential)
        return client.get(VIDEOS_URL, params={
            'part': 'statistics,status,snippet',
            'id':   platform_post_id,
        })

    def reply_to_comment(self, credential, comment_id: str, text: str, **kwargs) -> PublishResult:
        client = GoogleClient(credential)
        body = client.post(COMMENTS_URL, params={'part': 'snippet'}, json={
            'snippet': {
                'parentId':         comment_id,
                'textOriginal':     text,
            },
        })
        return PublishResult(
            success=True,
            platform_post_id=str(body.get('id', '')),
            raw_response=body,
        )

    # ── Internals ────────────────────────────────────────────────────────
    def _upload_video(self, credential, *, video_url, content, thumbnail=None,
                      is_short=False, **kwargs) -> PublishResult:
        self._require_youtube(credential)
        title = (kwargs.get('title') or content or 'Untitled').split('\n', 1)[0][:100]
        privacy = (kwargs.get('privacy') or DEFAULT_PRIVACY).lower()

        snippet = {
            'title':       title,
            'description': content or '',
            'tags':        kwargs.get('tags') or [],
            'categoryId':  str(kwargs.get('category_id') or 22),  # 22 = People & Blogs
        }
        status = {
            'privacyStatus':       privacy if privacy in ('public', 'unlisted', 'private') else 'public',
            'selfDeclaredMadeForKids': bool(kwargs.get('made_for_kids', False)),
        }
        if kwargs.get('scheduled_publish_time'):
            # ISO 8601 UTC; YouTube expects RFC3339
            status['publishAt'] = kwargs['scheduled_publish_time']
            status['privacyStatus'] = 'private'  # required for scheduled

        client = GoogleClient(credential, timeout=LONG_TIMEOUT)

        # ── Step 1: initiate resumable upload ────────────────────────────
        # GoogleClient maps non-2xx into typed exceptions, but the resumable
        # init endpoint needs the raw `Location` header, so we make this
        # request directly (still using the helper's auth).
        access_token = client.access_token()
        meta = {'snippet': snippet, 'status': status}
        init = requests.post(
            UPLOAD_URL,
            params={'part': 'snippet,status', 'uploadType': 'resumable'},
            headers={
                'Authorization': f'Bearer {access_token}',
                'Content-Type':  'application/json; charset=UTF-8',
                'X-Upload-Content-Type': 'video/*',
            },
            json=meta,
            timeout=LONG_TIMEOUT,
        )
        if init.status_code != 200:
            from ._google_client import _map_response
            _map_response('POST', UPLOAD_URL, init)  # raises typed exception

        upload_url = init.headers.get('Location')
        if not upload_url:
            raise PublishError('YouTube did not return an upload URL', raw=init.text[:200])

        # ── Step 2: stream the video bytes to the upload URL ─────────────
        video_id = self._stream_upload(upload_url, video_url, access_token)

        # ── Step 3: optional thumbnail ───────────────────────────────────
        if thumbnail:
            try:
                self._set_thumbnail(client, video_id, thumbnail)
            except Exception:
                logger.exception('Thumbnail upload failed for video %s — continuing', video_id)

        return PublishResult(
            success=True,
            platform_post_id=video_id,
            platform_url=f'https://www.youtube.com/watch?v={video_id}',
            raw_response={'video_id': video_id},
            warnings=['Reel was published as a standard video; YouTube classifies as Short automatically when duration ≤60s + 9:16'] if is_short else [],
        )

    def _stream_upload(self, upload_url: str, video_url: str, access_token: str) -> str:
        """Download video_url to a tempfile and PUT to YouTube's resumable URL."""
        # `video_url` is expected to be a public URL (e.g., S3 presigned).
        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as fh:
            tmp_path = fh.name
            try:
                with requests.get(video_url, stream=True, timeout=LONG_TIMEOUT) as src:
                    if src.status_code != 200:
                        raise PublishError(
                            f'Failed to download video for upload (status {src.status_code})',
                            code='media_unreachable',
                        )
                    for chunk in src.iter_content(chunk_size=1024 * 1024):
                        if chunk:
                            fh.write(chunk)
                fh.flush()
                size = os.path.getsize(tmp_path)
            finally:
                pass

        try:
            with open(tmp_path, 'rb') as f:
                resp = requests.put(
                    upload_url,
                    data=f,
                    headers={
                        'Authorization': f'Bearer {access_token}',
                        'Content-Type':  'video/*',
                        'Content-Length': str(size),
                    },
                    timeout=LONG_TIMEOUT,
                )
        finally:
            try: os.remove(tmp_path)
            except OSError: pass

        if resp.status_code not in (200, 201):
            from ._google_client import _map_response
            _map_response('PUT', upload_url, resp)

        try:
            body = resp.json()
        except Exception:
            raise PublishError('YouTube upload returned non-JSON', raw=resp.text[:200])

        vid = body.get('id')
        if not vid:
            raise PublishError('YouTube upload missing id in response', raw=body)
        return vid

    def _set_thumbnail(self, client: GoogleClient, video_id: str, thumb_url: str):
        """Download the thumbnail and POST to /thumbnails/set."""
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as fh:
            tmp_path = fh.name
            with requests.get(thumb_url, stream=True, timeout=LONG_TIMEOUT) as src:
                if src.status_code != 200:
                    raise PublishError(f'Thumbnail download failed (status {src.status_code})')
                for chunk in src.iter_content(chunk_size=64 * 1024):
                    if chunk:
                        fh.write(chunk)
        try:
            with open(tmp_path, 'rb') as f:
                client.post(THUMBS_URL,
                            params={'videoId': video_id, 'uploadType': 'media'},
                            headers={'Content-Type': 'image/jpeg'},
                            data=f.read(),
                            timeout=LONG_TIMEOUT)
        finally:
            try: os.remove(tmp_path)
            except OSError: pass

    def _require_youtube(self, credential):
        if not getattr(credential, 'channel_id', None):
            raise PublishError('PlatformCredential.channel_id is missing', code='missing_config')
        if not (getattr(credential, 'access_token', None) or getattr(credential, 'refresh_token', None)):
            raise PublishError('No access_token or refresh_token on credential', code='missing_config')


# Self-register on import
register_publisher('youtube', YouTubePublisher)
