"""
AI Assistant tests. Anthropic SDK is mocked at the helper level so we never
hit the network. Focus is on:
  - tenant guards (client role can't reach another tenant's endpoint)
  - input validation
  - response shape (variants, hashtags, suggestions, translations, calendar)
  - brand voice persists, used by get_brand_voice
  - best-time-to-post uses historical PostMetric data + falls back to defaults
"""
from datetime import datetime, timedelta, timezone as dt_tz
from types import SimpleNamespace
from unittest.mock import patch, MagicMock

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from social_stats.models import (
    Client, UserProfile, PostMetric, BrandVoiceProfile,
    Conversation, Message,
)


def _claude_returning(text: str):
    """Build a fake Anthropic.messages.create result whose .content[0].text == text."""
    msg = MagicMock()
    msg.content = [SimpleNamespace(text=text)]
    return msg


def _client_factory(label='ai'):
    return Client.objects.create(name=label, company=label.title(),
                                  email=f'{label}-{id(object())}@x.test')


def _user_for(client_obj, role='client'):
    import uuid
    u = User.objects.create_user(
        username=f'u-{uuid.uuid4().hex[:12]}', email='u@x.test',
        password='x', is_active=True,
    )
    profile = UserProfile.objects.create(user=u, role=role,
                                          client=client_obj if role == 'client' else None)
    if role == 'staff':
        profile.assigned_clients.add(client_obj)
    return u


def _api_for(user):
    api = APIClient()
    api.force_authenticate(user=user)
    return api


@override_settings(ANTHROPIC_API_KEY='test-key')
class ComposePostTests(TestCase):
    def setUp(self):
        self.client_obj = _client_factory()
        self.user = _user_for(self.client_obj)
        self.api = _api_for(self.user)
        cache.clear()

    @patch('social_stats.ai_views.get_claude')
    def test_compose_returns_variants_per_platform(self, mock_get_claude):
        client = MagicMock()
        client.messages.create.return_value = _claude_returning(
            '{"variants": {"facebook": ["v1", "v2", "v3"], "instagram": ["a", "b", "c"]}}'
        )
        mock_get_claude.return_value = client

        res = self.api.post('/api/ai/compose-post/', {
            'topic': 'launch announcement', 'tone': 'friendly',
            'platforms': ['facebook', 'instagram'],
        }, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.data['variants']['facebook'], ['v1', 'v2', 'v3'])
        self.assertEqual(res.data['variants']['instagram'], ['a', 'b', 'c'])

    @patch('social_stats.ai_views.get_claude')
    def test_compose_caches_repeat_call(self, mock_get_claude):
        client = MagicMock()
        client.messages.create.return_value = _claude_returning(
            '{"variants": {"facebook": ["x", "y", "z"]}}'
        )
        mock_get_claude.return_value = client

        body = {'topic': 'x', 'tone': 'friendly', 'platforms': ['facebook']}
        first = self.api.post('/api/ai/compose-post/', body, format='json')
        second = self.api.post('/api/ai/compose-post/', body, format='json')
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertTrue(second.data['cached'])
        self.assertEqual(client.messages.create.call_count, 1)  # only first hit Claude

    def test_compose_missing_topic_400(self):
        res = self.api.post('/api/ai/compose-post/',
                             {'platforms': ['facebook']}, format='json')
        self.assertEqual(res.status_code, 400)


@override_settings(ANTHROPIC_API_KEY='test-key')
class SuggestHashtagsTests(TestCase):
    def setUp(self):
        self.client_obj = _client_factory('ht')
        self.user = _user_for(self.client_obj)
        self.api = _api_for(self.user)
        cache.clear()

    @patch('social_stats.ai_views.get_claude')
    def test_normalizes_and_caps_hashtags(self, mock_get_claude):
        client = MagicMock()
        client.messages.create.return_value = _claude_returning(
            '{"hashtags": ["startup", "#startup", "marketing", "  growth  ", "GROWTH"]}'
        )
        mock_get_claude.return_value = client

        res = self.api.post('/api/ai/suggest-hashtags/', {
            'content': 'we just launched our marketing tool',
            'platform': 'instagram', 'count': 3,
        }, format='json')
        self.assertEqual(res.status_code, 200)
        # All start with #, deduped (case-insensitive), capped at count=3
        self.assertEqual(res.data['hashtags'], ['#startup', '#marketing', '#growth'])

    def test_content_required(self):
        res = self.api.post('/api/ai/suggest-hashtags/',
                             {'platform': 'instagram'}, format='json')
        self.assertEqual(res.status_code, 400)


