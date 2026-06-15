# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Tool definitions + dispatcher for Social Stats Assistant .

Anthropic's tool-use API lets the assistant call structured functions during
a conversation. Each tool is:

    1. Defined in TOOL_SCHEMA — the JSON schema sent to Claude
    2. Dispatched in execute_tool() — Python implementation, tenant-scoped

Every tool runs against the user's CURRENT client only — `client_id` is
injected by the orchestrator, never read from `tool_input`. Cross-tenant
data leakage is impossible by construction.

Dangerous tools (publish / send / delete / update) are tagged
`requires_confirmation=True`. The orchestrator returns a confirmation card
to the UI instead of executing immediately; the user clicks Confirm and
the call retries with `_confirmed=True`.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

from django.utils import timezone

from ..models import (
    Client, PostMetric, UnifiedPost, Conversation, Message,
    Competitor, CompetitorSnapshot, WeeklyTopPost, CalendarPost,
)

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────
# Tool schema — sent to Claude as the `tools` array
# ─────────────────────────────────────────────────────────────────────────

TOOL_SCHEMA = [
    {
        'name': 'get_client_metrics',
        'description': (
            'Fetch summary metrics for the current client over a time window. '
            'Returns per-platform totals: followers, impressions, reach, '
            'engagement, posts published.'
        ),
        'input_schema': {
            'type': 'object',
            'properties': {
                'days':     {'type': 'integer', 'description': 'Window length in days (default 30, max 365)', 'default': 30},
                'platform': {'type': 'string',  'description': 'Optional filter — facebook | instagram | linkedin | youtube | google_my_business'},
            },
        },
    },
    {
        'name': 'get_top_posts',
        'description': (
            "Fetch the current client's top-performing posts in the last 7 / 30 / 90 days. "
            'Returns list with platform, content snippet, engagement, posted_at, post_id.'
        ),
        'input_schema': {
            'type': 'object',
            'properties': {
                'limit':    {'type': 'integer', 'description': 'How many posts to return (default 5, max 20)', 'default': 5},
                'days':     {'type': 'integer', 'description': 'Window in days (default 30)', 'default': 30},
                'platform': {'type': 'string',  'description': 'Optional platform filter'},
                'metric':   {'type': 'string',  'description': 'engagement | reach | likes (default engagement)', 'default': 'engagement'},
            },
        },
    },
    {
        'name': 'search_messages',
        'description': (
            'Search the unified inbox for the current client. Returns matching '
            'conversations with platform, contact, latest preview, sentiment.'
        ),
        'input_schema': {
            'type': 'object',
            'properties': {
                'query':     {'type': 'string',  'description': 'Free-text search across message bodies'},
                'platform':  {'type': 'string',  'description': 'Optional platform filter'},
                'unread_only': {'type': 'boolean', 'description': 'Only conversations with unread inbound messages'},
                'limit':     {'type': 'integer', 'description': 'Max results (default 10, max 30)', 'default': 10},
            },
        },
    },
    {
        'name': 'create_draft_post',
        'description': (
            'Create a draft UnifiedPost for the current client. The user must '
            'still review and publish it manually. NEVER auto-publishes.'
        ),
        'input_schema': {
            'type': 'object',
            'properties': {
                'content':      {'type': 'string', 'description': 'The post body'},
                'platforms':    {'type': 'array', 'items': {'type': 'string'}, 'description': 'Target platforms'},
                'title':        {'type': 'string', 'description': 'Optional internal title'},
                'media_type':   {'type': 'string', 'description': 'text | image | video | carousel (default text)', 'default': 'text'},
            },
            'required': ['content', 'platforms'],
        },
    },
    {
        'name': 'schedule_post',
        'description': (
            'Schedule an existing draft for publishing at a specific time. '
            'REQUIRES USER CONFIRMATION before executing.'
        ),
        'input_schema': {
            'type': 'object',
            'properties': {
                'post_id':       {'type': 'integer', 'description': 'UnifiedPost id'},
                'scheduled_at':  {'type': 'string',  'description': 'ISO 8601 datetime (UTC) e.g. 2026-05-08T14:00:00Z'},
            },
            'required': ['post_id', 'scheduled_at'],
        },
    },
    {
        'name': 'update_post',
        'description': (
            "Update an existing UnifiedPost's content or metadata. "
            'REQUIRES USER CONFIRMATION before executing.'
        ),
        'input_schema': {
            'type': 'object',
            'properties': {
                'post_id':    {'type': 'integer', 'description': 'UnifiedPost id'},
                'content':    {'type': 'string',  'description': 'New body (omit to keep)'},
                'title':      {'type': 'string',  'description': 'New title (omit to keep)'},
            },
            'required': ['post_id'],
        },
    },
    {
        'name': 'send_whatsapp_campaign',
        'description': (
            'Launch a WhatsApp broadcast campaign. '
            'REQUIRES USER CONFIRMATION before executing. '
            'Always returns a confirmation card the first time.'
        ),
        'input_schema': {
            'type': 'object',
            'properties': {
                'campaign_id': {'type': 'integer', 'description': 'WhatsAppCampaign id'},
            },
            'required': ['campaign_id'],
        },
    },
    {
        'name': 'get_competitor_data',
        'description': (
            "Fetch competitor metrics for the current client's tracked competitors. "
            "Returns follower counts, recent post count, average engagement."
        ),
        'input_schema': {
            'type': 'object',
            'properties': {
                'competitor_id': {'type': 'integer', 'description': 'Specific competitor id (omit for all)'},
                'days':          {'type': 'integer', 'description': 'Window in days (default 30)', 'default': 30},
            },
        },
    },
    {
        'name': 'get_calendar',
        'description': (
            "Fetch upcoming calendar items (scheduled posts + planning notes) "
            "for the current client over the next N days."
        ),
        'input_schema': {
            'type': 'object',
            'properties': {
                'days_ahead': {'type': 'integer', 'description': 'Window forward (default 14, max 60)', 'default': 14},
                'platform':   {'type': 'string',  'description': 'Optional platform filter'},
            },
        },
    },
    {
        'name': 'generate_report',
        'description': (
            "Trigger a written performance report. Returns the report text + a "
            "share link. The user can then download a PDF separately."
        ),
        'input_schema': {
            'type': 'object',
            'properties': {
                'period':      {'type': 'string', 'description': 'weekly | monthly | quarterly (default weekly)', 'default': 'weekly'},
                'platforms':   {'type': 'array',  'items': {'type': 'string'}, 'description': 'Optional platform filter'},
            },
        },
    },
    # ── — fill the audit-flagged tool-coverage gap ─────────────────
    {
        'name': 'get_lead',
        'description': (
            'Fetch a single Lead by id with status, contact info, source '
            'attribution and recent activity. Useful for "what do we know '
            'about lead #N" questions.'
        ),
        'input_schema': {
            'type': 'object',
            'properties': {
                'lead_id': {'type': 'integer', 'description': 'Lead row id'},
            },
            'required': ['lead_id'],
        },
    },
    {
        'name': 'update_lead_status',
        'description': (
            "Move a Lead between pipeline stages (new → contacted → qualified "
            "→ converted | lost | spam). REQUIRES USER CONFIRMATION before "
            "executing because it triggers downstream events (notifications, "
            "automations)."
        ),
        'input_schema': {
            'type': 'object',
            'properties': {
                'lead_id':  {'type': 'integer', 'description': 'Lead row id'},
                'status':   {'type': 'string',  'description': 'new | contacted | qualified | converted | lost | spam'},
                'note':     {'type': 'string',  'description': 'Optional note appended to the lead timeline'},
            },
            'required': ['lead_id', 'status'],
        },
    },
    {
        'name': 'reply_to_message',
        'description': (
            'Send an outbound reply on an existing inbox conversation. Routes '
            'through the platform publisher (Facebook/Instagram/LinkedIn/'
            'YouTube) so the reply lands natively. REQUIRES USER CONFIRMATION '
            'before executing.'
        ),
        'input_schema': {
            'type': 'object',
            'properties': {
                'conversation_id': {'type': 'integer', 'description': 'Conversation row id'},
                'text':            {'type': 'string',  'description': 'Reply body — drafted in client brand voice'},
            },
            'required': ['conversation_id', 'text'],
        },
    },
    {
        'name': 'list_bot_flows',
        'description': (
            'List the bot flows defined for the current client, with active '
            'state, version, trigger type and lifetime trigger/completion '
            'stats. Read-only.'
        ),
        'input_schema': {
            'type': 'object',
            'properties': {
                'active_only': {'type': 'boolean', 'description': 'Only return is_active=True flows', 'default': False},
                'limit':       {'type': 'integer', 'description': 'Max flows (default 20, max 100)', 'default': 20},
            },
        },
    },
]


