# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
AI Caption Writer views.
POST /api/ai/caption/ — generate captions via Claude
GET  /api/ai/caption/ — get history for a client
"""
import hashlib
import json
import logging

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

import anthropic

from .models import Client, CaptionRequest
from .ai_context import build_client_ai_context

logger = logging.getLogger(__name__)

PLATFORM_RULES = {
    'facebook':           'Facebook: 150-300 words, conversational, 2-3 hashtags',
    'instagram':          'Instagram: 100-150 words, engaging, 15-20 hashtags grouped at end, include emojis',
    'linkedin':           'LinkedIn: 100-200 words, professional, no hashtags, thought leadership angle',
    'youtube':            'YouTube: 150-250 words, SEO focused, include keywords',
    'google_my_business': 'Google My Business: 50-100 words, local focus, include location keywords',
}

SYSTEM_PROMPT = (
    "You are an expert social media copywriter for a marketing agency. "
    "You write compelling captions that drive engagement and match each platform's "
    "unique style and audience expectations. "
    "Always return valid JSON only — no other text."
)

DAILY_RATE_LIMIT = 10   # requests per client per day
CACHE_TTL = 3600        # 1 hour cache for identical inputs


def _cache_key(data: dict) -> str:
    """Stable cache key based on request inputs."""
    raw = json.dumps({k: data.get(k) for k in sorted(['topic', 'tone', 'post_type', 'platforms', 'keywords', 'call_to_action'])}, sort_keys=True)
    return 'caption:' + hashlib.sha256(raw.encode()).hexdigest()


def _check_rate_limit(client: Client) -> bool:
    """Return True if client is within daily limit."""
    today = timezone.now().date()
    count = CaptionRequest.objects.filter(client=client, created_at__date=today).count()
    return count < DAILY_RATE_LIMIT


def _build_user_prompt(topic, tone, post_type, platforms, keywords, cta, client_context):
    platform_rules = '\n'.join(PLATFORM_RULES[p] for p in platforms if p in PLATFORM_RULES)
    platform_list = ', '.join(platforms)

    return f"""Write social media captions for the following:

{client_context}

Topic: {topic}
Tone: {tone}
Post type: {post_type}
Keywords to include: {keywords or 'none specified'}
Call to action: {cta or 'none specified'}

Write a caption for each platform requested: {platform_list}

Platform rules:
{platform_rules}

Return ONLY this exact JSON format:
{{
  "facebook": "caption text here",
  "instagram": "caption text here",
  "linkedin": "caption text here",
  "youtube": "caption text here",
  "google_my_business": "caption text here",
  "hashtags": {{
    "instagram": ["#tag1", "#tag2"],
    "facebook": ["#tag1", "#tag2"]
  }},
  "best_posting_time": {{
    "facebook": "Wednesday 1-3pm",
    "instagram": "Tuesday 11am or Friday 7pm"
  }}
}}
Only include platforms that were requested."""


@api_view(['POST', 'GET'])
@permission_classes([IsAuthenticated])
def caption_view(request):
    if request.method == 'GET':
        return _get_history(request)
    return _generate_caption(request)


def _get_history(request):
    client_id = request.query_params.get('client_id')
    if not client_id:
        # Try to infer from user profile
        try:
            profile = request.user.profile
            if profile.role == 'client' and profile.client_id:
                client_id = profile.client_id
        except Exception:
            pass
    if not client_id:
        return Response({'error': 'client_id required'}, status=400)

    qs = CaptionRequest.objects.filter(client_id=client_id).order_by('-created_at')[:20]
    data = []
    for r in qs:
        data.append({
            'id':                 r.id,
            'topic':              r.topic,
            'tone':               r.tone,
            'post_type':          r.post_type,
            'platforms':          r.platforms,
            'keywords':           r.keywords,
            'call_to_action':     r.call_to_action,
            'generated_captions': r.generated_captions,
            'created_at':         r.created_at.isoformat(),
        })
    return Response(data)


def _generate_caption(request):
    data       = request.data
    client_id  = data.get('client_id')
    topic      = (data.get('topic') or '').strip()
    tone       = data.get('tone', 'professional')
    post_type  = data.get('post_type', 'promotion')
    platforms  = data.get('platforms', [])
    keywords   = (data.get('keywords') or '').strip()
    cta        = (data.get('call_to_action') or '').strip()

    # Validation
    if not client_id:
        try:
            profile = request.user.profile
            if profile.role == 'client' and profile.client_id:
                client_id = profile.client_id
        except Exception:
            pass
    if not client_id:
        return Response({'error': 'client_id is required'}, status=400)
    if not topic:
        return Response({'error': 'topic is required'}, status=400)
    if not platforms:
        return Response({'error': 'at least one platform is required'}, status=400)

    try:
        client = Client.objects.get(id=client_id)
    except Client.DoesNotExist:
        return Response({'error': 'Client not found'}, status=404)

    client_context = build_client_ai_context(client)

    # Rate limit check
    if not _check_rate_limit(client):
        return Response({'error': f'Daily limit of {DAILY_RATE_LIMIT} caption requests reached. Try again tomorrow.'}, status=429)

    # Cache check (same inputs → same output within 1 hour)
    ckey = _cache_key(data)
    cached = cache.get(ckey)
    if cached:
        return Response({'captions': cached, 'cached': True})

    # Call Claude
    api_key = getattr(settings, 'ANTHROPIC_API_KEY', '')
    if not api_key:
        return Response({'error': 'AI service is not configured. Contact your administrator.'}, status=503)

    try:
        claude = anthropic.Anthropic(api_key=api_key)
        user_prompt = _build_user_prompt(topic, tone, post_type, platforms, keywords, cta, client_context)

        message = claude.messages.create(
            model='claude-haiku-4-5-20251001',
            max_tokens=2048,
            timeout=30,
            system=SYSTEM_PROMPT,
            messages=[{'role': 'user', 'content': user_prompt}],
        )
        raw = message.content[0].text.strip()

        # Strip markdown code fences if Claude wrapped it
        if raw.startswith('```'):
            raw = raw.split('\n', 1)[1] if '\n' in raw else raw[3:]
            if raw.endswith('```'):
                raw = raw[:-3].strip()

        captions = json.loads(raw)

    except anthropic.APITimeoutError:
        return Response({'error': 'The AI took too long to respond (30s limit). Please try again.'}, status=504)
    except anthropic.APIError as e:
        logger.error('Anthropic API error: %s', e)
        return Response({'error': 'AI service error. Please try again in a moment.'}, status=502)
    except json.JSONDecodeError:
        logger.error('Claude returned non-JSON: %s', raw[:200])
        return Response({'error': 'AI returned an unexpected format. Please try again.'}, status=502)
    except Exception as e:
        logger.error('Caption generation error: %s', e)
        return Response({'error': 'An unexpected error occurred. Please try again.'}, status=500)

    # Save to database
    CaptionRequest.objects.create(
        client=client,
        topic=topic,
        tone=tone,
        post_type=post_type,
        platforms=platforms,
        keywords=keywords,
        call_to_action=cta,
        generated_captions=captions,
        created_by=request.user,
    )

    # Cache the result
    cache.set(ckey, captions, CACHE_TTL)

    return Response({'captions': captions, 'cached': False})
