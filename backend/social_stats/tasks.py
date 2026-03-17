"""
Celery tasks — auto-sync all 5 platforms every few hours.
"""
import logging
import requests
from datetime import date, timedelta
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


def _date_range(days=30):
    today = date.today()
    return today - timedelta(days=days), today - timedelta(days=1)


def _refresh_google_token(cred):
    """Use refresh_token to get a new Google access_token."""
    from django.conf import settings
    resp = requests.post('https://oauth2.googleapis.com/token', data={
        'client_id':     settings.GOOGLE_CLIENT_ID,
        'client_secret': settings.GOOGLE_CLIENT_SECRET,
        'refresh_token': cred.refresh_token,
        'grant_type':    'refresh_token',
    }, timeout=10).json()
    if 'access_token' in resp:
        cred.access_token = resp['access_token']
        cred.expires_at   = timezone.now() + timedelta(seconds=resp.get('expires_in', 3600))
        cred.save(update_fields=['access_token', 'expires_at'])
    return cred.access_token


# ── Facebook ──────────────────────────────────────────────────────────────────
@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def sync_facebook(self, client_id, days=30):
    from .models import Client, PlatformCredential, DailyMetric, SyncLog
    log = SyncLog.objects.create(platform='facebook', client_id=client_id, status='running')
    try:
        cred  = PlatformCredential.objects.get(client_id=client_id, platform='facebook', is_active=True)
        since, until = _date_range(days)

        insights = requests.get(
            f"https://graph.facebook.com/v18.0/{cred.page_id}/insights",
            params={
                'metric': 'page_impressions,page_impressions_unique,page_post_engagements,page_views_total,page_fan_adds,page_consumptions',
                'period': 'day',
                'since':  since.isoformat(),
                'until':  (until + timedelta(days=1)).isoformat(),
                'access_token': cred.access_token,
            }, timeout=15
        ).json()

        daily = {}
        metric_map = {
            'page_impressions':        'impressions',
            'page_impressions_unique': 'reach',
            'page_post_engagements':   'likes',
            'page_views_total':        'profile_views',
            'page_fan_adds':           'followers',
            'page_consumptions':       'clicks',
        }
        for m in insights.get('data', []):
            key = metric_map.get(m['name'])
            if not key: continue
            for v in m.get('values', []):
                day = v['end_time'][:10]
                daily.setdefault(day, {})[key] = v['value']

        count = 0
        for day_str, vals in daily.items():
            DailyMetric.objects.update_or_create(
                client_id=client_id, platform='facebook', date=day_str,
                defaults=vals
            )
            count += 1

        log.status = 'success'; log.records_synced = count
    except Exception as e:
        log.status = 'failed'; log.error_message = str(e)
        raise self.retry(exc=e)
    finally:
        log.finished_at = timezone.now(); log.save()