# Tools that must NOT execute without explicit user confirmation.
CONFIRMATION_REQUIRED = {
    'schedule_post',
    'update_post',
    'send_whatsapp_campaign',
    'update_lead_status',
    'reply_to_message',
}


# ─────────────────────────────────────────────────────────────────────────
# Dispatcher
# ─────────────────────────────────────────────────────────────────────────

def execute_tool(*, name: str, tool_input: dict, client: Client, user, confirmed: bool = False) -> dict:
    """
    Run a tool by name. Returns a dict that becomes the tool_result content
    sent back to Claude.

    Returns shape:
        {"ok": True,  "data": ...}   on success
        {"ok": False, "error": "..."} on failure
        {"ok": False, "confirmation_required": True, "summary": "..."} for gated tools
        when called without confirmed=True.
    """
    if not name:
        return {'ok': False, 'error': 'no tool name'}
    if not client:
        return {'ok': False, 'error': 'no client in scope — switch to a client first'}

    # Gate dangerous actions
    if name in CONFIRMATION_REQUIRED and not confirmed:
        return {
            'ok': False,
            'confirmation_required': True,
            'tool_name': name,
            'tool_input': tool_input or {},
            'summary': _summarise_action(name, tool_input or {}),
        }

    fn = _DISPATCH.get(name)
    if not fn:
        return {'ok': False, 'error': f'unknown tool: {name}'}

    try:
        return {'ok': True, 'data': fn(tool_input or {}, client=client, user=user)}
    except Exception as e:
        logger.exception('tool %s failed', name)
        return {'ok': False, 'error': f'{name} failed: {e}'}


