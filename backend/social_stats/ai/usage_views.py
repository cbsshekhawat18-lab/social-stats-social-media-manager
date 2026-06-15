# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
AI usage / cost dashboard endpoints.

Mounted at:
    GET /api/ai/v2/usage/             — overall + per-feature aggregates (admin only)
    GET /api/ai/v2/usage/by-client/   — per-client breakdown (admin only)
    GET /api/ai/v2/usage/by-user/     — per-user breakdown (admin only)
    GET /api/ai/v2/usage/budget/      — current month spend vs cap
    GET /api/ai/v2/usage/quota/       — remaining quota for the current client (any user)

The admin endpoints require superadmin or staff role. The quota endpoint is
client-scoped (any authenticated user can see their own client's quota).
"""
from __future__ import annotations

from datetime import timedelta
from collections import defaultdict

from django.db.models import Sum, Count
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import AIUsageLog
from ..ai_views import _resolved_client
from . import cost_tracker, rate_limiter


def _is_admin(user) -> bool:
    profile = getattr(user, 'profile', None)
    return bool(profile and getattr(profile, 'role', '') in ('superadmin', 'staff'))


def _period_start(period: str = 'month'):
    now = timezone.now()
    if period == 'day':
        return now.replace(hour=0, minute=0, second=0, microsecond=0)
    if period == 'week':
        return (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


# ─────────────────────────────────────────────────────────────────────────
# 1. GET /ai/v2/usage/  — global + per-feature aggregates
# ─────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def usage_overview(request):
    if not _is_admin(request.user):
        return Response({'error': 'admin only'}, status=403)

    period = request.query_params.get('period', 'month')
    since  = _period_start(period)
    qs = AIUsageLog.objects.filter(created_at__gte=since)

    # Per-feature breakdown
    by_feature_qs = (
        qs.values('feature')
        .annotate(
            requests=Count('id'),
            input_tokens=Sum('input_tokens'),
            output_tokens=Sum('output_tokens'),
            cost_usd=Sum('total_cost_usd'),
        )
        .order_by('-cost_usd')
    )
    by_feature = [{
        'feature':       row['feature'],
        'requests':      int(row['requests'] or 0),
        'input_tokens':  int(row.get('input_tokens')  or 0),
        'output_tokens': int(row.get('output_tokens') or 0),
        'cost_usd':      float(row.get('cost_usd') or 0),
    } for row in by_feature_qs]

    # Per-model breakdown
    by_model_qs = (
        qs.values('model')
        .annotate(requests=Count('id'),
                  input_tokens=Sum('input_tokens'),
                  output_tokens=Sum('output_tokens'),
                  cost_usd=Sum('total_cost_usd'))
        .order_by('-cost_usd')
    )
    by_model = [{
        'model':         row['model'],
        'requests':      int(row.get('requests') or 0),
        'input_tokens':  int(row.get('input_tokens') or 0),
        'output_tokens': int(row.get('output_tokens') or 0),
        'cost_usd':      float(row.get('cost_usd') or 0),
    } for row in by_model_qs]

    # Daily series (for the sparkline)
    daily = defaultdict(lambda: {'requests': 0, 'cost_usd': 0.0})
    for r in qs.values('created_at', 'total_cost_usd').order_by('created_at'):
        d = r['created_at'].date().isoformat()
        daily[d]['requests'] += 1
        daily[d]['cost_usd'] += float(r['total_cost_usd'] or 0)
    timeseries = [{'date': d, **vals} for d, vals in sorted(daily.items())]

    total = qs.aggregate(
        cost=Sum('total_cost_usd'),
        in_tokens=Sum('input_tokens'),
        out_tokens=Sum('output_tokens'),
    )
    cached_count = qs.filter(cached=True).count()
    err_count    = qs.exclude(status='success').count()
    total_req    = qs.count()

    return Response({
        'period':         period,
        'period_start':   since.isoformat(),
        'totals': {
            'requests':       total_req,
            'cost_usd':       float(total['cost'] or 0),
            'input_tokens':   int(total['in_tokens']  or 0),
            'output_tokens':  int(total['out_tokens'] or 0),
            'cached':         cached_count,
            'errors':         err_count,
            'cache_hit_rate': round((cached_count / total_req * 100) if total_req else 0, 2),
        },
        'by_feature':   by_feature,
        'by_model':     by_model,
        'timeseries':   timeseries,
        'budget':       cost_tracker.budget_status(),
    })


# ─────────────────────────────────────────────────────────────────────────
# 2. GET /ai/v2/usage/by-client/  — per-client breakdown
# ─────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def usage_by_client(request):
    if not _is_admin(request.user):
        return Response({'error': 'admin only'}, status=403)

    period = request.query_params.get('period', 'month')
    since  = _period_start(period)
    qs = (
        AIUsageLog.objects.filter(created_at__gte=since, client_id__isnull=False)
        .values('client_id', 'client__company')
        .annotate(
            requests=Count('id'),
            input_tokens=Sum('input_tokens'),
            output_tokens=Sum('output_tokens'),
            cost_usd=Sum('total_cost_usd'),
        )
        .order_by('-cost_usd')[:100]
    )
    return Response({
        'period':  period,
        'clients': [{
            'client_id':     row['client_id'],
            'client_name':   row['client__company'],
            'requests':      int(row.get('requests') or 0),
            'input_tokens':  int(row.get('input_tokens')  or 0),
            'output_tokens': int(row.get('output_tokens') or 0),
            'cost_usd':      float(row.get('cost_usd') or 0),
        } for row in qs],
    })


# ─────────────────────────────────────────────────────────────────────────
# 3. GET /ai/v2/usage/by-user/  — per-user breakdown
# ─────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def usage_by_user(request):
    if not _is_admin(request.user):
        return Response({'error': 'admin only'}, status=403)

    period = request.query_params.get('period', 'month')
    since  = _period_start(period)
    qs = (
        AIUsageLog.objects.filter(created_at__gte=since, user_id__isnull=False)
        .values('user_id', 'user__email', 'user__first_name', 'user__last_name')
        .annotate(
            requests=Count('id'),
            cost_usd=Sum('total_cost_usd'),
        )
        .order_by('-requests')[:50]
    )
    return Response({
        'period': period,
        'users': [{
            'user_id':  row['user_id'],
            'email':    row['user__email'],
            'name':     ((row['user__first_name'] or '') + ' ' + (row['user__last_name'] or '')).strip(),
            'requests': int(row.get('requests') or 0),
            'cost_usd': float(row.get('cost_usd') or 0),
        } for row in qs],
    })


# ─────────────────────────────────────────────────────────────────────────
# 4. GET /ai/v2/usage/budget/  — global monthly budget status
# ─────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def usage_budget(request):
    if not _is_admin(request.user):
        return Response({'error': 'admin only'}, status=403)
    return Response(cost_tracker.budget_status())


# ─────────────────────────────────────────────────────────────────────────
# 5. GET /ai/v2/usage/quota/  — remaining daily quota for current client
# ─────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def usage_quota(request):
    """
    Per-client daily quota — accessible to any authenticated user (not admin-only).
    Surfaces the rate-limit usage of the current client so the UI can show
    "You've used 23/100 AI requests today".
    """
    client, err = _resolved_client(request)
    if err: return err
    return Response({
        'client_id': client.id,
        'client':    client.company,
        **rate_limiter.get_usage(client.id),
    })


# ─────────────────────────────────────────────────────────────────────────
# 6. GET /ai/v2/audit/  — client-visible "What did Social Stats do for me?"
# ─────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def usage_audit(request):
    """
    Client-facing AI activity feed — scoped to the current client.
    Different from /ai/v2/usage/ which is admin-only and shows cross-client.

    Query params:
        feature?   filter by feature label
        limit?     default 50, max 200
    """
    client, err = _resolved_client(request)
    if err: return err

    feature = request.query_params.get('feature')
    limit   = max(1, min(int(request.query_params.get('limit', 50) or 50), 200))

    qs = AIUsageLog.objects.filter(client=client).order_by('-created_at')
    if feature:
        qs = qs.filter(feature=feature)
    qs = qs[:limit]

    rows = [{
        'id':              r.id,
        'feature':         r.feature,
        'model':           r.model,
        'cached':          r.cached,
        'status':          r.status,
        'input_tokens':    r.input_tokens,
        'output_tokens':   r.output_tokens,
        'cost_usd':        float(r.total_cost_usd or 0),
        'duration_ms':     r.duration_ms,
        'response_summary': r.response_summary or '',
        'created_at':      r.created_at.isoformat() if r.created_at else '',
    } for r in qs]

    # Aggregate counts per feature for the side panel
    by_feature_counts = (
        AIUsageLog.objects.filter(client=client)
        .values('feature')
        .annotate(count=Count('id'))
        .order_by('-count')[:20]
    )

    return Response({
        'count':       len(rows),
        'rows':        rows,
        'by_feature':  list(by_feature_counts),
        'quota':       rate_limiter.get_usage(client.id),
    })