class BestTimeToPostTests(TestCase):
    def setUp(self):
        self.client_obj = _client_factory('bt')
        self.user = _user_for(self.client_obj)
        self.api = _api_for(self.user)
        cache.clear()

    def test_falls_back_to_defaults_when_no_history(self):
        res = self.api.post('/api/ai/best-time-to-post/',
                             {'platform': 'instagram'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['source'], 'platform_defaults')
        self.assertEqual(len(res.data['slots']), 3)
        for s in res.data['slots']:
            self.assertIn('label', s)
            self.assertIn('hour', s)
            self.assertIn('day_of_week', s)

    def test_uses_historical_buckets(self):
        # Seed 4 posts: 3 on Wed-12pm with high engagement, 1 on Mon-9am
        wed_12 = datetime(2026, 5, 6, 12, 0, tzinfo=dt_tz.utc)   # Wed
        mon_9  = datetime(2026, 5, 4, 9, 0, tzinfo=dt_tz.utc)    # Mon
        for i in range(3):
            PostMetric.objects.create(
                client=self.client_obj, platform='facebook', post_id=f'p{i}',
                published_at=wed_12, reach=1000, likes=200, comments=50, shares=20,
            )
        PostMetric.objects.create(
            client=self.client_obj, platform='facebook', post_id='lo1',
            published_at=mon_9, reach=10, likes=1, comments=0, shares=0,
        )
        # We need >=2 samples per bucket; mon_9 has only 1, so it should be excluded.
        # Add a second mon_9 sample so it qualifies but ranks below wed_12.
        PostMetric.objects.create(
            client=self.client_obj, platform='facebook', post_id='lo2',
            published_at=mon_9, reach=20, likes=2, comments=1, shares=0,
        )
        res = self.api.post('/api/ai/best-time-to-post/',
                             {'platform': 'facebook'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['source'], 'historical')
        # Top slot should be Wed (day_of_week=2) at hour 12
        top = res.data['slots'][0]
        self.assertEqual(top['day_of_week'], 2)
        self.assertEqual(top['hour'], 12)
        self.assertGreater(top['score'], 0)


@override_settings(ANTHROPIC_API_KEY='test-key')
class SuggestReplyTests(TestCase):
    def setUp(self):
        self.client_obj = _client_factory('rp')
        self.user = _user_for(self.client_obj)
        self.api = _api_for(self.user)
        self.conv = Conversation.objects.create(
            client=self.client_obj, platform='facebook',
            platform_thread_id='post1', type='comment',
        )
        self.in_msg = Message.objects.create(
            conversation=self.conv, direction='inbound',
            author_name='Alice', content='Loved your post!',
            sentiment='positive', sent_at=timezone.now(),
        )
        cache.clear()

    @patch('social_stats.ai_views.get_claude')
    def test_returns_three_suggestions_and_persists_first(self, mock_get_claude):
        c = MagicMock()
        c.messages.create.return_value = _claude_returning(
            '{"suggestions": ["Thanks!", "Glad you liked it 🙌", "Means a lot."]}'
        )
        mock_get_claude.return_value = c

        res = self.api.post('/api/ai/suggest-reply/',
                             {'message_id': self.in_msg.id}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(len(res.data['suggestions']), 3)

        self.in_msg.refresh_from_db()
        self.assertEqual(self.in_msg.ai_suggested_reply, 'Thanks!')

    def test_tenant_isolation(self):
        # Different client + user; that user shouldn't be able to peek at our msg
        other = _client_factory('other')
        other_user = _user_for(other)
        other_api = _api_for(other_user)
        res = other_api.post('/api/ai/suggest-reply/',
                              {'message_id': self.in_msg.id}, format='json')
        self.assertEqual(res.status_code, 403)


@override_settings(ANTHROPIC_API_KEY='test-key')
class RewriteTranslateTests(TestCase):
    def setUp(self):
        self.client_obj = _client_factory('rw')
        self.user = _user_for(self.client_obj)
        self.api = _api_for(self.user)
        cache.clear()

    @patch('social_stats.ai_views.get_claude')
    def test_rewrite_returns_text(self, mock_get_claude):
        c = MagicMock()
        c.messages.create.return_value = _claude_returning('Shorter version here.')
        mock_get_claude.return_value = c

        res = self.api.post('/api/ai/rewrite/', {
            'text': 'A long-winded original message that should be shortened.',
            'instruction': 'shorter',
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['text'], 'Shorter version here.')

    @patch('social_stats.ai_views.get_claude')
    def test_translate_returns_text(self, mock_get_claude):
        c = MagicMock()
        c.messages.create.return_value = _claude_returning('Hola, mundo')
        mock_get_claude.return_value = c

        res = self.api.post('/api/ai/translate/', {
            'text': 'Hello, world',
            'target_language': 'Spanish',
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['text'], 'Hola, mundo')

    def test_translate_validates_inputs(self):
        res = self.api.post('/api/ai/translate/',
                             {'text': 'Hi'}, format='json')
        self.assertEqual(res.status_code, 400)


@override_settings(ANTHROPIC_API_KEY='test-key')
class BrandVoiceTests(TestCase):
    def setUp(self):
        self.client_obj = _client_factory('bv')
        self.user = _user_for(self.client_obj)
        self.api = _api_for(self.user)
        cache.clear()

    @patch('social_stats.ai_views.get_claude')
    def test_train_persists_profile(self, mock_get_claude):
        c = MagicMock()
        c.messages.create.return_value = _claude_returning(
            '{"voice_summary": "Friendly, expert, concise.", '
            ' "tone_descriptors": ["friendly", "expert", "concise"], '
            ' "style_rules": ["use second person", "avoid jargon"], '
            ' "forbidden_words": ["disrupt", "synergize"]}'
        )
        mock_get_claude.return_value = c

        res = self.api.post('/api/ai/train-brand-voice/', {
            'sample_posts': ['Post 1 here', 'Post 2 here', 'Post 3 here'],
        }, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.data['tone_descriptors'], ['friendly', 'expert', 'concise'])

        bv = BrandVoiceProfile.objects.get(client=self.client_obj)
        self.assertEqual(bv.voice_summary, 'Friendly, expert, concise.')
        self.assertEqual(bv.tone_descriptors, ['friendly', 'expert', 'concise'])
        self.assertEqual(bv.forbidden_words, ['disrupt', 'synergize'])
        self.assertEqual(bv.sample_posts, ['Post 1 here', 'Post 2 here', 'Post 3 here'])

    def test_train_requires_three_samples(self):
        res = self.api.post('/api/ai/train-brand-voice/',
                             {'sample_posts': ['just one']}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_get_brand_voice_returns_empty_when_untrained(self):
        res = self.api.get('/api/ai/brand-voice/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['voice_summary'], '')
        self.assertEqual(res.data['tone_descriptors'], [])

    def test_get_brand_voice_returns_saved(self):
        BrandVoiceProfile.objects.create(
            client=self.client_obj,
            voice_summary='ok', tone_descriptors=['warm'],
            sample_posts=['a', 'b', 'c'],
        )
        res = self.api.get('/api/ai/brand-voice/')
        self.assertEqual(res.data['voice_summary'], 'ok')
        self.assertEqual(res.data['sample_count'], 3)


class AIDownTests(TestCase):
    """When ANTHROPIC_API_KEY is unset, every AI endpoint should return 503."""
    def setUp(self):
        self.client_obj = _client_factory('down')
        self.user = _user_for(self.client_obj)
        self.api = _api_for(self.user)
        cache.clear()

    @override_settings(ANTHROPIC_API_KEY='')
    def test_compose_503(self):
        res = self.api.post('/api/ai/compose-post/', {
            'topic': 'x', 'platforms': ['facebook'],
        }, format='json')
        self.assertEqual(res.status_code, 503)
