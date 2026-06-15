# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Reports + Narration.

Mounted at:
    POST /api/ai/v2/report-write     — full executive-style report
    POST /api/ai/v2/report-narrate   — short narrative paragraphs for a dashboard

Both flows pull the standard metrics snapshot + recent insights and run them
through Claude. Output is structured JSON ready for the existing PDF
generator (report_writer) or for inline rendering next to charts (narrate).
"""
from __future__ import annotations

import logging
from datetime import timedelta

from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import AIInsight
from ..ai_views import _resolved_client
from . import AIClient, AIError, RateLimited, prompts
from .content_views import _error_response
from .insights_views import _build_metrics_snapshot
from .prompts import report_writer, report_narrator

logger = logging.getLogger(__name__)


PERIOD_DAYS = {
    'weekly':    7,
    'monthly':   30,
    'quarterly': 90,
    'campaign':  30,
}


def _recent_insights(client, days: int) -> list[dict]:
    """Pull the most relevant recent AIInsights for the report context."""
    since = timezone.now() - timedelta(days=days)
    qs = (
        AIInsight.objects
        .filter(client=client, dismissed=False, generated_at__gte=since)
        .exclude(title='')
        .order_by('-generated_at')[:10]
    )
    return [{
        'title':              i.title,
        'description':        i.content,
        'severity':           i.severity,
        'insight_type':       i.insight_type,
        'action_recommended': i.action_recommended,
    } for i in qs]


# ─────────────────────────────────────────────────────────────────────────
# 1. POST /ai/v2/report-write
# ─────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def report_write(request):
    """
    Body: { client_id, period?='weekly', industry?, language? }
    Returns: full structured report
        {title, executive_summary, sections[], key_metrics[],
         recommendations[], footer_note, period, period_start, period_end}
    """
    client, err = _resolved_client(request)
    if err: return err

    period = (request.data.get('period') or 'weekly').strip().lower()
    days   = PERIOD_DAYS.get(period, 7)
    snap   = _build_metrics_snapshot(client, days=days)

    if snap.get('total_posts', 0) == 0:
        return Response({
            'error': f'No posts in the last {days} days to report on.',
            'period': period, 'period_days': days,
        }, status=400)

    period_start = snap.get('window_start', '')
    period_end   = snap.get('window_end', '')
    industry     = (request.data.get('industry') or getattr(client, 'industry', '') or '').strip()
    language     = request.data.get('language', 'English')

    ai = AIClient(client=client, user=request.user, feature='report_write')
    cfg = prompts.build('report_writer',
                        metrics_snapshot=snap,
                        business_name=client.company or '',
                        period_label=period,
                        period_start=period_start,
                        period_end=period_end,
                        insights=_recent_insights(client, days=days),
                        industry=industry,
                        language=language)
    try:
        raw = ai.extract_json(
            cfg['user_message'],
            system=cfg['system'],
            max_tokens=cfg['max_tokens'],
            temperature=cfg['temperature'],
        )
    except (AIError, RateLimited) as e:
        return _error_response(e, 'report-write failed')

    report = report_writer.coerce_result(raw)
    report.update({
        'period':       period,
        'period_days':  days,
        'period_start': period_start,
        'period_end':   period_end,
        'client':       client.company or '',
        'generated_at': timezone.now().isoformat(),
    })
    return Response(report)


# ─────────────────────────────────────────────────────────────────────────
# 2. POST /ai/v2/report-narrate
# ─────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def report_narrate(request):
    """
    Generate short narrative paragraphs for a chart or dashboard section.

    Body: { client_id, days?=30, chart_focus?, paragraphs?=3, language? }
    Returns: { paragraphs: [...], highlights: [...] }

    `chart_focus` is a free-form hint such as "engagement_over_time" or
    "platform_compare" — guides Claude to focus the narrative on that lens.
    """
    client, err = _resolved_client(request)
    if err: return err

    days = max(1, min(int(request.data.get('days', 30) or 30), 90))
    snap = _build_metrics_snapshot(client, days=days)
    if snap.get('total_posts', 0) == 0:
        return Response({
            'paragraphs': [],
            'highlights': [],
            'note': f'No posts in the last {days} days.',
        })

    chart_focus = (request.data.get('chart_focus') or '').strip()
    paragraphs  = max(1, min(int(request.data.get('paragraphs', 3) or 3), 5))

    ai = AIClient(client=client, user=request.user, feature='report_narrate')
    cfg = prompts.build('report_narrator',
                        metrics_snapshot=snap,
                        chart_focus=chart_focus,
                        business_name=client.company or '',
                        paragraphs=paragraphs,
                        language=request.data.get('language', 'English'))
    try:
        raw = ai.extract_json(
            cfg['user_message'], system=cfg['system'],
            max_tokens=cfg['max_tokens'], temperature=cfg['temperature'],
        )
    except (AIError, RateLimited) as e:
        return _error_response(e, 'report-narrate failed')

    return Response({
        **report_narrator.coerce_result(raw),
        'window_days': days,
        'chart_focus': chart_focus or None,
    })
