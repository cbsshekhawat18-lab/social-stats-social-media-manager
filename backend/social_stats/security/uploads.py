# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Upload validation — the single gate every user-supplied file goes through.

Rules:
  • Allow-list only: JPEG / PNG / GIF / WebP images, MP4 / MOV / WebM video,
    PDF. Everything else (SVG, HTML, XML, BMP, TIFF, MKV, Office docs, …) is
    rejected.
  • The type is detected from the file CONTENT — Pillow for images, container
    magic bytes for video, the ``%PDF-`` signature for PDF. The client's
    Content-Type header and the filename extension are never trusted.
  • Files whose first bytes look like markup (``<svg``, ``<html``,
    ``<script`` …) are rejected outright, even if they also parse as an image
    (polyglots).
  • Size is capped at ``settings.MEDIA_MAX_UPLOAD_MB`` (default 100).

``validate_media_upload`` returns the detected type so callers can store the
real MIME and a filename whose extension matches the content — that is what
the web server uses to pick the Content-Type it serves.

``validate_image_upload`` is the variant for ``ImageField``s (logo,
profile_image, avatar): images only, and usable as a Django model / DRF
serializer validator.
"""
from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass
from typing import Optional

from django.conf import settings
from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)


DEFAULT_MAX_UPLOAD_MB = 100


@dataclass(frozen=True)
class AllowedType:
    mime: str
    kind: str                      # 'image' | 'video' | 'document'
    extensions: tuple[str, ...]    # first entry is the canonical one


ALLOWED_TYPES: dict[str, AllowedType] = {t.mime: t for t in (
    AllowedType('image/jpeg',      'image',    ('.jpg', '.jpeg')),
    AllowedType('image/png',       'image',    ('.png',)),
    AllowedType('image/gif',       'image',    ('.gif',)),
    AllowedType('image/webp',      'image',    ('.webp',)),
    AllowedType('video/mp4',       'video',    ('.mp4',)),
    AllowedType('video/quicktime', 'video',    ('.mov',)),
    AllowedType('video/webm',      'video',    ('.webm',)),
    AllowedType('application/pdf', 'document', ('.pdf',)),
)}

IMAGE_EXTENSIONS = tuple(
    ext for t in ALLOWED_TYPES.values() if t.kind == 'image' for ext in t.extensions
)

_PIL_FORMAT_TO_MIME = {
    'JPEG': 'image/jpeg',
    'MPO':  'image/jpeg',   # multi-picture JPEG (many phone cameras)
    'PNG':  'image/png',
    'GIF':  'image/gif',
    'WEBP': 'image/webp',
}

# ISO base-media (MP4 / MOV) `ftyp` brands.
_MP4_BRANDS = {
    b'isom', b'iso2', b'iso3', b'iso4', b'iso5', b'iso6', b'mp41', b'mp42',
    b'avc1', b'M4V ', b'M4VP', b'M4VH', b'dash', b'mmp4', b'MSNV', b'XAVC',
    b'f4v ', b'NDAS',
}
_QUICKTIME_BRANDS = {b'qt  '}
# Same container, but not video — never accept these even if a compatible
# brand says "isom".
_NON_VIDEO_BRANDS = {
    b'heic', b'heix', b'heim', b'heis', b'hevc', b'hevx', b'mif1', b'msf1',
    b'avif', b'avis', b'M4A ', b'M4B ', b'M4P ', b'crx ',
}
# Legacy QuickTime files can start with one of these atoms instead of `ftyp`.
_QUICKTIME_LEADING_ATOMS = {b'moov', b'mdat', b'wide', b'free', b'skip', b'pnot'}

_EBML_MAGIC = b'\x1a\x45\xdf\xa3'

# Markup that a browser could render as a document. Checked against the first
# KB, where MIME sniffers look.
_MARKUP_RE = re.compile(
    rb'<\s*(?:svg|html|script|body|iframe|object|embed|!doctype\s+html)\b',
    re.IGNORECASE,
)

_SNIFF_BYTES = 4096

_FILENAME_SAFE_RE    = re.compile(r'[^\w.\-]+')
_FILENAME_DOT_RUN_RE = re.compile(r'\.{2,}')


def max_upload_bytes() -> int:
    mb = getattr(settings, 'MEDIA_MAX_UPLOAD_MB', DEFAULT_MAX_UPLOAD_MB) or DEFAULT_MAX_UPLOAD_MB
    return int(mb) * 1024 * 1024


def _allowed_summary() -> str:
    return 'JPEG, PNG, GIF or WebP images; MP4, MOV or WebM video; PDF'


# ─────────────────────────────────────────────────────────────────────────────
#  Low-level sniffers
# ─────────────────────────────────────────────────────────────────────────────
def _read_head(file, n: int = _SNIFF_BYTES) -> bytes:
    try:
        file.seek(0)
    except Exception:
        pass
    head = file.read(n) or b''
    try:
        file.seek(0)
    except Exception:
        pass
    if isinstance(head, str):          # text-mode file objects
        head = head.encode('utf-8', 'replace')
    return head


def _looks_like_markup(head: bytes) -> bool:
    window = head[:1024]
    stripped = window.lstrip(b'\xef\xbb\xbf \t\r\n\x00')
    if stripped[:1] == b'<':          # any text document starting with a tag
        return True
    return bool(_MARKUP_RE.search(window))


def _sniff_image(file) -> Optional[str]:
    """Return the MIME of an allowed image, ``None`` if Pillow can't parse
    the content as an image, or raise for images we refuse."""
    from PIL import Image

    try:
        file.seek(0)
        with Image.open(file) as img:
            fmt = (img.format or '').upper()
            img.verify()
    except Image.DecompressionBombError:
        raise ValidationError('Image dimensions are too large.')
    except Exception:
        return None
    finally:
        try:
            file.seek(0)
        except Exception:
            pass

    mime = _PIL_FORMAT_TO_MIME.get(fmt)
    if not mime:
        raise ValidationError(
            f'Unsupported image format ({fmt or "unknown"}). Upload a JPEG, PNG, GIF or WebP.'
        )
    return mime


def _sniff_video(head: bytes) -> Optional[str]:
    # ISO base media file format (MP4 / MOV): [size:4]['ftyp'][major brand:4]…
    if len(head) >= 12 and head[4:8] == b'ftyp':
        major = head[8:12]
        if major in _NON_VIDEO_BRANDS:
            return None
        if major in _QUICKTIME_BRANDS:
            return 'video/quicktime'
        if major in _MP4_BRANDS:
            return 'video/mp4'
        # Unknown major brand: fall back to the compatible-brands list.
        box_size = int.from_bytes(head[0:4], 'big')
        compat = head[16:min(box_size, len(head))]
        brands = {compat[i:i + 4] for i in range(0, len(compat) - 3, 4)}
        if brands & _NON_VIDEO_BRANDS:
            return None
        if brands & _QUICKTIME_BRANDS:
            return 'video/quicktime'
        if brands & _MP4_BRANDS:
            return 'video/mp4'
        return None

    if len(head) >= 8 and head[4:8] in _QUICKTIME_LEADING_ATOMS:
        return 'video/quicktime'

    # Matroska / WebM: EBML header, DocType element (0x42 0x82) names the flavour.
    if head.startswith(_EBML_MAGIC):
        doctype_at = head.find(b'\x42\x82', 4, 128)
        if doctype_at != -1 and head[doctype_at + 3:doctype_at + 7] == b'webm':
            return 'video/webm'
        return None

    return None


def _sniff_pdf(head: bytes) -> Optional[str]:
    return 'application/pdf' if head.startswith(b'%PDF-') else None


def _check_size(file) -> None:
    size = getattr(file, 'size', None)
    if size is None:
        return
    limit = max_upload_bytes()
    if size > limit:
        raise ValidationError(f'File too large (max {limit // (1024 * 1024)} MB).')


def _is_stored_field_file(value) -> bool:
    """A FieldFile that is already in storage (e.g. a model being re-saved
    without a new upload) — nothing to validate."""
    return getattr(value, '_committed', False) is True


# ─────────────────────────────────────────────────────────────────────────────
#  Public API
# ─────────────────────────────────────────────────────────────────────────────
def sniff_upload(file) -> AllowedType:
    """Detect the type of ``file`` from its content. Raises
    ``ValidationError`` unless it is one of ``ALLOWED_TYPES``."""
    head = _read_head(file)
    if not head:
        raise ValidationError('The uploaded file is empty.')
    if _looks_like_markup(head):
        raise ValidationError('HTML, SVG and other markup files are not allowed.')

    mime = _sniff_image(file) or _sniff_video(head) or _sniff_pdf(head)
    if not mime:
        raise ValidationError(f'Unsupported file type. Allowed: {_allowed_summary()}.')
    return ALLOWED_TYPES[mime]


def validate_media_upload(file) -> AllowedType:
    """Validate a media-library upload (images, video, PDF). Returns the
    detected type; raises ``ValidationError`` on rejection."""
    if not file:
        raise ValidationError('No file provided.')
    _check_size(file)
    return sniff_upload(file)


def validate_image_upload(value) -> None:
    """Validator for ``ImageField``s (model + DRF serializer). Accepts only
    JPEG / PNG / GIF / WebP content with a matching image extension."""
    if not value or _is_stored_field_file(value):
        return
    _check_size(value)
    detected = sniff_upload(value)
    if detected.kind != 'image':
        raise ValidationError('Upload a JPEG, PNG, GIF or WebP image.')
    ext = os.path.splitext(getattr(value, 'name', '') or '')[1].lower()
    if ext not in IMAGE_EXTENSIONS:
        raise ValidationError(
            f'Image file name must end in one of: {", ".join(IMAGE_EXTENSIONS)}.'
        )


def storage_extension(original_name: str, detected: AllowedType) -> str:
    """Pick the extension to store under: keep the user's if it is valid for
    the detected type (``.jpeg`` vs ``.jpg``), otherwise the canonical one.
    The extension decides the Content-Type the web server sends."""
    ext = os.path.splitext(original_name or '')[1].lower()
    return ext if ext in detected.extensions else detected.extensions[0]


def safe_filename(raw: str, *, max_len: int = 200) -> str:
    """Strip dangerous characters; collapse '..' runs; cap length. Empty input
    yields a placeholder so callers don't have to null-check."""
    if not raw:
        return 'upload'
    basename = os.path.basename(raw)
    cleaned  = _FILENAME_SAFE_RE.sub('_', basename)
    cleaned  = _FILENAME_DOT_RUN_RE.sub('.', cleaned)
    cleaned  = cleaned.lstrip('.')
    if not cleaned:
        cleaned = 'upload'
    return cleaned[:max_len]
