# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Smart notification watchers — Celery beat tasks that scan recent metrics and
dispatch alerts.

Implemented:
  detect_viral_posts        — engagement > 2× the client's recent average
  detect_token_expiring     — credentials expiring in <= 7 days
  detect_follower_milestones — followers crossing 1k/10k/100k/1M thresholds
  detect_engagement_drop    — week-over-week ≥30% decline (per platform)

Each watcher is idempotent via dedup keys on the Alert model + cache flags
(so we don't fire the same notification twice in a row).
"""
from __future__ import annotations

import logging
from datetime import timedelta

from celery import shared_task
from django.contrib.auth.models import User
from django.core.cache import cache
from django.db.models import Avg, F, Sum
from django.utils import timezone

from .models import (
    Client, PlatformCredential, PostMetric, DailyMetric, Alert,
    UnifiedPost,
)
from .notification_dispatch import dispatch_notification
from .audit import log_action

logger = logging.getLogger(__name__)


# ── Public top-level tasks ───────────────────────────────────────────────────
@shared_task(bind=True)
def run_smart_notifications(self):
    """Beat task — runs all watchers in sequence."""
    out = {}
    out['viral'] = detect_viral_posts.delay().id
    out['expiring'] = detect_token_expiring.delay().id
    out['milestone'] = detect_follower_milestones.delay().id
    out['engagement'] = detect_engagement_drop.delay().id
    return out


# ── Viral post detector ──────────────────────────────────────────────────────
@shared_task(bind=True)
def detect_viral_posts(self, threshold_multiplier: float = 2.0,
                        lookback_days: int = 14):
    """
    Compare each post published in the last 24h against the rolling average
    engagement (last `lookback_days`). Anything with engagement ≥ threshold ×
    average fires a single 'viral_post' notification.
    """
    cutoff_recent = timezone.now() - timedelta(hours=24)
    cutoff_avg    = timezone.now() - timedelta(days=lookback_days)

    fired = 0
    for client in Client.objects.iterator():
        avg = PostMetric.objects.filter(
            client=client, published_at__gte=cutoff_avg, published_at__lt=cutoff_recent,
        ).aggregate(avg_eng=Avg(_engagement_expr()))['avg_eng']
        if not avg or avg < 1:
            continue

        recent = PostMetric.objects.filter(
            client=client, published_at__gte=cutoff_recent,
        )
        for p in recent.iterator():
            engagement = ((p.likes or 0) + (p.comments or 0) * 2 +
                          (p.shares or 0) * 3 + (p.saves or 0) * 2)
            if engagement < avg * threshold_multiplier:
                continue
            cache_key = f'viral:{client.id}:{p.id}'
            if cache.get(cache_key):
                continue
            cache.set(cache_key, 1, timeout=60 * 60 * 48)

            recipients = _client_recipients(client)
            dispatch_notification(
                recipients=recipients, event_type='viral_post', client=client,
                title=f'🔥 Viral post on {p.platform}',
                body=f'A post is performing {round(engagement / avg, 1)}× '
                     f'your recent average.',
                data={'platform': p.platform, 'post_id': p.post_id,
                      'engagement': engagement},
            )
            Alert.objects.create(
                client=client, platform=p.platform, alert_type='viral_post',
                message=f'Viral on {p.platform}: {round(engagement / avg, 1)}× avg engagement',
                dedup_key=f'viral:{p.platform}:{p.post_id}',
            )
            fired += 1
    return fired


def _engagement_expr():
    # Used inside Avg(...). Constant fallback when the model is missing fields.
    return F('likes') + F('comments') * 2 + F('shares') * 3 + F('saves') * 2


# ── Token-expiring watcher ──────────────────────────────────────────────────
@shared_task(bind=True)
def detect_token_expiring(self, warn_days: int = 7):
    """One alert per (client, platform, day) for credentials expiring soon."""
    now = timezone.now()
    cutoff = now + timedelta(days=warn_days)

    qs = PlatformCredential.objects.filter(
        is_active=True,
        expires_at__isnull=False,
        expires_at__lte=cutoff,
        expires_at__gt=now,
    ).select_related('client')

    fired = 0
    for cred in qs.iterator():
        days = (cred.expires_at - now).days
        dedup = f'expiring:{cred.platform}:{cred.id}:{now.date()}'
        if Alert.objects.filter(dedup_key=dedup).exists():
            continue

        recipients = _client_recipients(cred.client)
        dispatch_notification(
            recipients=recipients, event_type='token_expiring',
            client=cred.client,
            title=f'⚠️ {cred.platform} token expires in {days} day(s)',
            body=f'Reconnect your {cred.platform} account to keep '
                 f'publishing without interruption.',
            data={'platform': cred.platform, 'credential_id': cred.id,
                  'days_remaining': days},
        )
        Alert.objects.create(
            client=cred.client, platform=cred.platform, alert_type='token_expired',
            message=f'{cred.platform} token expires in {days} day(s) — please reconnect.',
            dedup_key=dedup,
        )
        fired += 1
    return fired


# ── Follower milestones ──────────────────────────────────────────────────────
MILESTONES = [1_000, 5_000, 10_000, 25_000, 50_000, 100_000, 500_000, 1_000_000]


@shared_task(bind=True)
def detect_follower_milestones(self):
    """
    Scan the latest DailyMetric per (client × platform) and fire an alert when
    a milestone has been crossed since the previous day.
    """
    today = timezone.now().date()
    yesterday = today - timedelta(days=1)
    fired = 0

    for client in Client.objects.iterator():
        latest = DailyMetric.objects.filter(client=client, date=today).only(
            'platform', 'followers',
        )
        if not latest.exists():
            continue
        for row in latest:
            prev_count = (DailyMetric.objects
                          .filter(client=client, platform=row.platform,
                                  date__lt=today, followers__gt=0)
                          .order_by('-date').values_list('followers', flat=True)
                          .first()) or 0
            crossed = next(
                (m for m in MILESTONES if prev_count < m <= (row.followers or 0)),
                None,
            )
            if not crossed:
                continue
            dedup = f'milestone:{client.id}:{row.platform}:{crossed}'
            if Alert.objects.filter(dedup_key=dedup).exists():
                continue
            recipients = _client_recipients(client)
            dispatch_notification(
                recipients=recipients, event_type='follower_milestone',
                client=client,
                title=f'🎉 {row.platform} hit {crossed:,} followers',
                body='Time to celebrate — share the milestone with your audience.',
                data={'platform': row.platform, 'milestone': crossed,
                      'followers': row.followers},
            )
            Alert.objects.create(
                client=client, platform=row.platform, alert_type='follower_milestone',
                message=f'{row.platform} crossed {crossed:,} followers',
                dedup_key=dedup,
            )
            fired += 1
    return fired


# ── Engagement drop ─────────────────────────────────────────────────────────
@shared_task(bind=True)
def detect_engagement_drop(self, threshold: float = 0.30):
    """
    Compare last 7 days' avg engagement to the previous 7 days' per platform.
    Fire when the drop is ≥ `threshold` (fraction).
    """
    today = timezone.now().date()
    last_week_start  = today - timedelta(days=7)
    prev_week_start  = today - timedelta(days=14)

    fired = 0
    for client in Client.objects.iterator():
        for platform in PostMetric.objects.filter(client=client).values_list('platform', flat=True).distinct():
            this_avg = (DailyMetric.objects
                        .filter(client=client, platform=platform,
                                date__gte=last_week_start, date__lt=today)
                        .aggregate(a=Avg('engagement_rate'))['a']) or 0
            prev_avg = (DailyMetric.objects
                        .filter(client=client, platform=platform,
                                date__gte=prev_week_start, date__lt=last_week_start)
                        .aggregate(a=Avg('engagement_rate'))['a']) or 0
            if not prev_avg or prev_avg < 0.001:
                continue
            drop = (prev_avg - this_avg) / prev_avg
            if drop < threshold:
                continue
            dedup = f'drop:{client.id}:{platform}:{today.isoformat()}'
            if Alert.objects.filter(dedup_key=dedup).exists():
                continue

            recipients = _client_recipients(client)
            dispatch_notification(
                recipients=recipients, event_type='engagement_drop',
                client=client,
                title=f'📉 {platform} engagement dropped {round(drop * 100)}%',
                body='Week-over-week engagement is down sharply. '
                     'Consider revisiting content mix or posting cadence.',
                data={'platform': platform, 'drop_percent': round(drop * 100, 1),
                      'this_week': round(this_avg, 3), 'prev_week': round(prev_avg, 3)},
            )
            Alert.objects.create(
                client=client, platform=platform, alert_type='reach_drop',
                message=f'{platform} engagement down {round(drop * 100)}% week-over-week',
                dedup_key=dedup,
            )
            fired += 1
    return fired


# ── Approval-pending notification ────────────────────────────────────────────
@shared_task(bind=True)
def notify_approver_for_post(self, unified_post_id: int):
    """Called when a UnifiedPost moves to status='pending_approval'."""
    try:
        post = UnifiedPost.objects.select_related('client').get(id=unified_post_id)
    except UnifiedPost.DoesNotExist:
        return

    if post.status != 'pending_approval':
        return

    # Approvers = superadmin + staff assigned to this client
    from .models import UserProfile
    profiles = UserProfile.objects.filter(role__in=('superadmin', 'staff'))
    approvers = []
    for p in profiles:
        if p.role == 'superadmin' or p.assigned_clients.filter(id=post.client_id).exists():
            approvers.append(p.user)

    if not approvers:
        logger.info('notify_approver_for_post: no approvers found for client=%s', post.client_id)
        return

    dispatch_notification(
        recipients=approvers, event_type='approval_pending',
        client=post.client,
        title='Post needs your approval',
        body=f'"{post.title or post.content[:80]}" is waiting for review '
             f'before publishing on {", ".join(post.target_platforms or [])}.',
        data={'unified_post_id': post.id, 'created_by': post.created_by_id},
    )
    log_action(post.created_by, post.client, 'approval.requested',
               object_type='UnifiedPost', object_id=post.id,
               result='success',
               details={'title': post.title, 'platforms': post.target_platforms})


# ── Helpers ──────────────────────────────────────────────────────────────────
def _client_recipients(client: Client):
    """Resolve the User accounts that should receive a tenant alert."""
    from .models import UserProfile
    profiles = UserProfile.objects.filter(client=client)
    out = list(User.objects.filter(profile__in=profiles, is_active=True))
    # Also include any staff assigned to this client
    staff_profiles = UserProfile.objects.filter(role='staff', assigned_clients=client)
    out.extend(User.objects.filter(profile__in=staff_profiles, is_active=True))
    # Dedup
    seen, uniq = set(), []
    for u in out:
        if u.id not in seen:
            seen.add(u.id)
            uniq.append(u)
    return uniq
