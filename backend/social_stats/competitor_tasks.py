# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Daily snapshot job for competitor tracking.

For each Competitor, the per-platform helpers below try to fetch public
metrics. Each helper is best-effort — missing config or unsupported
platforms log + skip rather than crash the whole pass.

Currently implemented:
  - YouTube: public Channels.list via Social Stats's GOOGLE_API_KEY (no OAuth needed)
  - Facebook: public Page lookup via app token (META_APP_ID + secret)

Stubs (logged + skipped — require additional setup):
  - Instagram (private without auth)
  - LinkedIn (organization API requires per-org grants)
  - GMB (no public competitor lookup — listings come via Place IDs separately)
"""
from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Optional

import requests
from celery import shared_task
from django.conf import settings
from django.utils import timezone

from .models import Competitor, CompetitorSnapshot

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = (8, 20)


# ── Top-level entry points ───────────────────────────────────────────────────
@shared_task(bind=True)
def snapshot_competitors(self):
    """Daily fan-out: queue a snapshot job per Competitor."""
    qs = Competitor.objects.only('id')
    queued = 0
    for c in qs.iterator():
        snapshot_one_competitor.delay(c.id)
        queued += 1
    if queued:
        logger.info('snapshot_competitors queued %s jobs', queued)
    return queued


@shared_task(bind=True, max_retries=2, default_retry_delay=300)
def snapshot_one_competitor(self, competitor_id: int):
    """Snapshot one Competitor across every supported platform."""
    try:
        competitor = Competitor.objects.get(id=competitor_id)
    except Competitor.DoesNotExist:
        return 0

    handles = competitor.public_handles or {}
    today = timezone.now().date()
    written = 0

    for platform, handle in handles.items():
        if not handle:
            continue
        try:
            data = _fetch_for_platform(platform, handle)
        except Exception:
            logger.exception('snapshot fetch failed competitor=%s platform=%s',
                             competitor.id, platform)
            data = None
        if not data:
            continue
        _persist_snapshot(competitor, platform, today, data)
        written += 1

    competitor.last_synced_at = timezone.now()
    competitor.save(update_fields=['last_synced_at'])
    if written:
        _update_follower_history(competitor, today)
    return written


# ── Per-platform fetchers ────────────────────────────────────────────────────
def _fetch_for_platform(platform: str, handle: str) -> Optional[dict]:
    p = (platform or '').lower()
    if p == 'youtube':
        return _fetch_youtube(handle)
    if p == 'facebook':
        return _fetch_facebook(handle)
    if p in ('instagram', 'linkedin', 'google_my_business'):
        logger.debug('Snapshot for %s not implemented (handle=%s)', p, handle)
        return None
    return None


def _fetch_youtube(channel_id_or_handle: str) -> Optional[dict]:
    """
    Public YouTube channel data — needs a Google API key (browser-restricted
    works fine when called from server with allowed IP). Falls back to None if
    the key is missing or the channel can't be resolved.
    """
    api_key = getattr(settings, 'YOUTUBE_API_KEY', '') or getattr(settings, 'GOOGLE_API_KEY', '')
    if not api_key:
        logger.debug('YouTube competitor snapshot skipped — no API key configured')
        return None

    handle = (channel_id_or_handle or '').strip()
    params = {'part': 'snippet,statistics', 'key': api_key}
    if handle.startswith('UC'):
        params['id'] = handle
    elif handle.startswith('@'):
        params['forHandle'] = handle
    else:
        params['forUsername'] = handle.lstrip('@')

    try:
        resp = requests.get(
            'https://www.googleapis.com/youtube/v3/channels',
            params=params, timeout=DEFAULT_TIMEOUT,
        )
    except requests.RequestException as e:
        logger.warning('YouTube snapshot network error: %s', e)
        return None
    if resp.status_code != 200:
        logger.warning('YouTube snapshot status=%s body=%s', resp.status_code, resp.text[:200])
        return None

    items = (resp.json() or {}).get('items') or []
    if not items:
        return None
    stats = items[0].get('statistics') or {}
    snippet = items[0].get('snippet') or {}
    followers = int(stats.get('subscriberCount') or 0)
    posts_count = int(stats.get('videoCount') or 0)
    views = int(stats.get('viewCount') or 0)
    avg_views = round(views / posts_count, 1) if posts_count else 0
    return {
        'followers':    followers,
        'posts_count':  posts_count,
        'engagement_rate': 0.0,  # YouTube doesn't expose like-rate publicly
        'avg_likes':    0,
        'avg_comments': 0,
        'sample_top_posts': [],
        'raw': {'avg_views': avg_views, 'title': snippet.get('title', '')},
    }


def _fetch_facebook(page_id_or_username: str) -> Optional[dict]:
    """
    Public Facebook Page lookup via app token. Returns fan_count + recent
    public posts when reachable.
    """
    app_id = getattr(settings, 'META_APP_ID', '')
    app_secret = getattr(settings, 'META_APP_SECRET', '')
    if not app_id or not app_secret:
        logger.debug('FB competitor snapshot skipped — no app credentials')
        return None
    app_token = f'{app_id}|{app_secret}'

    handle = (page_id_or_username or '').strip().lstrip('@')
    try:
        resp = requests.get(
            f'https://graph.facebook.com/v21.0/{handle}',
            params={'fields': 'name,fan_count,about,category', 'access_token': app_token},
            timeout=DEFAULT_TIMEOUT,
        )
    except requests.RequestException as e:
        logger.warning('FB snapshot network error: %s', e)
        return None
    if resp.status_code != 200:
        logger.info('FB snapshot status=%s for %s', resp.status_code, handle)
        return None

    body = resp.json() or {}
    return {
        'followers':    int(body.get('fan_count') or 0),
        'posts_count':  0,  # public posts list requires user token
        'engagement_rate': 0.0,
        'avg_likes':    0,
        'avg_comments': 0,
        'sample_top_posts': [],
        'raw': {'name': body.get('name', ''), 'category': body.get('category', '')},
    }


# ── Persistence ──────────────────────────────────────────────────────────────
def _persist_snapshot(competitor, platform: str, today: date, data: dict):
    CompetitorSnapshot.objects.update_or_create(
        competitor=competitor, platform=platform, date=today,
        defaults={
            'followers':       data.get('followers', 0),
            'posts_count':     data.get('posts_count', 0),
            'engagement_rate': data.get('engagement_rate', 0.0),
            'avg_likes':       data.get('avg_likes', 0),
            'avg_comments':    data.get('avg_comments', 0),
            'sample_top_posts': data.get('sample_top_posts') or [],
            'raw':             data.get('raw') or {},
        },
    )


def _update_follower_history(competitor, today: date):
    """Append today's follower count to the per-platform follower_history blob."""
    today_iso = today.isoformat()
    history = dict(competitor.follower_history or {})
    snaps = CompetitorSnapshot.objects.filter(competitor=competitor, date=today)
    for s in snaps:
        series = list(history.get(s.platform) or [])
        # Replace today's entry if already present
        series = [pt for pt in series if pt.get('date') != today_iso]
        series.append({'date': today_iso, 'n': s.followers})
        # Cap to last 365 entries to avoid unbounded growth
        history[s.platform] = series[-365:]
    competitor.follower_history = history
    competitor.save(update_fields=['follower_history'])
