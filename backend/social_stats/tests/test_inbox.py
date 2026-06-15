"""
Inbox tests.

Covers:
  - Sync tasks create Conversation + Message + UnifiedReview rows correctly
  - Sentiment classifier returns 'unknown' when ANTHROPIC_API_KEY is unset
  - Conversation viewset filters / actions
  - Reply action routes through the right publisher and writes outbound row
  - InboxStats aggregates correctly
"""
from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from social_stats.models import (
    Client, PlatformCredential, UserProfile,
    Conversation, Message, UnifiedReview,
)
from social_stats.publishers import PublishResult
from social_stats import sentiment


def _resp(status=200, json_body=None, *, headers=None):
    m = MagicMock()
    m.status_code = status
    m.headers = headers or {}
    m.json.return_value = json_body if json_body is not None else {}
    m.content = b'{}' if json_body is not None else b''
    m.text = ''
    return m


# ══════════════════════════════════════════════════════════════════════
# Sentiment helper
# ══════════════════════════════════════════════════════════════════════
class SentimentTests(TestCase):
    @override_settings(ANTHROPIC_API_KEY='')
    def test_no_key_returns_unknown(self):
        self.assertEqual(sentiment.classify('This is amazing!'), 'unknown')
        self.assertEqual(sentiment.classify(''), 'unknown')


# ══════════════════════════════════════════════════════════════════════
# Sync tasks
# ══════════════════════════════════════════════════════════════════════
class SyncFacebookInboxTests(TestCase):
    def setUp(self):
        self.client_obj = Client.objects.create(name='Acme', company='Acme Inc',
                                                email=f'acme-{id(self)}@x.test')
        self.cred = PlatformCredential.objects.create(
            client=self.client_obj, platform='facebook',
            access_token='tok', page_id='100', is_active=True,
        )

    @patch('social_stats.inbox_tasks._sentiment.classify', return_value='positive')
    @patch('social_stats.inbox_tasks.requests.get')
    def test_creates_conversation_and_message(self, mock_get, _mock_sent):
        mock_get.return_value = _resp(200, {
            'data': [{
                'id': 'page_post_1',
                'message': 'hi',
                'comments': {'data': [{
                    'id': 'cmt_1',
                    'message': 'great post!',
                    'from': {'name': 'Alice', 'id': '999'},
                    'created_time': '2026-05-07T10:00:00+0000',
                }]},
            }],
        })
        from social_stats.inbox_tasks import sync_facebook_inbox
        n = sync_facebook_inbox(self.client_obj.id)
        self.assertEqual(n, 1)

        conv = Conversation.objects.get(client=self.client_obj, platform='facebook',
                                         platform_thread_id='page_post_1')
        self.assertEqual(conv.unread_count, 1)
        self.assertEqual(conv.contact_name, 'Alice')
        self.assertEqual(conv.sentiment, 'positive')
        msg = conv.messages.first()
        self.assertEqual(msg.content, 'great post!')
        self.assertEqual(msg.direction, 'inbound')
        self.assertEqual(msg.platform_message_id, 'cmt_1')

    @patch('social_stats.inbox_tasks._sentiment.classify', return_value='unknown')
    @patch('social_stats.inbox_tasks.requests.get')
    def test_idempotent_on_repeat(self, mock_get, _mock_sent):
        mock_get.return_value = _resp(200, {
            'data': [{
                'id': 'p1', 'message': 'x',
                'comments': {'data': [{
                    'id': 'cmt_1', 'message': 'wow',
                    'from': {'name': 'B'},
                    'created_time': '2026-05-07T10:00:00+0000',
                }]},
            }],
        })
        from social_stats.inbox_tasks import sync_facebook_inbox
        sync_facebook_inbox(self.client_obj.id)
        sync_facebook_inbox(self.client_obj.id)
        self.assertEqual(Message.objects.count(), 1)
        self.assertEqual(Conversation.objects.get().unread_count, 1)


