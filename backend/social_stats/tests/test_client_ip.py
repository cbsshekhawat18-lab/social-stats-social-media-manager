"""
Client-IP resolution regression tests.

X-Forwarded-For is client-controlled. It must be ignored unless
TRUSTED_PROXY_COUNT says how many of our own proxies appended to it, and then
only the N-th entry from the right counts. Rotating the header must not let
a caller dodge per-IP throttles.
"""
from django.core.cache import cache
from django.test import RequestFactory, SimpleTestCase, TestCase, override_settings
from rest_framework.test import APIClient

from social_stats.security.client_ip import get_client_ip


def _req(remote='198.51.100.9', xff=None):
    meta = {'REMOTE_ADDR': remote}
    if xff is not None:
        meta['HTTP_X_FORWARDED_FOR'] = xff
    return RequestFactory().get('/', **meta)


class GetClientIpTests(SimpleTestCase):
    @override_settings(TRUSTED_PROXY_COUNT=0)
    def test_header_ignored_without_trusted_proxies(self):
        self.assertEqual(get_client_ip(_req(xff='1.2.3.4')), '198.51.100.9')

    @override_settings(TRUSTED_PROXY_COUNT=1)
    def test_one_proxy_uses_rightmost_entry(self):
        # Client sent "1.2.3.4"; nginx appended the real peer 203.0.113.7.
        self.assertEqual(get_client_ip(_req(xff='1.2.3.4, 203.0.113.7')), '203.0.113.7')

    @override_settings(TRUSTED_PROXY_COUNT=2)
    def test_two_proxies_use_second_from_right(self):
        ip = get_client_ip(_req(xff='1.2.3.4, 203.0.113.7, 10.0.0.2'))
        self.assertEqual(ip, '203.0.113.7')

    @override_settings(TRUSTED_PROXY_COUNT=2)
    def test_short_header_falls_back_to_remote_addr(self):
        self.assertEqual(get_client_ip(_req(xff='1.2.3.4')), '198.51.100.9')

    @override_settings(TRUSTED_PROXY_COUNT=1)
    def test_missing_header_falls_back_to_remote_addr(self):
        self.assertEqual(get_client_ip(_req()), '198.51.100.9')

    @override_settings(TRUSTED_PROXY_COUNT=1)
    def test_garbage_entry_falls_back_to_remote_addr(self):
        self.assertEqual(get_client_ip(_req(xff='1.2.3.4, not-an-ip')), '198.51.100.9')

    def test_axes_uses_the_same_helper(self):
        from axes.helpers import get_client_ip_address
        with override_settings(TRUSTED_PROXY_COUNT=1):
            self.assertEqual(
                get_client_ip_address(_req(xff='1.2.3.4, 203.0.113.7')), '203.0.113.7',
            )
        with override_settings(TRUSTED_PROXY_COUNT=0):
            self.assertEqual(
                get_client_ip_address(_req(xff='1.2.3.4, 203.0.113.7')), '198.51.100.9',
            )


class LoginThrottleSpoofingTests(TestCase):
    """LoginIPThrottle allows 10/min per IP. Forging a fresh X-Forwarded-For
    on every attempt must not reset that budget."""

    LIMIT = 10

    def setUp(self):
        cache.clear()
        self.api = APIClient()

    def tearDown(self):
        cache.clear()

    def _attempt(self, i, **extra):
        # A different username each time so django-axes' per-(user, ip)
        # lockout never fires — this test is about the throttle alone.
        return self.api.post('/api/auth/login/', {
            'username': f'nobody{i}@x.test', 'password': 'wrong-password',
            'terms_accepted': True,
        }, format='json', **extra)

    def _assert_throttled_after_limit(self, extra_for):
        for i in range(self.LIMIT):
            res = self._attempt(i, **extra_for(i))
            self.assertNotEqual(res.status_code, 429, f'throttled early at attempt {i + 1}')
        res = self._attempt(self.LIMIT, **extra_for(self.LIMIT))
        self.assertEqual(res.status_code, 429)

    @override_settings(TRUSTED_PROXY_COUNT=0)
    def test_rotating_xff_without_proxy(self):
        self._assert_throttled_after_limit(lambda i: {
            'REMOTE_ADDR': '203.0.113.7',
            'HTTP_X_FORWARDED_FOR': f'10.9.{i}.{i}',
        })

    @override_settings(TRUSTED_PROXY_COUNT=1)
    def test_rotating_xff_behind_one_proxy(self):
        # The attacker controls the left part; nginx always appends the real
        # peer (203.0.113.7) on the right, and REMOTE_ADDR is nginx itself.
        self._assert_throttled_after_limit(lambda i: {
            'REMOTE_ADDR': '172.18.0.5',
            'HTTP_X_FORWARDED_FOR': f'10.9.{i}.{i}, 203.0.113.7',
        })

    @override_settings(TRUSTED_PROXY_COUNT=1)
    def test_distinct_real_clients_are_not_lumped_together(self):
        for i in range(self.LIMIT + 2):
            res = self._attempt(i, REMOTE_ADDR='172.18.0.5',
                                HTTP_X_FORWARDED_FOR=f'203.0.113.{i + 1}')
            self.assertNotEqual(res.status_code, 429)