def _summarise_action(name: str, ti: dict) -> str:
    """Plain-English description of a confirmation-gated action."""
    if name == 'schedule_post':
        return f"Schedule post #{ti.get('post_id')} for {ti.get('scheduled_at')}"
    if name == 'update_post':
        return f"Update post #{ti.get('post_id')}"
    if name == 'send_whatsapp_campaign':
        return f"Launch WhatsApp campaign #{ti.get('campaign_id')} now"
    if name == 'update_lead_status':
        return f"Move lead #{ti.get('lead_id')} to status '{ti.get('status')}'"
    if name == 'reply_to_message':
        body = (ti.get('text') or '')
        preview = body[:80] + ('…' if len(body) > 80 else '')
        return f"Reply on conversation #{ti.get('conversation_id')}: {preview!r}"
    return name


# ─────────────────────────────────────────────────────────────────────────
# Tool implementations — every fn takes (tool_input, *, client, user)
# ─────────────────────────────────────────────────────────────────────────

def _t_get_client_metrics(ti, *, client, user):
    days     = max(1, min(int(ti.get('days') or 30), 365))
    platform = (ti.get('platform') or '').strip() or None
    since    = timezone.now() - timedelta(days=days)

    qs = PostMetric.objects.filter(client=client, posted_at__gte=since)
    if platform:
        qs = qs.filter(platform=platform)

    rows = {}
    for m in qs:
        p = m.platform
        r = rows.setdefault(p, {
            'platform': p, 'posts_published': 0,
            'likes': 0, 'comments': 0, 'shares': 0,
            'impressions': 0, 'reach': 0, 'video_views': 0, 'engagement_total': 0,
        })
        r['posts_published'] += 1
        r['likes']           += int(getattr(m, 'likes', 0) or 0)
        r['comments']        += int(getattr(m, 'comments', 0) or 0)
        r['shares']          += int(getattr(m, 'shares', 0) or 0)
        r['impressions']     += int(getattr(m, 'impressions', 0) or 0)
        r['reach']           += int(getattr(m, 'reach', 0) or 0)
        r['video_views']     += int(getattr(m, 'video_views', 0) or 0)
        r['engagement_total']+= int((getattr(m, 'likes', 0) or 0)
                                     + (getattr(m, 'comments', 0) or 0)
                                     + (getattr(m, 'shares', 0) or 0))

    return {
        'client': client.company,
        'days':   days,
        'platform_filter': platform,
        'totals': list(rows.values()),
        'window_start': since.date().isoformat(),
        'window_end':   timezone.now().date().isoformat(),
    }


