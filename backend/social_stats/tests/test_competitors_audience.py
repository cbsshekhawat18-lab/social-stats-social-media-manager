"""
Tests for the competitor module + audience insights.

Covers:
  - CompetitorViewSet CRUD + tenant isolation + timeline / posts actions
  - BenchmarkView ranking math
  - snapshot_one_competitor with mocked HTTP for YouTube + Facebook
  - UnifiedAudienceView aggregation, heatmap normalization, top content types
"""
import uuid
from datetime import date, datetime, timedelta, timezone as dt_tz
from unittest.mock import MagicMock, patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from social_stats.models import (
    Client, Competitor, CompetitorSnapshot, DailyMetric, PostMetric, UserProfile,
)


def _client_factory(label='cl'):
    return Client.objects.create(
        name=label, company=label.title(),
        email=f'{label}-{uuid.uuid4().hex[:8]}@x.test',
    )


def _user_for(client_obj, role='client'):
    u = User.objects.create_user(
        username=f'u-{uuid.uuid4().hex[:12]}',
        email='u@x.test', password='x', is_active=True,
    )
    profile = UserProfile.objects.create(user=u, role=role,
                                          client=client_obj if role == 'client' else None)
    if role == 'staff':
        profile.assigned_clients.add(client_obj)
    return u


def _api(user):
    a = APIClient()
    a.force_authenticate(user=user)
    return a


def _resp(status=200, json_body=None):
    m = MagicMock()
    m.status_code = status
    m.json.return_value = json_body or {}
    m.text = ''
    return m