# ── Instagram ─────────────────────────────────────────────────────────────────
@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def sync_instagram(self, client_id, days=30):
    from .models import PlatformCredential, DailyMetric, PostMetric, SyncLog
    log = SyncLog.objects.create(platform='instagram', client_id=client_id, status='running')
    try:
        cred  = PlatformCredential.objects.get(client_id=client_id, platform='instagram', is_active=True)
        since, until = _date_range(days)

        insights = requests.get(
            f"https://graph.facebook.com/v18.0/{cred.instagram_account_id}/insights",
            params={
                'metric': 'impressions,reach,profile_views,website_clicks,follower_count',
                'period': 'day',
                'since':  since.isoformat(),
                'until':  (until + timedelta(days=1)).isoformat(),
                'access_token': cred.access_token,
            }, timeout=15
        ).json()

        daily = {}
        for m in insights.get('data', []):
            name = m['name']
            for v in m.get('values', []):
                day = v['end_time'][:10]
                daily.setdefault(day, {})[name] = v['value']

        count = 0
        for day_str, vals in daily.items():
            DailyMetric.objects.update_or_create(
                client_id=client_id, platform='instagram', date=day_str,
                defaults={
                    'impressions':   vals.get('impressions', 0),
                    'reach':         vals.get('reach', 0),
                    'profile_views': vals.get('profile_views', 0),
                    'website_clicks':vals.get('website_clicks', 0),
                    'followers':     vals.get('follower_count', 0),
                }
            )
            count += 1

        # Per-post metrics
        posts = requests.get(
            f"https://graph.facebook.com/v18.0/{cred.instagram_account_id}/media",
            params={
                'fields': 'id,caption,media_type,permalink,timestamp',
                'limit':  25,
                'access_token': cred.access_token,
            }, timeout=15
        ).json()

        for post in posts.get('data', []):
            try:
                pi = requests.get(
                    f"https://graph.facebook.com/v18.0/{post['id']}/insights",
                    params={
                        'metric': 'impressions,reach,likes,comments,saved,video_views,shares',
                        'access_token': cred.access_token,
                    }, timeout=10
                ).json()
                m = {x['name']: x['values'][0]['value'] for x in pi.get('data', [])}
                PostMetric.objects.update_or_create(
                    client_id=client_id, platform='instagram', post_id=post['id'],
                    defaults={
                        'post_url':    post.get('permalink', ''),
                        'post_type':   post.get('media_type', '').lower(),
                        'caption':     post.get('caption', '')[:500],
                        'published_at':post.get('timestamp'),
                        'impressions': m.get('impressions', 0),
                        'reach':       m.get('reach', 0),
                        'likes':       m.get('likes', 0),
                        'comments':    m.get('comments', 0),
                        'saves':       m.get('saved', 0),
                        'video_views': m.get('video_views', 0),
                        'shares':      m.get('shares', 0),
                    }
                )
            except Exception:
                pass

        log.status = 'success'; log.records_synced = count
    except Exception as e:
        log.status = 'failed'; log.error_message = str(e)
        raise self.retry(exc=e)
    finally:
        log.finished_at = timezone.now(); log.save()


# ── YouTube ───────────────────────────────────────────────────────────────────
@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def sync_youtube(self, client_id, days=30):
    from .models import PlatformCredential, DailyMetric, SyncLog
    log = SyncLog.objects.create(platform='youtube', client_id=client_id, status='running')
    try:
        cred  = PlatformCredential.objects.get(client_id=client_id, platform='youtube', is_active=True)
        if cred.is_expired:
            _refresh_google_token(cred)

        since, until = _date_range(days)

        analytics = requests.get(
            'https://youtubeanalytics.googleapis.com/v2/reports',
            params={
                'ids':        f'channel=={cred.channel_id}',
                'startDate':   since.isoformat(),
                'endDate':     until.isoformat(),
                'metrics':    'views,estimatedMinutesWatched,subscribersGained,subscribersLost,likes,comments,shares,impressions,impressionClickThroughRate,averageViewDuration',
                'dimensions': 'day',
                'sort':       'day',
            },
            headers={'Authorization': f'Bearer {cred.access_token}'},
            timeout=15
        ).json()

        rows    = analytics.get('rows', [])
        headers = [h['name'] for h in analytics.get('columnHeaders', [])]
        count   = 0

        for row in rows:
            data = dict(zip(headers, row))
            DailyMetric.objects.update_or_create(
                client_id=client_id, platform='youtube', date=data['day'],
                defaults={
                    'video_views': int(data.get('views', 0)),
                    'impressions': int(data.get('impressions', 0)),
                    'likes':       int(data.get('likes', 0)),
                    'comments':    int(data.get('comments', 0)),
                    'shares':      int(data.get('shares', 0)),
                    'followers':   int(data.get('subscribersGained', 0)),
                    'ctr':         float(data.get('impressionClickThroughRate', 0)),
                }
            )
            count += 1

        log.status = 'success'; log.records_synced = count
    except Exception as e:
        log.status = 'failed'; log.error_message = str(e)
        raise self.retry(exc=e)
    finally:
        log.finished_at = timezone.now(); log.save()


