# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
AI Post Ideas Generator views.
POST /api/ai/post-ideas/          — generate a full month calendar
GET  /api/ai/post-ideas/          — list past generations for a client
POST /api/ai/post-ideas/{id}/approve-all/     — mark every idea approved
POST /api/ai/post-ideas/{id}/add-to-calendar/ — convert approved ideas → CalendarPost
"""
import calendar
import json
import logging
from datetime import date, datetime

from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

import anthropic

from django.conf import settings
from .models import Client, PostIdeaSet, PostIdea, CalendarPost
from .ai_context import build_client_ai_context

logger = logging.getLogger(__name__)

MONTHLY_RATE_LIMIT = 3   # generations per client per month

SYSTEM_PROMPT = (
    "You are a social media content strategist for a marketing agency. "
    "You create data-driven content calendars that are practical, engaging, "
    "and tailored to each business type and audience. "
    "Return valid JSON only."
)

PLATFORM_MAP = {
    'facebook':           'Facebook',
    'instagram':          'Instagram',
    'linkedin':           'LinkedIn',
    'youtube':            'YouTube',
    'google_my_business': 'Google My Business',
}

CALENDAR_POST_TYPE_MAP = {
    'reel':      'reel',
    'image':     'image',
    'carousel':  'carousel',
    'story':     'story',
    'text':      'text',
    'video':     'video',
    'short':     'short',
}

def _check_rate_limit(client: Client, month: int, year: int) -> bool:
    count = PostIdeaSet.objects.filter(
        client=client, month=month, year=year
    ).count()
    return count < MONTHLY_RATE_LIMIT


def _build_user_prompt(business_type, location, target_audience, platforms, post_count, upcoming_events, month, year, client_context):
    month_name = calendar.month_name[month]
    platform_list = ', '.join(PLATFORM_MAP.get(p, p) for p in platforms)

    return f"""Create exactly {post_count} social media post ideas for this business for {month_name} {year}.

{client_context}

Business type: {business_type}
Location: {location or 'Not specified'}
Target audience: {target_audience or 'General audience'}
Platforms: {platform_list}
Total posts needed: {post_count}
Upcoming events/promotions: {upcoming_events or 'None'}

Month context: Include relevant {month_name} themes, holidays, and seasonal opportunities.
Do not group ideas by week. Keep the output lean and token efficient.

For each post idea include:
- A suggested publish date in YYYY-MM-DD format inside {month_name} {year}
- A suggested publish time
- Which platform
- Post type (Reel, Image, Carousel, Story, Text)
- Topic/concept (specific, not generic)
- Caption direction (2-3 sentences of guidance)
- 5 relevant hashtag ideas

Mix content types:
40% promotional, 30% educational/tips, 20% behind the scenes, 10% engagement/polls

