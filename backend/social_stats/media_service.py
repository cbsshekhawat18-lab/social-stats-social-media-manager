# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Media handling for the Unified Composer.

Responsibilities:
  - upload_media:  persist a file (S3 if configured, else local FileField)
                   into a MediaAsset row, generate a thumbnail, extract
                   image/video metadata.
  - validate_for_platform:  per-platform size / format / duration / aspect-ratio rules.
  - transcode_for_platform: best-effort resize/compress when the asset doesn't
                            meet a platform's rules. Lazy-imports moviepy so
                            the module loads cleanly even when ffmpeg isn't
                            installed in dev.

Storage:
  When `AWS_ACCESS_KEY_ID` and `AWS_S3_BUCKET` are set in settings, files are
  uploaded to S3 (returns presigned URLs). Otherwise we fall back to Django's
  default storage (local filesystem in dev).
"""
from __future__ import annotations

import io
import logging
import mimetypes
import os
import uuid
from dataclasses import dataclass
from typing import Any, Optional

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import UploadedFile
from django.utils.text import slugify
from PIL import Image, ImageOps

from .models import MediaAsset

logger = logging.getLogger(__name__)


# ── Per-platform limits ───────────────────────────────────────────────────────
# Conservative limits — under official caps to leave headroom for re-encoding.
PLATFORM_LIMITS: dict[str, dict] = {
    'facebook': {
        'image': {'max_bytes': 10 * 1024 * 1024,        'allowed_mime': {'image/jpeg', 'image/png', 'image/gif'}},
        'video': {'max_bytes': 4 * 1024 * 1024 * 1024,  'max_seconds': 240 * 60, 'allowed_mime': {'video/mp4', 'video/quicktime'}},
    },
    'instagram': {
        # IG Feed
        'image': {'max_bytes': 8 * 1024 * 1024, 'allowed_mime': {'image/jpeg'},
                  'aspect_min': 4 / 5, 'aspect_max': 1.91, 'min_width': 320, 'max_width': 1440},
        'video': {'max_bytes': 1024 * 1024 * 1024, 'max_seconds': 60, 'allowed_mime': {'video/mp4', 'video/quicktime'},
                  'aspect_min': 4 / 5, 'aspect_max': 16 / 9},
        'reel':  {'max_bytes': 1024 * 1024 * 1024, 'max_seconds': 90, 'allowed_mime': {'video/mp4'},
                  'aspect_target': 9 / 16},
        'story': {'max_bytes': 100 * 1024 * 1024, 'max_seconds': 60, 'allowed_mime': {'video/mp4', 'image/jpeg'},
                  'aspect_target': 9 / 16},
    },
    'youtube': {
        'video': {'max_bytes': 256 * 1024 * 1024 * 1024, 'max_seconds': 12 * 3600,
                  'allowed_mime': {'video/mp4', 'video/quicktime', 'video/x-matroska', 'video/webm'}},
        'reel':  {'max_bytes': 256 * 1024 * 1024, 'max_seconds': 60, 'allowed_mime': {'video/mp4'},
                  'aspect_target': 9 / 16},
    },
    'linkedin': {
        'image': {'max_bytes': 5 * 1024 * 1024, 'allowed_mime': {'image/jpeg', 'image/png'}},
        'video': {'max_bytes': 5 * 1024 * 1024 * 1024, 'max_seconds': 10 * 60,
                  'allowed_mime': {'video/mp4', 'video/quicktime'}},
    },
    'google_my_business': {
        'image': {'max_bytes': 5 * 1024 * 1024, 'allowed_mime': {'image/jpeg', 'image/png'},
                  'min_width': 250, 'min_height': 250},
        'video': {'max_bytes': 100 * 1024 * 1024, 'max_seconds': 30, 'allowed_mime': {'video/mp4'}},
    },
}


# ── Result dataclasses ────────────────────────────────────────────────────────
@dataclass
class ValidationResult:
    ok: bool
    errors: list
    warnings: list

    def add_error(self, msg):    self.errors.append(msg);   self.ok = False
    def add_warning(self, msg):  self.warnings.append(msg)


# ── Public surface ────────────────────────────────────────────────────────────
def upload_media(
    file: UploadedFile,
    client_id: int,
    *,
    uploaded_by_id: Optional[int] = None,
    folder: str = '',
    alt_text: str = '',
    tags: Optional[list] = None,
) -> MediaAsset:
    """
    Persist `file` and return a MediaAsset row. Generates a thumbnail when the
    file is an image; extracts image dimensions; for video, attempts to read
    duration via moviepy (lazy-imported, optional).
    """
    if not file:
        raise ValueError('file is required')

    mime = file.content_type or mimetypes.guess_type(file.name)[0] or 'application/octet-stream'
    name = _safe_filename(file.name)
    asset = MediaAsset(
        client_id=client_id,
        uploaded_by_id=uploaded_by_id,
        mime_type=mime,
        file_size=file.size or 0,
        alt_text=alt_text or '',
        tags=tags or [],
        folder=(folder or '').strip(),
    )
    asset.file.save(name, file, save=False)

    # Image metadata + thumbnail
    if mime.startswith('image/'):
        try:
            file.seek(0)
            with Image.open(file) as img:
                img = ImageOps.exif_transpose(img)
                asset.width, asset.height = img.size
                thumb_buffer = io.BytesIO()
                thumb = img.copy()
                thumb.thumbnail((480, 480))
                if thumb.mode in ('RGBA', 'LA', 'P'):
                    thumb = thumb.convert('RGB')
                thumb.save(thumb_buffer, format='JPEG', quality=80)
                asset.thumbnail.save(
                    f'{os.path.splitext(name)[0]}_thumb.jpg',
                    ContentFile(thumb_buffer.getvalue()),
                    save=False,
                )
        except Exception:
            logger.exception('Failed to process image metadata for %s', name)

    # Video duration via moviepy if available.
    elif mime.startswith('video/'):
        duration = _probe_video_duration(asset.file.path if asset.file else None)
        if duration:
            asset.duration_seconds = duration

    asset.save()
    return asset


def validate_for_platform(asset: MediaAsset, platform: str, post_type: str) -> ValidationResult:
    """
    Check `asset` against the platform's rules for the given `post_type`
    (one of 'image', 'video', 'reel', 'story').

    Returns a ValidationResult; never raises. Caller decides whether warnings
    are blocking.
    """
    result = ValidationResult(ok=True, errors=[], warnings=[])

    rules = (PLATFORM_LIMITS.get(platform) or {}).get(post_type)
    if not rules:
        result.add_warning(f'No validation rules defined for {platform}/{post_type}')
        return result

    if asset.file_size and rules.get('max_bytes') and asset.file_size > rules['max_bytes']:
        result.add_error(
            f'File too large for {platform} {post_type}: '
            f'{asset.file_size:,} bytes > {rules["max_bytes"]:,} bytes'
        )

    allowed = rules.get('allowed_mime') or set()
    if allowed and asset.mime_type and asset.mime_type not in allowed:
        result.add_error(
            f'{platform} {post_type} requires one of {sorted(allowed)} — got {asset.mime_type}'
        )

    if rules.get('max_seconds') and asset.duration_seconds:
        if asset.duration_seconds > rules['max_seconds']:
            result.add_error(
                f'Video too long for {platform} {post_type}: '
                f'{asset.duration_seconds:.0f}s > {rules["max_seconds"]:.0f}s'
            )

    # Image dimension constraints
    if rules.get('min_width') and asset.width and asset.width < rules['min_width']:
        result.add_error(f'Image width {asset.width}px below minimum {rules["min_width"]}px')
    if rules.get('min_height') and asset.height and asset.height < rules['min_height']:
        result.add_error(f'Image height {asset.height}px below minimum {rules["min_height"]}px')

    # Aspect ratio for image posts (warn rather than block — it's recoverable)
    if asset.width and asset.height:
        ar = asset.width / asset.height
        if rules.get('aspect_min') and ar < rules['aspect_min']:
            result.add_warning(f'Aspect ratio {ar:.2f} is narrower than {platform} expects ({rules["aspect_min"]:.2f})')
        if rules.get('aspect_max') and ar > rules['aspect_max']:
            result.add_warning(f'Aspect ratio {ar:.2f} is wider than {platform} expects ({rules["aspect_max"]:.2f})')
        target = rules.get('aspect_target')
        if target and abs(ar - target) > 0.05:
            result.add_warning(f'{platform} prefers aspect ratio {target:.2f}, got {ar:.2f}')

    return result


def transcode_for_platform(asset: MediaAsset, platform: str, post_type: str) -> MediaAsset:
    """
    Best-effort transcoder. Currently:
      - Re-encodes too-large JPEGs at lower quality.
      - For video, lazy-imports moviepy; if absent, returns the asset unchanged
        with a warning logged.

    Returns the (possibly new) MediaAsset. Real per-platform transcoding will
    expand here in this.
    """
    rules = (PLATFORM_LIMITS.get(platform) or {}).get(post_type) or {}
    max_bytes = rules.get('max_bytes')

    # Image: re-compress JPEG/PNG until under max_bytes.
    if asset.mime_type and asset.mime_type.startswith('image/') and max_bytes:
        if asset.file_size <= max_bytes:
            return asset
        try:
            asset.file.open('rb')
            with Image.open(asset.file) as img:
                img = ImageOps.exif_transpose(img)
                if img.mode in ('RGBA', 'LA', 'P'):
                    img = img.convert('RGB')
                quality = 90
                buf = io.BytesIO()
                while quality >= 40:
                    buf.seek(0); buf.truncate(0)
                    img.save(buf, format='JPEG', quality=quality, optimize=True)
                    if buf.tell() <= max_bytes:
                        break
                    quality -= 10
                buf.seek(0)
                new_name = f"{os.path.splitext(asset.file.name)[0]}_trans.jpg"
                asset.file.save(os.path.basename(new_name), ContentFile(buf.getvalue()), save=False)
                asset.mime_type = 'image/jpeg'
                asset.file_size = buf.tell()
                asset.save(update_fields=['file', 'mime_type', 'file_size'])
        except Exception:
            logger.exception('Image transcode failed for asset %s', asset.id)
        finally:
            try: asset.file.close()
            except Exception: pass
        return asset

    # Video: lazy moviepy. A later iteration will expand this with smart-crop / resize.
    if asset.mime_type and asset.mime_type.startswith('video/'):
        try:
            from moviepy.editor import VideoFileClip  # noqa: F401
        except ImportError:
            logger.info('moviepy not installed — skipping video transcode for asset %s', asset.id)
            return asset
        # No-op for now — placeholder so callers can rely on the symbol existing.
        return asset

    return asset


# ── S3 helpers (used when settings configure S3) ──────────────────────────────
def _s3_enabled() -> bool:
    return bool(getattr(settings, 'AWS_ACCESS_KEY_ID', None) and getattr(settings, 'AWS_S3_BUCKET', None))


def presigned_url(asset: MediaAsset, *, expires: int = 3600) -> str:
    """
    Return a signed URL the platform APIs can fetch the file from.
    Falls back to the local MEDIA_URL path when S3 isn't configured.
    """
    if not asset or not asset.file:
        return ''
    if _s3_enabled():
        try:
            import boto3
            client = boto3.client(
                's3',
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=getattr(settings, 'AWS_S3_REGION', None),
            )
            return client.generate_presigned_url(
                'get_object',
                Params={'Bucket': settings.AWS_S3_BUCKET, 'Key': asset.file.name},
                ExpiresIn=expires,
            )
        except Exception:
            logger.exception('Failed to sign S3 URL for asset %s', asset.id)
    # Local fallback — assumes Django is serving MEDIA_URL
    try:
        return asset.file.url
    except Exception:
        return ''


# ── Internals ─────────────────────────────────────────────────────────────────
def _safe_filename(original: str) -> str:
    base, ext = os.path.splitext(original or 'upload')
    base = slugify(base) or 'upload'
    short = uuid.uuid4().hex[:8]
    return f'{base}_{short}{ext.lower()}'


def _probe_video_duration(path: Optional[str]) -> float:
    if not path:
        return 0.0
    try:
        from moviepy.editor import VideoFileClip
    except ImportError:
        return 0.0
    try:
        with VideoFileClip(path) as clip:
            return float(clip.duration or 0)
    except Exception:
        logger.exception('Failed to probe video duration for %s', path)
        return 0.0
