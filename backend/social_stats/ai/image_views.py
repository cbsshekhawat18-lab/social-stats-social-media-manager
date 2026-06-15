# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Image AI endpoints (vision).

Mounted at:
    POST /api/ai/v2/describe-image          — structured analysis of an image
    POST /api/ai/v2/image-to-post           — turn an image into platform-tailored posts
    POST /api/ai/v2/alt-text                — accessibility alt text
    POST /api/ai/v2/brand-compliance-check  — audit image against brand guidelines

Each endpoint accepts EITHER:
    {image_url: "https://..."}  — server downloads + base64-encodes
    {image_b64: "<raw base64>", media_type: "image/jpeg"}  — direct upload

The vision call routes through AIClient.complete_vision (Sonnet, multimodal),
which records every call in AIUsageLog and enforces the same rate limits as
the text endpoints.
"""
from __future__ import annotations

import base64
import logging
from urllib.parse import urlparse

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..ai_helpers import brand_voice_prompt
from ..ai_views import _resolved_client
from . import AIClient, AIError, RateLimited, prompts
from .client import _parse_json_loose

logger = logging.getLogger(__name__)

MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB hard cap
ALLOWED_MEDIA_TYPES = {'image/jpeg', 'image/png', 'image/gif', 'image/webp'}


def _load_image_from_url(url: str) -> tuple[str, str]:
    """
    Fetch an image and return (base64_payload, media_type).
    Only http/https schemes allowed. Raises AIError on failure.
    """
    parsed = urlparse(url)
    if parsed.scheme not in ('http', 'https'):
        raise AIError('image_url must be an http(s) URL')

    try:
        import requests  # already in requirements.txt
    except ImportError:
        raise AIError('requests not installed')

    try:
        resp = requests.get(url, timeout=15, stream=True)
        resp.raise_for_status()
    except Exception as e:
        raise AIError(f'failed to fetch image: {e}') from e

    media_type = (resp.headers.get('Content-Type') or 'image/jpeg').split(';')[0].strip()
    if media_type not in ALLOWED_MEDIA_TYPES:
        # Fall back to JPEG; Anthropic accepts the four common types
        media_type = 'image/jpeg'

    data = b''
    for chunk in resp.iter_content(chunk_size=64 * 1024):
        data += chunk
        if len(data) > MAX_IMAGE_BYTES:
            raise AIError(f'image exceeds {MAX_IMAGE_BYTES // (1024 * 1024)} MB cap')

    return base64.b64encode(data).decode('ascii'), media_type


def _resolve_image_payload(request) -> tuple[str, str]:
    """
    Returns (base64, media_type) from either image_url or image_b64.
    Raises AIError on missing/invalid input.
    """
    image_url = request.data.get('image_url')
    image_b64 = request.data.get('image_b64')
    media_type = request.data.get('media_type') or 'image/jpeg'

    if image_url:
        return _load_image_from_url(image_url)

    if image_b64:
        # Strip a leading "data:image/...;base64," prefix if present
        if image_b64.startswith('data:'):
            try:
                header, image_b64 = image_b64.split(',', 1)
                if 'image/' in header:
                    media_type = header.split(':', 1)[1].split(';', 1)[0]
            except ValueError:
                pass
        if media_type not in ALLOWED_MEDIA_TYPES:
            media_type = 'image/jpeg'
        return image_b64, media_type

    raise AIError('image_url or image_b64 is required')


def _error_response(err: Exception, fallback: str = 'AI request failed'):
    if isinstance(err, RateLimited):
        return Response({
            'error': str(err), 'scope': err.scope,
            'limit': err.limit, 'used': err.used,
        }, status=429)
    if isinstance(err, AIError):
        return Response({'error': str(err) or fallback}, status=503)
    logger.exception(fallback)
    return Response({'error': fallback}, status=500)


def _vision_json(*, ai: AIClient, template: str, b64: str, media_type: str, **kwargs) -> dict:
    """
    Build a vision prompt, append the JSON-only contract to the system prompt,
    call Anthropic, parse the JSON response.
    """
    cfg = prompts.build(template, **kwargs)
    system = (cfg.get('system') or '').rstrip()
    system += (
        '\n\nIMPORTANT: Respond with valid JSON only. '
        'No prose, no markdown, no commentary outside the JSON object.'
    )
    text = ai.complete_vision(
        cfg['user_message'],
        image_b64=b64,
        media_type=media_type,
        system=system,
        max_tokens=cfg.get('max_tokens', 1024),
        temperature=cfg.get('temperature', 0.4),
    )
    return _parse_json_loose(text)


# ─────────────────────────────────────────────────────────────────────────
# 1. /ai/v2/describe-image
# ─────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def describe_image(request):
    """
    Body: { client_id, image_url? | image_b64?, media_type?, purpose?, language? }
    Returns: { description, suggested_caption, suggested_hashtags, detected_objects,
               mood, colors, suggested_edits }
    """
    client, err = _resolved_client(request)
    if err: return err

    try:
        b64, media_type = _resolve_image_payload(request)
    except AIError as e:
        return Response({'error': str(e)}, status=400)

    ai = AIClient(client=client, user=request.user, feature='describe_image')
    try:
        data = _vision_json(
            ai=ai, template='image_describer',
            b64=b64, media_type=media_type,
            purpose=request.data.get('purpose', 'caption'),
            language=request.data.get('language', 'English'),
        )
    except (AIError, RateLimited) as e:
        return _error_response(e, 'describe-image failed')
    return Response(data)


# ─────────────────────────────────────────────────────────────────────────
# 2. /ai/v2/image-to-post
# ─────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def image_to_post(request):
    """
    Body: { client_id, image_url? | image_b64?, platforms[], tone?, extra_notes?, language? }
    Returns: { posts: [{platform, content, hashtags, alt_text}] }
    """
    client, err = _resolved_client(request)
    if err: return err

    try:
        b64, media_type = _resolve_image_payload(request)
    except AIError as e:
        return Response({'error': str(e)}, status=400)

    ai = AIClient(client=client, user=request.user, feature='image_to_post')
    try:
        data = _vision_json(
            ai=ai, template='image_to_post',
            b64=b64, media_type=media_type,
            platforms=request.data.get('platforms') or ['instagram'],
            tone=request.data.get('tone', 'friendly'),
            extra_notes=request.data.get('extra_notes', ''),
            language=request.data.get('language', 'English'),
            brand_voice=brand_voice_prompt(client),
        )
    except (AIError, RateLimited) as e:
        return _error_response(e, 'image-to-post failed')
    return Response(data)


# ─────────────────────────────────────────────────────────────────────────
# 3. /ai/v2/alt-text
# ─────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def alt_text(request):
    """
    Body: { client_id, image_url? | image_b64?, max_chars?, language? }
    Returns: { alt_text }
    """
    client, err = _resolved_client(request)
    if err: return err

    try:
        b64, media_type = _resolve_image_payload(request)
    except AIError as e:
        return Response({'error': str(e)}, status=400)

    ai = AIClient(client=client, user=request.user, feature='alt_text')
    try:
        data = _vision_json(
            ai=ai, template='alt_text',
            b64=b64, media_type=media_type,
            language=request.data.get('language', 'English'),
            max_chars=int(request.data.get('max_chars', 140) or 140),
        )
    except (AIError, RateLimited) as e:
        return _error_response(e, 'alt-text failed')
    return Response(data)


# ─────────────────────────────────────────────────────────────────────────
# 4. /ai/v2/brand-compliance-check
# ─────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def brand_compliance_check(request):
    """
    Body: { client_id, image_url? | image_b64?, brand_colors[]?, brand_tone?, has_logo? }
    Returns: { compliant, score, issues, suggestions }
    """
    client, err = _resolved_client(request)
    if err: return err

    try:
        b64, media_type = _resolve_image_payload(request)
    except AIError as e:
        return Response({'error': str(e)}, status=400)

    ai = AIClient(client=client, user=request.user, feature='brand_compliance')
    try:
        data = _vision_json(
            ai=ai, template='brand_compliance',
            b64=b64, media_type=media_type,
            brand_colors=request.data.get('brand_colors') or [],
            brand_tone=request.data.get('brand_tone', '') or '',
            has_logo=bool(request.data.get('has_logo', False)),
            language=request.data.get('language', 'English'),
        )
    except (AIError, RateLimited) as e:
        return _error_response(e, 'brand-compliance-check failed')
    return Response(data)