class SyncGMBReviewsTests(TestCase):
    def setUp(self):
        self.client_obj = Client.objects.create(name='Salon', company='Salon Co',
                                                email=f'salon-{id(self)}@x.test')
        self.cred = PlatformCredential.objects.create(
            client=self.client_obj, platform='google_my_business',
            access_token='gmb-tok', refresh_token='r',
            gmb_account_id='1', gmb_location_id='2',
            is_active=True,
            expires_at=timezone.now() + timedelta(hours=1),
        )

    @patch('social_stats.inbox_tasks._sentiment.classify', return_value='positive')
    @patch('social_stats.inbox_tasks.requests.get')
    def test_creates_unified_review(self, mock_get, _mock_sent):
        mock_get.return_value = _resp(200, {
            'reviews': [{
                'reviewId': 'r-1',
                'reviewer': {'displayName': 'Mia', 'profilePhotoUrl': 'https://x/p.jpg'},
                'starRating': 'FIVE',
                'comment': 'Loved it!',
                'createTime': '2026-05-01T12:00:00Z',
            }],
        })
        from social_stats.inbox_tasks import sync_gmb_reviews_unified
        n = sync_gmb_reviews_unified(self.client_obj.id)
        self.assertEqual(n, 1)
        rv = UnifiedReview.objects.get(client=self.client_obj)
        self.assertEqual(rv.rating, 5)
        self.assertEqual(rv.reviewer_name, 'Mia')
        self.assertEqual(rv.sentiment, 'positive')

    @patch('social_stats.inbox_tasks._sentiment.classify', return_value='unknown')
    @patch('social_stats.inbox_tasks.requests.get')
    def test_picks_up_owner_reply(self, mock_get, _mock_sent):
        # First sync creates the review; second sync attaches the owner reply
        mock_get.side_effect = [
            _resp(200, {'reviews': [{
                'reviewId': 'r-2', 'starRating': 'THREE',
                'comment': 'mid', 'createTime': '2026-05-01T12:00:00Z',
                'reviewer': {'displayName': 'Bob'},
            }]}),
            _resp(200, {'reviews': [{
                'reviewId': 'r-2', 'starRating': 'THREE',
                'comment': 'mid', 'createTime': '2026-05-01T12:00:00Z',
                'reviewer': {'displayName': 'Bob'},
                'reviewReply': {'comment': 'thanks for the feedback', 'updateTime': '2026-05-02T12:00:00Z'},
            }]}),
        ]
        from social_stats.inbox_tasks import sync_gmb_reviews_unified
        sync_gmb_reviews_unified(self.client_obj.id)
        sync_gmb_reviews_unified(self.client_obj.id)

        rv = UnifiedReview.objects.get()
        self.assertEqual(rv.reply_text, 'thanks for the feedback')
        self.assertEqual(rv.status, 'replied')


# ══════════════════════════════════════════════════════════════════════
# Conversation viewset (filtering + actions)
# ══════════════════════════════════════════════════════════════════════
class ConversationAPITests(TestCase):
    def setUp(self):
        self.client_obj = Client.objects.create(name='Acme', company='Acme Inc',
                                                email=f'acme-api-{id(self)}@x.test')
        self.user = User.objects.create_user(username=f'u-{id(self)}', email='u@x.test',
                                              password='x', is_active=True)
        UserProfile.objects.create(user=self.user, role='client', client=self.client_obj)
        self.api = APIClient()
        self.api.force_authenticate(user=self.user)

        # Two conversations — one unread, one resolved
        self.c1 = Conversation.objects.create(
            client=self.client_obj, platform='facebook',
            platform_thread_id='p1', type='comment',
            contact_name='Alice', last_message_preview='hi',
            unread_count=2, sentiment='positive',
            last_message_at=timezone.now(),
        )
        self.c2 = Conversation.objects.create(
            client=self.client_obj, platform='instagram',
            platform_thread_id='p2', type='comment',
            contact_name='Bob', unread_count=0,
            is_resolved=True, sentiment='negative',
            last_message_at=timezone.now() - timedelta(hours=1),
        )
        # An archived conversation that should hide by default
        Conversation.objects.create(
            client=self.client_obj, platform='facebook',
            platform_thread_id='p3', type='comment',
            is_archived=True,
        )

    def test_default_list_excludes_archived(self):
        res = self.api.get('/api/inbox/conversations/')
        self.assertEqual(res.status_code, 200)
        ids = [c['id'] for c in (res.data.get('results') or res.data)]
        self.assertIn(self.c1.id, ids)
        self.assertIn(self.c2.id, ids)
        self.assertEqual(len(ids), 2)

    def test_filter_by_platform(self):
        res = self.api.get('/api/inbox/conversations/?platform=facebook')
        ids = [c['id'] for c in (res.data.get('results') or res.data)]
        self.assertIn(self.c1.id, ids)
        self.assertNotIn(self.c2.id, ids)

    def test_filter_unread(self):
        res = self.api.get('/api/inbox/conversations/?unread=1')
        ids = [c['id'] for c in (res.data.get('results') or res.data)]
        self.assertEqual(ids, [self.c1.id])

    def test_filter_sentiment(self):
        res = self.api.get('/api/inbox/conversations/?sentiment=negative')
        ids = [c['id'] for c in (res.data.get('results') or res.data)]
        self.assertEqual(ids, [self.c2.id])

    def test_mark_read_zeros_unread(self):
        Message.objects.create(
            conversation=self.c1, direction='inbound', content='hi',
            sent_at=timezone.now(),
        )
        res = self.api.post(f'/api/inbox/conversations/{self.c1.id}/mark_read/')
        self.assertEqual(res.status_code, 200)
        self.c1.refresh_from_db()
        self.assertEqual(self.c1.unread_count, 0)
        self.assertIsNotNone(Message.objects.get(conversation=self.c1).read_at)

    def test_archive_and_unarchive(self):
        self.api.post(f'/api/inbox/conversations/{self.c1.id}/archive/')
        self.c1.refresh_from_db(); self.assertTrue(self.c1.is_archived)
        self.api.post(f'/api/inbox/conversations/{self.c1.id}/unarchive/')
        self.c1.refresh_from_db(); self.assertFalse(self.c1.is_archived)