# ── LinkedIn ──────────────────────────────────────────────────────────────────
@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def sync_linkedin(self, client_id, days=30):
    from .models import PlatformCredential, DailyMetric, SyncLog
    import time
    log = SyncLog.objects.create(platform='linkedin', client_id=client_id, status='running')
    try:
        cred  = PlatformCredential.objects.get(client_id=client_id, platform='linkedin', is_active=True)
        since, until = _date_range(days)
        org_urn = f"urn:li:organization:{cred.organization_id}"

        since_ms = int(time.mktime(since.timetuple())) * 1000
        until_ms = int(time.mktime(until.timetuple())) * 1000

        stats = requests.get(
            'https://api.linkedin.com/v2/organizationPageStatistics',
            params={
                'q':           'organization',
                'organization': org_urn,
                'timeIntervals.timeGranularityType': 'DAY',
                'timeIntervals.timeRange.start':     since_ms,
                'timeIntervals.timeRange.end':       until_ms,
            },
            headers={'Authorization': f'Bearer {cred.access_token}'},
            timeout=15
        ).json()

        count = 0
        for el in stats.get('elements', []):
            ts    = el.get('timeRange', {}).get('start', 0)
            day   = date.fromtimestamp(ts / 1000).isoformat()
            views = el.get('totalPageStatistics', {})
            DailyMetric.objects.update_or_create(
                client_id=client_id, platform='linkedin', date=day,
                defaults={
                    'impressions':    views.get('views', {}).get('allPageViews', {}).get('pageViews', 0),
                    'clicks':         views.get('clicks', {}).get('allClicks', {}).get('totalClicks', 0),
                    'followers':      views.get('followersGained', 0),
                    'engagement_rate':views.get('clicks', {}).get('allClicks', {}).get('clickThroughRate', 0),
                }
            )
            count += 1

        log.status = 'success'; log.records_synced = count
    except Exception as e:
        log.status = 'failed'; log.error_message = str(e)
        raise self.retry(exc=e)
    finally:
        log.finished_at = timezone.now(); log.save()


# ── Google My Business ────────────────────────────────────────────────────────
@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def sync_gmb(self, client_id, days=30):
    from .models import PlatformCredential, DailyMetric, SyncLog
    log = SyncLog.objects.create(platform='google_my_business', client_id=client_id, status='running')
    try:
        cred  = PlatformCredential.objects.get(client_id=client_id, platform='google_my_business', is_active=True)
        if cred.is_expired:
            _refresh_google_token(cred)

        since, until = _date_range(days)

        resp = requests.post(
            f'https://businessprofileperformance.googleapis.com/v1/{cred.gmb_location_id}:fetchMultiDailyMetricsTimeSeries',
            json={
                'dailyMetrics': [
                    'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
                    'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
                    'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
                    'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
                    'WEBSITE_CLICKS',
                    'CALL_CLICKS',
                    'BUSINESS_DIRECTION_REQUESTS',
                    'BUSINESS_CONVERSATIONS',
                ],
                'dailyRange': {
                    'startDate': {'year': since.year, 'month': since.month, 'day': since.day},
                    'endDate':   {'year': until.year, 'month': until.month, 'day': until.day},
                }
            },
            headers={'Authorization': f'Bearer {cred.access_token}'},
            timeout=15
        ).json()

        daily = {}
        for series in resp.get('multiDailyMetricTimeSeries', []):
            metric_name = series.get('dailyMetric', '')
            for entry in series.get('dailyMetricTimeSeries', {}).get('datedValues', []):
                d   = entry['date']
                day = f"{d['year']}-{d['month']:02d}-{d['day']:02d}"
                val = int(entry.get('value', 0) or 0)
                daily.setdefault(day, {})

                if 'IMPRESSIONS' in metric_name:
                    daily[day]['impressions'] = daily[day].get('impressions', 0) + val
                elif metric_name == 'WEBSITE_CLICKS':
                    daily[day]['website_clicks'] = val
                elif metric_name == 'CALL_CLICKS':
                    daily[day]['phone_calls'] = val
                elif metric_name == 'BUSINESS_DIRECTION_REQUESTS':
                    daily[day]['direction_requests'] = val
                elif metric_name == 'BUSINESS_CONVERSATIONS':
                    daily[day]['clicks'] = val

        count = 0
        for day_str, vals in daily.items():
            DailyMetric.objects.update_or_create(
                client_id=client_id, platform='google_my_business', date=day_str,
                defaults=vals
            )
            count += 1

        log.status = 'success'; log.records_synced = count
    except Exception as e:
        log.status = 'failed'; log.error_message = str(e)
        raise self.retry(exc=e)
    finally:
        log.finished_at = timezone.now(); log.save()