def _t_get_top_posts(ti, *, client, user):
    limit    = max(1, min(int(ti.get('limit') or 5), 20))
    days     = max(1, min(int(ti.get('days') or 30), 365))
    platform = (ti.get('platform') or '').strip() or None
    metric   = (ti.get('metric') or 'engagement').lower()
    since    = timezone.now() - timedelta(days=days)

    qs = PostMetric.objects.filter(client=client, posted_at__gte=since)
    if platform:
        qs = qs.filter(platform=platform)

    posts = []
    for m in qs:
        likes    = int(getattr(m, 'likes', 0) or 0)
        comments = int(getattr(m, 'comments', 0) or 0)
        shares   = int(getattr(m, 'shares', 0) or 0)
        reach    = int(getattr(m, 'reach', 0) or 0)
        score = (
            reach if metric == 'reach' else
            likes if metric == 'likes' else
            (likes + comments + shares)
        )
        posts.append({
            'platform': m.platform,
            'content':  (getattr(m, 'caption', '') or getattr(m, 'content', '') or '')[:200],
            'engagement': likes + comments + shares,
            'reach':    reach,
            'likes':    likes,
            'comments': comments,
            'shares':   shares,
            'posted_at': m.posted_at.isoformat() if m.posted_at else '',
            'post_id':  getattr(m, 'platform_post_id', None) or getattr(m, 'id', None),
            '_score':   score,
        })

    posts.sort(key=lambda r: r['_score'], reverse=True)
    posts = posts[:limit]
    for p in posts:
        p.pop('_score', None)
    return {'count': len(posts), 'metric': metric, 'days': days, 'posts': posts}


def _t_search_messages(ti, *, client, user):
    query    = (ti.get('query') or '').strip()
    platform = (ti.get('platform') or '').strip() or None
    unread_only = bool(ti.get('unread_only', False))
    limit    = max(1, min(int(ti.get('limit') or 10), 30))

    qs = Conversation.objects.filter(client=client, is_archived=False).order_by('-last_message_at')
    if platform:
        qs = qs.filter(platform=platform)
    if unread_only:
        qs = qs.filter(unread_count__gt=0)
    if query:
        qs = qs.filter(messages__content__icontains=query).distinct()

    qs = qs[:limit]
    out = []
    for c in qs:
        out.append({
            'conversation_id':       c.id,
            'platform':              c.platform,
            'contact':               c.contact_name or c.contact_handle or '',
            'last_message_preview':  (c.last_message_preview or '')[:200],
            'last_message_at':       c.last_message_at.isoformat() if c.last_message_at else '',
            'unread_count':          c.unread_count,
            'sentiment':             c.sentiment,
            'is_resolved':           c.is_resolved,
        })
    return {'count': len(out), 'query': query, 'conversations': out}


