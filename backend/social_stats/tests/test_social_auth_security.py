"""
Regression tests for the coordinated-disclosure findings in the social
login + password reset flows (reported 2026-09):

  1. Social login callbacks must validate the OAuth `state` parameter
     against the session (login-CSRF guard).
  2. Social login must not bypass MFA: TOTP-enabled accounts get the
     mfa handshake redirect, never immediate JWTs.
  3. Password reset must invalidate existing sessions and refresh tokens.
  4. Social login never puts tokens in the redirect URL: it carries a
     one-time code, redeemed once via POST /api/auth/social/exchange/.
"""
from datetime import timedelta
from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, urlparse

from django.contrib.auth.models import User
from django.test import TestCase, Client as DjangoClient
from django.utils import timezone

from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from social_stats.models import PasswordResetToken, UserProfile
from social_stats.security.mfa import UserMFA
from social_stats.security.sessions import UserSession, record_session


def _login_code(location):
    """The one-time code from a /auth/callback?code=... redirect."""
    query = parse_qs(urlparse(location).query)
    assert set(query) == {'code'}, f'unexpected redirect params: {location}'
    return query['code'][0]


def _exchange(location):
    return APIClient().post('/api/auth/social/exchange/',
                            {'code': _login_code(location)}, format='json')


def _google_provider_ok(email='victim@example.com'):
    """Mock http_requests so the Google callback resolves a valid profile."""
    token_resp = MagicMock(status_code=200)
    token_resp.json.return_value = {'access_token': 'ya29.test'}
    userinfo_resp = MagicMock(status_code=200)
    userinfo_resp.json.return_value = {
        'email': email, 'given_name': 'Vic', 'family_name': 'Tim',
    }
    return token_resp, userinfo_resp


class SocialLoginStateValidationTests(TestCase):
    """Finding 1 — the callback must reject a state that was never issued
    to this browser session (login CSRF)."""

    def setUp(self):
        self.http = DjangoClient()

    @patch('social_stats.social_auth_views.http_requests')
    def test_callback_without_session_state_is_rejected(self, mock_http):
        res = self.http.get('/api/auth/social/google/callback/',
                            {'code': 'attacker-code', 'state': 'forged'})
        self.assertEqual(res.status_code, 302)
        self.assertIn('/login?error=', res['Location'])
        # The authorization code must never be exchanged
        mock_http.post.assert_not_called()

    @patch('social_stats.social_auth_views.http_requests')
    def test_callback_with_mismatched_state_is_rejected(self, mock_http):
        start = self.http.get('/api/auth/social/google/start/')
        self.assertEqual(start.status_code, 302)  # session now holds a state
        res = self.http.get('/api/auth/social/google/callback/',
                            {'code': 'attacker-code', 'state': 'not-the-one-issued'})
        self.assertIn('/login?error=', res['Location'])
        mock_http.post.assert_not_called()

    @patch('social_stats.social_auth_views.http_requests')
    def test_callback_with_matching_state_proceeds(self, mock_http):
        self.http.get('/api/auth/social/google/start/')
        state = self.http.session['social_state']
        mock_http.post.return_value, mock_http.get.return_value = _google_provider_ok()
        res = self.http.get('/api/auth/social/google/callback/',
                            {'code': 'good-code', 'state': state})
        self.assertEqual(res.status_code, 302)
        self.assertIn('access', _exchange(res['Location']).data)
        mock_http.post.assert_called_once()

    @patch('social_stats.social_auth_views.http_requests')
    def test_state_is_single_use(self, mock_http):
        self.http.get('/api/auth/social/google/start/')
        state = self.http.session['social_state']
        mock_http.post.return_value, mock_http.get.return_value = _google_provider_ok()
        first = self.http.get('/api/auth/social/google/callback/',
                              {'code': 'good-code', 'state': state})
        self.assertIn('/auth/callback?code=', first['Location'])
        replay = self.http.get('/api/auth/social/google/callback/',
                               {'code': 'good-code', 'state': state})
        self.assertIn('/login?error=', replay['Location'])

    @patch('social_stats.social_auth_views.http_requests')
    def test_facebook_and_microsoft_callbacks_also_guarded(self, mock_http):
        for path in ('/api/auth/social/facebook/callback/',
                     '/api/auth/social/microsoft/callback/'):
            res = self.http.get(path, {'code': 'x', 'state': 'forged'})
            self.assertEqual(res.status_code, 302, path)
            self.assertIn('/login?error=', res['Location'], path)
        mock_http.post.assert_not_called()
        mock_http.get.assert_not_called()