# ── Smart Alert Checks ────────────────────────────────────────────────────────
@shared_task
def check_alerts():
    from .models import Client, PlatformCredential, DailyMetric, PostMetric, SyncLog, ClientGoal, Alert
    from django.db.models import Sum, Avg
    from django.contrib.auth.models import User
    from django.core.mail import send_mail
    from django.conf import settings as djsettings

    today = date.today()

    def _create(client, platform, alert_type, message, dedup_key):
        if Alert.objects.filter(client=client, dedup_key=dedup_key, created_at__date=today).exists():
            return None
        return Alert.objects.create(
            client=client, platform=platform,
            alert_type=alert_type, message=message, dedup_key=dedup_key,
        )

    def _send(to, subject, body):
        if not to:
            return
        try:
            send_mail(subject, body, djsettings.DEFAULT_FROM_EMAIL, to, fail_silently=True)
        except Exception:
            pass

    def _admins():
        return list(User.objects.filter(profile__role='superadmin', is_active=True).values_list('email', flat=True))

    def _client_emails(client):
        return list(User.objects.filter(profile__role='client', profile__client=client, is_active=True).values_list('email', flat=True))

    for client in Client.objects.filter(is_active=True):
        creds = list(PlatformCredential.objects.filter(client=client, is_active=True).exclude(access_token=''))

        for cred in creds:
            plat = cred.platform
            plat_label = cred.get_platform_display()

            # 1. Token expired
            if cred.is_expired:
                alert = _create(client, plat, 'token_expired',
                    f"{plat_label} token expired. Reconnect to continue syncing.",
                    f"token_expired_{plat}")
                if alert:
                    _send(_admins(),
                        f"[{client.company}] {plat_label} token expired",
                        f"{plat_label} credentials for {client.company} expired.\n"
                        f"Reconnect at {djsettings.FRONTEND_URL}/admin/client/{client.id}/settings")

            # 2. Sync failed 3x in a row
            last3 = list(SyncLog.objects.filter(client=client, platform=plat).order_by('-started_at')[:3])
            if len(last3) == 3 and all(l.status == 'failed' for l in last3):
                alert = _create(client, plat, 'sync_failed',
                    f"{plat_label} sync failed 3 times in a row.",
                    f"sync_failed_{plat}")
                if alert:
                    _send(_admins(),
                        f"[{client.company}] {plat_label} sync failing repeatedly",
                        f"{plat_label} for {client.company} failed 3 syncs in a row.\n"
                        f"Check logs: {djsettings.FRONTEND_URL}/admin/synclogs")

            # 3. Reach drop > 30%
            r_until = today - timedelta(days=1)
            r_since = r_until - timedelta(days=6)
            p_until = r_since - timedelta(days=1)
            p_since = p_until - timedelta(days=6)
            r_avg = DailyMetric.objects.filter(client=client, platform=plat, date__range=(r_since, r_until)).aggregate(v=Avg('reach'))['v'] or 0
            p_avg = DailyMetric.objects.filter(client=client, platform=plat, date__range=(p_since, p_until)).aggregate(v=Avg('reach'))['v'] or 0
            if p_avg > 0 and r_avg < p_avg * 0.7:
                drop = round((1 - r_avg / p_avg) * 100)
                _create(client, plat, 'reach_drop',
                    f"{plat_label} reach dropped {drop}% vs previous week average.",
                    f"reach_drop_{plat}")

            # 6. Follower milestones
            milestones = [1_000, 5_000, 10_000, 50_000, 100_000, 500_000, 1_000_000]
            yesterday  = today - timedelta(days=1)
            curr_f = DailyMetric.objects.filter(client=client, platform=plat, date=yesterday).values_list('followers', flat=True).first() or 0
            prev_f = DailyMetric.objects.filter(client=client, platform=plat, date=yesterday - timedelta(days=1)).values_list('followers', flat=True).first() or 0
            for ms in milestones:
                if prev_f < ms <= curr_f:
                    alert = _create(client, plat, 'follower_milestone',
                        f"Reached {ms:,} followers on {plat_label}!",
                        f"milestone_{plat}_{ms}")
                    if alert:
                        _send(_client_emails(client),
                            f"You've hit {ms:,} followers on {plat_label}!",
                            f"Congratulations! {client.company} reached {ms:,} followers on {plat_label}.")

        # 4. Viral post (any post in last 2 days is 3x 30-day avg)
        avg30 = DailyMetric.objects.filter(
            client=client,
            date__range=(today - timedelta(days=32), today - timedelta(days=2)),
        ).aggregate(ai=Avg('impressions'), ar=Avg('reach'), al=Avg('likes'))

        for post in PostMetric.objects.filter(client=client, published_at__date__gte=today - timedelta(days=2)):
            viral = None
            if avg30['ai'] and post.impressions > avg30['ai'] * 3:
                viral = 'impressions'
            elif avg30['ar'] and post.reach > avg30['ar'] * 3:
                viral = 'reach'
            elif avg30['al'] and post.likes > avg30['al'] * 3:
                viral = 'likes'
            if viral:
                alert = _create(client, post.platform, 'viral_post',
                    f"Viral post on {post.platform}: {viral} is 3× your 30-day average!",
                    f"viral_{post.id}")
                if alert:
                    _send(_client_emails(client),
                        f"Your post is going viral on {post.platform}!",
                        f"A {post.platform} post by {client.company} has {viral} at 3× the 30-day average!")

        # 5. Goal at risk (< 50% with < 10 days left in month)
        if today.month == 12:
            month_end = date(today.year + 1, 1, 1) - timedelta(days=1)
        else:
            month_end = date(today.year, today.month + 1, 1) - timedelta(days=1)
        days_left = (month_end - today).days

        if days_left < 10:
            for goal in ClientGoal.objects.filter(client=client, month=today.month, year=today.year):
                qs = DailyMetric.objects.filter(client=client, date__range=(date(today.year, today.month, 1), today))
                if goal.platform != 'all':
                    qs = qs.filter(platform=goal.platform)
                current = qs.aggregate(v=Sum(goal.metric))['v'] or 0
                pct = current / goal.target_value * 100 if goal.target_value > 0 else 0
                if pct < 50:
                    _create(client, goal.platform, 'goal_at_risk',
                        f"{goal.metric.replace('_', ' ').title()} goal: {round(pct)}% achieved with {days_left} days left.",
                        f"goal_at_risk_{goal.id}")


