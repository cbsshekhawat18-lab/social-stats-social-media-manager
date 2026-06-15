# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Competitor tracking API.

ViewSet:
  CompetitorViewSet — CRUD + actions: timeline / posts / insights / snapshot_now

APIView:
  BenchmarkView — POST: compares the client's metrics against avg + top of
                  their competitor pool on a given platform.
"""
from __future__ import annotations

import logging
from datetime import timedelta
from typing import Optional

from django.db.models import Avg, Max, Sum
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .competitor_serializers import (
    CompetitorSerializer, CompetitorSnapshotSerializer,
)
from .models import (
    Client, Competitor, CompetitorSnapshot, DailyMetric,
)
from .tenant_mixins import TenantScopedMixin

logger = logging.getLogger(__name__)


class CompetitorViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    queryset = Competitor.objects.all()
    serializer_class = CompetitorSerializer

    @action(detail=True, methods=['get'])
    def timeline(self, request, pk=None):
        """
        Historical snapshots for charting. ?platform= and ?days=N filter
        the result; default last 90 days, all platforms.
        """
        competitor = self.get_object()
        days = max(1, min(int(request.query_params.get('days') or 90), 365))
        cutoff = timezone.now().date() - timedelta(days=days)

        qs = CompetitorSnapshot.objects.filter(
            competitor=competitor, date__gte=cutoff,
        ).order_by('date')
        if request.query_params.get('platform'):
            qs = qs.filter(platform=request.query_params['platform'])

        return Response({
            'competitor':  competitor.name,
            'days':        days,
            'snapshots':   CompetitorSnapshotSerializer(qs, many=True).data,
        })

    @action(detail=True, methods=['get'])
    def posts(self, request, pk=None):
        """
        Top public posts captured during recent snapshots. Returns a flat
        list across all platforms unless ?platform= is specified.
        """
        competitor = self.get_object()
        platform = request.query_params.get('platform')
        days = max(1, min(int(request.query_params.get('days') or 30), 90))
        cutoff = timezone.now().date() - timedelta(days=days)

        qs = CompetitorSnapshot.objects.filter(
            competitor=competitor, date__gte=cutoff,
        )
        if platform:
            qs = qs.filter(platform=platform)

        merged = []
        for snap in qs.order_by('-date'):
            for post in (snap.sample_top_posts or []):
                merged.append({
                    **post,
                    'snapshot_date':  snap.date,
                    'platform':       snap.platform,
                })
        # Best-effort dedupe by post id/permalink
        seen = set()
        out = []
        for p in merged:
            key = p.get('id') or p.get('permalink') or p.get('url')
            if key and key in seen:
                continue
            if key:
                seen.add(key)
            out.append(p)
        return Response({'posts': out[:100]})

    @action(detail=True, methods=['post'])
    def snapshot_now(self, request, pk=None):
        """Manually trigger a snapshot pull for this competitor."""
        from .competitor_tasks import snapshot_one_competitor
        competitor = self.get_object()
        snapshot_one_competitor.delay(competitor.id)
        return Response({'queued': True})

    @action(detail=True, methods=['post'])
    def insights(self, request, pk=None):
        """
        AI-powered analysis of the competitor's content patterns (last 30 days).
        Returns {summary, strengths[], opportunities[], top_themes[]}.
        """
        from .ai_helpers import get_claude, parse_json_response, HAIKU
        competitor = self.get_object()

        cutoff = timezone.now().date() - timedelta(days=30)
        snapshots = list(CompetitorSnapshot.objects.filter(
            competitor=competitor, date__gte=cutoff,
        ).order_by('date'))

        if not snapshots:
            return Response({
                'detail': 'No snapshots in the last 30 days. '
                          'Run "Sync now" first or wait for the daily job.',
            }, status=400)

        claude = get_claude()
        if not claude:
            return Response({'detail': 'AI service is not configured.'}, status=503)

        # Build a compact prompt
        platform_summary = {}
        sample_posts = []
        for s in snapshots:
            ps = platform_summary.setdefault(s.platform, {
                'first_followers': s.followers, 'last_followers': s.followers,
                'first_date': s.date, 'last_date': s.date,
                'avg_engagement': 0, 'samples': 0,
            })
            ps['last_followers'] = s.followers
            ps['last_date'] = s.date
            ps['avg_engagement'] += s.engagement_rate or 0
            ps['samples'] += 1
            for p in (s.sample_top_posts or [])[:3]:
                sample_posts.append({
                    'platform': s.platform,
                    'date':     str(s.date),
                    'caption':  (p.get('caption') or p.get('title') or '')[:280],
                    'likes':    p.get('likes'),
                })

        for k, v in platform_summary.items():
            v['avg_engagement'] = round(v['avg_engagement'] / max(1, v['samples']), 3)
            v['follower_delta'] = v['last_followers'] - v['first_followers']

        try:
            msg = claude.messages.create(
                model=HAIKU, max_tokens=1500, timeout=30,
                system=(
                    'You analyse competitor social media accounts. Output ONLY '
                    'valid JSON. Be concrete and specific — pull from the data '
                    'provided, do not speculate beyond it.'
                ),
                messages=[{
                    'role': 'user',
                    'content': (
                        f'Competitor: {competitor.name}\n\n'
                        f'Per-platform summary (30 days):\n{platform_summary}\n\n'
                        f'Sample posts ({len(sample_posts)} captured):\n'
                        + '\n'.join(
                            f"- [{p['platform']} {p['date']}] {p.get('likes', '?')} likes — {p['caption']}"
                            for p in sample_posts[:30]
                        )
                        + '\n\n'
                        'Return EXACTLY this JSON:\n'
                        '{"summary": "<2-3 sentence overview>", '
                        ' "strengths": ["<short bullet>", "<bullet>"], '
                        ' "opportunities": ["<bullet>", "<bullet>"], '
                        ' "top_themes": ["<theme>", "<theme>"]}'
                    ),
                }],
            )
            out = parse_json_response(msg.content[0].text)
        except Exception as e:
            logger.exception('Competitor insights AI call failed')
            return Response({'detail': f'AI error: {e}'}, status=502)

        return Response({
            'competitor_id': competitor.id,
            'name':          competitor.name,
            'platform_summary': platform_summary,
            **out,
        })


class BenchmarkView(APIView):
    """
    POST: compare a client's metric (last N days) against average + top of
    their competitors on a platform.

    Body: {client_id?, platform, metric?: 'reach' | 'followers' | 'engagement_rate', days?: 30}
    Returns: {client: stat, avg: stat, top: stat, rank: int|null, total_competitors: int}
    """
    def post(self, request):
        try:
            profile = request.user.profile
        except Exception:
            return Response({'error': 'No profile'}, status=403)

        client_id = (request.data.get('client_id')
                     or request.query_params.get('client_id')
                     or profile.client_id)
        if profile.role == 'client':
            client_id = profile.client_id
        elif profile.role == 'staff':
            try:
                cid = int(client_id) if client_id else None
            except (TypeError, ValueError):
                cid = None
            if not cid or not profile.assigned_clients.filter(id=cid).exists():
                return Response({'error': 'client_id required'}, status=400)
            client_id = cid
        if not client_id:
            return Response({'error': 'client_id required'}, status=400)

        platform = (request.data.get('platform') or '').strip()
        metric   = (request.data.get('metric') or 'engagement_rate').strip()
        days     = max(1, min(int(request.data.get('days') or 30), 90))
        if not platform:
            return Response({'error': 'platform is required'}, status=400)

        try:
            client = Client.objects.get(id=client_id)
        except Client.DoesNotExist:
            return Response({'error': 'Client not found'}, status=404)

        cutoff = timezone.now().date() - timedelta(days=days)

        # ── Client's value ──────────────────────────────────────────
        client_val = _client_metric(client, platform, metric, cutoff)

        # ── Competitors' values from their snapshots ────────────────
        competitors = list(client.competitors.all())
        comp_values = []
        for c in competitors:
            v = _competitor_metric(c, platform, metric, cutoff)
            if v is not None:
                comp_values.append({'name': c.name, 'value': v})

        if not comp_values:
            return Response({
                'client':            {'value': client_val},
                'competitors':       [],
                'avg':               None,
                'top':               None,
                'rank':              None,
                'total_competitors': 0,
                'note':              'No competitor snapshots yet — run "Sync now" '
                                     'or wait for the daily job.',
            })

        sorted_pool = sorted(comp_values + [{'name': '__client__', 'value': client_val or 0}],
                              key=lambda x: x['value'], reverse=True)
        rank = next((i + 1 for i, x in enumerate(sorted_pool) if x['name'] == '__client__'),
                    None)

        avg = round(sum(c['value'] for c in comp_values) / len(comp_values), 3)
        top = max(c['value'] for c in comp_values)

        return Response({
            'client':             {'value': client_val},
            'competitors':        comp_values,
            'avg':                avg,
            'top':                top,
            'rank':               rank,
            'total_competitors':  len(comp_values),
            'metric':             metric,
            'platform':           platform,
            'days':               days,
        })


# ── Helpers ──────────────────────────────────────────────────────────────────
def _client_metric(client, platform, metric, cutoff):
    qs = DailyMetric.objects.filter(client=client, platform=platform, date__gte=cutoff)
    if not qs.exists():
        return None
    if metric == 'reach':
        return qs.aggregate(s=Sum('reach'))['s'] or 0
    if metric == 'followers':
        return qs.aggregate(m=Max('followers'))['m'] or 0
    if metric == 'engagement_rate':
        v = qs.aggregate(a=Avg('engagement_rate'))['a']
        return round(float(v or 0), 3)
    if metric in ('impressions', 'video_views'):
        v = qs.aggregate(s=Sum(metric))['s']
        return v or 0
    return None


def _competitor_metric(competitor, platform, metric, cutoff):
    qs = CompetitorSnapshot.objects.filter(
        competitor=competitor, platform=platform, date__gte=cutoff,
    )
    if not qs.exists():
        return None
    if metric in ('engagement_rate',):
        v = qs.aggregate(a=Avg(metric))['a']
        return round(float(v or 0), 3)
    if metric == 'followers':
        return qs.aggregate(m=Max('followers'))['m'] or 0
    if metric == 'posts':
        v = qs.aggregate(a=Avg('posts_count'))['a']
        return round(float(v or 0), 1)
    return None
