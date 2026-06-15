# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Smart Composer AI endpoints.

Mounted at:
    POST /api/ai/v2/compose             — multi-platform post variants
    POST /api/ai/v2/rewrite             — instruction-based rewrite
    POST /api/ai/v2/extend              — extend a draft
    POST /api/ai/v2/summarize           — bullet/paragraph/tweet/tldr summary
    POST /api/ai/v2/hashtag-research    — deeper hashtag research with reach scoring
    POST /api/ai/v2/optimal-time        — best time-to-post (uses PostMetric history + AI)
    POST /api/ai/v2/title-generator     — title candidates for blog/YT/long-form
    POST /api/ai/v2/post-improve        — score + critique + improved version

The /v2/ prefix avoids conflicts with the existing endpoints in `ai_views.py`
(Rule #1: do not change existing AI features). New endpoints flow through the
new AIClient infrastructure for proper rate limiting + cost tracking + logging.
"""
from __future__ import annotations

import logging
from collections import defaultdict
from datetime import timedelta

from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Client, PostMetric
from ..ai_helpers import brand_voice_prompt
from ..ai_views import _resolved_client                 # reuse existing tenant guard
from . import AIClient, AIError, RateLimited, prompts

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────

def _ai_call_json(*, ai: AIClient, template: str, **kwargs) -> dict:
    """
    Build a prompt from `template`, run it through AIClient.extract_json, and
    return the parsed dict. Raises AIError / RateLimited as-is.
    """
    cfg = prompts.build(template, **kwargs)
    return ai.extract_json(
        cfg['user_message'],
        system=cfg['system'],
        model=cfg.get('model'),
        max_tokens=cfg.get('max_tokens', 1024),
        temperature=cfg.get('temperature', 0.5),
    )


def _error_response(err: Exception, fallback: str = 'AI request failed'):
    if isinstance(err, RateLimited):
        return Response({
            'error': str(err),
            'scope': err.scope,
            'limit': err.limit,
            'used':  err.used,
        }, status=429)
    if isinstance(err, AIError):
        return Response({'error': str(err) or fallback}, status=503)
    logger.exception(fallback)
    return Response({'error': fallback}, status=500)


# ─────────────────────────────────────────────────────────────────────────
# 1. /ai/v2/compose
# ─────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def compose(request):
    """
    Generate one platform-tailored variant per requested platform.

    Body:
        { client_id, topic, platforms[], tone, length,
          include_hashtags, include_emojis, language, cta, extra_notes }

    Returns:
        { variants: [{platform, content, hashtags[], suggested_media_type,
                     character_count, score}] }
    """
    client, err = _resolved_client(request)
    if err: return err

    topic = (request.data.get('topic') or '').strip()
    if not topic:
        return Response({'error': 'topic is required'}, status=400)

    platforms        = request.data.get('platforms') or ['instagram']
    tone             = request.data.get('tone') or 'friendly'
    length           = request.data.get('length') or 'medium'
    include_hashtags = bool(request.data.get('include_hashtags', True))
    include_emojis   = bool(request.data.get('include_emojis',   True))
    language         = request.data.get('language') or 'English'
    cta              = (request.data.get('cta') or '').strip()
    extra_notes      = (request.data.get('extra_notes') or '').strip()

    ai = AIClient(client=client, user=request.user, feature='compose')
    try:
        data = _ai_call_json(
            ai=ai, template='compose',
            topic=topic, platforms=platforms, tone=tone, length=length,
            include_hashtags=include_hashtags, include_emojis=include_emojis,
            language=language, cta=cta, extra_notes=extra_notes,
            brand_voice=brand_voice_prompt(client),
        )
    except (AIError, RateLimited) as e:
        return _error_response(e, 'compose failed')

    variants = data.get('variants') or []
    # Backfill character_count when the model returns 0
    for v in variants:
        if not v.get('character_count'):
            v['character_count'] = len(v.get('content') or '')
    return Response({'variants': variants})


# ─────────────────────────────────────────────────────────────────────────
# 2. /ai/v2/rewrite
# ─────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def rewrite_v2(request):
    """
    Body: { client_id, text, instruction, preserve_meaning? }
    Returns: { rewritten_text, changes_summary }
    """
    client, err = _resolved_client(request)
    if err: return err

    text        = (request.data.get('text') or '').strip()
    instruction = (request.data.get('instruction') or '').strip()
    if not text or not instruction:
        return Response({'error': 'text and instruction are required'}, status=400)

    ai = AIClient(client=client, user=request.user, feature='rewrite_v2')
    try:
        data = _ai_call_json(
            ai=ai, template='rewrite',
            text=text, instruction=instruction,
            preserve_meaning=bool(request.data.get('preserve_meaning', True)),
            brand_voice=brand_voice_prompt(client),
        )
    except (AIError, RateLimited) as e:
        return _error_response(e, 'rewrite failed')
    return Response(data)


# ─────────────────────────────────────────────────────────────────────────
# 3. /ai/v2/extend
# ─────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def extend(request):
    """
    Body: { client_id, draft, target_length: 'short'|'medium'|'long'|int, preserve_tone? }
    Returns: { extended_text, added_word_count }
    """
    client, err = _resolved_client(request)
    if err: return err

    draft = (request.data.get('draft') or '').strip()
    if not draft:
        return Response({'error': 'draft is required'}, status=400)

    target_length = request.data.get('target_length', 'medium')
    if isinstance(target_length, str) and target_length.isdigit():
        target_length = int(target_length)

    ai = AIClient(client=client, user=request.user, feature='extend')
    try:
        data = _ai_call_json(
            ai=ai, template='extend',
            draft=draft, target_length=target_length,
            preserve_tone=bool(request.data.get('preserve_tone', True)),
            brand_voice=brand_voice_prompt(client),
        )
    except (AIError, RateLimited) as e:
        return _error_response(e, 'extend failed')
    return Response(data)


# ─────────────────────────────────────────────────────────────────────────
# 4. /ai/v2/summarize
# ─────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def summarize(request):
    """
    Body: { client_id, text, style?, target_length?, language? }
    Returns: { summary, key_points: [] }
    """
    client, err = _resolved_client(request)
    if err: return err

    text = (request.data.get('text') or '').strip()
    if not text:
        return Response({'error': 'text is required'}, status=400)

    ai = AIClient(client=client, user=request.user, feature='summarize')
    try:
        data = _ai_call_json(
            ai=ai, template='summarize',
            text=text,
            style=request.data.get('style', 'bullet_points'),
            target_length=request.data.get('target_length', 'medium'),
            language=request.data.get('language', 'English'),
        )
    except (AIError, RateLimited) as e:
        return _error_response(e, 'summarize failed')
    return Response(data)


# ─────────────────────────────────────────────────────────────────────────
# 5. /ai/v2/hashtag-research
# ─────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def hashtag_research(request):
    """
    Body: { client_id, content, platform?, count?, niche?, location?, language? }
    Returns: { hashtags: [{tag, estimated_reach, competition_level, relevance_score, rationale}] }
    """
    client, err = _resolved_client(request)
    if err: return err

    content = (request.data.get('content') or '').strip()
    if not content:
        return Response({'error': 'content is required'}, status=400)

    ai = AIClient(client=client, user=request.user, feature='hashtag_research')
    try:
        data = _ai_call_json(
            ai=ai, template='hashtag_research',
            content=content,
            platform=request.data.get('platform', 'instagram'),
            count=int(request.data.get('count', 15) or 15),
            niche=request.data.get('niche', '') or '',
            location=request.data.get('location', '') or '',
            language=request.data.get('language', 'English'),
        )
    except (AIError, RateLimited) as e:
        return _error_response(e, 'hashtag research failed')
    return Response(data)


# ─────────────────────────────────────────────────────────────────────────
# 6. /ai/v2/optimal-time
# ─────────────────────────────────────────────────────────────────────────
def _build_engagement_map(client, platform: str | None, days: int = 60) -> dict:
    """
    Aggregate the client's recent PostMetric data into a {weekday: {hour: norm_score}} map.
    Returns {} when there's not enough data.
    """
    since = timezone.now() - timedelta(days=days)
    qs = PostMetric.objects.filter(client=client, posted_at__gte=since)
    if platform:
        qs = qs.filter(platform=platform)

    bucket_eng = defaultdict(list)   # (weekday_name, hour) -> [eng_score, ...]
    for m in qs.iterator():
        dt = getattr(m, 'posted_at', None)
        if not dt:
            continue
        weekday = dt.strftime('%A')
        hour    = int(dt.hour)
        # Normalised engagement signal: likes + comments + shares relative to followers.
        eng = (
            (getattr(m, 'likes', 0) or 0)
            + (getattr(m, 'comments', 0) or 0)
            + (getattr(m, 'shares', 0) or 0)
        )
        bucket_eng[(weekday, hour)].append(eng)

    if not bucket_eng:
        return {}

    # Average per bucket and normalise to 0..1
    avg = {k: sum(v) / max(len(v), 1) for k, v in bucket_eng.items()}
    if not avg:
        return {}
    peak = max(avg.values()) or 1
    out = defaultdict(dict)
    for (wd, hr), val in avg.items():
        out[wd][hr] = round(val / peak, 3)
    return dict(out)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def optimal_time(request):
    """
    Body: { client_id, platform?, content_type?, target_audience?, timezone?, top_n? }
    Returns: { recommendations: [{day, hour, expected_engagement_score, reason}], data_window_days }
    """
    client, err = _resolved_client(request)
    if err: return err

    platform     = request.data.get('platform') or None
    content_type = request.data.get('content_type', 'general')
    audience     = request.data.get('target_audience', '')
    tz           = request.data.get('timezone') or getattr(client, 'timezone', '') or 'UTC'
    top_n        = max(1, min(int(request.data.get('top_n', 5) or 5), 10))

    history = _build_engagement_map(client, platform=platform, days=60)

    ai = AIClient(client=client, user=request.user, feature='optimal_time')
    try:
        data = _ai_call_json(
            ai=ai, template='optimal_time',
            platform=platform or 'instagram',
            content_type=content_type,
            target_audience=audience,
            timezone=tz,
            historical_engagement=history,
            top_n=top_n,
        )
    except (AIError, RateLimited) as e:
        return _error_response(e, 'optimal-time failed')

    return Response({
        'recommendations':  data.get('recommendations') or [],
        'data_window_days': 60 if history else 0,
    })


# ─────────────────────────────────────────────────────────────────────────
# 7. /ai/v2/title-generator
# ─────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def title_generator(request):
    """
    Body: { client_id, topic, content?, style?, count?, language? }
    Returns: { titles: [{text, ctr_prediction, length, score, rationale}] }
    """
    client, err = _resolved_client(request)
    if err: return err

    topic = (request.data.get('topic') or '').strip()
    if not topic:
        return Response({'error': 'topic is required'}, status=400)

    ai = AIClient(client=client, user=request.user, feature='title_generator')
    try:
        data = _ai_call_json(
            ai=ai, template='title_generator',
            topic=topic,
            content=(request.data.get('content') or '').strip(),
            style=request.data.get('style', 'informative'),
            count=int(request.data.get('count', 6) or 6),
            language=request.data.get('language', 'English'),
        )
    except (AIError, RateLimited) as e:
        return _error_response(e, 'title-generator failed')

    titles = data.get('titles') or []
    for t in titles:
        if not t.get('length'):
            t['length'] = len(t.get('text') or '')
    return Response({'titles': titles})


# ─────────────────────────────────────────────────────────────────────────
# 8. /ai/v2/post-improve
# ─────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def post_improve(request):
    """
    Body: { client_id, draft, platform?, goal? }
    Returns: { score, issues: [], suggestions: [], improved_version }
    """
    client, err = _resolved_client(request)
    if err: return err

    draft = (request.data.get('draft') or '').strip()
    if not draft:
        return Response({'error': 'draft is required'}, status=400)

    ai = AIClient(client=client, user=request.user, feature='post_improve')
    try:
        data = _ai_call_json(
            ai=ai, template='post_improve',
            draft=draft,
            platform=request.data.get('platform', 'instagram'),
            goal=request.data.get('goal', 'engagement'),
            brand_voice=brand_voice_prompt(client),
        )
    except (AIError, RateLimited) as e:
        return _error_response(e, 'post-improve failed')
    return Response(data)
