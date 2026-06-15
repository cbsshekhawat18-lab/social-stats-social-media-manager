"""
AI dashboard briefing tests.

The AI call is mocked at the AIClient.complete level so tests:
  • run offline without an ANTHROPIC_API_KEY,
  • are deterministic,
  • assert the prompt + output-cleaning + caching + rate-limiting contracts
    without depending on Claude's actual behaviour.

Three behaviour groups:
  1. Output cleaning — drops preamble, caps line count, returns '' for empty/garbage.
  2. Caching — the second call inside 1h is cache-served (no AI invocation).
  3. Rate-limiting — after 10 calls per client per day the function returns
     stale cache (or '') without invoking the AI.
"""
import uuid
from unittest.mock import patch, MagicMock

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase, override_settings

from social_stats.ai.dashboard_briefing import build_briefing
from social_stats.models import Client, UserProfile, DailyMetric


def _client(label='c'):
    return Client.objects.create(
        name=label, company=label.title(),
        email=f'{label}-{uuid.uuid4().hex[:6]}@x.test',
    )


def _user(client_obj=None):
    u = User.objects.create_user(
        username=f'u-{uuid.uuid4().hex[:10]}',
        email=f'{uuid.uuid4().hex[:6]}@x.test',
        password='x', is_active=True,
    )
    UserProfile.objects.create(
        user=u, role='client',
        client=client_obj,
    )
    return u


def _seed_metrics(client_obj):
    """The briefing has a `_has_signal` guard — without DailyMetric rows it
    returns '' before calling AI. Seed enough metrics for the guard to pass.

    DailyMetric tracks likes/comments/shares separately; the briefing's
    `_recent_metrics` bucket sums them into the `engagement` field of the
    payload. We populate the underlying columns here.
    """
    from datetime import date, timedelta
    today = date.today()
    for i in range(10):
        DailyMetric.objects.create(
            client=client_obj, platform='facebook',
            date=today - timedelta(days=i),
            likes=50, comments=30, shares=20,
            reach=500, impressions=1000,
        )


@override_settings(CACHES={
    'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
                'LOCATION': 'briefing-tests'},
})
class BriefingOutputCleaningTests(TestCase):
    """The output cleaner has to defend against three real Haiku failure modes:
      • leading preamble ("Here is your briefing:")
      • runaway length (the model returns 20 bullets)
      • outright empty / whitespace-only output
    """

    def setUp(self):
        cache.clear()
        self.client_obj = _client('out')
        _seed_metrics(self.client_obj)

    @patch('social_stats.ai.dashboard_briefing.AIClient')
    def test_strips_preamble_before_first_bullet(self, AIClientMock):
        AIClientMock.return_value.complete.return_value = (
            "Here is your dashboard briefing:\n\n"
            "• 3 new leads from Mumbai campaign (high quality)\n"
            "• Engagement up 240% on Reel"
        )
        out = build_briefing(self.client_obj)
        self.assertTrue(out.startswith('•'),
            f'expected leading bullet after preamble strip; got {out!r}')
        self.assertNotIn('Here is your', out)

    @patch('social_stats.ai.dashboard_briefing.AIClient')
    def test_caps_at_six_lines(self, AIClientMock):
        AIClientMock.return_value.complete.return_value = '\n'.join(
            f'• item {i}' for i in range(20)
        )
        out = build_briefing(self.client_obj)
        self.assertLessEqual(len(out.splitlines()), 6)

    @patch('social_stats.ai.dashboard_briefing.AIClient')
    def test_returns_empty_string_on_empty_output(self, AIClientMock):
        AIClientMock.return_value.complete.return_value = '   \n  \n'
        out = build_briefing(self.client_obj)
        self.assertEqual(out, '')

    @patch('social_stats.ai.dashboard_briefing.AIClient')
    def test_returns_empty_when_ai_raises(self, AIClientMock):
        """A bad API key, model timeout, or safety reject should NOT bubble
        up — the dashboard must keep rendering the rest of the payload."""
        AIClientMock.return_value.complete.side_effect = RuntimeError('AI down')
        out = build_briefing(self.client_obj)
        self.assertEqual(out, '')

    def test_returns_empty_for_workspace_with_no_signal(self):
        """No metrics + no leads + no brand voice → no signal → no briefing,
        without any AI call. Verifies the early-return guard."""
        bare = _client('bare')   # no _seed_metrics call
        with patch('social_stats.ai.dashboard_briefing.AIClient') as AIClientMock:
            out = build_briefing(bare)
            self.assertEqual(out, '')
            AIClientMock.return_value.complete.assert_not_called()