# ── Batch tasks (all clients) ─────────────────────────────────────────────────
@shared_task
def sync_all(platform):
    from .models import PlatformCredential
    ids = PlatformCredential.objects.filter(
        platform=platform, is_active=True, client__is_active=True
    ).values_list('client_id', flat=True)
    task_map = {
        'facebook':           sync_facebook,
        'instagram':          sync_instagram,
        'youtube':            sync_youtube,
        'linkedin':           sync_linkedin,
        'google_my_business': sync_gmb,
    }
    task = task_map.get(platform)
    if task:
        for cid in ids:
            task.delay(cid)


# ── Best Post of the Week ─────────────────────────────────────────────────────
@shared_task
def find_best_posts():
    """
    Scores every PostMetric published in the previous 7-day window for each
    active client and stores the top-ranked post per platform in WeeklyTopPost.
    Runs every Monday at 8am.
    """
    from .models import Client, PostMetric, WeeklyTopPost

    today      = date.today()
    # When run on Monday: days_back=7 → last Monday; other days: also anchors to last Monday
    days_back  = today.weekday() + 7
    week_start = today - timedelta(days=days_back)
    week_end   = week_start + timedelta(days=6)

    def _score(post):
        return (
            post.impressions * 1   +
            post.reach       * 1.2 +
            post.likes       * 2   +
            post.comments    * 3   +
            post.shares      * 4   +
            post.saves       * 3   +
            post.video_views * 0.5
        )

    saved = 0
    for client in Client.objects.filter(is_active=True):
        platforms = PostMetric.objects.filter(
            client=client,
            published_at__date__range=(week_start, week_end),
        ).values_list('platform', flat=True).distinct()

        for platform in platforms:
            posts = list(PostMetric.objects.filter(
                client=client, platform=platform,
                published_at__date__range=(week_start, week_end),
            ))
            if not posts:
                continue

            posts.sort(key=_score, reverse=True)
            top = posts[0]

            WeeklyTopPost.objects.update_or_create(
                client=client, platform=platform, week_start=week_start, rank=1,
                defaults={'post_metric': top, 'score': round(_score(top), 2)},
            )
            saved += 1

    logger.info("find_best_posts: saved %d top posts for week starting %s", saved, week_start)


