# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Regression tests for specific bugs fixed during the engineering audit.

1. YouTube inbox `_upsert_yt_comment` raised NameError (undefined `platform`)
   for every NEW comment, so YouTube comments were silently never ingested.
2. Client.is_processing_paused (GDPR/DPDP restrict-processing) was stored
   but never enforced: sync fan-outs still queued paused clients, AI calls
   still ran, and the composer still published.
"""
import uuid
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from social_stats.models import (
    Client, UserProfile, Conversation, Message, PlatformCredential, UnifiedPost,
)


def _client_factory(label, **kw):
    return Client.objects.create(
        name=label, company=label.title(),
        email=f'{label}-{uuid.uuid4().hex[:8]}@x.test', **kw,
    )


def _user_for(client_obj, role='client'):
    u = User.objects.create_user(
        username=f'u-{uuid.uuid4().hex[:12]}', email='u@x.test',
        password='x', is_active=True,
    )
    UserProfile.objects.create(user=u, role=role, client=client_obj)
    return u


class YouTubeInboxUpsertTests(TestCase):
    """`_upsert_yt_comment` must create the Message (used to raise NameError)."""

    def setUp(self):
        self.client_obj = _client_factory('yt')

    @patch('social_stats.inbox_tasks._sentiment.classify', return_value='positive')
    def test_new_comment_is_ingested(self, _mock_sent):
        from social_stats.inbox_tasks import _upsert_yt_comment
        created = _upsert_yt_comment(
            self.client_obj.id, 'thread1', 'comment1',
            {
                'textDisplay': 'Nice video!',
                'authorDisplayName': 'Alice',
                'publishedAt': '2026-08-01T10:00:00Z',
            },
            is_top=True,
        )
        self.assertTrue(created)
        conv = Conversation.objects.get(client=self.client_obj, platform='youtube')
        self.assertEqual(conv.unread_count, 1)
        msg = Message.objects.get(conversation=conv)
        self.assertEqual(msg.content, 'Nice video!')

    @patch('social_stats.inbox_tasks._sentiment.classify', return_value='positive')
    def test_repeat_comment_is_idempotent(self, _mock_sent):
        from social_stats.inbox_tasks import _upsert_yt_comment
        args = (self.client_obj.id, 'thread1', 'comment1',
                {'textDisplay': 'Nice!', 'authorDisplayName': 'A',
                 'publishedAt': '2026-08-01T10:00:00Z'})
        self.assertTrue(_upsert_yt_comment(*args, is_top=True))
        self.assertFalse(_upsert_yt_comment(*args, is_top=True))
        self.assertEqual(Message.objects.count(), 1)


class ProcessingPausedTests(TestCase):
    """Client.is_processing_paused must actually restrict processing."""

    def setUp(self):
        self.paused = _client_factory('paused', is_processing_paused=True)
        self.active = _client_factory('active')
        for c in (self.paused, self.active):
            PlatformCredential.objects.create(
                client=c, platform='facebook', access_token='tok', is_active=True,
            )

    def test_sync_all_skips_paused_clients(self):
        from social_stats import tasks
        with patch.object(tasks.sync_facebook, 'delay') as mock_delay:
            tasks.sync_all('facebook')
        called_ids = [c.args[0] for c in mock_delay.call_args_list]
        self.assertIn(self.active.id, called_ids)
        self.assertNotIn(self.paused.id, called_ids)

    def test_inbox_fanout_skips_paused_clients(self):
        from social_stats import inbox_tasks
        with patch.object(inbox_tasks.sync_facebook_inbox, 'delay') as mock_delay:
            inbox_tasks.sync_inbox_for_all_clients()
        called_ids = [c.args[0] for c in mock_delay.call_args_list]
        self.assertIn(self.active.id, called_ids)
        self.assertNotIn(self.paused.id, called_ids)

    @override_settings(ANTHROPIC_API_KEY='test-key')
    def test_ai_client_refuses_paused_workspace(self):
        from social_stats.ai.client import AIClient, AIError
        ai = AIClient(client=self.paused, feature='test')
        with self.assertRaises(AIError):
            ai.complete('hello')

    def test_composer_create_returns_423(self):
        user = _user_for(self.paused)
        api = APIClient()
        api.force_authenticate(user=user)
        res = api.post('/api/composer/posts/', {
            'content': 'hi', 'target_platforms': ['facebook'],
        }, format='json')
        self.assertEqual(res.status_code, 423)

    def test_composer_publish_now_returns_423(self):
        user = _user_for(self.paused)
        post = UnifiedPost.objects.create(
            client=self.paused, content='x', target_platforms=['facebook'],
        )
        api = APIClient()
        api.force_authenticate(user=user)
        res = api.post(f'/api/composer/posts/{post.id}/publish_now/')
        self.assertEqual(res.status_code, 423)
        post.refresh_from_db()
        self.assertEqual(post.status, 'draft')

    def test_composer_unaffected_for_active_workspace(self):
        user = _user_for(self.active)
        api = APIClient()
        api.force_authenticate(user=user)
        res = api.post('/api/composer/posts/', {
            'client': self.active.id,
            'content': 'hi', 'target_platforms': ['facebook'],
        }, format='json')
        self.assertEqual(res.status_code, 201, res.data)


class WhatsAppInboxPayloadTests(TestCase):
    """The batched inbox rewrite must keep the exact response contract."""

    def setUp(self):
        from django.utils import timezone
        from social_stats.models import WhatsAppMessage
        self.client_obj = _client_factory('wa')
        self.user = _user_for(self.client_obj)
        self.contact = self.client_obj.whatsapp_contacts.create(
            phone='+15550002222', name='Bob', last_message_at=timezone.now(),
        )
        WhatsAppMessage.objects.create(
            client=self.client_obj, contact=self.contact, direction='inbound',
            message_type='text', payload={'text': {'body': 'older'}},
        )
        self.latest = WhatsAppMessage.objects.create(
            client=self.client_obj, contact=self.contact, direction='inbound',
            message_type='text', payload={'text': {'body': 'newest'}},
        )

    def test_inbox_returns_latest_message_and_unread_count(self):
        api = APIClient()
        api.force_authenticate(user=self.user)
        res = api.get('/api/whatsapp/inbox/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data['results']), 1)
        row = res.data['results'][0]
        self.assertEqual(row['unread_count'], 2)
        self.assertEqual(row['last_message']['preview'], 'newest')
        self.assertEqual(row['contact']['id'], self.contact.id)


class OAuthStateValidationTests(TestCase):
    """Callbacks must reject a `state` that doesn't match the one stored in
    the session at /start (OAuth CSRF guard)."""

    def _start_facebook(self, http, client_id):
        return http.get(f'/api/oauth/facebook/start/{client_id}/')

    def test_forged_state_is_rejected(self):
        from django.test import Client as HttpClient
        http = HttpClient()
        res = http.get('/api/oauth/facebook/callback/?code=x&state=1:forged')
        self.assertEqual(res.status_code, 302)
        self.assertIn('error=oauth_state_mismatch', res['Location'])

    def test_matching_state_passes_the_guard(self):
        from unittest.mock import patch
        from django.test import Client as HttpClient
        client_obj = _client_factory('oauthok')
        http = HttpClient()
        start = self._start_facebook(http, client_obj.id)
        self.assertEqual(start.status_code, 302)
        state = http.session['oauth_state']
        # Token exchange fails (no real Meta app) → flow errors AFTER the
        # state guard, proving the guard accepted the genuine state.
        with patch('social_stats.oauth_views.requests.get') as mock_get:
            mock_get.return_value.json.return_value = {'error': {'message': 'bad app'}}
            res = http.get(f'/api/oauth/facebook/callback/?code=x&state={state}')
        self.assertEqual(res.status_code, 302)
        self.assertNotIn('oauth_state_mismatch', res['Location'])

    def test_state_is_single_use(self):
        from django.test import Client as HttpClient
        client_obj = _client_factory('oauthonce')
        http = HttpClient()
        self._start_facebook(http, client_obj.id)
        state = http.session['oauth_state']
        from unittest.mock import patch
        with patch('social_stats.oauth_views.requests.get') as mock_get:
            mock_get.return_value.json.return_value = {'error': {'message': 'x'}}
            http.get(f'/api/oauth/facebook/callback/?code=x&state={state}')
        # Replaying the same state must now fail the guard.
        res = http.get(f'/api/oauth/facebook/callback/?code=x&state={state}')
        self.assertIn('error=oauth_state_mismatch', res['Location'])