@override_settings(CACHES={
    'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
                'LOCATION': 'briefing-cache-tests'},
})
class BriefingCacheTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client_obj = _client('cache')
        _seed_metrics(self.client_obj)

    @patch('social_stats.ai.dashboard_briefing.AIClient')
    def test_second_call_within_ttl_is_cache_served(self, AIClientMock):
        AIClientMock.return_value.complete.return_value = '• cached line'
        first  = build_briefing(self.client_obj)
        second = build_briefing(self.client_obj)
        self.assertEqual(first, second)
        # AI was only called once — second hit was cached.
        self.assertEqual(AIClientMock.return_value.complete.call_count, 1)

    @patch('social_stats.ai.dashboard_briefing.AIClient')
    def test_force_bypasses_cache(self, AIClientMock):
        AIClientMock.return_value.complete.side_effect = ['• v1', '• v2']
        first  = build_briefing(self.client_obj)
        second = build_briefing(self.client_obj, force=True)
        self.assertEqual(first, '• v1')
        self.assertEqual(second, '• v2')
        self.assertEqual(AIClientMock.return_value.complete.call_count, 2)


@override_settings(CACHES={
    'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
                'LOCATION': 'briefing-rate-tests'},
})
class BriefingRateLimitTests(TestCase):
    """The rate limit defends the AI budget. After RATE_LIMIT_PER_DAY=10
    `force=True` calls in a day, further calls must NOT invoke the AI."""

    def setUp(self):
        cache.clear()
        self.client_obj = _client('rl')
        _seed_metrics(self.client_obj)

    @patch('social_stats.ai.dashboard_briefing.AIClient')
    def test_rate_limit_blocks_after_threshold(self, AIClientMock):
        AIClientMock.return_value.complete.return_value = '• rl line'
        # 10 forced calls — the budget. Each consumes one rate-limit slot.
        for _ in range(10):
            build_briefing(self.client_obj, force=True)
        self.assertEqual(AIClientMock.return_value.complete.call_count, 10)

        # 11th forced call: the rate limit must reject it. AI not called again.
        build_briefing(self.client_obj, force=True)
        self.assertEqual(AIClientMock.return_value.complete.call_count, 10,
            'rate limit must prevent the 11th AI invocation')


@override_settings(CACHES={
    'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
                'LOCATION': 'briefing-int-tests'},
})
class BriefingDashboardIntegrationTests(TestCase):
    """End-to-end: hitting /api/dashboard/today/ surfaces the briefing in
    the response payload when the AI is available."""

    def setUp(self):
        cache.clear()
        self.client_obj = _client('int')
        self.owner = _user(client_obj=self.client_obj)
        _seed_metrics(self.client_obj)

    @patch('social_stats.ai.dashboard_briefing.AIClient')
    def test_briefing_appears_in_today_payload(self, AIClientMock):
        AIClientMock.return_value.complete.return_value = '• integration test bullet'
        from rest_framework.test import APIClient
        api = APIClient()
        api.force_authenticate(user=self.owner)
        res = api.get('/api/dashboard/today/')
        self.assertEqual(res.status_code, 200)
        self.assertIn('integration test bullet', res.data['briefing'])

    def test_briefing_skip_flag_returns_empty_string(self):
        """`?briefing=skip` lets the regression test suite hit the
        endpoint without mocking the AI client."""
        from rest_framework.test import APIClient
        api = APIClient()
        api.force_authenticate(user=self.owner)
        res = api.get('/api/dashboard/today/?briefing=skip')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['briefing'], '')
