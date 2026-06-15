# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
AI Hashtag Research Tool views.

POST /api/ai/hashtags/                        — generate hashtag research
GET  /api/ai/hashtags/?client_id=             — get history for a client
POST /api/ai/hashtags/{id}/save-set/          — save a custom hashtag set
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

from .models import Client, HashtagSet
from .ai_context import build_client_ai_context

logger = logging.getLogger(__name__)

DAILY_RATE_LIMIT = 20       # searches per client per day
CACHE_TTL = 86400           # 24 hours — same niche+location+platform

SYSTEM_PROMPT = (
    "You are a social media hashtag strategist. "
    "You research and recommend the most effective hashtag combinations "
    "for maximum organic reach. You understand hashtag tiers "
    "(mega/large/medium/small/niche/local) and how to mix them for best results. "
    "Return valid JSON only."
)

PLATFORM_RULES = {
    'instagram': 'Instagram: 20-30 hashtags, mix all tiers',
    'facebook':  'Facebook: 3-5 hashtags maximum',
    'linkedin':  'LinkedIn: 3-5 professional hashtags',
    'youtube':   'YouTube: 5-10 in description',
}


# ── helpers ───────────────────────────────────────────────────────────────────

def _cache_key(niche: str, location: str, platform: str) -> str:
    raw = json.dumps(
        {'niche': niche.lower().strip(), 'location': location.lower().strip(), 'platform': platform},
        sort_keys=True,
    )
    return 'hashtag:' + hashlib.sha256(raw.encode()).hexdigest()


def _check_rate_limit(client: Client) -> bool:
    """Return True if client is within the daily limit."""
    today = timezone.now().date()
    count = HashtagSet.objects.filter(client=client, generated_at__date=today).count()
    return count < DAILY_RATE_LIMIT


def _build_user_prompt(niche, location, platform, post_topic, post_type, client_context):
    platform_rule = PLATFORM_RULES.get(platform, '')
    location_line = f'Location: {location}' if location else 'Location: Global / Not specified'

    return f"""Research and recommend hashtags for:

{client_context}

Niche: {niche}
{location_line}
Platform: {platform}
Post topic: {post_topic}
Post type: {post_type}

Platform rules:
{platform_rule}

For each hashtag include estimated reach size.
Group by tier.

Return ONLY this JSON:
{{
  "strategy": "One sentence hashtag strategy",
  "groups": {{
    "mega": {{
      "description": "1M+ posts — max exposure",
      "tags": [
        {{"tag": "#yoga", "estimated_posts": "50M+"}}
      ]
    }},
    "large": {{
      "description": "100K-1M — broad reach",
      "tags": [{{"tag": "#example", "estimated_posts": "500K"}}]
    }},
    "medium": {{
      "description": "10K-100K — targeted",
      "tags": [{{"tag": "#example", "estimated_posts": "50K"}}]
    }},
    "small": {{
      "description": "1K-10K — niche audience",
      "tags": [{{"tag": "#example", "estimated_posts": "5K"}}]
    }},
    "local": {{
      "description": "Location specific",
      "tags": [{{"tag": "#example", "estimated_posts": "2K"}}]
    }},
    "branded": {{
      "description": "Create your own brand tags",
      "tags": [{{"tag": "#yourbrand", "estimated_posts": "New"}}]
    }}
  }},
  "recommended_set": {{
    "caption": "Ready to paste caption hashtags as one block",
    "first_comment": "Hashtags for first comment as one block",
    "mix_explanation": "Why this mix works"
  }},
  "avoid": ["#tag — reason why to avoid"],
  "platform_tips": "Specific tips for {platform}"
}}"""


def _serialize_hashtag_set(hs: HashtagSet) -> dict:
    return {
        'id':           hs.id,
        'niche':        hs.niche,
        'location':     hs.location,
        'platform':     hs.platform,
        'hashtags':     hs.hashtags,
        'saved_sets':   hs.saved_sets,
        'generated_at': hs.generated_at.isoformat(),
    }


# ── main dispatcher ───────────────────────────────────────────────────────────

@api_view(['POST', 'GET'])
@permission_classes([IsAuthenticated])
def hashtag_view(request):
    if request.method == 'GET':
        return _get_history(request)
    return _generate_hashtags(request)


# ── GET history ───────────────────────────────────────────────────────────────

def _get_history(request):
    client_id = request.query_params.get('client_id')
    if not client_id:
        try:
            profile = request.user.profile
            if profile.role == 'client' and profile.client_id:
                client_id = profile.client_id
        except Exception:
            pass
    if not client_id:
        return Response({'error': 'client_id required'}, status=400)

    qs = HashtagSet.objects.filter(client_id=client_id).order_by('-generated_at')[:30]
    return Response([_serialize_hashtag_set(hs) for hs in qs])


# ── POST generate ─────────────────────────────────────────────────────────────

