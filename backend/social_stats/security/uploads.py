# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
secure file upload validator.

Goals:
  • Reject oversize files BEFORE they hit disk
  • Detect MIME from CONTENT, not user-supplied Content-Type or file extension
  • Strip EXIF (GPS coords, camera info) from images
  • Sanitize filenames (no path traversal, no NULs, no shell-meta abuse)
  • Re-encode images via Pillow → kills any embedded payload that depended
    on the original byte stream

Antivirus (ClamAV) integration is deliberately deferred — it's an ops/infra
choice. Hook the `scan` callable through if/when ClamAV is provisioned.

Library notes
-------------
``python-magic`` (the C-libmagic wrapper) is the right tool for content-based
MIME detection. We try to import it lazily; if it's not available (devs on
Windows / minimal docker images), we degrade to ``mimetypes.guess_type`` on
the filename — louder but functional. The PROD deploy ships libmagic.
"""
from __future__ import annotations

import io
import logging
import mimetypes
import os
import re
from typing import Iterable, Optional

from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import UploadedFile


logger = logging.getLogger(__name__)


DEFAULT_MAX_SIZE = 25 * 1024 * 1024  # 25 MB

ALLOWED_MIMES = {
    'image':    {'image/jpeg', 'image/png', 'image/webp', 'image/gif'},
    'video':    {'video/mp4', 'video/quicktime', 'video/webm'},
    'document': {
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain', 'text/csv',
    },
}

# Filenames are stored on disk + reflected in URLs. Lock down:
_FILENAME_SAFE_RE     = re.compile(r'[^\w.\-]+')
_FILENAME_DOT_RUN_RE  = re.compile(r'\.{2,}')


# ─────────────────────────────────────────────────────────────────────────────
def detect_mime(file: UploadedFile) -> str:
    """Sniff the MIME from the first 2KB. Falls back to extension-based guess
    if libmagic isn't installed."""
    try:
        import magic  # python-magic
        head = file.read(2048)
        file.seek(0)
        return (magic.from_buffer(head, mime=True) or '').lower()
    except Exception:
        # Best-effort fallback — fragile, but better than rejecting all uploads.
        guess, _ = mimetypes.guess_type(file.name or '')
        return (guess or '').lower()


def safe_filename(raw: str, *, max_len: int = 200) -> str:
    """Strip dangerous characters; collapse '..' runs; cap length. Empty input
    yields a placeholder so callers don't have to null-check.
    """
    if not raw:
        return 'upload'
    # Take just the basename — kill any path segments
    basename = os.path.basename(raw)
    # Replace whitespace + unsafe chars
    cleaned  = _FILENAME_SAFE_RE.sub('_', basename)
    # Collapse '..' runs (path-traversal defence in depth)
    cleaned  = _FILENAME_DOT_RUN_RE.sub('.', cleaned)
    # Strip leading dots (no hidden files)
    cleaned  = cleaned.lstrip('.')
    if not cleaned:
        cleaned = 'upload'
    return cleaned[:max_len]


def strip_image_exif(file: UploadedFile) -> UploadedFile:
    """Re-encode the image via Pillow without EXIF metadata. Returns the
    same UploadedFile-ish wrapper with `.read()` re-positioned to 0.

    On any decode error we leave the file untouched — re-encoding is a
    privacy nicety, not a hard security requirement, and we'd rather accept
    an unusual image than reject a real user.
    """
    try:
        from PIL import Image
        file.seek(0)
        img = Image.open(file)
        img_format = (img.format or 'PNG').upper()
        if img_format == 'JPEG' and img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        buf = io.BytesIO()
        img.save(buf, format=img_format)
        buf.seek(0)
        # Wrap the cleaned bytes back into an UploadedFile-shape
        from django.core.files.base import ContentFile
        cleaned = ContentFile(buf.read(), name=file.name)
        cleaned.content_type = file.content_type
        return cleaned
    except Exception:
        logger.warning('strip_image_exif: re-encode failed for %s — passing through', file.name)
        file.seek(0)
        return file


def validate_upload(
    file: UploadedFile,
    *,
    file_type: str = 'image',
    max_size: int = DEFAULT_MAX_SIZE,
    allowed_mimes: Optional[Iterable[str]] = None,
    strip_exif: bool = True,
) -> tuple[UploadedFile, str, str]:
    """Validate + sanitize a single upload.

    Returns ``(cleaned_file, safe_name, detected_mime)``. Raises
    ``django.core.exceptions.ValidationError`` on any rejection so DRF
    serializers / views can let the error propagate naturally.
    """
    if file is None:
        raise ValidationError('No file provided.')

    # 1. Size
    if file.size > max_size:
        raise ValidationError(f'File too large (max {max_size // (1024*1024)} MB).')

    # 2. MIME — content-based
    mime = detect_mime(file)
    bucket = set(allowed_mimes) if allowed_mimes else ALLOWED_MIMES.get(file_type, set())
    if not bucket:
        raise ValidationError(f'No allowed MIMEs configured for type "{file_type}".')
    if mime not in bucket:
        raise ValidationError(f'Unsupported file type "{mime or "unknown"}".')

    # 3. Filename
    safe_name = safe_filename(file.name or 'upload')

    # 4. Image-specific: re-encode + strip EXIF
    if file_type == 'image' and strip_exif:
        file = strip_image_exif(file)

    return file, safe_name, mime
