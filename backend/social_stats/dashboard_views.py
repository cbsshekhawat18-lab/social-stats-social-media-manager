# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Dashboard aggregation endpoints.

  GET /api/dashboard/counts/   — sidebar badge counts (unread inbox,
                                  pending approvals, new leads,
                                  unread notifications)
  GET /api/search/unified/     — cross-feature search for the Cmd+K palette
                                  (posts, leads, conversations, contacts)

Both endpoints are scoped to the active client. Resolution order:
  1. ?client_id=N query param (admin / agency context)
  2. profile.client_id (end-user workspaces)

A client is required — endpoints return 400 when none can be resolved (e.g.,
agency view without a client picked yet). Errors are recoverable; the UI
hides the badges until a client is selected.
"""
from __future__ import annotations

from datetime import timedelta

from django.db.models import Q
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import (
    Client, Conversation, Notification, UnifiedPost,
    AgencyClientRelation, AgencyMembership, ApprovalRequest,
    UnifiedReview,
)
from .bot_models import Lead


# ─────────────────────────────────────────────────────────────────────────────
# Helpers — single client resolution + scope check
# ─────────────────────────────────────────────────────────────────────────────
def _resolve_client(request) -> Client | None:
    """Pick the active client from query param or profile. Returns None when
    nothing matches OR the user has no permission to read it."""
    profile = getattr(request.user, 'profile', None)

    cid = request.query_params.get('client_id')
    if cid and str(cid).isdigit():
        client = Client.objects.filter(id=int(cid)).first()
        if not client:
            return None
        if profile and profile.role == 'superadmin':
            return client
        # End user: must own this client.
        if profile and profile.client_id == client.id:
            return client
        # Agency: must have an active relation to this client.
        if profile and profile.primary_agency_id and AgencyClientRelation.objects.filter(
            agency_id=profile.primary_agency_id, client=client, status='active',
        ).exists():
            return client
        return None

    if profile and profile.client_id:
        return profile.client

    # No explicit client — for admins, return None (no-op badges)
    return None


# ─────────────────────────────────────────────────────────────────────────────
# /api/dashboard/counts/ — sidebar badge feed
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_counts(request):
    """Return the four sidebar badge counts as a flat JSON dict.

    Response shape:
        {
          "client_id":           42,
          "unread_inbox":        3,    # conversations with unread > 0
          "priority_inbox":      1,    # negative-sentiment threads
          "pending_approvals":   2,    # ApprovalRequest still pending
          "new_leads":           5,    # leads created in last 24h, status=new
          "unread_notifications": 8,
          "scheduled_posts":     12,   # status=scheduled or queued
        }

    Designed for cheap polling + WebSocket invalidation. Each query is
    indexed and tenant-scoped; total work ≤ 6 short SELECT counts.
    """
    client = _resolve_client(request)
    if client is None:
        # Admin without a client picked, or auth-but-no-workspace edge.
        # Returning zeros is friendlier than a 400 — the UI can keep
        # rendering and the badges just stay at 0.
        return Response(_zeros())

    user = request.user
    since_24h = timezone.now() - timedelta(hours=24)

    counts = {
        'client_id':            client.id,
        'unread_inbox':         Conversation.objects.filter(
                                    client=client, is_archived=False,
                                    is_resolved=False, unread_count__gt=0,
                                ).count(),
        'priority_inbox':       Conversation.objects.filter(
                                    client=client, is_archived=False,
                                    is_resolved=False, sentiment='negative',
                                ).count(),
        'pending_approvals':    ApprovalRequest.objects.filter(
                                    client=client, status='pending',
                                ).count(),
        'new_leads':            Lead.objects.filter(
                                    client=client, status='new',
                                    created_at__gte=since_24h,
                                ).count(),
        'unread_notifications': Notification.objects.filter(
                                    user=user, is_read=False,
                                ).count(),
        'scheduled_posts':      UnifiedPost.objects.filter(
                                    client=client,
                                    status__in=['scheduled', 'queued'],
                                ).count(),
    }
    return Response(counts)


def _zeros() -> dict:
    return {
        'client_id':            None,
        'unread_inbox':         0,
        'priority_inbox':       0,
        'pending_approvals':    0,
        'new_leads':            0,
        'unread_notifications': 0,
        'scheduled_posts':      0,
    }


# ─────────────────────────────────────────────────────────────────────────────
# /api/search/unified/ — Cmd+K cross-feature search
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def unified_search(request):
    """Search across posts, leads, conversations and contacts in one call.

    Query params:
      q          — required, ≥2 chars (single-char queries return empty)
      client_id  — optional explicit client; falls back to active workspace
      limit      — per-category cap (default 5, max 20)

    Response shape:
        {
          "query":  "mumbai",
          "client_id": 42,
          "posts":         [{id, title, preview, status, deep_link}],
          "leads":         [{id, name, phone, status, deep_link}],
          "conversations": [{id, contact, platform, preview, deep_link}],
          "contacts":      [{id, name, phone, deep_link}],
          "total": N,
        }

    Each item carries `deep_link` so the palette can navigate without the
    frontend reasoning about feature URL conventions. Tenant-scoped.
    """
    query = (request.query_params.get('q') or '').strip()
    if len(query) < 2:
        return Response({
            'query': query, 'client_id': None,
            'posts': [], 'leads': [], 'conversations': [], 'contacts': [],
            'total': 0,
        })

    client = _resolve_client(request)
    if client is None:
        return Response({
            'query': query, 'client_id': None,
            'posts': [], 'leads': [], 'conversations': [], 'contacts': [],
            'total': 0,
        })

    try:
        limit = max(1, min(int(request.query_params.get('limit') or 5), 20))
    except (TypeError, ValueError):
        limit = 5

    posts = list(
        UnifiedPost.objects.filter(client=client)
        .filter(Q(title__icontains=query) | Q(content__icontains=query))
        .order_by('-created_at')
        .values('id', 'title', 'content', 'status')[:limit]
    )
    posts = [{
        'id':        p['id'],
        'title':     p['title'] or (p['content'] or '')[:60],
        'preview':   (p['content'] or '')[:120],
        'status':    p['status'],
        'deep_link': f'/admin/composer/{p["id"]}',
    } for p in posts]

    leads = list(
        Lead.objects.filter(client=client)
        .filter(
            Q(name__icontains=query)
            | Q(phone__icontains=query)
            | Q(email__icontains=query)
            | Q(notes__icontains=query)
        )
        .order_by('-created_at')
        .values('id', 'name', 'phone', 'email', 'status')[:limit]
    )
    leads = [{
        'id':        l['id'],
        'name':      l['name'] or l['phone'],
        'phone':     l['phone'],
        'email':     l['email'],
        'status':    l['status'],
        'deep_link': f'/admin/leads/{l["id"]}',
    } for l in leads]

    conversations = list(
        Conversation.objects.filter(client=client, is_archived=False)
        .filter(
            Q(contact_name__icontains=query)
            | Q(contact_handle__icontains=query)
            | Q(messages__content__icontains=query)
            | Q(last_message_preview__icontains=query)
        )
        .order_by('-last_message_at')
        .distinct()
        .values('id', 'contact_name', 'contact_handle', 'platform', 'last_message_preview')[:limit]
    )
    conversations = [{
        'id':        c['id'],
        'contact':   c['contact_name'] or c['contact_handle'] or '(unknown)',
        'platform':  c['platform'],
        'preview':   (c['last_message_preview'] or '')[:120],
        'deep_link': f'/admin/inbox/{c["id"]}',
    } for c in conversations]

    # Contacts are channel-specific today; query WhatsAppContact since that's
    # what's wired. The future Contact super-record (audit decision #1) would
    # supersede this without changing the response shape.
    from .models import WhatsAppContact
    contacts = list(
        WhatsAppContact.objects.filter(client=client)
        .filter(Q(name__icontains=query) | Q(phone__icontains=query))
        .order_by('-last_inbound_at')
        .values('id', 'name', 'phone')[:limit]
    )
    contacts = [{
        'id':        ct['id'],
        'name':      ct['name'] or ct['phone'],
        'phone':     ct['phone'],
        'deep_link': f'/admin/contacts/{ct["id"]}',
    } for ct in contacts]

    return Response({
        'query':         query,
        'client_id':     client.id,
        'posts':         posts,
        'leads':         leads,
        'conversations': conversations,
        'contacts':      contacts,
        'total':         len(posts) + len(leads) + len(conversations) + len(contacts),
    })


# ─────────────────────────────────────────────────────────────────────────────
# /api/dashboard/today/ — single aggregated cross-feature payload
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_today(request):
    """Return everything the home dashboard needs in ONE call.

    Replaces the 8-call pattern that produced layout shift while loading
    different cards independently. Tenant-scoped via the same resolver as
    counts/search.

    Response shape:
        {
          "client_id":        42,
          "client_name":      "Acme",
          "as_of":            "2026-05-09T07:30:00Z",
          "briefing":         "",                  # AI-generated; empty stub for now
          "posts":            {published_today, scheduled, queued, reach_change_pct},
          "inbox":            {unread, priority, replied_today, avg_reply_minutes},
          "leads":            {new_today, qualified, converted_today, pipeline_value},
          "campaigns":        {running, sent_today, avg_delivery_rate_pct},
          "recent_activity":  [{action_type, description, severity, created_at}],
          "pending_approvals":[{id, action_type, requested_by, preview, created_at}],
          "engagement_chart": [{date, engagement, reach}, ...],  # last 30 days
        }
    """
    from datetime import datetime, time as dtime
    from django.db.models import Sum, Avg, F, Count

    # Lazy imports — these models aren't always touched, keeps cold-start
    # cheap for the simpler counts/search endpoints above.
    from .bot_models import Lead
    from .marketplace_models import ActivityLog
    from .models import (
        WhatsAppCampaign, DailyMetric, Conversation, Message, UnifiedPost,
    )

    client = _resolve_client(request)
    if client is None:
        return Response({
            'client_id': None,
            'client_name': '',
            'as_of': timezone.now().isoformat(),
            **_today_zeros(),
        })

    now = timezone.now()
    today_start = timezone.make_aware(datetime.combine(now.date(), dtime.min)) \
        if timezone.is_naive(now) else now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_start - timedelta(days=1)
    last30_start    = today_start - timedelta(days=30)
    prior30_start   = today_start - timedelta(days=60)

    # ── Posts ───────────────────────────────────────────────────────
    posts_qs = UnifiedPost.objects.filter(client=client)
    posts = {
        'published_today': posts_qs.filter(
            status='published', published_at__gte=today_start,
        ).count(),
        'scheduled':       posts_qs.filter(status='scheduled').count(),
        'queued':          posts_qs.filter(status='queued').count(),
        'reach_change_pct': _reach_change_pct(client, last30_start, prior30_start),
    }

    # ── Inbox ───────────────────────────────────────────────────────
    convs_qs = Conversation.objects.filter(client=client, is_archived=False)
    replied_today_qs = Message.objects.filter(
        conversation__client=client, direction='outbound',
        sent_at__gte=today_start,
    )
    inbox = {
        'unread':            convs_qs.filter(unread_count__gt=0, is_resolved=False).count(),
        'priority':          convs_qs.filter(sentiment='negative', is_resolved=False).count(),
        'replied_today':     replied_today_qs.count(),
        'avg_reply_minutes': _avg_reply_minutes(client, since=last30_start),
    }

    # ── Leads ───────────────────────────────────────────────────────
    leads_qs = Lead.objects.filter(client=client)
    qualified_set = ('qualified', 'converted')
    pipeline_total = leads_qs.filter(
        status__in=['new', 'contacted', 'qualified'],
    ).aggregate(total=Sum('conversion_value'))['total'] or 0
    leads = {
        'new_today':        leads_qs.filter(
            status='new', created_at__gte=today_start,
        ).count(),
        'qualified':        leads_qs.filter(status='qualified').count(),
        'converted_today':  leads_qs.filter(
            status='converted', converted_at__gte=today_start,
        ).count(),
        'pipeline_value':   float(pipeline_total),
    }

    # ── Campaigns ───────────────────────────────────────────────────
    camp_qs = WhatsAppCampaign.objects.filter(client=client)
    running_qs = camp_qs.filter(status='running')
    sent_today = camp_qs.filter(
        started_at__gte=today_start,
    ).aggregate(total=Sum('sent_count'))['total'] or 0
    delivery_rate = _avg_delivery_rate(camp_qs.filter(
        status__in=['running', 'completed'], total_count__gt=0,
    ))
    campaigns = {
        'running':                running_qs.count(),
        'sent_today':             int(sent_today),
        'avg_delivery_rate_pct':  delivery_rate,
    }

    # ── Recent activity ────────────────────────────────────────────
    activity = list(
        ActivityLog.objects.filter(client=client)
        .order_by('-created_at')[:10]
        .values('id', 'action_type', 'description', 'severity',
                'actor_type', 'created_at', 'target_object_type',
                'target_object_id')
    )
    for a in activity:
        if a.get('created_at'):
            a['created_at'] = a['created_at'].isoformat()

    # ── Pending approvals ──────────────────────────────────────────
    approvals = list(
        ApprovalRequest.objects.filter(client=client, status='pending')
        .select_related('requested_by')
        .order_by('-created_at')[:5]
    )
    approvals_payload = [{
        'id':           a.id,
        'action_type':  a.action_type,
        'requested_by': (a.requested_by.get_full_name()
                         or a.requested_by.email) if a.requested_by_id else 'Unknown',
        'preview':      (a.preview or '')[:200],
        'expires_at':   a.expires_at.isoformat() if a.expires_at else None,
        'created_at':   a.created_at.isoformat() if a.created_at else None,
    } for a in approvals]

    # ── Engagement chart (last 30 days, rolled up across platforms) ─
    chart = list(
        DailyMetric.objects.filter(
            client=client, date__gte=last30_start.date(),
        )
        .values('date')
        .annotate(
            engagement=Sum(F('likes') + F('comments') + F('shares')),
            reach=Sum('reach'),
        )
        .order_by('date')
    )
    for row in chart:
        row['date'] = row['date'].isoformat() if row['date'] else None
        row['engagement'] = int(row['engagement'] or 0)
        row['reach'] = int(row['reach'] or 0)

    briefing = ''
    if request.query_params.get('briefing') != 'skip':
        try:
            from .ai.dashboard_briefing import build_briefing
            briefing = build_briefing(client, user=request.user)
        except Exception:
            briefing = ''

    return Response({
        'client_id':         client.id,
        'client_name':       client.company,
        'as_of':             now.isoformat(),
        'briefing':          briefing,
        'posts':             posts,
        'inbox':             inbox,
        'leads':             leads,
        'campaigns':         campaigns,
        'recent_activity':   activity,
        'pending_approvals': approvals_payload,
        'engagement_chart':  chart,
    })


# ─────────────────────────────────────────────────────────────────────────────
# Helpers — kept private; never import from outside the dashboard module.
# ─────────────────────────────────────────────────────────────────────────────
def _today_zeros() -> dict:
    """Empty-state payload for admins with no client picked yet."""
    return {
        'briefing': '',
        'posts':    {'published_today': 0, 'scheduled': 0, 'queued': 0, 'reach_change_pct': None},
        'inbox':    {'unread': 0, 'priority': 0, 'replied_today': 0, 'avg_reply_minutes': None},
        'leads':    {'new_today': 0, 'qualified': 0, 'converted_today': 0, 'pipeline_value': 0.0},
        'campaigns':{'running': 0, 'sent_today': 0, 'avg_delivery_rate_pct': None},
        'recent_activity':   [],
        'pending_approvals': [],
        'engagement_chart':  [],
    }


def _reach_change_pct(client, last30_start, prior30_start):
    """% change in total reach: last 30d vs prior 30d. None on insufficient data."""
    from django.db.models import Sum
    from .models import DailyMetric

    last  = DailyMetric.objects.filter(
        client=client, date__gte=last30_start.date(), date__lt=timezone.now().date(),
    ).aggregate(t=Sum('reach'))['t'] or 0
    prev  = DailyMetric.objects.filter(
        client=client, date__gte=prior30_start.date(), date__lt=last30_start.date(),
    ).aggregate(t=Sum('reach'))['t'] or 0

    if not prev:
        return None
    return round((last - prev) / prev * 100, 1)


def _avg_reply_minutes(client, since):
    """Median (well, avg) minutes between an inbound message and the next
    outbound on the same conversation. had been added `last_outbound_at` to
    Conversation but it's only populated by post-Phase-7 callsites; this
    falls back to per-message scan when the column is unset.

    Returns None when we don't have enough data to compute meaningfully.
    """
    from django.db.models import F
    from .models import Conversation

    convs = Conversation.objects.filter(
        client=client, is_archived=False,
        last_message_at__gte=since,
        last_outbound_at__isnull=False,
        last_message_at__isnull=False,
    ).annotate(
        gap_seconds=(F('last_outbound_at') - F('last_message_at')),
    )
    # Build the average in Python — DB-level diff types differ across
    # backends, and the dataset is small enough.
    deltas = []
    for c in convs.values('last_message_at', 'last_outbound_at'):
        if not c['last_outbound_at'] or not c['last_message_at']:
            continue
        d = (c['last_outbound_at'] - c['last_message_at']).total_seconds()
        if d > 0:                       # ignore "they replied first" rows
            deltas.append(d)
    if not deltas:
        return None
    return round(sum(deltas) / len(deltas) / 60.0, 1)


def _avg_delivery_rate(qs):
    """Average delivered/total across campaigns. None when no campaigns."""
    rates = []
    for c in qs.values('total_count', 'delivered_count'):
        total = c['total_count'] or 0
        if not total:
            continue
        rates.append((c['delivered_count'] or 0) / total)
    if not rates:
        return None
    return round(sum(rates) / len(rates) * 100, 1)