def _generate_hashtags(request):
    data       = request.data
    client_id  = data.get('client_id')
    niche      = (data.get('niche') or '').strip()
    location   = (data.get('location') or '').strip()
    platform   = (data.get('platform') or '').strip()
    post_topic = (data.get('post_topic') or '').strip()
    post_type  = (data.get('post_type') or 'general').strip()

    # Resolve client_id for client-role users
    if not client_id:
        try:
            profile = request.user.profile
            if profile.role == 'client' and profile.client_id:
                client_id = profile.client_id
        except Exception:
            pass

    # Validation
    if not client_id:
        return Response({'error': 'client_id is required'}, status=400)
    if not platform:
        return Response({'error': 'platform is required'}, status=400)

    try:
        client = Client.objects.get(id=client_id)
    except Client.DoesNotExist:
        return Response({'error': 'Client not found'}, status=404)

    niche = niche or client.business_category or client.company
    location = location or client.business_location
    post_topic = post_topic or client.brand_description or client.usp
    client_context = build_client_ai_context(client)

    if not niche:
        return Response({'error': 'niche is required'}, status=400)
    if not post_topic:
        return Response({'error': 'post_topic is required'}, status=400)

    # Rate limit
    if not _check_rate_limit(client):
        return Response(
            {'error': f'Daily limit of {DAILY_RATE_LIMIT} hashtag searches reached. Try again tomorrow.'},
            status=429,
        )

    # 24-hour cache — same niche + location + platform
    ckey   = _cache_key(niche, location, platform)
    cached = cache.get(ckey)
    if cached:
        # Return a minimal HashtagSet-like response from cache
        return Response({'hashtags': cached, 'cached': True, 'id': None})

    # Claude API
    api_key = getattr(settings, 'ANTHROPIC_API_KEY', '')
    if not api_key:
        return Response({'error': 'AI service is not configured. Contact your administrator.'}, status=503)

    try:
        claude      = anthropic.Anthropic(api_key=api_key)
        user_prompt = _build_user_prompt(niche, location, platform, post_topic, post_type, client_context)

        message = claude.messages.create(
            model='claude-haiku-4-5-20251001',
            max_tokens=4096,
            timeout=45,
            system=SYSTEM_PROMPT,
            messages=[{'role': 'user', 'content': user_prompt}],
        )
        raw = message.content[0].text.strip()

        # Strip markdown code fences if present
        if raw.startswith('```'):
            raw = raw.split('\n', 1)[1] if '\n' in raw else raw[3:]
            if raw.endswith('```'):
                raw = raw[:-3].strip()

        hashtags = json.loads(raw)

    except anthropic.APITimeoutError:
        return Response(
            {'error': 'The AI took too long to respond (45s limit). Please try again.'},
            status=504,
        )
    except anthropic.APIError as e:
        logger.error('Anthropic API error: %s', e)
        return Response({'error': 'AI service error. Please try again in a moment.'}, status=502)
    except json.JSONDecodeError:
        logger.error('Claude returned non-JSON for hashtags: %s', raw[:300])
        return Response({'error': 'AI returned an unexpected format. Please try again.'}, status=502)
    except Exception as e:
        logger.error('Hashtag generation error: %s', e)
        return Response({'error': 'An unexpected error occurred. Please try again.'}, status=500)

    # Persist
    hs = HashtagSet.objects.create(
        client=client,
        niche=niche,
        location=location,
        platform=platform,
        hashtags=hashtags,
        generated_by=request.user,
    )

    # Cache result for 24 hours
    cache.set(ckey, hashtags, CACHE_TTL)

    return Response({'hashtags': hashtags, 'cached': False, 'id': hs.id})


# ── POST save-set ─────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def save_set(request, pk):
    set_name = (request.data.get('set_name') or '').strip()
    tags     = request.data.get('tags', [])

    if not set_name:
        return Response({'error': 'set_name is required'}, status=400)
    if not tags:
        return Response({'error': 'tags list is required'}, status=400)

    try:
        hs = HashtagSet.objects.get(pk=pk)
    except HashtagSet.DoesNotExist:
        return Response({'error': 'HashtagSet not found'}, status=404)

    # Verify ownership
    try:
        profile = request.user.profile
        is_admin = profile.role in ('superadmin', 'staff')
    except Exception:
        is_admin = False

    if not is_admin and hs.client_id != getattr(getattr(request.user, 'profile', None), 'client_id', None):
        return Response({'error': 'Not authorized'}, status=403)

    new_entry = {
        'name':       set_name,
        'tags':       tags,
        'platform':   hs.platform,
        'created_at': timezone.now().isoformat(),
    }

    saved = list(hs.saved_sets or [])
    saved.append(new_entry)
    hs.saved_sets = saved
    hs.save(update_fields=['saved_sets'])

    return Response({'saved_sets': hs.saved_sets})


# ── GET all saved sets for a client ──────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_saved_sets(request):
    """Return all saved sets across all HashtagSets for a client."""
    client_id = request.query_params.get('client_id')
    if not client_id:
        try:
            profile = request.user.profile
            if profile.role == 'client' and profile.client_id:
                client_id = profile.client_id
        except Exception:
            pass
    if not client_id:
        return Response({'error': 'client_id required'}, status=400)

    qs = HashtagSet.objects.filter(client_id=client_id).exclude(saved_sets=[])
    result = []
    for hs in qs:
        for s in (hs.saved_sets or []):
            result.append({
                'hashtag_set_id': hs.id,
                'name':           s.get('name'),
                'tags':           s.get('tags', []),
                'platform':       s.get('platform', hs.platform),
                'created_at':     s.get('created_at'),
            })
    # sort newest first
    result.sort(key=lambda x: x.get('created_at') or '', reverse=True)
    return Response(result)