# ── AI Insights ────────────────────────────────────────────────────────────────
@shared_task
def generate_ai_insights(client_id, month, year):
    """
    Fetches 30 days of DailyMetric + top 5 PostMetric records,
    builds a prompt, calls Claude, and stores the result in AIInsight.
    """
    from django.conf import settings
    from django.db.models import Sum
    from .models import Client, DailyMetric, PostMetric, AIInsight

    try:
        client = Client.objects.get(id=client_id)
    except Client.DoesNotExist:
        logger.error("generate_ai_insights: client %s not found", client_id)
        return

    # Date range: full calendar month
    since = date(year, month, 1)
    if month == 12:
        until = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        until = date(year, month + 1, 1) - timedelta(days=1)

    # Aggregate daily metrics per platform
    daily_qs = DailyMetric.objects.filter(
        client=client, date__range=(since, until)
    ).values('platform').annotate(
        impressions=Sum('impressions'),
        reach=Sum('reach'),
        clicks=Sum('clicks'),
        likes=Sum('likes'),
        comments=Sum('comments'),
        shares=Sum('shares'),
        video_views=Sum('video_views'),
        followers=Sum('followers'),
        website_clicks=Sum('website_clicks'),
        phone_calls=Sum('phone_calls'),
    )

    # Top 5 posts by impressions in the month
    top_posts = PostMetric.objects.filter(
        client=client,
        published_at__date__gte=since,
        published_at__date__lte=until,
    ).order_by('-impressions')[:5]

    # Build the data summary
    months = ['January','February','March','April','May','June',
              'July','August','September','October','November','December']
    month_name = months[month - 1]

    lines = [f"Client: {client.company}", f"Period: {month_name} {year}", ""]

    platform_display = {
        'facebook': 'Facebook', 'instagram': 'Instagram',
        'youtube': 'YouTube', 'linkedin': 'LinkedIn',
        'google_my_business': 'Google My Business',
    }

    if daily_qs:
        lines.append("=== Monthly Platform Metrics ===")
        for row in daily_qs:
            p = platform_display.get(row['platform'], row['platform'])
            lines.append(f"\n{p}:")
            lines.append(f"  Impressions: {row['impressions']:,}")
            lines.append(f"  Reach: {row['reach']:,}")
            lines.append(f"  Clicks: {row['clicks']:,}")
            lines.append(f"  Likes: {row['likes']:,}")
            lines.append(f"  Comments: {row['comments']:,}")
            lines.append(f"  Shares: {row['shares']:,}")
            if row['video_views']:
                lines.append(f"  Video Views: {row['video_views']:,}")
            if row['followers']:
                lines.append(f"  Followers gained: {row['followers']:,}")
            if row['website_clicks']:
                lines.append(f"  Website Clicks: {row['website_clicks']:,}")
            if row['phone_calls']:
                lines.append(f"  Phone Calls: {row['phone_calls']:,}")
    else:
        lines.append("No platform data available for this period.")

    if top_posts:
        lines.append("\n=== Top 5 Posts by Impressions ===")
        for i, post in enumerate(top_posts, 1):
            p = platform_display.get(post.platform, post.platform)
            caption = (post.caption[:80] + '…') if len(post.caption) > 80 else post.caption
            lines.append(
                f"{i}. [{p}] {caption or post.post_type or 'Post'} — "
                f"{post.impressions:,} impressions, {post.likes:,} likes, {post.comments:,} comments"
            )

    data_summary = "\n".join(lines)

    system_prompt = (
        "You are a social media analyst for a marketing agency. "
        "Analyze the provided metrics and write a clear, friendly "
        "2-3 paragraph report for the client. Include: what went well, "
        "what needs improvement, top recommendation, and one specific "
        "actionable tip. Use simple language, no jargon. Be positive "
        "but honest. End with one specific action to take next week."
    )

    api_key = settings.ANTHROPIC_API_KEY
    if not api_key:
        logger.error("generate_ai_insights: ANTHROPIC_API_KEY not set")
        return

    try:
        import anthropic
        anthropic_client = anthropic.Anthropic(api_key=api_key)
        message = anthropic_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=system_prompt,
            messages=[{"role": "user", "content": data_summary}],
        )
        content = message.content[0].text
    except Exception as e:
        logger.error("generate_ai_insights: Claude API error: %s", e)
        return

    # Upsert the insight
    AIInsight.objects.update_or_create(
        client=client, month=month, year=year,
        defaults={'content': content},
    )
    logger.info("generate_ai_insights: saved insight for %s %s/%s", client.company, month, year)


