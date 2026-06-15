# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Unified AI Assistant API.

Endpoints:
  POST /ai/compose-post/        — 3 variants per platform
  POST /ai/suggest-hashtags/    — top hashtags for a draft
  POST /ai/best-time-to-post/   — 3 best time slots from historical engagement
  POST /ai/suggest-reply/       — 3 reply suggestions for an inbox message
  POST /ai/rewrite/             — rewrite text per instruction
  POST /ai/translate/           — translate text
  POST /ai/generate-image-caption/  — caption an image (Claude vision)
  POST /ai/content-calendar/    — multi-week editorial calendar
  POST /ai/train-brand-voice/   — saves a BrandVoiceProfile from sample posts
  GET  /ai/brand-voice/         — fetch the current profile (if any)

All endpoints are tenant-scoped (client_id derived from the authenticated user
or from request.body when caller is superadmin/staff with assignment access).
All use the saved BrandVoiceProfile when generating content.
"""
from __future__ import annotations

import logging
from datetime import datetime, time, timedelta

from django.conf import settings
from django.core.cache import cache
from django.db.models import Avg, Count
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .ai_helpers import (
    HAIKU, SONNET, get_claude, parse_json_response,
    unified_voice_prompt,
    rate_limit_check, cache_key_for,
)
from .ai_context import build_client_ai_context
from .models import (
    Client, BrandVoiceProfile, PostMetric, Message, Conversation,
)

logger = logging.getLogger(__name__)

DAILY_LIMIT_DEFAULT = 30
CACHE_TTL = 60 * 60   # 1 hour


# ── Tenant resolver ──────────────────────────────────────────────────────────
def _resolved_client(request):
    """
    Tenant guard. Returns (Client, None) on success, (None, Response) on error.
    """
    try:
        profile = request.user.profile
    except Exception:
        return None, Response({'error': 'No profile'}, status=403)

    raw = request.data.get('client_id') if hasattr(request, 'data') else None
    raw = raw or request.query_params.get('client_id')

    if profile.role == 'superadmin':
        cid = raw or profile.client_id
    elif profile.role == 'staff':
        try:
            cid = int(raw) if raw else None
        except (TypeError, ValueError):
            cid = None
        if cid is None or not profile.assigned_clients.filter(id=cid).exists():
            return None, Response({'error': 'client_id required'}, status=400)
    else:
        cid = profile.client_id

    if not cid:
        return None, Response({'error': 'client_id required'}, status=400)

    try:
        return Client.objects.get(id=cid), None
    except Client.DoesNotExist:
        return None, Response({'error': 'Client not found'}, status=404)


def _ai_unavailable():
    return Response(
        {'error': 'AI service is not configured. Contact your administrator.'},
        status=503,
    )


# ══════════════════════════════════════════════════════════════════════
# 1. compose-post
# ══════════════════════════════════════════════════════════════════════
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def compose_post(request):
    """
    Body: {topic, tone?, platforms[], length?}
    Returns: {variants: {platform: [v1, v2, v3]}}
    """
    client, err = _resolved_client(request)
    if err: return err
    if not rate_limit_check(client.id, 'compose-post', DAILY_LIMIT_DEFAULT):
        return Response({'error': 'Daily AI limit reached'}, status=429)

    topic     = (request.data.get('topic') or '').strip()
    tone      = (request.data.get('tone') or 'friendly').strip()
    length    = (request.data.get('length') or 'medium').strip()
    platforms = request.data.get('platforms') or []
    if not topic:
        return Response({'error': 'topic is required'}, status=400)
    if not platforms:
        return Response({'error': 'platforms is required'}, status=400)

    ckey = cache_key_for('compose-post', {
        'c': client.id, 'topic': topic, 'tone': tone, 'length': length, 'platforms': platforms,
    })
    cached = cache.get(ckey)
    if cached:
        return Response({'variants': cached, 'cached': True})

    claude = get_claude()
    if not claude:
        return _ai_unavailable()

    bv = unified_voice_prompt(client)
    cc = build_client_ai_context(client)
    sys_prompt = (
        'You are an expert social media copywriter. Write 3 distinct variants '
        'per platform (varied openings + angles). Output ONLY valid JSON.\n'
        + (bv + '\n' if bv else '')
    )
    user_prompt = (
        f'{cc}\n\n'
        f'Topic: {topic}\nTone: {tone}\nLength: {length}\nPlatforms: {", ".join(platforms)}\n\n'
        'Return EXACTLY this JSON:\n'
        '{"variants": {"<platform>": ["<v1>", "<v2>", "<v3>"]}}'
    )

    try:
        msg = claude.messages.create(
            model=HAIKU, max_tokens=2048, timeout=30,
            system=sys_prompt,
            messages=[{'role': 'user', 'content': user_prompt}],
        )
        out = parse_json_response(msg.content[0].text)
        variants = out.get('variants') or {}
    except Exception as e:
        logger.exception('compose_post failed')
        return Response({'error': f'AI error: {e}'}, status=502)

    cache.set(ckey, variants, CACHE_TTL)
    return Response({'variants': variants, 'cached': False})


# ══════════════════════════════════════════════════════════════════════
# 2. suggest-hashtags
# ══════════════════════════════════════════════════════════════════════
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def suggest_hashtags(request):
    """
    Body: {content, platform, count?}
    Returns: {hashtags: ['#a', '#b', ...]}
    """
    client, err = _resolved_client(request)
    if err: return err
    if not rate_limit_check(client.id, 'suggest-hashtags', DAILY_LIMIT_DEFAULT):
        return Response({'error': 'Daily AI limit reached'}, status=429)

    content  = (request.data.get('content') or '').strip()
    platform = (request.data.get('platform') or 'instagram').strip()
    count    = max(1, min(int(request.data.get('count') or 12), 30))

    if not content:
        return Response({'error': 'content is required'}, status=400)

    ckey = cache_key_for('hashtags', {'c': client.id, 'p': platform, 'n': count, 't': content[:200]})
    cached = cache.get(ckey)
    if cached:
        return Response({'hashtags': cached, 'cached': True})

    claude = get_claude()
    if not claude:
        return _ai_unavailable()

    bv = unified_voice_prompt(client)
    sys_prompt = (
        'You suggest social media hashtags optimized for discoverability and audience fit. '
        'Mix broad + niche. No banned/spammy tags. Output JSON only.\n'
        + (bv + '\n' if bv else '')
    )
    user_prompt = (
        f'Suggest {count} hashtags for {platform}. Content:\n"""{content[:1500]}"""\n\n'
        'Return JSON: {"hashtags": ["#tag1", ...]}'
    )

    try:
        msg = claude.messages.create(
            model=HAIKU, max_tokens=512, timeout=20,
            system=sys_prompt,
            messages=[{'role': 'user', 'content': user_prompt}],
        )
        out = parse_json_response(msg.content[0].text)
        tags = out.get('hashtags') or []
    except Exception as e:
        logger.exception('suggest_hashtags failed')
        return Response({'error': f'AI error: {e}'}, status=502)

    # Normalize: prefix #, dedupe, cap at count
    seen, cleaned = set(), []
    for t in tags:
        if not isinstance(t, str): continue
        t = t.strip().lstrip('#').strip()
        if not t or t.lower() in seen: continue
        seen.add(t.lower())
        cleaned.append(f'#{t}')
        if len(cleaned) >= count: break

    cache.set(ckey, cleaned, CACHE_TTL)
    return Response({'hashtags': cleaned, 'cached': False})


# ══════════════════════════════════════════════════════════════════════
# 3. best-time-to-post  (heuristic from historical PostMetric)
# ══════════════════════════════════════════════════════════════════════
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def best_time_to_post(request):
    """
    Body: {platform, content_type?}
    Returns: {slots: [{day_of_week, hour, score, label}, ...3]}
    """
    client, err = _resolved_client(request)
    if err: return err

    platform = (request.data.get('platform') or '').strip()
    if not platform:
        return Response({'error': 'platform is required'}, status=400)

    cutoff = timezone.now() - timedelta(days=90)
    metrics = PostMetric.objects.filter(
        client=client, platform=platform,
        published_at__gte=cutoff,
        published_at__isnull=False,
    ).only('published_at', 'reach', 'likes', 'comments', 'shares')

    # Bucket by (day_of_week, hour) and average engagement
    buckets = {}
    for m in metrics.iterator():
        when = m.published_at
        if not when:
            continue
        key = (when.weekday(), when.hour)
        bucket = buckets.setdefault(key, {'sum': 0, 'count': 0})
        engagement = (m.reach or 0) + (m.likes or 0) * 2 + (m.comments or 0) * 3 + (m.shares or 0) * 4
        bucket['sum'] += engagement
        bucket['count'] += 1

    if not buckets:
        # Cold start — return platform defaults
        defaults = {
            'facebook':           [(2, 13), (4, 9),  (1, 19)],
            'instagram':          [(3, 11), (5, 19), (1, 8)],
            'linkedin':           [(1, 9),  (2, 12), (3, 17)],
            'youtube':            [(5, 14), (6, 16), (3, 21)],
            'google_my_business': [(2, 10), (4, 14), (5, 11)],
        }.get(platform, [(2, 12), (4, 18), (1, 9)])
        slots = [_slot_label(d, h, score=None) for d, h in defaults]
        return Response({'slots': slots, 'source': 'platform_defaults'})

    # Pick top 3 by avg engagement (require at least 2 samples)
    ranked = sorted(
        ((d, h, b['sum'] / max(1, b['count']), b['count'])
         for (d, h), b in buckets.items() if b['count'] >= 2),
        key=lambda x: x[2], reverse=True,
    )[:3]
    if not ranked:
        # Fall through to defaults if no bucket had >= 2 samples
        return best_time_to_post(request)
    slots = [_slot_label(d, h, score=score, samples=n) for d, h, score, n in ranked]
    return Response({'slots': slots, 'source': 'historical', 'sample_size': sum(b['count'] for b in buckets.values())})


def _slot_label(dow: int, hour: int, *, score=None, samples=None):
    days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    h12 = hour % 12 or 12
    ampm = 'AM' if hour < 12 else 'PM'
    return {
        'day_of_week': dow,
        'hour':        hour,
        'label':       f'{days[dow]} {h12}{ampm}',
        'score':       round(score, 1) if score is not None else None,
        'samples':     samples,
    }


# ══════════════════════════════════════════════════════════════════════
# 4. suggest-reply
# ══════════════════════════════════════════════════════════════════════
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def suggest_reply(request):
    """
    Body: {message_id}
    Returns: {suggestions: ['...', '...', '...']}
    """
    msg_id = request.data.get('message_id')
    if not msg_id:
        return Response({'error': 'message_id is required'}, status=400)

    try:
        message = Message.objects.select_related('conversation', 'conversation__client').get(id=msg_id)
    except Message.DoesNotExist:
        return Response({'error': 'Message not found'}, status=404)

    # Tenant guard
    try:
        profile = request.user.profile
    except Exception:
        return Response({'error': 'No profile'}, status=403)
    cid = message.conversation.client_id
    if profile.role == 'staff':
        if not profile.assigned_clients.filter(id=cid).exists():
            return Response({'error': 'Forbidden'}, status=403)
    elif profile.role == 'client':
        if profile.client_id != cid:
            return Response({'error': 'Forbidden'}, status=403)

    client = message.conversation.client
    if not rate_limit_check(client.id, 'suggest-reply', DAILY_LIMIT_DEFAULT):
        return Response({'error': 'Daily AI limit reached'}, status=429)

    claude = get_claude()
    if not claude:
        return _ai_unavailable()

    bv = unified_voice_prompt(client)
    conv = message.conversation
    sys_prompt = (
        'You write short, on-brand social media replies. '
        'Each suggestion ≤ 240 chars. Tone matches brand. Output JSON only.\n'
        + (bv + '\n' if bv else '')
    )
    sentiment = message.sentiment or 'unknown'
    user_prompt = (
        f'Platform: {conv.platform}. Conversation type: {conv.type}. '
        f'Inbound sentiment: {sentiment}.\n\n'
        f'They wrote: """{(message.content or "")[:1500]}"""\n\n'
        'Return JSON: {"suggestions": ["<reply 1>", "<reply 2>", "<reply 3>"]}\n'
        'Make the 3 replies distinct: one warm, one concise/professional, one playful (only if appropriate).'
    )

    try:
        msg = claude.messages.create(
            model=HAIKU, max_tokens=600, timeout=20,
            system=sys_prompt,
            messages=[{'role': 'user', 'content': user_prompt}],
        )
        out = parse_json_response(msg.content[0].text)
        suggestions = [s for s in (out.get('suggestions') or []) if isinstance(s, str)]
    except Exception as e:
        logger.exception('suggest_reply failed')
        return Response({'error': f'AI error: {e}'}, status=502)

    # Persist the first suggestion onto the message for use in the inbox UI
    if suggestions:
        Message.objects.filter(id=message.id).update(ai_suggested_reply=suggestions[0][:1000])

    return Response({'suggestions': suggestions[:3]})


# ══════════════════════════════════════════════════════════════════════
# 5. rewrite
# ══════════════════════════════════════════════════════════════════════
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def rewrite(request):
    """
    Body: {text, instruction}
    Returns: {text: '...'}
    """
    client, err = _resolved_client(request)
    if err: return err
    if not rate_limit_check(client.id, 'rewrite', DAILY_LIMIT_DEFAULT):
        return Response({'error': 'Daily AI limit reached'}, status=429)

    text        = (request.data.get('text') or '').strip()
    instruction = (request.data.get('instruction') or 'shorter').strip()
    if not text:
        return Response({'error': 'text is required'}, status=400)

    ckey = cache_key_for('rewrite', {'c': client.id, 't': text, 'i': instruction})
    cached = cache.get(ckey)
    if cached:
        return Response({'text': cached, 'cached': True})

    claude = get_claude()
    if not claude:
        return _ai_unavailable()

    bv = unified_voice_prompt(client)
    sys_prompt = (
        'You rewrite social media copy. Match the requested transformation. '
        'Preserve key facts. Output ONLY the rewritten text — no preamble, no quotes.\n'
        + (bv + '\n' if bv else '')
    )
    user_prompt = f'Transformation: {instruction}\n\nOriginal:\n"""{text[:3000]}"""'

    try:
        msg = claude.messages.create(
            model=HAIKU, max_tokens=1024, timeout=20,
            system=sys_prompt,
            messages=[{'role': 'user', 'content': user_prompt}],
        )
        out = (msg.content[0].text or '').strip().strip('"').strip()
    except Exception as e:
        logger.exception('rewrite failed')
        return Response({'error': f'AI error: {e}'}, status=502)

    cache.set(ckey, out, CACHE_TTL)
    return Response({'text': out, 'cached': False})


# ══════════════════════════════════════════════════════════════════════
# 6. translate
# ══════════════════════════════════════════════════════════════════════
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def translate(request):
    """
    Body: {text, target_language}
    Returns: {text: '...'}
    """
    client, err = _resolved_client(request)
    if err: return err
    if not rate_limit_check(client.id, 'translate', DAILY_LIMIT_DEFAULT * 2):
        return Response({'error': 'Daily AI limit reached'}, status=429)

    text   = (request.data.get('text') or '').strip()
    target = (request.data.get('target_language') or '').strip()
    if not text or not target:
        return Response({'error': 'text and target_language are required'}, status=400)

    ckey = cache_key_for('translate', {'t': text, 'lang': target.lower()})
    cached = cache.get(ckey)
    if cached:
        return Response({'text': cached, 'cached': True})

    claude = get_claude()
    if not claude:
        return _ai_unavailable()

    sys_prompt = (
        'You are a professional translator. Preserve meaning, tone, and any '
        'platform-specific markers (hashtags, @mentions, URLs). Output ONLY '
        'the translated text.'
    )
    user_prompt = f'Translate to {target}:\n\n"""{text[:5000]}"""'

    try:
        msg = claude.messages.create(
            model=HAIKU, max_tokens=2048, timeout=25,
            system=sys_prompt,
            messages=[{'role': 'user', 'content': user_prompt}],
        )
        out = (msg.content[0].text or '').strip()
    except Exception as e:
        logger.exception('translate failed')
        return Response({'error': f'AI error: {e}'}, status=502)

    cache.set(ckey, out, CACHE_TTL * 24)  # translations are stable; 24h cache
    return Response({'text': out, 'cached': False})


# ══════════════════════════════════════════════════════════════════════
# 7. generate-image-caption (Claude vision)
# ══════════════════════════════════════════════════════════════════════
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_image_caption(request):
    """
    Body: {image_url, platform?, length?}
    Returns: {caption: '...'}
    """
    client, err = _resolved_client(request)
    if err: return err
    if not rate_limit_check(client.id, 'image-caption', DAILY_LIMIT_DEFAULT):
        return Response({'error': 'Daily AI limit reached'}, status=429)

    image_url = (request.data.get('image_url') or '').strip()
    platform  = (request.data.get('platform') or 'instagram').strip()
    length    = (request.data.get('length') or 'medium').strip()
    if not image_url:
        return Response({'error': 'image_url is required'}, status=400)

    ckey = cache_key_for('img-caption', {'u': image_url, 'p': platform, 'l': length})
    cached = cache.get(ckey)
    if cached:
        return Response({'caption': cached, 'cached': True})

    claude = get_claude()
    if not claude:
        return _ai_unavailable()

    bv = unified_voice_prompt(client)
    sys_prompt = (
        f'Write a {length} caption for {platform} based on the image. '
        'Output ONLY the caption — no explanations.\n'
        + (bv + '\n' if bv else '')
    )

    try:
        msg = claude.messages.create(
            model=HAIKU, max_tokens=600, timeout=30,
            system=sys_prompt,
            messages=[{
                'role': 'user',
                'content': [
                    {'type': 'image', 'source': {'type': 'url', 'url': image_url}},
                    {'type': 'text',  'text': 'Write the caption.'},
                ],
            }],
        )
        caption = (msg.content[0].text or '').strip().strip('"')
    except Exception as e:
        logger.exception('generate_image_caption failed')
        return Response({'error': f'AI error: {e}'}, status=502)

    cache.set(ckey, caption, CACHE_TTL)
    return Response({'caption': caption, 'cached': False})


# ══════════════════════════════════════════════════════════════════════
# 8. content-calendar
# ══════════════════════════════════════════════════════════════════════
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def content_calendar(request):
    """
    Body: {industry?, count_per_week?, weeks?}
    Returns: {calendar: [{week, day, topic, post_type, caption_hint, hashtags}]}
    """
    client, err = _resolved_client(request)
    if err: return err
    if not rate_limit_check(client.id, 'content-calendar', 5):
        return Response({'error': 'Daily limit reached'}, status=429)

    industry = (request.data.get('industry') or client.business_category or 'general').strip()
    count_per_week = max(1, min(int(request.data.get('count_per_week') or 3), 7))
    weeks          = max(1, min(int(request.data.get('weeks') or 4), 12))

    ckey = cache_key_for('cal', {'c': client.id, 'i': industry, 'n': count_per_week, 'w': weeks})
    cached = cache.get(ckey)
    if cached:
        return Response({'calendar': cached, 'cached': True})

    claude = get_claude()
    if not claude:
        return _ai_unavailable()

    bv = unified_voice_prompt(client)
    cc = build_client_ai_context(client)
    sys_prompt = (
        'You create editorial calendars. Output ONLY valid JSON.\n'
        + (bv + '\n' if bv else '')
    )
    user_prompt = (
        f'{cc}\n\n'
        f'Industry: {industry}\nWeeks: {weeks}\nPosts per week: {count_per_week}\n\n'
        'Mix post_type values: announcement, educational, promotional, behind_scenes, ugc.\n'
        'Spread topics so they don\'t repeat within a week.\n\n'
        'Return EXACTLY this JSON:\n'
        '{"calendar": [{"week": 1, "day": "Mon", "post_type": "...", '
        '"topic": "...", "caption_hint": "...", "hashtags": ["#a", "#b"]}]}'
    )

    try:
        msg = claude.messages.create(
            model=SONNET, max_tokens=4096, timeout=60,
            system=sys_prompt,
            messages=[{'role': 'user', 'content': user_prompt}],
        )
        out = parse_json_response(msg.content[0].text)
        calendar = out.get('calendar') or []
    except Exception as e:
        logger.exception('content_calendar failed')
        return Response({'error': f'AI error: {e}'}, status=502)

    cache.set(ckey, calendar, CACHE_TTL * 4)  # 4h cache for calendars
    return Response({'calendar': calendar, 'cached': False})


# ══════════════════════════════════════════════════════════════════════
# 9. brand-voice training + retrieval
# ══════════════════════════════════════════════════════════════════════
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def train_brand_voice(request):
    """
    Body: {sample_posts: [str, ...]}
    Returns: the saved BrandVoiceProfile (voice_summary, tones, rules, forbidden).
    """
    client, err = _resolved_client(request)
    if err: return err

    samples = request.data.get('sample_posts') or []
    if not isinstance(samples, list) or len(samples) < 3:
        return Response(
            {'error': 'Provide at least 3 sample posts as a list of strings'},
            status=400,
        )
    samples = [str(s).strip() for s in samples if str(s).strip()][:20]
    if len(samples) < 3:
        return Response({'error': 'At least 3 non-empty samples required'}, status=400)

    if not rate_limit_check(client.id, 'train-brand-voice', 5):
        return Response({'error': 'Daily limit reached'}, status=429)

    claude = get_claude()
    if not claude:
        return _ai_unavailable()

    sys_prompt = (
        'Analyze these sample posts and capture the brand voice. '
        'Output ONLY valid JSON.'
    )
    posts_block = '\n\n'.join(f'--- POST {i+1} ---\n{p[:1000]}' for i, p in enumerate(samples))
    user_prompt = (
        f'Sample posts:\n{posts_block}\n\n'
        'Return EXACTLY this JSON:\n'
        '{"voice_summary": "<2-3 sentence description of brand voice>", '
        '"tone_descriptors": ["<adjective>", "<adjective>", "<adjective>"], '
        '"style_rules": ["<short rule>", ...], '
        '"forbidden_words": ["<word>", ...]}'
    )

    try:
        msg = claude.messages.create(
            model=HAIKU, max_tokens=1024, timeout=30,
            system=sys_prompt,
            messages=[{'role': 'user', 'content': user_prompt}],
        )
        analysis = parse_json_response(msg.content[0].text)
    except Exception as e:
        logger.exception('train_brand_voice failed')
        return Response({'error': f'AI error: {e}'}, status=502)

    profile, _ = BrandVoiceProfile.objects.update_or_create(
        client=client,
        defaults={
            'sample_posts':     samples,
            'voice_summary':    str(analysis.get('voice_summary') or '')[:5000],
            'tone_descriptors': [str(t).strip() for t in (analysis.get('tone_descriptors') or [])][:10],
            'style_rules':      [str(r).strip() for r in (analysis.get('style_rules') or [])][:20],
            'forbidden_words':  [str(w).strip() for w in (analysis.get('forbidden_words') or [])][:50],
            'last_trained_at':  timezone.now(),
        },
    )
    return Response({
        'voice_summary':    profile.voice_summary,
        'tone_descriptors': profile.tone_descriptors,
        'style_rules':      profile.style_rules,
        'forbidden_words':  profile.forbidden_words,
        'last_trained_at':  profile.last_trained_at,
        'sample_count':     len(samples),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_brand_voice(request):
    client, err = _resolved_client(request)
    if err: return err
    profile = getattr(client, 'brand_voice', None)
    if not profile:
        return Response({'voice_summary': '', 'tone_descriptors': [],
                         'style_rules': [], 'forbidden_words': [],
                         'last_trained_at': None})
    return Response({
        'voice_summary':    profile.voice_summary,
        'tone_descriptors': profile.tone_descriptors,
        'style_rules':      profile.style_rules,
        'forbidden_words':  profile.forbidden_words,
        'last_trained_at':  profile.last_trained_at,
        'sample_count':     len(profile.sample_posts or []),
    })