def _t_create_draft_post(ti, *, client, user):
    content   = (ti.get('content') or '').strip()
    platforms = ti.get('platforms') or []
    title     = (ti.get('title') or '').strip()
    media_type = (ti.get('media_type') or 'text').strip() or 'text'

    if not content:
        return {'created': False, 'error': 'content is required'}
    if not isinstance(platforms, list) or not platforms:
        return {'created': False, 'error': 'platforms must be a non-empty list'}

    post = UnifiedPost.objects.create(
        client=client,
        title=title[:200],
        content=content[:8000],
        platforms=list(platforms),
        media_type=media_type,
        status='draft',
        created_by=user if user and user.is_authenticated else None,
    )
    return {
        'created':     True,
        'post_id':     post.id,
        'status':      post.status,
        'platforms':   post.platforms,
        'preview':     (post.content or '')[:160],
        'edit_url':    f'/dashboard/analytics/composer/{post.id}',
    }


def _t_schedule_post(ti, *, client, user):
    post_id = int(ti.get('post_id') or 0)
    when    = ti.get('scheduled_at') or ''
    if not post_id or not when:
        return {'scheduled': False, 'error': 'post_id and scheduled_at are required'}

    try:
        post = UnifiedPost.objects.get(id=post_id, client=client)
    except UnifiedPost.DoesNotExist:
        return {'scheduled': False, 'error': 'post not found for this client'}

    try:
        dt = datetime.fromisoformat(when.replace('Z', '+00:00'))
    except ValueError:
        return {'scheduled': False, 'error': f'invalid scheduled_at: {when}'}

    post.scheduled_at = dt
    post.status = 'scheduled'
    post.save(update_fields=['scheduled_at', 'status', 'updated_at']
              if hasattr(post, 'updated_at') else ['scheduled_at', 'status'])
    return {'scheduled': True, 'post_id': post.id, 'scheduled_at': dt.isoformat()}


def _t_update_post(ti, *, client, user):
    post_id = int(ti.get('post_id') or 0)
    if not post_id:
        return {'updated': False, 'error': 'post_id is required'}
    try:
        post = UnifiedPost.objects.get(id=post_id, client=client)
    except UnifiedPost.DoesNotExist:
        return {'updated': False, 'error': 'post not found for this client'}

    fields = []
    if ti.get('content') is not None:
        post.content = (ti['content'] or '')[:8000]
        fields.append('content')
    if ti.get('title') is not None:
        post.title = (ti['title'] or '')[:200]
        fields.append('title')
    if not fields:
        return {'updated': False, 'error': 'no fields to update'}
    post.save(update_fields=fields + (['updated_at'] if hasattr(post, 'updated_at') else []))
    return {'updated': True, 'post_id': post.id, 'fields_changed': fields}


def _t_send_whatsapp_campaign(ti, *, client, user):
    campaign_id = int(ti.get('campaign_id') or 0)
    if not campaign_id:
        return {'sent': False, 'error': 'campaign_id is required'}
    try:
        from ..models import WhatsAppCampaign
        from ..whatsapp_tasks import send_whatsapp_campaign as send_task
    except Exception:
        return {'sent': False, 'error': 'WhatsApp module not available'}
    try:
        camp = WhatsAppCampaign.objects.get(id=campaign_id, client=client)
    except WhatsAppCampaign.DoesNotExist:
        return {'sent': False, 'error': 'campaign not found for this client'}

    try:
        send_task.delay(camp.id)
    except Exception:
        # Graceful: queue may not be running in dev — surface that
        return {'sent': False, 'error': 'campaign queue not running; trigger manually'}
    return {'sent': True, 'campaign_id': camp.id, 'name': getattr(camp, 'name', '')}