class SocialLoginMFATests(TestCase):
    """Finding 2 — a TOTP-enabled account must get the MFA handshake, not
    immediate JWTs, when signing in socially."""

    def setUp(self):
        self.http = DjangoClient()
        self.user = User.objects.create_user(
            username='victim@example.com', email='victim@example.com',
            password='StrongPass!234xyz',
        )
        UserProfile.objects.create(user=self.user, role='client')
        UserMFA.objects.create(user=self.user, is_enabled=True,
                               totp_secret='JBSWY3DPEHPK3PXP')

    @patch('social_stats.social_auth_views.http_requests')
    def test_mfa_user_gets_handshake_not_tokens(self, mock_http):
        self.http.get('/api/auth/social/google/start/')
        state = self.http.session['social_state']
        mock_http.post.return_value, mock_http.get.return_value = _google_provider_ok()
        res = self.http.get('/api/auth/social/google/callback/',
                            {'code': 'good-code', 'state': state})
        self.assertEqual(res.status_code, 302)
        data = _exchange(res['Location']).data
        self.assertTrue(data['mfa_required'])
        self.assertTrue(data['mfa_token'])
        self.assertNotIn('access', data)
        self.assertNotIn('refresh', data)

    @patch('social_stats.social_auth_views.http_requests')
    def test_handshake_token_completes_via_mfa_login(self, mock_http):
        import pyotp
        self.http.get('/api/auth/social/google/start/')
        state = self.http.session['social_state']
        mock_http.post.return_value, mock_http.get.return_value = _google_provider_ok()
        res = self.http.get('/api/auth/social/google/callback/',
                            {'code': 'good-code', 'state': state})
        mfa_token = _exchange(res['Location']).data['mfa_token']

        api = APIClient()
        verify = api.post('/api/auth/mfa/login/', {
            'mfa_token': mfa_token,
            'code': pyotp.TOTP('JBSWY3DPEHPK3PXP').now(),
            'terms_accepted': True,
        }, format='json')
        self.assertEqual(verify.status_code, 200)
        self.assertIn('access', verify.data)
        self.assertIn('refresh', verify.data)

    @patch('social_stats.social_auth_views.http_requests')
    def test_non_mfa_user_still_gets_tokens_directly(self, mock_http):
        UserMFA.objects.filter(user=self.user).update(is_enabled=False)
        self.http.get('/api/auth/social/google/start/')
        state = self.http.session['social_state']
        mock_http.post.return_value, mock_http.get.return_value = _google_provider_ok()
        res = self.http.get('/api/auth/social/google/callback/',
                            {'code': 'good-code', 'state': state})
        data = _exchange(res['Location']).data
        self.assertIn('access', data)
        self.assertNotIn('mfa_required', data)


class PasswordResetRevocationTests(TestCase):
    """Finding 3 — completing a password reset must kill existing sessions
    and refresh tokens."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='resetme@example.com', email='resetme@example.com',
            password='OldPass!234abcd', is_active=True,
        )
        UserProfile.objects.create(user=self.user, role='client')

    def _reset_password(self):
        token = PasswordResetToken.objects.create(user=self.user)
        api = APIClient()
        res = api.post('/api/auth/password-reset/confirm/', {
            'token': str(token.token),
            'password': 'BrandNew!5678efgh',
        }, format='json')
        self.assertEqual(res.status_code, 200)

    def test_old_refresh_token_is_blacklisted_after_reset(self):
        old_refresh = RefreshToken.for_user(self.user)
        self._reset_password()
        api = APIClient()
        res = api.post('/api/auth/refresh/', {'refresh': str(old_refresh)},
                       format='json')
        self.assertEqual(res.status_code, 401)

    def test_recorded_sessions_are_revoked_after_reset(self):
        refresh = RefreshToken.for_user(self.user)
        record_session(user=self.user, refresh_jti=refresh['jti'],
                       expires_at=timezone.now() + timedelta(days=7))
        self._reset_password()
        session = UserSession.objects.get(user=self.user, refresh_jti=refresh['jti'])
        self.assertIsNotNone(session.revoked_at)
        self.assertEqual(session.revoke_reason, 'password_reset')

    def test_login_with_new_password_still_works_after_reset(self):
        self._reset_password()
        api = APIClient()
        res = api.post('/api/auth/login/', {
            'username': 'resetme@example.com',
            'password': 'BrandNew!5678efgh',
            'terms_accepted': True,
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertIn('access', res.data)


class SocialLoginCodeExchangeTests(TestCase):
    """Finding 4 — JWTs never travel in the redirect URL."""

    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.http = DjangoClient()
        self.api = APIClient()

    def _callback(self, mock_http, email='fresh@example.com'):
        self.http.get('/api/auth/social/google/start/')
        state = self.http.session['social_state']
        mock_http.post.return_value, mock_http.get.return_value = _google_provider_ok(email)
        res = self.http.get('/api/auth/social/google/callback/',
                            {'code': 'good-code', 'state': state})
        self.assertEqual(res.status_code, 302)
        return res['Location']

    @patch('social_stats.social_auth_views.http_requests')
    def test_redirect_carries_only_a_code(self, mock_http):
        location = self._callback(mock_http)
        self.assertTrue(location.startswith('http'))
        self.assertIn('/auth/callback?code=', location)
        for leaked in ('access', 'refresh', 'eyJ'):
            self.assertNotIn(leaked, location)

    @patch('social_stats.social_auth_views.http_requests')
    def test_exchange_returns_working_tokens(self, mock_http):
        res = _exchange(self._callback(mock_http))
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res['Cache-Control'], 'no-store')
        self.api.credentials(HTTP_AUTHORIZATION=f'Bearer {res.data["access"]}')
        me = self.api.get('/api/auth/me/')
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.data['email'], 'fresh@example.com')

    @patch('social_stats.social_auth_views.http_requests')
    def test_code_is_single_use(self, mock_http):
        code = _login_code(self._callback(mock_http))
        first = self.api.post('/api/auth/social/exchange/', {'code': code}, format='json')
        second = self.api.post('/api/auth/social/exchange/', {'code': code}, format='json')
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 400)

    @patch('social_stats.social_auth_views.http_requests')
    def test_code_expires_after_60_seconds(self, mock_http):
        from social_stats import social_auth_views
        with patch.object(social_auth_views.cache, 'set') as mock_set:
            self._callback(mock_http)
        self.assertEqual(mock_set.call_args.kwargs['timeout'], 60)

    def test_unknown_or_malformed_codes_rejected(self):
        for body in ({'code': 'nope'}, {'code': ''}, {}, {'code': 'x' * 500}, {'code': ['a']}):
            with self.subTest(body=body):
                res = self.api.post('/api/auth/social/exchange/', body, format='json')
                self.assertEqual(res.status_code, 400)