# ══════════════════════════════════════════════════════════════════════
# Competitor CRUD + tenant isolation
# ══════════════════════════════════════════════════════════════════════
class CompetitorAPITests(TestCase):
    def setUp(self):
        self.c = _client_factory('vs')
        self.u = _user_for(self.c)
        self.api = _api(self.u)

    def test_create_via_api_stamps_client_from_session(self):
        res = self.api.post('/api/competitors/', {
            'name': 'Acme Rival',
            'public_handles': {'youtube': 'UC1234567890'},
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        c = Competitor.objects.get(name='Acme Rival')
        self.assertEqual(c.client, self.c)
        self.assertEqual(c.public_handles['youtube'], 'UC1234567890')

    def test_list_only_returns_own_tenant_competitors(self):
        Competitor.objects.create(client=self.c, name='Mine')
        other = _client_factory('other')
        Competitor.objects.create(client=other, name='Theirs')
        res = self.api.get('/api/competitors/')
        names = [r['name'] for r in (res.data.get('results') or res.data)]
        self.assertIn('Mine', names)
        self.assertNotIn('Theirs', names)

    def test_timeline_action_filters_by_days(self):
        comp = Competitor.objects.create(client=self.c, name='Rival')
        today = timezone.now().date()
        for i in range(5):
            CompetitorSnapshot.objects.create(
                competitor=comp, platform='youtube',
                date=today - timedelta(days=i * 30),
                followers=1000 + i * 100,
            )
        res = self.api.get(f'/api/competitors/{comp.id}/timeline/?days=60')
        # Only 3 snapshots within 60 days (today, -30, -60)
        snaps = res.data['snapshots']
        self.assertEqual(len(snaps), 3)

    def test_posts_action_dedupes_and_caps(self):
        comp = Competitor.objects.create(client=self.c, name='Rival')
        today = timezone.now().date()
        # Create snapshots with overlapping sample_top_posts
        CompetitorSnapshot.objects.create(
            competitor=comp, platform='youtube', date=today,
            sample_top_posts=[
                {'id': 'a', 'caption': 'one'},
                {'id': 'b', 'caption': 'two'},
            ],
        )
        CompetitorSnapshot.objects.create(
            competitor=comp, platform='youtube', date=today - timedelta(days=1),
            sample_top_posts=[
                {'id': 'a', 'caption': 'one duplicate'},  # should dedupe
                {'id': 'c', 'caption': 'three'},
            ],
        )
        res = self.api.get(f'/api/competitors/{comp.id}/posts/')
        ids = [p.get('id') for p in res.data['posts']]
        self.assertEqual(sorted(ids), ['a', 'b', 'c'])


# ══════════════════════════════════════════════════════════════════════
# Snapshot job — YouTube + Facebook fetchers
# ══════════════════════════════════════════════════════════════════════
@override_settings(YOUTUBE_API_KEY='yt-key', META_APP_ID='', META_APP_SECRET='')
class SnapshotTaskTests(TestCase):
    def setUp(self):
        self.c = _client_factory('s')
        self.comp = Competitor.objects.create(
            client=self.c, name='Rival',
            public_handles={'youtube': 'UCxxxxxx', 'facebook': 'rival.page'},
        )

    @patch('social_stats.competitor_tasks.requests.get')
    def test_youtube_snapshot_persists_followers_and_video_count(self, mock_get):
        mock_get.return_value = _resp(200, {
            'items': [{
                'snippet': {'title': 'Rival Channel'},
                'statistics': {
                    'subscriberCount': '12500',
                    'videoCount':      '180',
                    'viewCount':       '4500000',
                },
            }],
        })
        from social_stats.competitor_tasks import snapshot_one_competitor
        n = snapshot_one_competitor(self.comp.id)
        self.assertEqual(n, 1)  # FB skipped (no app creds), YT persisted

        snap = CompetitorSnapshot.objects.get(competitor=self.comp, platform='youtube')
        self.assertEqual(snap.followers, 12500)
        self.assertEqual(snap.posts_count, 180)
        self.assertEqual(snap.raw['avg_views'], 25000.0)

        # follower_history populated
        self.comp.refresh_from_db()
        history = self.comp.follower_history.get('youtube') or []
        self.assertEqual(history[-1]['n'], 12500)
        self.assertIsNotNone(self.comp.last_synced_at)

    @override_settings(META_APP_ID='app', META_APP_SECRET='secret', YOUTUBE_API_KEY='')
    @patch('social_stats.competitor_tasks.requests.get')
    def test_facebook_snapshot_persists_fan_count(self, mock_get):
        mock_get.return_value = _resp(200, {
            'name': 'Rival Page', 'fan_count': 9000, 'category': 'Software',
        })
        from social_stats.competitor_tasks import snapshot_one_competitor
        n = snapshot_one_competitor(self.comp.id)
        self.assertEqual(n, 1)  # YT skipped (no key), FB persisted
        snap = CompetitorSnapshot.objects.get(competitor=self.comp, platform='facebook')
        self.assertEqual(snap.followers, 9000)
        self.assertEqual(snap.raw['name'], 'Rival Page')

    def test_unsupported_platform_skipped(self):
        from social_stats.competitor_tasks import snapshot_one_competitor
        # No YT or FB key → all platforms skipped
        comp = Competitor.objects.create(
            client=self.c, name='Mute',
            public_handles={'instagram': '@mute', 'linkedin': 'mute'},
        )
        n = snapshot_one_competitor(comp.id)
        self.assertEqual(n, 0)


# ══════════════════════════════════════════════════════════════════════
# Benchmark API
# ══════════════════════════════════════════════════════════════════════
class BenchmarkTests(TestCase):
    def setUp(self):
        self.c = _client_factory('b')
        self.u = _user_for(self.c)
        self.api = _api(self.u)
        self.today = timezone.now().date()

    def test_returns_avg_top_and_rank(self):
        # Client has 4% engagement on facebook
        DailyMetric.objects.create(
            client=self.c, platform='facebook',
            date=self.today, engagement_rate=0.04,
        )
        # Two competitors with snapshots
        c1 = Competitor.objects.create(client=self.c, name='High')
        c2 = Competitor.objects.create(client=self.c, name='Low')
        CompetitorSnapshot.objects.create(competitor=c1, platform='facebook',
                                           date=self.today, engagement_rate=0.06)
        CompetitorSnapshot.objects.create(competitor=c2, platform='facebook',
                                           date=self.today, engagement_rate=0.02)

        res = self.api.post('/api/competitors/benchmark/',
                             {'platform': 'facebook', 'metric': 'engagement_rate'},
                             format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertAlmostEqual(res.data['avg'], 0.04, places=3)
        self.assertAlmostEqual(res.data['top'], 0.06, places=3)
        # Client 0.04 ranks 2nd in pool [0.06, 0.04, 0.02]
        self.assertEqual(res.data['rank'], 2)
        self.assertEqual(res.data['total_competitors'], 2)

    def test_no_competitors_returns_explanatory_note(self):
        DailyMetric.objects.create(
            client=self.c, platform='facebook',
            date=self.today, engagement_rate=0.05,
        )
        res = self.api.post('/api/competitors/benchmark/',
                             {'platform': 'facebook', 'metric': 'engagement_rate'},
                             format='json')
        self.assertEqual(res.status_code, 200)
        self.assertIsNone(res.data['avg'])
        self.assertIn('snapshot', res.data['note'])

    def test_platform_required(self):
        res = self.api.post('/api/competitors/benchmark/',
                             {'metric': 'engagement_rate'}, format='json')
        self.assertEqual(res.status_code, 400)


# ══════════════════════════════════════════════════════════════════════
# Unified Audience
# ══════════════════════════════════════════════════════════════════════
class UnifiedAudienceTests(TestCase):
    def setUp(self):
        self.c = _client_factory('a')
        self.u = _user_for(self.c)
        self.api = _api(self.u)
        self.today = timezone.now().date()

    def test_aggregates_totals_and_by_platform(self):
        DailyMetric.objects.create(client=self.c, platform='facebook',
                                    date=self.today, reach=1000, impressions=2000,
                                    followers=500, engagement_rate=0.05)
        DailyMetric.objects.create(client=self.c, platform='instagram',
                                    date=self.today, reach=2000, impressions=3500,
                                    followers=900, engagement_rate=0.08)

        res = self.api.get('/api/audience/unified/?days=30')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.data['totals']['reach'], 3000)
        self.assertEqual(res.data['totals']['impressions'], 5500)
        self.assertEqual(res.data['by_platform']['facebook']['reach'], 1000)
        self.assertEqual(res.data['by_platform']['instagram']['followers'], 900)
        # demographics is the documented placeholder
        self.assertEqual(res.data['demographics']['status'], 'data_unavailable')

    def test_active_hours_heatmap_normalized(self):
        # 3 posts on Wednesday 2pm, 1 post on Monday 9am
        wed_2pm = datetime(2026, 5, 6, 14, 0, tzinfo=dt_tz.utc)   # Wed
        mon_9am = datetime(2026, 5, 4, 9, 0, tzinfo=dt_tz.utc)    # Mon
        for i in range(3):
            PostMetric.objects.create(
                client=self.c, platform='facebook', post_id=f'a{i}',
                published_at=wed_2pm, post_type='image',
                likes=100, comments=10, shares=5, reach=500,
            )
        PostMetric.objects.create(
            client=self.c, platform='facebook', post_id='b1',
            published_at=mon_9am, post_type='video',
            likes=10, comments=1, shares=0, reach=50,
        )
        res = self.api.get('/api/audience/unified/?days=365')
        heat = res.data['active_hours']['heatmap']
        # Wed=2, hour 14 should be the brightest
        self.assertEqual(heat[2][14], 1.0)
        # Monday morning should be dimmer
        self.assertLess(heat[0][9], heat[2][14])

    def test_top_content_types_per_platform(self):
        wed = datetime(2026, 5, 6, 14, 0, tzinfo=dt_tz.utc)
        # Carousel posts dominate over text on facebook
        PostMetric.objects.create(client=self.c, platform='facebook', post_id='c1',
                                   published_at=wed, post_type='carousel',
                                   likes=200, comments=20, reach=1000)
        PostMetric.objects.create(client=self.c, platform='facebook', post_id='t1',
                                   published_at=wed, post_type='text',
                                   likes=10, comments=1, reach=50)
        res = self.api.get('/api/audience/unified/?days=365')
        fb_top = res.data['top_content_types']['facebook']
        self.assertEqual(fb_top[0]['post_type'], 'carousel')
        self.assertGreater(fb_top[0]['avg_score'], fb_top[1]['avg_score'])