Return ONLY this JSON (no other text, no markdown):
{{
  "month_theme": "Overall theme for the month",
  "strategy_notes": "Key strategy for this month",
  "posts": [
    {{
      "date": "{year}-{month:02d}-05",
      "time": "7:00 PM",
      "platform": "instagram",
      "post_type": "Reel",
      "topic": "Specific topic here",
      "caption_direction": "Write a caption that...",
      "hashtags": ["#tag1","#tag2","#tag3","#tag4","#tag5"],
      "notes": "Optional extra guidance"
    }}
  ]
}}"""


def _flatten_ideas(ideas_json: dict) -> list:
    """Flatten AI response into a list of PostIdea-ready dicts."""
    result = []
    for post in ideas_json.get('posts', []):
        scheduled_date = None
        raw_date = (post.get('date') or '').strip()
        if raw_date:
            try:
                scheduled_date = datetime.strptime(raw_date, '%Y-%m-%d').date()
            except ValueError:
                scheduled_date = None
        result.append({
            'week_number':   1,
            'day_of_week':   scheduled_date.strftime('%A') if scheduled_date else '',
            'scheduled_date': scheduled_date,
            'platform':      (post.get('platform') or '').lower().replace(' ', '_'),
            'post_type':     (post.get('post_type') or 'image').lower(),
            'topic':         post.get('topic', ''),
            'caption_hint':  post.get('caption_direction', ''),
            'hashtag_hints': post.get('hashtags', []),
            'best_time':     post.get('time', ''),
            'notes':         post.get('notes', ''),
        })
    return result


# ── Main view ─────────────────────────────────────────────────────────────────

@api_view(['POST', 'GET'])
@permission_classes([IsAuthenticated])
def post_ideas_view(request):
    if request.method == 'GET':
        return _get_history(request)
    return _generate_ideas(request)


def _get_history(request):
    client_id = request.query_params.get('client_id')
    month     = request.query_params.get('month')
    year      = request.query_params.get('year')

    if not client_id:
        try:
            profile = request.user.profile
            if profile.role == 'client' and profile.client_id:
                client_id = profile.client_id
        except Exception:
            pass
    if not client_id:
        return Response({'error': 'client_id required'}, status=400)

    qs = PostIdeaSet.objects.filter(client_id=client_id)
    if month:
        qs = qs.filter(month=month)
    if year:
        qs = qs.filter(year=year)
    qs = qs.order_by('-generated_at')[:12]

    data = []
    for idea_set in qs:
        ideas_list = list(idea_set.post_ideas.values(
            'id', 'week_number', 'day_of_week', 'scheduled_date', 'platform', 'post_type',
            'topic', 'caption_hint', 'hashtag_hints', 'best_time', 'notes',
            'is_approved', 'is_added_to_calendar', 'converted_post_id',
        ))
        data.append({
            'id':               idea_set.id,
            'month':            idea_set.month,
            'year':             idea_set.year,
            'month_name':       calendar.month_name[idea_set.month],
            'business_type':    idea_set.business_type,
            'location':         idea_set.location,
            'target_audience':  idea_set.target_audience,
            'platforms':        idea_set.platforms,
            'posts_per_week':   idea_set.posts_per_week,
            'month_theme':      idea_set.ideas.get('month_theme', ''),
            'strategy_notes':   idea_set.ideas.get('strategy_notes', ''),
            'posts':            idea_set.ideas.get('posts', []),
            'ideas':            ideas_list,
            'generated_at':     idea_set.generated_at.isoformat(),
        })
    return Response(data)


def _generate_ideas(request):
    data             = request.data
    client_id        = data.get('client_id')
    month            = data.get('month')
    year             = data.get('year')
    business_type    = (data.get('business_type') or '').strip()
    location         = (data.get('location') or '').strip()
    upcoming_events  = (data.get('upcoming_events') or '').strip()
    target_audience  = (data.get('target_audience') or '').strip()
    platforms        = data.get('platforms', [])
    posts_per_week   = int(data.get('posts_per_week') or 5)

    # Resolve client_id from token if not given
    if not client_id:
        try:
            profile = request.user.profile
            if profile.role == 'client' and profile.client_id:
                client_id = profile.client_id
        except Exception:
            pass

    # Validation
    errors = {}
    if not client_id:
        errors['client_id'] = 'Required.'
    if not month:
        errors['month'] = 'Required.'
    if not year:
        errors['year'] = 'Required.'
    if not platforms:
        errors['platforms'] = 'At least one platform is required.'
    if errors:
        return Response({'errors': errors}, status=400)

    month = int(month)
    year  = int(year)

    try:
        client = Client.objects.get(id=client_id)
    except Client.DoesNotExist:
        return Response({'error': 'Client not found.'}, status=404)

    business_type = business_type or client.business_category or client.company
    location = location or client.business_location
    target_audience = target_audience or client.target_audience
    client_context = build_client_ai_context(client)

    if not business_type:
        return Response({'errors': {'business_type': 'Required.'}}, status=400)

    # Rate limit: 3 per client per month
    if not _check_rate_limit(client, month, year):
        month_name = calendar.month_name[month]
        return Response({
            'error': f'Monthly limit of {MONTHLY_RATE_LIMIT} generations reached for {month_name} {year}. '
                     f'Previous calendars are still available in your history.'
        }, status=429)

    api_key = getattr(settings, 'ANTHROPIC_API_KEY', '')
    if not api_key:
        return Response({'error': 'AI service is not configured. Contact your administrator.'}, status=503)

    # Call Claude Opus 4.6 with streaming (long output)
    try:
        claude       = anthropic.Anthropic(api_key=api_key)
        user_prompt  = _build_user_prompt(
            business_type, location, target_audience, platforms,
            posts_per_week, upcoming_events, month, year, client_context,
        )

        raw = ''
        with claude.messages.stream(
            model='claude-opus-4-6',
            max_tokens=8192,
            thinking={'type': 'adaptive'},
            system=SYSTEM_PROMPT,
            messages=[{'role': 'user', 'content': user_prompt}],
        ) as stream:
            final = stream.get_final_message()
            for block in final.content:
                if block.type == 'text':
                    raw = block.text.strip()
                    break

        # Strip markdown fences if present
        if raw.startswith('```'):
            raw = raw.split('\n', 1)[1] if '\n' in raw else raw[3:]
            if raw.endswith('```'):
                raw = raw[:-3].strip()

        ideas_json = json.loads(raw)

    except anthropic.APITimeoutError:
        return Response({'error': 'The AI took too long to respond. Please try again.'}, status=504)
    except anthropic.APIError as e:
        logger.error('Anthropic API error: %s', e)
        return Response({'error': 'AI service error. Please try again in a moment.'}, status=502)
    except json.JSONDecodeError:
        logger.error('Claude returned non-JSON for post ideas: %s', raw[:300])
        return Response({'error': 'AI returned an unexpected format. Please try again.'}, status=502)
    except Exception as e:
        logger.error('Post ideas generation error: %s', e)
        return Response({'error': 'An unexpected error occurred. Please try again.'}, status=500)

    # Persist PostIdeaSet
    idea_set = PostIdeaSet.objects.create(
        client          = client,
        month           = month,
        year            = year,
        business_type   = business_type,
        location        = location,
        upcoming_events = upcoming_events,
        target_audience = target_audience,
        platforms       = platforms,
        posts_per_week  = posts_per_week,
        ideas           = ideas_json,
        generated_by    = request.user,
    )

    # Persist individual PostIdea rows
    flat_ideas = _flatten_ideas(ideas_json)
    idea_objs  = [
        PostIdea(
            idea_set     = idea_set,
            week_number  = p['week_number'],
            day_of_week  = p['day_of_week'],
            scheduled_date = p['scheduled_date'],
            platform     = p['platform'],
            post_type    = p['post_type'],
            topic        = p['topic'],
            caption_hint = p['caption_hint'],
            hashtag_hints= p['hashtag_hints'],
            best_time    = p['best_time'],
            notes        = p['notes'],
        )
        for p in flat_ideas
    ]
    PostIdea.objects.bulk_create(idea_objs)

    # Build response
    ideas_list = list(idea_set.post_ideas.values(
        'id', 'week_number', 'day_of_week', 'scheduled_date', 'platform', 'post_type',
        'topic', 'caption_hint', 'hashtag_hints', 'best_time', 'notes',
        'is_approved', 'is_added_to_calendar',
    ))

    return Response({
        'id':             idea_set.id,
        'month':          month,
        'year':           year,
        'month_name':     calendar.month_name[month],
        'business_type':  business_type,
        'location':       location,
        'target_audience':target_audience,
        'platforms':      platforms,
        'posts_per_week': posts_per_week,
        'month_theme':    ideas_json.get('month_theme', ''),
        'strategy_notes': ideas_json.get('strategy_notes', ''),
        'posts':          ideas_json.get('posts', []),
        'ideas':          ideas_list,
        'generated_at':   idea_set.generated_at.isoformat(),
    }, status=201)


# ── Approve all ───────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def approve_all(request, pk):
    try:
        idea_set = PostIdeaSet.objects.get(pk=pk)
    except PostIdeaSet.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)

    # Basic auth check: staff/superadmin can approve all; clients only their own
    profile = getattr(request.user, 'profile', None)
    if profile and profile.role == 'client' and profile.client_id != idea_set.client_id:
        return Response({'error': 'Forbidden.'}, status=403)

    updated = idea_set.post_ideas.filter(is_approved=False).update(is_approved=True)
    return Response({'approved': updated, 'total': idea_set.post_ideas.count()})


# ── Update single idea (edit before adding to calendar) ───────────────────────

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_idea(request, pk, idea_pk):
    try:
        idea_set = PostIdeaSet.objects.get(pk=pk)
        idea     = idea_set.post_ideas.get(pk=idea_pk)
    except (PostIdeaSet.DoesNotExist, PostIdea.DoesNotExist):
        return Response({'error': 'Not found.'}, status=404)

    editable = ['topic', 'caption_hint', 'hashtag_hints', 'best_time', 'notes',
                'day_of_week', 'scheduled_date', 'platform', 'post_type', 'is_approved']
    for field in editable:
        if field in request.data:
            value = request.data[field]
            if field == 'scheduled_date':
                if value:
                    try:
                        value = datetime.strptime(value, '%Y-%m-%d').date()
                        idea.day_of_week = value.strftime('%A')
                    except ValueError:
                        return Response({'error': 'scheduled_date must use YYYY-MM-DD format.'}, status=400)
                else:
                    value = None
                    idea.day_of_week = ''
            setattr(idea, field, value)
    idea.save()

    return Response({
        'id':                  idea.id,
        'week_number':         idea.week_number,
        'day_of_week':         idea.day_of_week,
        'scheduled_date':      idea.scheduled_date.isoformat() if idea.scheduled_date else None,
        'platform':            idea.platform,
        'post_type':           idea.post_type,
        'topic':               idea.topic,
        'caption_hint':        idea.caption_hint,
        'hashtag_hints':       idea.hashtag_hints,
        'best_time':           idea.best_time,
        'notes':               idea.notes,
        'is_approved':         idea.is_approved,
        'is_added_to_calendar':idea.is_added_to_calendar,
    })


# ── Add to calendar ───────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_to_calendar(request, pk):
    try:
        idea_set = PostIdeaSet.objects.get(pk=pk)
    except PostIdeaSet.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)

    profile = getattr(request.user, 'profile', None)
    if profile and profile.role == 'client' and profile.client_id != idea_set.client_id:
        return Response({'error': 'Forbidden.'}, status=403)

    # Optional: specific idea_ids to add, else add all approved ones
    idea_ids     = request.data.get('idea_ids', None)
    approve_all_ = request.data.get('approve_all', False)

    qs = idea_set.post_ideas.filter(is_added_to_calendar=False)
    if idea_ids:
        qs = qs.filter(id__in=idea_ids)
    elif not approve_all_:
        qs = qs.filter(is_approved=True)

    # Determine the target scheduled month/year
    target_month = idea_set.month
    target_year  = idea_set.year

    created_count = 0
    for idea in qs:
        # Resolve post_type
        pt = CALENDAR_POST_TYPE_MAP.get(idea.post_type.lower(), 'image')

        # Parse time
        scheduled_dt = None
        try:
            target_date = idea.scheduled_date or date(target_year, target_month, 1)
            hour = 12
            minute = 0
            if idea.best_time:
                # Parse "7:00 PM" style
                import re
                m = re.search(r'(\d+)(?::(\d+))?\s*(AM|PM)?', idea.best_time, re.I)
                if m:
                    hour = int(m.group(1))
                    minute = int(m.group(2) or 0)
                    ampm = (m.group(3) or '').upper()
                    if ampm == 'PM' and hour != 12:
                        hour += 12
                    elif ampm == 'AM' and hour == 12:
                        hour = 0
            scheduled_dt = timezone.make_aware(
                datetime(target_date.year, target_date.month, target_date.day, hour, minute)
            )
        except Exception:
            pass

        cal_post = CalendarPost.objects.create(
            client       = idea_set.client,
            platform     = idea.platform,
            post_type    = pt,
            status       = 'draft',
            title        = idea.topic[:200],
            caption      = idea.caption_hint,
            hashtags     = ' '.join(idea.hashtag_hints),
            scheduled_at = scheduled_dt,
            created_by   = request.user,
        )
        idea.is_added_to_calendar = True
        idea.is_approved          = True
        idea.converted_post       = cal_post
        idea.save(update_fields=['is_added_to_calendar', 'is_approved', 'converted_post'])
        created_count += 1

    return Response({
        'created': created_count,
        'message': f'{created_count} post{"s" if created_count != 1 else ""} added to your content calendar as drafts.',
    })
