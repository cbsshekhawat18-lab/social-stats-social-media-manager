# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Cross-platform Audience Insights API.

Endpoint:
  GET /api/audience/unified/  — aggregates across every platform connected
                                 to the resolved client.

Returns:
  {
    'days':         <int>,
    'totals':       {reach, impressions, followers, video_views, engagement_rate},
    'by_platform':  {platform: {reach, impressions, followers, posts}},
    'active_hours': 7×24 heatmap of post engagement (sum of reactions),
    'top_content_types': {platform: [{post_type, score, samples}, ...]},
    'demographics': {<status: 'data_unavailable'>}
  }

Demographics intentionally returns a `data_unavailable` marker — extracting
age/gender/location requires per-platform Audience Insights API calls
(Facebook Page Insights, Instagram demographics, etc.) which need their own
sync layer. Frontend renders an explanatory placeholder.
"""
from __future__ import annotations

from datetime import timedelta
from typing import Optional

from django.db.models import Avg, Max, Sum
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Client, DailyMetric, PostMetric


class UnifiedAudienceView(APIView):
    """GET /api/audience/unified/?days=30"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            profile = request.user.profile
        except Exception:
            return Response({'error': 'No profile'}, status=403)

        # Resolve target client
        cid = request.query_params.get('client_id')
        if profile.role == 'superadmin':
            try:
                client_id = int(cid) if cid else profile.client_id
            except (TypeError, ValueError):
                client_id = None
        elif profile.role == 'staff':
            try:
                client_id = int(cid) if cid else None
            except (TypeError, ValueError):
                client_id = None
            if not client_id or not profile.assigned_clients.filter(id=client_id).exists():
                return Response({'error': 'client_id required'}, status=400)
        else:
            client_id = profile.client_id
        if not client_id:
            return Response({'error': 'client_id required'}, status=400)

        try:
            client = Client.objects.get(id=client_id)
        except Client.DoesNotExist:
            return Response({'error': 'Client not found'}, status=404)

        days = max(1, min(int(request.query_params.get('days') or 30), 365))
        cutoff = timezone.now().date() - timedelta(days=days)

        # ── Totals + per-platform breakdown ──────────────────────────────
        daily = DailyMetric.objects.filter(client=client, date__gte=cutoff)
        totals = daily.aggregate(
            reach=Sum('reach'),
            impressions=Sum('impressions'),
            video_views=Sum('video_views'),
            followers_max=Max('followers'),
            engagement_rate_avg=Avg('engagement_rate'),
        )
        totals = {
            'reach':            totals['reach'] or 0,
            'impressions':      totals['impressions'] or 0,
            'video_views':      totals['video_views'] or 0,
            'followers_max':    totals['followers_max'] or 0,
            'engagement_rate':  round(float(totals['engagement_rate_avg'] or 0), 3),
        }

        by_platform = {}
        for row in (daily.values('platform').annotate(
            reach=Sum('reach'),
            impressions=Sum('impressions'),
            followers=Max('followers'),
            video_views=Sum('video_views'),
            engagement_rate=Avg('engagement_rate'),
        )):
            by_platform[row['platform']] = {
                'reach':           row['reach'] or 0,
                'impressions':     row['impressions'] or 0,
                'followers':       row['followers'] or 0,
                'video_views':     row['video_views'] or 0,
                'engagement_rate': round(float(row['engagement_rate'] or 0), 3),
            }

        # ── Active-hours heatmap (when does the audience engage?) ────────
        # 7×24 grid of (day_of_week × hour) → sum of (likes + comments + shares)
        # over posts published in the window. Approximates "when audience is
        # online" using the response curve to OUR posting times.
        post_qs = PostMetric.objects.filter(
            client=client,
            published_at__date__gte=cutoff,
            published_at__isnull=False,
        ).only('published_at', 'likes', 'comments', 'shares', 'reach', 'platform', 'post_type')

        heatmap = [[0] * 24 for _ in range(7)]
        post_type_buckets = {}
        sample_counts = [[0] * 24 for _ in range(7)]
        for pm in post_qs.iterator():
            when = pm.published_at
            if not when:
                continue
            dow = when.weekday()
            hr = when.hour
            engagement = ((pm.likes or 0) + (pm.comments or 0) * 2 + (pm.shares or 0) * 3
                          + (pm.reach or 0) // 100)
            heatmap[dow][hr] += engagement
            sample_counts[dow][hr] += 1

            # Top content types per platform
            key = pm.post_type or 'other'
            bucket = post_type_buckets.setdefault(pm.platform, {})
            entry = bucket.setdefault(key, {'score': 0, 'samples': 0})
            entry['score'] += engagement
            entry['samples'] += 1

        # Normalize heatmap to 0..1 for the frontend
        max_cell = max((max(row) for row in heatmap), default=0) or 1
        normalized = [[round(cell / max_cell, 3) for cell in row] for row in heatmap]

        # Top content types: sorted by score desc, top 5 per platform
        top_content_types = {}
        for platform, types in post_type_buckets.items():
            ranked = sorted(
                ({'post_type': k, 'score': v['score'], 'samples': v['samples'],
                  'avg_score': round(v['score'] / max(1, v['samples']), 1)}
                 for k, v in types.items()),
                key=lambda x: x['avg_score'], reverse=True,
            )[:5]
            top_content_types[platform] = ranked

        return Response({
            'days':        days,
            'totals':      totals,
            'by_platform': by_platform,
            'active_hours': {
                'heatmap':       normalized,
                'sample_counts': sample_counts,
                'max':           max_cell,
            },
            'top_content_types': top_content_types,
            'demographics': {
                'status': 'data_unavailable',
                'note': (
                    'Demographics (age, gender, location) require per-platform '
                    'Audience Insights sync. Facebook Page Insights and '
                    'Instagram audience endpoints are next on the roadmap.'
                ),
            },
        })
