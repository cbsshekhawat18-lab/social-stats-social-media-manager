# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Brand Voice endpoints.

Mounted at:
    GET  /api/ai/v2/brand-voice/        — fetch the current profile
    POST /api/ai/v2/brand-voice/train/  — retrain from sample posts
    POST /api/ai/v2/brand-voice/test/   — generate a sample post in the trained voice

The existing /api/ai/train-brand-voice and /api/ai/brand-voice (legacy) are
kept untouched per Rule #1. These endpoints persist additional fields:
target_audience, prohibited_topics, preferred_words, emoji_usage, hashtag_style.
"""
from __future__ import annotations

import logging

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..ai_helpers import brand_voice_prompt
from ..ai_views import _resolved_client
from . import AIClient, AIError, RateLimited, prompts
from . import brand_voice as brand_voice_service
from .content_views import _ai_call_json, _error_response

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────
# 1. GET /ai/v2/brand-voice/
# ─────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_voice(request):
    client, err = _resolved_client(request)
    if err: return err
    return Response(brand_voice_service.get_brand_voice_payload(client))


# ─────────────────────────────────────────────────────────────────────────
# 2. POST /ai/v2/brand-voice/train/
# ─────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def train_voice(request):
    """
    Body: { client_id, sample_posts: [str, ...], business_hint?, industry?, language? }
    Returns: serialised profile + 3 example posts in the trained voice.

    Synchronous for now — training takes 5-15s and feedback is more useful
    inline than via polling. If we later move to background, swap the call
    for a Celery task and return a job_id.
    """
    client, err = _resolved_client(request)
    if err: return err

    samples       = request.data.get('sample_posts') or []
    business_hint = (request.data.get('business_hint') or '').strip()
    industry      = (request.data.get('industry') or '').strip()
    language      = (request.data.get('language') or 'English').strip()

    try:
        out = brand_voice_service.train_brand_voice(
            client=client,
            samples=samples,
            user=request.user,
            business_hint=business_hint,
            industry=industry,
            language=language,
        )
    except RateLimited as e:
        return Response({
            'error': str(e), 'scope': e.scope,
            'limit': e.limit, 'used':  e.used,
        }, status=429)
    except AIError as e:
        return Response({'error': str(e)}, status=400 if 'sample' in str(e).lower() else 503)
    except Exception:
        logger.exception('train_voice failed')
        return Response({'error': 'training failed'}, status=500)

    return Response(out)


# ─────────────────────────────────────────────────────────────────────────
# 3. POST /ai/v2/brand-voice/test/
# ─────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def test_voice(request):
    """
    Generate a sample post about `topic` using the client's trained brand voice.
    Useful as a "preview" button on the BrandVoicePage.

    Body: { client_id, topic, platform?, tone? }
    Returns: { content, hashtags, suggested_media_type, character_count, score, voice_used: bool }
    """
    client, err = _resolved_client(request)
    if err: return err

    topic = (request.data.get('topic') or '').strip()
    if not topic:
        return Response({'error': 'topic is required'}, status=400)

    voice_block = brand_voice_prompt(client)

    ai = AIClient(client=client, user=request.user, feature='brand_voice_test')
    try:
        data = _ai_call_json(
            ai=ai, template='post_writer',
            topic=topic,
            platform=request.data.get('platform', 'instagram'),
            tone=request.data.get('tone') or '',
            length='medium',
            include_hashtags=True,
            include_emojis=True,
            language=request.data.get('language', 'English'),
            brand_voice=voice_block,
        )
    except (AIError, RateLimited) as e:
        return _error_response(e, 'brand-voice test failed')

    data['voice_used'] = bool(voice_block)
    if not data.get('character_count'):
        data['character_count'] = len(data.get('content') or '')
    return Response(data)