# ── Monthly ROI Reports ────────────────────────────────────────────────────────
@shared_task
def generate_monthly_roi_reports():
    """
    Runs on 2nd of every month at 8am.
    Calculates ROI for the previous month for all active clients with ROISettings.
    """
    from .models import Client, ROIReport, ROISettings
    from .roi_calculator import calculate_roi
    from decimal import Decimal

    today = date.today()
    # Calculate for previous month
    if today.month == 1:
        month, year = 12, today.year - 1
    else:
        month, year = today.month - 1, today.year

    clients_with_settings = Client.objects.filter(
        is_active=True,
        roi_settings__isnull=False,
    )

    success_count = 0
    fail_count    = 0

    for client in clients_with_settings:
        try:
            result = calculate_roi(client.id, month, year)
            ROIReport.objects.update_or_create(
                client=client, month=month, year=year,
                defaults={
                    'total_investment':   Decimal(str(result['total_investment'])),
                    'agency_fee':         Decimal(str(result['agency_fee'])),
                    'total_clicks':       result['total_clicks'],
                    'total_impressions':  result['total_impressions'],
                    'total_reach':        result['total_reach'],
                    'website_clicks':     result['total_website_clicks'],
                    'estimated_leads':    result['estimated_leads'],
                    'estimated_sales':    result['estimated_sales'],
                    'estimated_revenue':  Decimal(str(result['estimated_revenue'])),
                    'roi_percentage':     Decimal(str(result['roi_percentage'])),
                    'cost_per_click':     Decimal(str(result['cost_per_click'])),
                    'cost_per_lead':      Decimal(str(result['cost_per_lead'])),
                    'cost_per_sale':      Decimal(str(result['cost_per_sale'])),
                    'platform_breakdown': result['platform_breakdown'],
                }
            )
            success_count += 1
            logger.info("generate_monthly_roi_reports: saved ROI for %s %s/%s", client.company, month, year)
        except Exception as e:
            fail_count += 1
            logger.error("generate_monthly_roi_reports: failed for %s: %s", client.company, e)

    logger.info("generate_monthly_roi_reports: %d success, %d failed for %s/%s", success_count, fail_count, month, year)


# ── Content Calendar Tasks ─────────────────────────────────────────────────────