def _t_get_competitor_data(ti, *, client, user):
    days = max(1, min(int(ti.get('days') or 30), 365))
    competitor_id = ti.get('competitor_id')
    since = timezone.now() - timedelta(days=days)

    qs = Competitor.objects.filter(client=client)
    if competitor_id:
        qs = qs.filter(id=int(competitor_id))

    rows = []
    for c in qs:
        snaps = CompetitorSnapshot.objects.filter(competitor=c, taken_at__gte=since).order_by('-taken_at')[:10]
        latest = snaps.first()
        rows.append({
            'competitor_id': c.id,
            'name':          c.name,
            'platform':      getattr(c, 'platform', '') or '',
            'handle':        getattr(c, 'public_handles', None) or {},
            'follower_count_latest': latest.followers if latest else None,
            'snapshots_in_window':   snaps.count(),
            'snapshot_dates':        [s.taken_at.date().isoformat() for s in snaps],
        })
    return {'count': len(rows), 'days': days, 'competitors': rows}


def _t_get_calendar(ti, *, client, user):
    days_ahead = max(1, min(int(ti.get('days_ahead') or 14), 60))
    platform   = (ti.get('platform') or '').strip() or None
    until      = timezone.now() + timedelta(days=days_ahead)

    posts_qs = UnifiedPost.objects.filter(
        client=client, status__in=('scheduled', 'draft'),
        scheduled_at__gte=timezone.now(), scheduled_at__lte=until,
    ).order_by('scheduled_at')[:50]

    items = []
    for p in posts_qs:
        platforms = p.platforms or []
        if platform and platform not in platforms:
            continue
        items.append({
            'id':           p.id,
            'kind':         'post',
            'status':       p.status,
            'title':        p.title or '',
            'preview':      (p.content or '')[:160],
            'platforms':    platforms,
            'scheduled_at': p.scheduled_at.isoformat() if p.scheduled_at else '',
        })

    notes_qs = CalendarPost.objects.filter(
        client=client, scheduled_at__gte=timezone.now(), scheduled_at__lte=until,
    ).order_by('scheduled_at')[:50]
    for n in notes_qs:
        items.append({
            'id':           f'note-{n.id}',
            'kind':         'planning',
            'title':        getattr(n, 'topic', '') or '',
            'preview':      getattr(n, 'notes', '') or '',
            'platforms':    [getattr(n, 'platform', '')],
            'scheduled_at': n.scheduled_at.isoformat() if n.scheduled_at else '',
        })

    items.sort(key=lambda r: r['scheduled_at'])
    return {'count': len(items), 'days_ahead': days_ahead, 'items': items}


def _t_generate_report(ti, *, client, user):
    """
    Lightweight version: pulls last 7/30/90 days of metrics + top posts and
    asks the AI client (separate AIClient call) for a written summary.
    Returns the text — the caller renders it; the heavier PDF report is a
    separate flow.
    """
    period = (ti.get('period') or 'weekly').lower()
    days   = {'weekly': 7, 'monthly': 30, 'quarterly': 90}.get(period, 7)
    metrics_data = _t_get_client_metrics({'days': days}, client=client, user=user)
    top = _t_get_top_posts({'limit': 5, 'days': days}, client=client, user=user)

    return {
        'period': period,
        'window_days': days,
        'metrics_summary': metrics_data,
        'top_posts':       top.get('posts', []),
        'note': 'Use this as the context to write a prose report; download a PDF from the Reports page.',
    }


# ─────────────────────────────────────────────────────────────────────────

def _t_get_lead(ti, *, client, user):
    from ..bot_models import Lead, LeadActivity
    lead_id = int(ti.get('lead_id') or 0)
    if not lead_id:
        return {'error': 'lead_id is required'}
    try:
        lead = Lead.objects.get(id=lead_id, client=client)
    except Lead.DoesNotExist:
        return {'error': f'lead #{lead_id} not found in this workspace'}

    activities = list(
        LeadActivity.objects.filter(lead=lead).order_by('-created_at')[:5]
        .values('activity_type', 'content', 'created_at')
    )
    for a in activities:
        a['created_at'] = a['created_at'].isoformat() if a['created_at'] else ''

    return {
        'id':              lead.id,
        'name':            lead.name,
        'phone':           lead.phone,
        'email':           lead.email,
        'status':          lead.status,
        'quality_score':   lead.quality_score,
        'quality_reason':  lead.quality_reason,
        'interest':        lead.interest,
        'budget':          lead.budget,
        'location':        lead.location,
        'source_channel':       lead.source_channel,
        'source_campaign_name': lead.source_campaign_name,
        'source_flow_id':       lead.source_flow_id,
        'assigned_to_id':       lead.assigned_to_id,
        'tags':                 list(lead.tags or []),
        'notes':                lead.notes,
        'converted_at':         lead.converted_at.isoformat() if lead.converted_at else None,
        'conversion_value':     str(lead.conversion_value) if lead.conversion_value else None,
        'created_at':           lead.created_at.isoformat(),
        'recent_activity':      activities,
    }


