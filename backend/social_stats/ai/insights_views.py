# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Insights + Analytics AI endpoints.

Mounted at:
    POST /api/ai/v2/insight-generate    — generate + persist insights from recent data
    GET  /api/ai/v2/insights            — list saved insights for a client
    PATCH /api/ai/v2/insights/<id>      — dismiss / mark acted_upon
    POST /api/ai/v2/anomaly-detect      — flag anomalies in a metric series
    POST /api/ai/v2/trend-analysis      — identify trends in performance
    POST /api/ai/v2/forecast            — short-horizon forecast
    POST /api/ai/v2/competitor-insight  — analyse one competitor
    POST /api/ai/v2/audience-profile    — generate audience persona
    GET  /api/ai/v2/today-briefing      — daily briefing widget data

All endpoints route through AIClient (cost / rate-limit / log) and scope by
client_id via the existing `_resolved_client(request)` helper.
"""
from __future__ import annotations

import logging
from collections import defaultdict
from datetime import timedelta

from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import (
    AIInsight, Client, PostMetric, Competitor, CompetitorSnapshot,
)
from ..ai_views import _resolved_client
from . import AIClient, AIError, RateLimited, prompts
from .content_views import _ai_call_json, _error_response
from .prompts import insight_generator, anomaly_detector, trend_analyzer, forecaster

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────
# Data-shaping helpers
# ─────────────────────────────────────────────────────────────────────────

def _build_metrics_snapshot(client: Client, days: int = 30) -> dict:
    """
    Aggregate the last `days` of PostMetric data into a compact JSON snapshot
    suitable for sending to Claude. Capped to keep prompts within budget.
    """
    since = timezone.now() - timedelta(days=days)
    qs = PostMetric.objects.filter(client=client, posted_at__gte=since)

    by_platform = defaultdict(lambda: {
        'platform': '', 'posts': 0,
        'likes': 0, 'comments': 0, 'shares': 0,
        'impressions': 0, 'reach': 0, 'video_views': 0,
        'engagement_total': 0,
    })

    posts = []
    for m in qs:
        p = m.platform
        b = by_platform[p]
        b['platform'] = p
        b['posts']            += 1
        likes    = int(getattr(m, 'likes', 0) or 0)
        comments = int(getattr(m, 'comments', 0) or 0)
        shares   = int(getattr(m, 'shares', 0) or 0)
        b['likes']            += likes
        b['comments']         += comments
        b['shares']           += shares
        b['impressions']      += int(getattr(m, 'impressions', 0) or 0)
        b['reach']            += int(getattr(m, 'reach', 0) or 0)
        b['video_views']      += int(getattr(m, 'video_views', 0) or 0)
        b['engagement_total'] += likes + comments + shares
        posts.append({
            'platform':  p,
            'posted_at': m.posted_at.isoformat() if m.posted_at else '',
            'engagement': likes + comments + shares,
            'reach':     int(getattr(m, 'reach', 0) or 0),
            'preview':   (getattr(m, 'caption', '') or getattr(m, 'content', '') or '')[:140],
        })

    # Top 10 posts in window
    posts.sort(key=lambda r: r['engagement'], reverse=True)
    top_posts = posts[:10]

    return {
        'window_days':  days,
        'window_start': since.date().isoformat(),
        'window_end':   timezone.now().date().isoformat(),
        'totals_by_platform': list(by_platform.values()),
        'top_posts':    top_posts,
        'total_posts':  qs.count(),
    }


def _series_for_metric(client: Client, metric: str, days: int = 60,
                       platform: str | None = None) -> list[dict]:
    """
    Build a daily {date, value} series for a metric over the last `days`.
    """
    since = timezone.now() - timedelta(days=days)
    qs = PostMetric.objects.filter(client=client, posted_at__gte=since)
    if platform:
        qs = qs.filter(platform=platform)

    by_day = defaultdict(int)
    for m in qs:
        if not m.posted_at:
            continue
        day = m.posted_at.date().isoformat()
        if metric == 'engagement_total':
            v = (int(getattr(m, 'likes', 0) or 0)
                 + int(getattr(m, 'comments', 0) or 0)
                 + int(getattr(m, 'shares', 0) or 0))
        elif metric in ('reach', 'impressions', 'likes', 'comments', 'shares', 'video_views', 'followers'):
            v = int(getattr(m, metric, 0) or 0)
        else:
            v = 0
        by_day[day] += v

    return [{'date': d, 'value': by_day[d]} for d in sorted(by_day.keys())]


# ─────────────────────────────────────────────────────────────────────────
# 1. POST /ai/v2/insight-generate
# ─────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def insight_generate(request):
    """
    Body: { client_id, days?=30, focus_area?, max_insights?=5, persist?=true }
    Returns: { insights: [...], persisted: int }
    """
    client, err = _resolved_client(request)
    if err: return err

    days         = max(1, min(int(request.data.get('days', 30) or 30), 90))
    focus_area   = (request.data.get('focus_area') or 'any').strip()
    max_insights = max(1, min(int(request.data.get('max_insights', 5) or 5), 10))
    persist      = bool(request.data.get('persist', True))

    snapshot = _build_metrics_snapshot(client, days=days)
    if snapshot['total_posts'] == 0:
        return Response({
            'insights':  [],
            'persisted': 0,
            'note':      f'No posts in the last {days} days to analyse.',
        })

    ai = AIClient(client=client, user=request.user, feature='insight_generate')
    cfg = prompts.build('insight_generator',
                        metrics_snapshot=snapshot,
                        business_name=client.company or '',
                        focus_area=focus_area,
                        max_insights=max_insights)
    try:
        raw = ai.extract_json(cfg['user_message'], system=cfg['system'],
                              max_tokens=cfg['max_tokens'],
                              temperature=cfg['temperature'])
    except (AIError, RateLimited) as e:
        return _error_response(e, 'insight-generate failed')

    insights = insight_generator.coerce_result(raw, max_insights=max_insights)

    persisted = 0
    if persist and insights:
        for ins in insights:
            try:
                AIInsight.objects.create(
                    client=client,
                    title=ins['title'],
                    insight_type=ins['insight_type'],
                    severity=ins['severity'],
                    confidence_score=ins['confidence'],
                    data_sources=[snapshot.get('window_start'), snapshot.get('window_end')],
                    action_recommended=ins['action_recommended'],
                    content=ins['description'],
                    expires_at=timezone.now() + timedelta(days=7),
                )
                persisted += 1
            except Exception:
                logger.exception('failed to persist insight')

    return Response({
        'insights':  insights,
        'persisted': persisted,
        'window_days': days,
    })


# ─────────────────────────────────────────────────────────────────────────
# 2. GET /ai/v2/insights/  + PATCH /ai/v2/insights/<id>/
# ─────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_insights(request):
    client, err = _resolved_client(request)
    if err: return err

    show_dismissed = request.query_params.get('dismissed') == 'true'
    severity       = request.query_params.get('severity')
    qs = AIInsight.objects.filter(client=client)
    if not show_dismissed:
        qs = qs.filter(dismissed=False)
    if severity:
        qs = qs.filter(severity=severity)
    qs = qs.exclude(title='').order_by('-generated_at')[:100]

    out = [{
        'id':                 i.id,
        'title':              i.title,
        'description':        i.content,
        'insight_type':       i.insight_type,
        'severity':           i.severity,
        'confidence_score':   i.confidence_score,
        'action_recommended': i.action_recommended,
        'dismissed':          i.dismissed,
        'acted_upon':         i.acted_upon,
        'expires_at':         i.expires_at.isoformat() if i.expires_at else None,
        'generated_at':       i.generated_at.isoformat() if i.generated_at else '',
    } for i in qs]

    return Response({'count': len(out), 'insights': out})


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_insight(request, pk):
    client, err = _resolved_client(request)
    if err: return err
    try:
        ins = AIInsight.objects.get(id=pk, client=client)
    except AIInsight.DoesNotExist:
        return Response({'error': 'insight not found'}, status=404)
    fields = []
    if 'dismissed' in request.data:
        ins.dismissed = bool(request.data.get('dismissed'))
        fields.append('dismissed')
    if 'acted_upon' in request.data:
        ins.acted_upon = bool(request.data.get('acted_upon'))
        fields.append('acted_upon')
    if fields:
        ins.save(update_fields=fields)
    return Response({'id': ins.id, 'dismissed': ins.dismissed, 'acted_upon': ins.acted_upon})


# ─────────────────────────────────────────────────────────────────────────
# 3. POST /ai/v2/anomaly-detect
# ─────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def anomaly_detect(request):
    """
    Body: { client_id, metric, days?=60, platform? }
    Returns: { anomalies: [...], summary }
    """
    client, err = _resolved_client(request)
    if err: return err

    metric = (request.data.get('metric') or 'engagement_total').strip()
    days   = max(7, min(int(request.data.get('days', 60) or 60), 180))
    platform = (request.data.get('platform') or '').strip() or None

    series = _series_for_metric(client, metric, days=days, platform=platform)
    if len(series) < 7:
        return Response({
            'anomalies': [],
            'summary':   'Not enough data to detect anomalies (need ≥7 daily points).',
            'series_points': len(series),
        })

    ai = AIClient(client=client, user=request.user, feature='anomaly_detect')
    cfg = prompts.build('anomaly_detector', metric=metric, series=series,
                        baseline_window_days=min(28, len(series) - 1))
    try:
        raw = ai.extract_json(cfg['user_message'], system=cfg['system'],
                              max_tokens=cfg['max_tokens'],
                              temperature=cfg['temperature'])
    except (AIError, RateLimited) as e:
        return _error_response(e, 'anomaly-detect failed')

    result = anomaly_detector.coerce_result(raw)
    result['series_points'] = len(series)
    return Response(result)


# ─────────────────────────────────────────────────────────────────────────
# 4. POST /ai/v2/trend-analysis
# ─────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def trend_analysis(request):
    """
    Body: { client_id, days?=30 }
    Returns: { trends: [...] }
    """
    client, err = _resolved_client(request)
    if err: return err

    days = max(7, min(int(request.data.get('days', 30) or 30), 90))
    snapshot = _build_metrics_snapshot(client, days=days)
    if snapshot['total_posts'] == 0:
        return Response({'trends': [], 'note': f'No posts in the last {days} days.'})

    ai = AIClient(client=client, user=request.user, feature='trend_analysis')
    cfg = prompts.build('trend_analyzer',
                        metrics_snapshot=snapshot,
                        period_label=f'last {days} days',
                        business_name=client.company or '')
    try:
        raw = ai.extract_json(cfg['user_message'], system=cfg['system'],
                              max_tokens=cfg['max_tokens'],
                              temperature=cfg['temperature'])
    except (AIError, RateLimited) as e:
        return _error_response(e, 'trend-analysis failed')

    return Response({'trends': trend_analyzer.coerce_result(raw), 'window_days': days})


# ─────────────────────────────────────────────────────────────────────────
# 5. POST /ai/v2/forecast
# ─────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def forecast(request):
    """
    Body: { client_id, metric, horizon_days?=7, lookback_days?=60, platform? }
    Returns: { forecast: [...], assumptions, caveats }
    """
    client, err = _resolved_client(request)
    if err: return err

    metric        = (request.data.get('metric') or 'engagement_total').strip()
    horizon_days  = max(1, min(int(request.data.get('horizon_days', 7) or 7), 30))
    lookback_days = max(14, min(int(request.data.get('lookback_days', 60) or 60), 180))
    platform = (request.data.get('platform') or '').strip() or None

    series = _series_for_metric(client, metric, days=lookback_days, platform=platform)
    if len(series) < 14:
        return Response({
            'forecast': [], 'assumptions': [], 'caveats': ['Need at least 14 daily points to forecast'],
            'series_points': len(series),
        })

    ai = AIClient(client=client, user=request.user, feature='forecast')
    cfg = prompts.build('forecaster',
                        metric=metric,
                        series=series,
                        horizon_days=horizon_days)
    try:
        raw = ai.extract_json(cfg['user_message'], system=cfg['system'],
                              max_tokens=cfg['max_tokens'],
                              temperature=cfg['temperature'])
    except (AIError, RateLimited) as e:
        return _error_response(e, 'forecast failed')

    result = forecaster.coerce_result(raw)
    result['horizon_days'] = horizon_days
    result['series_points'] = len(series)
    return Response(result)


# ─────────────────────────────────────────────────────────────────────────
# 6. POST /ai/v2/competitor-insight
# ─────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def competitor_insight(request):
    """
    Body: { client_id, competitor_id, days?=60 }
    Returns: { strengths, weaknesses, content_themes, posting_patterns, recommendations_for_us }
    """
    client, err = _resolved_client(request)
    if err: return err

    competitor_id = int(request.data.get('competitor_id') or 0)
    if not competitor_id:
        return Response({'error': 'competitor_id is required'}, status=400)
    try:
        comp = Competitor.objects.get(id=competitor_id, client=client)
    except Competitor.DoesNotExist:
        return Response({'error': 'competitor not found for this client'}, status=404)

    days = max(7, min(int(request.data.get('days', 60) or 60), 180))
    since = (timezone.now() - timedelta(days=days)).date()
    snaps = list(
        CompetitorSnapshot.objects.filter(competitor=comp, date__gte=since)
        .order_by('-date')[:60]
        .values('date', 'followers', 'posts_count', 'engagement_rate', 'avg_likes', 'avg_comments')
    )
    snaps_clean = [
        {
            'date':            s['date'].isoformat() if s['date'] else '',
            'followers':       int(s.get('followers') or 0),
            'posts_count':     int(s.get('posts_count') or 0),
            'engagement_rate': float(s.get('engagement_rate') or 0),
            'avg_likes':       float(s.get('avg_likes') or 0),
            'avg_comments':    float(s.get('avg_comments') or 0),
        }
        for s in snaps
    ]

    # Our matching numbers for the same window
    snap = _build_metrics_snapshot(client, days=days)
    our_total = next(
        (t for t in snap['totals_by_platform'] if t['platform'] == getattr(comp, 'platform', '')),
        {},
    )

    ai = AIClient(client=client, user=request.user, feature='competitor_insight')
    cfg = prompts.build('competitor_insight',
                        competitor_name=comp.name,
                        platform=getattr(comp, 'platform', '') or '',
                        snapshots=snaps_clean,
                        our_snapshot=our_total)
    try:
        data = _ai_call_json(ai=ai, template='competitor_insight',
                             competitor_name=comp.name,
                             platform=getattr(comp, 'platform', '') or '',
                             snapshots=snaps_clean,
                             our_snapshot=our_total)
    except (AIError, RateLimited) as e:
        return _error_response(e, 'competitor-insight failed')
    data['competitor_id'] = comp.id
    data['snapshots_in_window'] = len(snaps_clean)
    return Response(data)


# ─────────────────────────────────────────────────────────────────────────
# 7. POST /ai/v2/audience-profile
# ─────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def audience_profile(request):
    """
    Body: { client_id, days?=30 }
    Returns: persona profile JSON
    """
    client, err = _resolved_client(request)
    if err: return err

    days = max(7, min(int(request.data.get('days', 30) or 30), 90))
    snapshot = _build_metrics_snapshot(client, days=days)
    summary = {
        'company':      client.company or '',
        'industry':     getattr(client, 'industry', '') or '',
        'country':      getattr(client, 'country', '') or '',
        'window_days':  days,
        'total_posts':  snapshot.get('total_posts', 0),
    }

    ai = AIClient(client=client, user=request.user, feature='audience_profile')
    try:
        data = _ai_call_json(ai=ai, template='audience_profiler',
                             client_summary=summary,
                             metrics_snapshot=snapshot,
                             business_name=client.company or '')
    except (AIError, RateLimited) as e:
        return _error_response(e, 'audience-profile failed')
    return Response(data)


# ─────────────────────────────────────────────────────────────────────────
# 8. GET /ai/v2/today-briefing  — daily summary for the dashboard widget
# ─────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def today_briefing(request):
    """
    Returns up to 5 most recent active AIInsights for the current client,
    formatted for the dashboard widget. Pure read — does not call Claude.
    Generated insights live in AIInsight; this just serves them.
    """
    client, err = _resolved_client(request)
    if err: return err

    qs = (
        AIInsight.objects
        .filter(client=client, dismissed=False)
        .exclude(title='')
        .order_by('-generated_at')[:5]
    )
    items = [{
        'id':                 i.id,
        'title':              i.title,
        'description':        i.content,
        'severity':           i.severity,
        'insight_type':       i.insight_type,
        'action_recommended': i.action_recommended,
        'generated_at':       i.generated_at.isoformat() if i.generated_at else '',
    } for i in qs]

    return Response({
        'count':       len(items),
        'items':       items,
        'generated_at': timezone.now().isoformat(),
    })