@shared_task
def sync_posts_to_calendar(client_id):
    """
    After every platform sync, create CalendarPost records from newly synced
    PostMetric records that don't have a CalendarPost yet.
    """
    from .models import PostMetric, CalendarPost

    # Find PostMetric records for this client that have no associated CalendarPost
    existing_metric_ids = CalendarPost.objects.filter(
        client_id=client_id,
        post_metric__isnull=False,
    ).values_list('post_metric_id', flat=True)

    new_metrics = PostMetric.objects.filter(
        client_id=client_id,
    ).exclude(id__in=existing_metric_ids)

    # Also skip any that match by external_id
    existing_ext_ids = CalendarPost.objects.filter(
        client_id=client_id,
    ).exclude(external_id='').values_list('external_id', flat=True)

    new_metrics = new_metrics.exclude(post_id__in=existing_ext_ids)

    created = 0
    for metric in new_metrics:
        try:
            CalendarPost.objects.create(
                client_id   = client_id,
                platform    = metric.platform,
                post_type   = metric.post_type or 'image',
                status      = 'published',
                caption     = metric.caption,
                media_url   = metric.thumbnail_url,
                post_url    = metric.post_url,
                published_at = metric.published_at,
                post_metric  = metric,
                external_id  = metric.post_id,
                impressions  = metric.impressions,
                reach        = metric.reach,
                likes        = metric.likes,
                comments     = metric.comments,
                shares       = metric.shares,
                saves        = metric.saves,
                video_views  = metric.video_views,
            )
            created += 1
        except Exception as e:
            logger.warning("sync_posts_to_calendar: failed for metric %s: %s", metric.id, e)

    logger.info("sync_posts_to_calendar: created %d CalendarPost records for client %s", created, client_id)


@shared_task
def send_scheduling_reminders():
    """
    Runs every day at 8am.
    Finds all scheduled posts for tomorrow and emails superadmins.
    """
    from .models import CalendarPost
    from django.contrib.auth.models import User
    from django.core.mail import send_mail
    from django.conf import settings as djsettings

    tomorrow = date.today() + timedelta(days=1)

    posts = CalendarPost.objects.filter(
        status='scheduled',
        scheduled_at__date=tomorrow,
    ).select_related('client').order_by('scheduled_at')

    if not posts.exists():
        logger.info("send_scheduling_reminders: no posts scheduled for %s", tomorrow)
        return

    admins = list(
        User.objects.filter(
            profile__role='superadmin', is_active=True,
        ).values_list('email', flat=True)
    )
    if not admins:
        return

    lines = [f"Tomorrow's scheduled posts ({tomorrow.strftime('%A, %B %-d')}):", ""]
    for post in posts:
        time_str = post.scheduled_at.strftime('%H:%M') if post.scheduled_at else '—'
        caption_preview = (post.caption[:80] + '…') if len(post.caption) > 80 else post.caption or post.title or '(no caption)'
        lines.append(
            f"  • [{post.client.company}] {post.get_platform_display()} @ {time_str} — {caption_preview}"
        )

    body = "\n".join(lines)
    try:
        send_mail(
            subject=f"📅 Tomorrow: {posts.count()} post(s) going live",
            message=body,
            from_email=getattr(djsettings, 'DEFAULT_FROM_EMAIL', 'noreply@socialstats.io'),
            recipient_list=admins,
            fail_silently=True,
        )
    except Exception as e:
        logger.error("send_scheduling_reminders: email failed: %s", e)

    logger.info("send_scheduling_reminders: notified about %d posts for %s", posts.count(), tomorrow)


@shared_task
def check_overdue_scheduled_posts():
    """
    Runs every hour.
    Finds posts with status=scheduled whose scheduled_at has passed by >2 hours.
    Marks them as failed and creates an Alert.
    """
    from .models import CalendarPost, Alert
    from django.utils import timezone as tz

    cutoff = tz.now() - timedelta(hours=2)

    overdue = CalendarPost.objects.filter(
        status='scheduled',
        scheduled_at__lt=cutoff,
    ).select_related('client')

    updated = 0
    for post in overdue:
        post.status = 'failed'
        post.save(update_fields=['status', 'updated_at'])

        dedup_key = f"overdue_post_{post.id}"
        if not Alert.objects.filter(dedup_key=dedup_key).exists():
            try:
                Alert.objects.create(
                    client     = post.client,
                    platform   = post.platform,
                    alert_type = 'sync_failed',
                    message    = (
                        f"Scheduled post '{post.title or post.caption[:60] or 'Untitled'}' "
                        f"on {post.get_platform_display()} was never published. "
                        f"It was scheduled for {post.scheduled_at.strftime('%b %-d at %H:%M')}."
                    ),
                    dedup_key  = dedup_key,
                )
            except Exception as e:
                logger.warning("check_overdue_scheduled_posts: alert creation failed: %s", e)

        updated += 1

    if updated:
        logger.info("check_overdue_scheduled_posts: marked %d posts as failed", updated)