def _t_update_lead_status(ti, *, client, user):
    from ..bot_models import Lead, LeadActivity
    from ..events.publisher import EventPublisher

    lead_id  = int(ti.get('lead_id') or 0)
    new_stat = (ti.get('status') or '').strip()
    note     = (ti.get('note') or '').strip()

    valid = {choice[0] for choice in Lead._meta.get_field('status').choices}
    if new_stat not in valid:
        return {'error': f'invalid status; one of {sorted(valid)}'}
    try:
        lead = Lead.objects.get(id=lead_id, client=client)
    except Lead.DoesNotExist:
        return {'error': f'lead #{lead_id} not found in this workspace'}

    previous = lead.status
    if previous == new_stat:
        return {'ok': True, 'lead_id': lead.id, 'status': new_stat,
                'note': 'status was already set; no change'}

    lead.status = new_stat
    if note and not lead.notes:
        lead.notes = note
    elif note:
        lead.notes = f'{lead.notes}\n\n{note}'
    lead.save(update_fields=['status', 'notes'])

    LeadActivity.objects.create(
        lead=lead, actor=user, activity_type='status_change',
        content=f'Status: {previous} → {new_stat} (via AI Assistant)'
                + (f' — {note}' if note else ''),
        metadata={'previous': previous, 'new': new_stat, 'via': 'ai_assistant'},
    )

    # Same event-bus emission lead_views.update_status performs, so the
    try:
        EventPublisher.publish(
            'lead.status_changed',
            client=client, actor=user,
            actor_type='ai',
            payload={'lead_id': lead.id, 'from_status': previous, 'to_status': new_stat},
        )
        if new_stat == 'converted' and previous != 'converted':
            EventPublisher.publish(
                'lead.converted', client=client, actor=user, actor_type='ai',
                payload={'lead_id': lead.id,
                         'value': str(lead.conversion_value) if lead.conversion_value else None},
            )
    except Exception:
        pass

    return {
        'ok': True, 'lead_id': lead.id,
        'previous_status': previous, 'new_status': new_stat,
    }