# ══════════════════════════════════════════════════════════════════════
# Reply action — routes through the publisher + writes outbound message
# ══════════════════════════════════════════════════════════════════════
class ReplyActionTests(TestCase):
    def setUp(self):
        self.client_obj = Client.objects.create(name='Acme', company='Acme Inc',
                                                email=f'acme-reply-{id(self)}@x.test')
        PlatformCredential.objects.create(
            client=self.client_obj, platform='facebook',
            access_token='tok', page_id='100', is_active=True,
        )
        self.user = User.objects.create_user(username=f'u-r-{id(self)}',
                                              email='u@x.test', password='x', is_active=True)
        UserProfile.objects.create(user=self.user, role='client', client=self.client_obj)
        self.api = APIClient()
        self.api.force_authenticate(user=self.user)

        self.conv = Conversation.objects.create(
            client=self.client_obj, platform='facebook',
            platform_thread_id='post_42', type='comment',
            contact_name='Alice', last_message_preview='hi',
            unread_count=1, last_message_at=timezone.now(),
        )
        # The inbound comment we'll reply to
        self.in_msg = Message.objects.create(
            conversation=self.conv,
            platform_message_id='cmt_1',
            direction='inbound', author_name='Alice',
            content='thanks!', sent_at=timezone.now(),
        )

    def test_reply_calls_publisher_and_persists_outbound(self):
        with patch('social_stats.publishers.facebook.FacebookPublisher.reply_to_comment',
                   return_value=PublishResult(success=True, platform_post_id='reply-99')) as mock_fn:
            res = self.api.post(f'/api/inbox/conversations/{self.conv.id}/reply/',
                                 {'text': 'You are welcome!'}, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        mock_fn.assert_called_once()
        # The publisher was called with our inbound comment id + the new text
        args, kwargs = mock_fn.call_args
        self.assertEqual(args[1], 'cmt_1')   # comment_id
        self.assertEqual(args[2], 'You are welcome!')

        # Outbound Message persisted with the publisher's returned id
        out = Message.objects.get(conversation=self.conv, direction='outbound')
        self.assertEqual(out.content, 'You are welcome!')
        self.assertEqual(out.platform_message_id, 'reply-99')
        self.assertEqual(out.sent_by, self.user)

    def test_reply_token_expired_disables_credential(self):
        from social_stats.publishers import TokenExpiredError
        with patch('social_stats.publishers.facebook.FacebookPublisher.reply_to_comment',
                   side_effect=TokenExpiredError('expired')):
            res = self.api.post(f'/api/inbox/conversations/{self.conv.id}/reply/',
                                 {'text': 'hi'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['code'], 'token_expired')
        cred = PlatformCredential.objects.get(client=self.client_obj, platform='facebook')
        self.assertFalse(cred.is_active)

    def test_reply_text_required(self):
        res = self.api.post(f'/api/inbox/conversations/{self.conv.id}/reply/',
                             {'text': '   '}, format='json')
        self.assertEqual(res.status_code, 400)


# ══════════════════════════════════════════════════════════════════════
# Inbox stats
# ══════════════════════════════════════════════════════════════════════
class InboxStatsTests(TestCase):
    def setUp(self):
        self.client_obj = Client.objects.create(name='Acme', company='Acme Inc',
                                                email=f'acme-st-{id(self)}@x.test')
        self.user = User.objects.create_user(username=f'u-st-{id(self)}',
                                              email='u@x.test', password='x', is_active=True)
        UserProfile.objects.create(user=self.user, role='client', client=self.client_obj)
        self.api = APIClient()
        self.api.force_authenticate(user=self.user)

    def test_aggregates_unread_by_platform_and_sentiment(self):
        Conversation.objects.create(
            client=self.client_obj, platform='facebook',
            platform_thread_id='a', type='comment',
            unread_count=3, sentiment='positive',
            last_message_at=timezone.now(),
        )
        Conversation.objects.create(
            client=self.client_obj, platform='instagram',
            platform_thread_id='b', type='comment',
            unread_count=1, sentiment='negative',
            last_message_at=timezone.now(),
        )
        Conversation.objects.create(
            client=self.client_obj, platform='facebook',
            platform_thread_id='c', type='comment',
            unread_count=0, sentiment='neutral',
            last_message_at=timezone.now(),
        )

        res = self.api.get('/api/inbox/stats/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['total_unread'], 2)  # number of *threads* with unread > 0
        self.assertEqual(res.data['by_platform']['facebook'], 1)
        self.assertEqual(res.data['by_platform']['instagram'], 1)
        self.assertEqual(res.data['by_sentiment']['positive'], 1)
        self.assertEqual(res.data['by_sentiment']['negative'], 1)
        self.assertEqual(res.data['by_sentiment']['neutral'], 1)