def _t_reply_to_message(ti, *, client, user):
    """Reply on an existing inbox conversation. Mirrors the request-time path
    in inbox_views.reply (gate via marketplace_permissions, send via
    publisher, persist, emit event)."""
    from ..publishers import (
        get_publisher, PublishError, TokenExpiredError, RateLimitError,
    )
    from ..models import Conversation, Message, PlatformCredential
    from ..marketplace_permissions import check_action
    from ..events.publisher import EventPublisher

    conv_id = int(ti.get('conversation_id') or 0)
    text    = (ti.get('text') or '').strip()
    if not conv_id or not text:
        return {'error': 'conversation_id and text are both required'}
    try:
        conv = Conversation.objects.get(id=conv_id, client=client)
    except Conversation.DoesNotExist:
        return {'error': f'conversation #{conv_id} not found in this workspace'}

    # Reply permission depends on conversation type — same mapping inbox_views uses.
    perm_key = {
        'comment': 'reply_comments',
        'dm':      'reply_messages',
        'review':  'reply_reviews',
    }.get(conv.type, 'reply_messages')

    # Build a fake DRF request just enough for check_action to read .user.
    class _Req:
        pass
    req = _Req()
    req.user = user
    verdict, _ctx = check_action(req, client, perm_key, action_type=f'reply_{conv.type}')
    if verdict == 'denied':
        return {'error': f'permission "{perm_key}" not granted on this workspace'}
    if verdict == 'approval_required':
        return {'error': 'this reply needs human approval — submit it from the inbox UI'}

    cred = PlatformCredential.objects.filter(
        client=client, platform=conv.platform, is_active=True,
    ).first()
    if not cred:
        return {'error': f'no active {conv.platform} credential to reply with'}

    publisher = get_publisher(conv.platform)
    try:
        if conv.type == 'comment':
            result = publisher.reply_to_comment(cred, conv.platform_thread_id, text)
        elif conv.type == 'dm':
            result = publisher.reply_to_dm(
                cred, conv.platform_thread_id, text,
                psid=conv.contact_handle, recipient_id=conv.contact_handle,
            )
        else:
            return {'error': f'cannot reply to conversation type {conv.type} via tool'}
    except TokenExpiredError:
        return {'error': f'{conv.platform} token expired — reconnect the integration'}
    except RateLimitError:
        return {'error': f'{conv.platform} rate-limited — try again in a few minutes'}
    except PublishError as e:
        return {'error': f'{conv.platform} reply failed: {e}'}

    msg = Message.objects.create(
        conversation=conv,
        platform_message_id=getattr(result, 'platform_post_id', '') or '',
        direction='outbound',
        author_name=getattr(user, 'get_full_name', lambda: user.email)() or user.email,
        content=text,
        sent_at=timezone.now(),
        replied_at=timezone.now(),
    )
    Conversation.objects.filter(id=conv.id).update(
        last_message_preview=text[:500],
        last_message_at=timezone.now(),
        last_outbound_at=timezone.now(),
    )

    try:
        EventPublisher.publish(
            'message.sent', client=client, actor=user, actor_type='ai',
            payload={'message_id': msg.id, 'channel': conv.platform},
        )
    except Exception:
        pass

    return {
        'ok':              True,
        'message_id':      msg.id,
        'conversation_id': conv.id,
        'platform':        conv.platform,
        'sent_at':         msg.sent_at.isoformat(),
    }


def _t_list_bot_flows(ti, *, client, user):
    from ..bot_models import BotFlow
    active_only = bool(ti.get('active_only', False))
    limit = max(1, min(int(ti.get('limit') or 20), 100))

    qs = BotFlow.objects.filter(client=client)
    if active_only:
        qs = qs.filter(is_active=True)
    qs = qs.order_by('-updated_at')[:limit]

    flows = [{
        'id':                f.id,
        'name':              f.name,
        'is_active':         f.is_active,
        'is_template':       f.is_template,
        'trigger_type':      f.trigger_type,
        'version':           f.version,
        'published_version': f.published_version,
        'total_triggered':   f.total_triggered,
        'total_completed':   f.total_completed,
        'leads_captured':    f.total_leads_captured,
        'last_published_at': f.last_published_at.isoformat() if f.last_published_at else None,
        'updated_at':        f.updated_at.isoformat(),
    } for f in qs]
    return {'count': len(flows), 'flows': flows}


_DISPATCH = {
    'get_client_metrics':     _t_get_client_metrics,
    'get_top_posts':          _t_get_top_posts,
    'search_messages':        _t_search_messages,
    'create_draft_post':      _t_create_draft_post,
    'schedule_post':          _t_schedule_post,
    'update_post':            _t_update_post,
    'send_whatsapp_campaign': _t_send_whatsapp_campaign,
    'get_competitor_data':    _t_get_competitor_data,
    'get_calendar':           _t_get_calendar,
    'generate_report':        _t_generate_report,
    'get_lead':               _t_get_lead,
    'update_lead_status':     _t_update_lead_status,
    'reply_to_message':       _t_reply_to_message,
    'list_bot_flows':         _t_list_bot_flows,
}
